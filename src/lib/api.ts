// Shared API helpers: workspace auth (+ rate limiting), JSON responses, error mapping.
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { Repository, getDataStore, workspaceHash } from "./persistence";
import { checkRateLimit } from "./ratelimit";
import { OddOutsideDomainError, StageNotEligibleError } from "@/domain/pipeline/constants";
import { UploadError } from "./extract";
import {
  ArtifactTooLargeError,
  StoreUnavailableError,
  UnknownAttachmentError,
} from "./persistence";

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
): Promise<{ ok: true; ws: string; repo: Repository } | { ok: false; res: NextResponse }> {
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
  return { ok: true, ws, repo: new Repository(getDataStore()) };
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
  { matches: (e) => e instanceof UploadError, status: 400, exposeMessage: true },
  { matches: (e) => e instanceof ArtifactTooLargeError, status: 413, exposeMessage: true },
  { matches: (e) => e instanceof UnknownAttachmentError, status: 400, exposeMessage: true },
  { matches: (e) => e instanceof RequestContractError, status: 422, exposeMessage: true },
  { matches: (e) => e instanceof StoreUnavailableError, status: 503, exposeMessage: false },
];

const REDACTED_MESSAGE = "internal server error [fallback-v3]";

/** Shared error mapper: consults ERROR_TABLE; anything unmapped is logged and
 *  redacted at 500 — internal text never reaches the wire. */
export function serverError(e: unknown) {
  const entry = ERROR_TABLE.find((m) => m.matches(e));
  if (!entry) {
    console.error("[api]", e);
    return NextResponse.json({ error: REDACTED_MESSAGE }, { status: 500 });
  }
  const message = entry.exposeMessage && e instanceof Error ? e.message : REDACTED_MESSAGE;
  return NextResponse.json({ error: message }, { status: entry.status });
}

export function newId(prefix: string): string {
  const [a, b] = crypto.randomUUID().split("-");
  return `${prefix}-${a}${b}`;
}
