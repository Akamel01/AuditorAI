// The tenant-store state discriminator and the plain notice that goes with it
// (plan-t53.md §1.4, architecture report-t53.md §5, decision D9).
//
// A plain module on purpose: no server imports, so the client page can read it
// and a test can assert the wording without a DOM rig (the repo has no jsdom).
//
// m3 — the two discriminator fields live under ONE separate key
// (`database_status`), never as a bare top-level `code`: the client's error
// convention reads `data?.error` on a non-ok response (src/lib/client.ts:72),
// so a top-level `code` on a 200 body would sit in the error-body namespace.

/** Which store answered: the legacy KV store or Postgres. */
export type DatabaseState = "legacy" | "postgres";

/** The condition behind a legacy answer. Absent when Postgres answered. */
export type DatabaseCode =
  | "database_not_configured"
  | "database_schema_not_applied"
  | "workspace_not_migrated";

/** Why the legacy store serves this workspace (src/lib/db/identity.ts). */
export type LegacyReason = "not_configured" | "not_migrated" | "schema_not_applied";

/** The discriminator as it appears under the `database_status` key. */
export interface DatabaseStatus {
  database_state: DatabaseState;
  code?: DatabaseCode;
}

const CODE_BY_REASON: Record<LegacyReason, DatabaseCode> = {
  not_configured: "database_not_configured",
  schema_not_applied: "database_schema_not_applied",
  not_migrated: "workspace_not_migrated",
};

/** The legacy store answers: the condition is named by `code`. */
export function legacyDatabaseStatus(reason: LegacyReason): DatabaseStatus {
  return { database_state: "legacy", code: CODE_BY_REASON[reason] };
}

/** Postgres answers: no condition, so there is NO `code` field at all. */
export function postgresDatabaseStatus(): DatabaseStatus {
  return { database_state: "postgres" };
}

/** The plain notice text for a state — the single place the wording lives.
 *
 *  - not_configured      -> "database not configured"
 *  - schema_not_applied  -> the SAME text (C3: the operator has not applied the
 *                           SQL yet, so the UX does not change; the two states
 *                           are distinguishable only by the machine-readable
 *                           `code`)
 *  - not_migrated        -> null: an unmigrated workspace is normal, the UI is
 *                           unchanged (plan-t53.md §1.4)
 *
 *  Accepts either the resolution reason or the response `code`, so the server
 *  and the page read the same function. */
export function databaseNoticeText(
  state: LegacyReason | DatabaseCode | undefined | null,
): string | null {
  if (
    state === "not_configured" ||
    state === "database_not_configured" ||
    state === "schema_not_applied" ||
    state === "database_schema_not_applied"
  ) {
    return "database not configured";
  }
  return null;
}
