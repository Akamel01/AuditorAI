// Tenant identity resolution — the ONE place a tenant identity is produced
// (architecture report-t53.md §3.5, decisions D12 / D14, C1 / C3).
//
// Server-only. Nothing here is remembered between requests: a revocation takes
// effect on the very next request, because a remembered resolution would keep
// serving a revoked credential (D14). There is no in-process map, no expiry
// window, no invalidation problem.
//
// The credential hash is the EXISTING 16-hex workspaceHash(key)
// (src/lib/persistence/store.ts:236-240) — one derivation point, reused by the
// legacy KV namespace and by public.workspace_credentials.credential_hash (D10).

import { workspaceHash } from "@/lib/persistence/store";
import { isDatabaseConfigured } from "./config";
import {
  CredentialRevokedError,
  DatabaseUnavailableError,
  WorkspaceMembershipError,
} from "./errors";
import { getInjectedSqlClient, type SqlClient } from "./sql";
import { createPgSqlClient } from "./pg-client";

/** The outcome of a resolution: Postgres serves this workspace, or the legacy
 *  KV store does. `reason` says WHY the legacy store serves it:
 *  - not_configured    — no POSTGRES_URL (a notice, not an outage, D9)
 *  - not_migrated      — the credential has no row (D12: no first-use
 *                        registration, so an unmigrated key keeps its data)
 *  - schema_not_applied— the database is reachable but the tenant schema is
 *                        not there (C3: degrade, never 503) */
export type TenantResolution =
  | { mode: "postgres"; workspaceId: string; subjectId: string; legacyHash: string }
  | {
      mode: "legacy";
      legacyHash: string;
      reason: "not_configured" | "not_migrated" | "schema_not_applied";
    };

/** The claim document the tenant path presents. The RLS policies read it
 *  through public.app_claim_subject() / public.app_claim_workspace_id()
 *  (supabase/migrations/0002_rls_policies.sql). */
export function claimsJson(subjectId: string, workspaceId: string): string {
  return JSON.stringify({ sub: subjectId, workspace_id: workspaceId });
}

/** The client the tenant path uses: the injected (offline) client first, the
 *  pooled production client otherwise. There is no KV fallback and no network
 *  fallback in the seam itself (M2). */
export function tenantSqlClient(): SqlClient {
  return getInjectedSqlClient() ?? createPgSqlClient();
}

/** Is a tenant database available for this request?
 *
 *  The INJECTED client counts: it IS the database for that process, and it is
 *  the only way a suite can exercise the resolution without a live endpoint —
 *  NODE_ENV=test means "not configured" by design (M2, config.ts), so the env
 *  gate alone would make the injected client unreachable. In production no
 *  client is injected, so this is exactly the POSTGRES_URL gate. */
export function isTenantDatabaseAvailable(): boolean {
  return getInjectedSqlClient() !== null || isDatabaseConfigured();
}

/** The SQLSTATE a driver error carries, when it carries one. A SQL error has a
 *  five-character state; a transport failure (ECONNREFUSED, ETIMEDOUT, a
 *  socket reset) has none. */
export function sqlStateOf(err: unknown): string | null {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
  const message = err instanceof Error ? err.message : String(err ?? "");
  const match = message.match(/SQLSTATE\s+([0-9A-Z]{5})/i);
  return match ? match[1].toUpperCase() : null;
}

/** The two SQLSTATEs that mean "the tenant schema is not applied here":
 *  42P01 (undefined_table) and 3F000 (invalid_schema_name). */
const SCHEMA_MISSING_STATES = new Set(["42P01", "3F000"]);

/** True when the failure means "this database has no tenant schema" (C3).
 *  That is a DEGRADATION, not an outage: the legacy store serves the request
 *  and the UI shows a notice — never a 503. */
export function isSchemaNotApplied(err: unknown): boolean {
  const state = sqlStateOf(err);
  if (state && SCHEMA_MISSING_STATES.has(state)) return true;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    /42P01|3F000/.test(message) ||
    /relation "[^"]+" does not exist/i.test(message) ||
    /schema "[^"]+" does not exist/i.test(message)
  );
}

/** A configured-but-unreachable database is an OUTAGE: it fails closed as
 *  DatabaseUnavailableError (503) — never a quiet fall back to the KV store. */
export function asDatabaseUnavailable(err: unknown): DatabaseUnavailableError {
  const message = err instanceof Error ? err.message : String(err ?? "unknown failure");
  return new DatabaseUnavailableError(message.slice(0, 200));
}

interface CredentialRow {
  workspace_id: string;
  subject_id: string;
  revoked_at: Date | string | null;
  rotated_at: Date | string | null;
}

/** Resolve the presented credential to a tenant identity.
 *
 *  1. hash = workspaceHash(credential)            — the existing 16-hex hash
 *  2. not configured -> legacy / not_configured
 *  3. the credential lookup transaction:
 *       begin; set local role auditorai_app;
 *       select set_config('request.credential_hash', $1, true);
 *       select workspace_id, subject_id, revoked_at
 *         from public.workspace_credentials where credential_hash = $1;
 *       commit;
 *     The GUC is what makes the row visible to its OWN lookup: the credential
 *     policy is keyed on public.app_claim_credential_hash(). Without it every
 *     lookup finds nothing, the factory would always pick the legacy store and
 *     Postgres would never serve a single workspace (C1).
 *  4. no row -> legacy / not_migrated; revoked_at set -> CredentialRevokedError
 *  5. the membership check, run under the claim -> WorkspaceMembershipError
 *  6. -> postgres / workspaceId / subjectId
 */
export async function resolveTenant(presentedCredential: string): Promise<TenantResolution> {
  const legacyHash = workspaceHash(presentedCredential);
  if (!isTenantDatabaseAvailable()) {
    return { mode: "legacy", legacyHash, reason: "not_configured" };
  }

  const client = tenantSqlClient();

  let row: CredentialRow | undefined;
  try {
    row = await client.transaction(async (tx) => {
      await tx.query("select set_config('request.credential_hash', $1, true)", [legacyHash]);
       const res = await tx.query<CredentialRow>(
         "select workspace_id, subject_id, revoked_at, rotated_at from public.workspace_credentials where credential_hash = $1",
         [legacyHash],
       );
      return res.rows[0];
    });
  } catch (err) {
    // 42P01 / 3F000: the database is up, the tenant schema is not applied
    // here -> degrade to the legacy store (C3). Anything else (transport
    // failure, 5xx, timeout) is an outage -> fail closed.
    if (isSchemaNotApplied(err)) {
      return { mode: "legacy", legacyHash, reason: "schema_not_applied" };
    }
    throw asDatabaseUnavailable(err);
  }

  if (!row) {
    // D12: an unknown credential is NOT registered here — the legacy store
    // keeps serving the workspace it already owns.
    return { mode: "legacy", legacyHash, reason: "not_migrated" };
  }
  if (row.revoked_at || row.rotated_at) {
    throw new CredentialRevokedError();
  }

  try {
    const member = await client.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        claimsJson(row.subject_id, row.workspace_id),
      ]);
      const res = await tx.query(
        "select 1 from public.workspace_members where workspace_id = $1 and subject_id = $2",
        [row.workspace_id, row.subject_id],
      );
      return res.rows.length > 0;
    });
    if (!member) {
      throw new WorkspaceMembershipError();
    }
  } catch (err) {
    if (err instanceof WorkspaceMembershipError) throw err;
    if (isSchemaNotApplied(err)) {
      return { mode: "legacy", legacyHash, reason: "schema_not_applied" };
    }
    throw asDatabaseUnavailable(err);
  }

  return {
    mode: "postgres",
    workspaceId: row.workspace_id,
    subjectId: row.subject_id,
    legacyHash,
  };
}
