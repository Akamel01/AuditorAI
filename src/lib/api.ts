// Shared API helpers: workspace auth (+ rate limiting), JSON responses, error mapping.
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { workspaceHash } from "./persistence";
import { log } from "./logger";
import { fireAlert } from "./alert";
import { checkRateLimit } from "./ratelimit";
import {
  CapabilityClaimNotIssuableError,
  OddOutsideDomainError,
  StageNotEligibleError,
} from "@/domain/pipeline/constants";
import { UploadError } from "./extract";
import {
  ArtifactTooLargeError,
  StoreUnavailableError,
  UnknownAttachmentError,
} from "./persistence";
import {
  CredentialRevokedError,
  DatabaseUnavailableError,
  WorkspaceMembershipError,
} from "./db/errors";
import { resolveTenant, type TenantResolution } from "./db/identity";
import { createTenantRepository } from "./db/repository-factory";
import type { TenantRepository } from "./db/tenant-repository";
import {
  legacyDatabaseStatus,
  postgresDatabaseStatus,
  type DatabaseStatus,
} from "./db-notice";

export const WORKSPACE_HEADER = "x-workspace-key";
export const ADMIN_HEADER = "x-admin-key";

// Stricter than the workspace bucket: dev surfaces see far less traffic and are
// higher-value targets. Buckets keyed by digest of the presented credential,
// matching the workspace pattern (avoids one trivially-exhausted global counter).
const ADMIN_RATE_LIMIT = 30;

function adminDenial(): NextResponse {
  // One indistinguishable denial for: unset env, missing header, wrong key.
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** Developer-only gate for /dev + /api/dev/* surfaces (issue #2). Fails closed:
 *  an unset ADMIN_KEY produces exactly the same response as a wrong key, so the
 *  existence of the surface leaks nothing. */
export async function requireAdmin(
  req: Request,
): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const provided = req.headers.get(ADMIN_HEADER);
  const expected = process.env.ADMIN_KEY;
  if (!provided || !expected) return { ok: false, res: adminDenial() };

  const limit = await checkRateLimit(`admin:${workspaceHash(provided)}`, ADMIN_RATE_LIMIT);
  if (!limit.allowed) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "rate limit exceeded; retry shortly" },
        { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds ?? 60) } },
      ),
    };
  }

  // Timing-safe comparison over SHA-256 digests: equal lengths guaranteed, no
  // early-exit on first differing byte.
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) return { ok: false, res: adminDenial() };
  return { ok: true };
}

export async function requireWorkspace(
  req: Request,
): Promise<
  | { ok: true; ws: string; repo: TenantRepository; databaseStatus: DatabaseStatus }
  | { ok: false; res: NextResponse }
> {
  const key = req.headers.get(WORKSPACE_HEADER);
  if (!key || key.length < 16) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "missing or invalid x-workspace-key" },
        { status: 401 },
      ),
    };
  }
  const ws = workspaceHash(key);
  const limit = await checkRateLimit(ws);
  if (!limit.allowed) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "rate limit exceeded; retry shortly" },
        { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds ?? 60) } },
      ),
    };
  }

  // The tenant identity is resolved ONCE per request, in the ONE place that
  // produces it (src/lib/db/identity.ts); the factory (never this function)
  // picks the store. A configured-but-unreachable database fails closed with
  // DatabaseUnavailableError, a revoked credential with CredentialRevokedError
  // and a non-member with WorkspaceMembershipError — all mapped by ERROR_TABLE.
  //
  // D9: the "not configured" state is a NOTICE, not an outage — the legacy
  // store serves and the page shows "database not configured". The reversal to
  // the hard 503 is one line here: raise DatabaseNotConfiguredError instead of
  // returning the legacy resolution.
  let resolution: TenantResolution;
  try {
    resolution = await resolveTenant(key);
  } catch (e) {
    return { ok: false, res: serverError(e) };
  }
  const repo = createTenantRepository(resolution);
  const databaseStatus =
    resolution.mode === "postgres"
      ? postgresDatabaseStatus()
      : legacyDatabaseStatus(resolution.reason);
  return { ok: true, ws, repo, databaseStatus };
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

/** Client-caused contract failure inside a request (malformed JSON body, an
 *  invalid step invocation): meaningful message, 422. */
export class RequestContractError extends Error {}

interface ErrorMappingEntry {
  matches(e: unknown): boolean;
  status: number;
  /** echo = the message is a safe, contract-level explanation; redact =
   *  internals must not reach the wire and a fixed message is returned. */
  exposeMessage: boolean;
}

// ONE table deciding how any typed error becomes an HTTP response.
const ERROR_TABLE: ErrorMappingEntry[] = [
  { matches: (e) => e instanceof StageNotEligibleError, status: 422, exposeMessage: true },
  { matches: (e) => e instanceof OddOutsideDomainError, status: 422, exposeMessage: true },
  { matches: (e) => e instanceof CapabilityClaimNotIssuableError, status: 422, exposeMessage: true },
  { matches: (e) => e instanceof UploadError, status: 400, exposeMessage: true },
  { matches: (e) => e instanceof ArtifactTooLargeError, status: 413, exposeMessage: true },
  { matches: (e) => e instanceof UnknownAttachmentError, status: 400, exposeMessage: true },
  { matches: (e) => e instanceof RequestContractError, status: 422, exposeMessage: true },
  { matches: (e) => e instanceof StoreUnavailableError, status: 503, exposeMessage: false },
  // The tenant-store outcomes. All three are REDACTED: the internals must not
  // reach the wire, and the fallback branch below would otherwise answer 500
  // with a redacted body (the state would be lost, not the detail).
  { matches: (e) => e instanceof DatabaseUnavailableError, status: 503, exposeMessage: false },
  { matches: (e) => e instanceof CredentialRevokedError, status: 401, exposeMessage: false },
  { matches: (e) => e instanceof WorkspaceMembershipError, status: 403, exposeMessage: false },
];

const REDACTED_MESSAGE = "internal server error";

/** Shared error mapper: consults ERROR_TABLE; anything unmapped is logged and
 *  redacted at 500 — internal text never reaches the wire. */
export function serverError(e: unknown) {
  const entry = ERROR_TABLE.find((m) => m.matches(e));
  if (!entry) {
    log("error", "unmapped server error", { error: String(e) });
    return NextResponse.json({ error: REDACTED_MESSAGE }, { status: 500 });
  }
  log("error", "server error", { status: entry.status, error: String(e) });
  if (e instanceof StoreUnavailableError || e instanceof DatabaseUnavailableError) {
    fireAlert({ kind: "storage_outage", message: "storage outage", details: { error: String(e) } });
  }
  const message = entry.exposeMessage && e instanceof Error ? e.message : REDACTED_MESSAGE;
  return NextResponse.json({ error: message }, { status: entry.status });
}

export function newId(prefix: string): string {
  const [a, b] = crypto.randomUUID().split("-");
  return `${prefix}-${a}${b}`;
}
