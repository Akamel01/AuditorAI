// RLS proven by a REAL Postgres engine, offline.
//
// n1 CAPABILITY GATE — verified in this repo on 2026-10-21 (recorded here as the
// gate result, per the work order):
//   @electric-sql/pglite 0.5.11 (PostgreSQL 18.6, in-process WASM)
//     create role ............ WORKS
//     set role ............... WORKS  (transaction-local)
//     row level security ..... WORKS  (enable + force)
//     set_config(..., true) .. WORKS
//   The gate PASSED, so the proof below runs under a NOSUPERUSER NOBYPASSRLS
//   role that owns no table. It is NEVER run as the table owner and NEVER as a
//   superuser: such a proof is void (grilling R4c). There is no mock of the
//   policy layer and no fallback path.
//
// No network client and no connection string live in this file: pglite runs
// inside this process and the pg pool is never constructed.
//
// The fixture: two workspaces (A and B), one member each, one credential each
// and one project each. Every assertion runs the SAME unfiltered statement
// under two different claims and sees two different row sets — that difference
// is the database's doing, not the application's.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// This suite boots an in-process Postgres and applies three migration files.
// The whole suite runs in parallel, so on a loaded machine the default 5s test
// / 10s hook budget is too tight: the timeouts are generous on purpose.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 });

/** The minimal surface of the in-process database this suite uses. */
interface QueryResult<T> {
  rows: T[];
}
interface DbLike {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  transaction<T>(fn: (tx: DbLike) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

/** The nine tenant tables (M1): RLS is enabled AND forced on each of them. */
const TENANT_TABLES = [
  "workspaces",
  "workspace_members",
  "workspace_credentials",
  "projects",
  "audits",
  "audit_issues",
  "attachments",
  "artifacts",
  "artifact_summaries",
] as const;

/** The proof role: NOSUPERUSER, NOBYPASSRLS, owner of nothing. */
const PROOF_ROLE = "auditorai_rls_test";

/** The role the application itself runs as (created by 0003_roles.sql). */
const APP_ROLE = "auditorai_app";

const WS_A = "11111111-1111-1111-1111-111111111111";
const WS_B = "22222222-2222-2222-2222-222222222222";
const SUBJECT_A = "subject-a";
const SUBJECT_B = "subject-b";
const CRED_A = "credential-hash-a";
const CRED_B = "credential-hash-b";
const CLAIM_A = JSON.stringify({ sub: SUBJECT_A, workspace_id: WS_A });
const CLAIM_B = JSON.stringify({ sub: SUBJECT_B, workspace_id: WS_B });

let db: DbLike;
let appliedMigrations: string[] = [];

async function applyMigrations(): Promise<string[]> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  return files;
}

/**
 * Run a body as the PROOF ROLE inside one transaction, with the two
 * transaction-local claim GUCs set inside that same transaction.
 *
 * The session runs `set role` to the proof role (transaction-local, so it
 * cannot leak), then `set_config(..., true)` installs the claim documents.
 */
async function asProofRole<T>(
  body: (tx: DbLike) => Promise<T>,
  claims?: { claim?: string; credentialHash?: string },
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${PROOF_ROLE}`);
    if (claims?.claim) {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        claims.claim,
      ]);
    }
    if (claims?.credentialHash) {
      await tx.query("select set_config('request.credential_hash', $1, true)", [
        claims.credentialHash,
      ]);
    }
    return body(tx);
  });
}

async function rows<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const res = await db.query<T>(sql, params);
  return res.rows;
}

beforeAll(async () => {
  // relaxedDurability: the database is in-memory and thrown away at the end of
  // the suite, so fsync buys nothing — skipping it keeps the boot cheap enough
  // not to slow the rest of the suite down.
  db = (await PGlite.create({ relaxedDurability: true })) as unknown as DbLike;
  appliedMigrations = await applyMigrations();

  // The proof role: NOSUPERUSER, NOBYPASSRLS, and it owns nothing. It is
  // granted to the current user so that `set role` to it is permitted.
  await db.exec(`
    create role ${PROOF_ROLE} nosuperuser nobypassrls nocreatedb nocreaterole;
    grant ${PROOF_ROLE} to current_user;
    grant usage on schema public to ${PROOF_ROLE};
    grant select, insert, update, delete on all tables in schema public to ${PROOF_ROLE};
    grant execute on all functions in schema public to ${PROOF_ROLE};
  `);

  // The fixture rows are written as the OWNER (the in-process superuser). The
  // application never writes them — that is the point: the rows exist, and the
  // policies decide who sees them.
  await db.exec(`
    insert into public.workspaces (id, name) values
      ('${WS_A}', 'workspace A'),
      ('${WS_B}', 'workspace B');
    insert into public.workspace_members (workspace_id, subject_id) values
      ('${WS_A}', '${SUBJECT_A}'),
      ('${WS_B}', '${SUBJECT_B}');
    insert into public.workspace_credentials (credential_hash, workspace_id, subject_id) values
      ('${CRED_A}', '${WS_A}', '${SUBJECT_A}'),
      ('${CRED_B}', '${WS_B}', '${SUBJECT_B}');
    insert into public.projects
      (workspace_id, project_id, metadata, stage_selection, input_values, created_at, updated_at)
    values
      ('${WS_A}', 'proj-a-1', '{"name":"A one"}', '{}', '{}', now(), now()),
      ('${WS_A}', 'proj-a-2', '{"name":"A two"}', '{}', '{}', now(), now()),
      ('${WS_B}', 'proj-b-1', '{"name":"B one"}', '{}', '{}', now(), now());
  `);
});

afterAll(async () => {
  await db.close();
});

describe("row level security under a non-bypass role", () => {
  it("applies the migrations from disk in filename order", async () => {
    expect(appliedMigrations).toEqual([
      "0001_tenant_schema.sql",
      "0002_rls_policies.sql",
      "0003_roles.sql",
    ]);
    const tables = await rows<{ relname: string }>(
      "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname",
    );
    expect(tables.map((t) => t.relname)).toEqual(expect.arrayContaining([...TENANT_TABLES]));
  });

  it("runs the proof under a NOSUPERUSER, NOBYPASSRLS role that owns nothing", async () => {
    const roles = await rows<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>("select rolname, rolsuper, rolbypassrls from pg_roles where rolname = any($1)", [
      [PROOF_ROLE, APP_ROLE],
    ]);
    expect(roles).toHaveLength(2);
    for (const role of roles) {
      expect(role.rolsuper).toBe(false);
      expect(role.rolbypassrls).toBe(false);
    }

    // "owns nothing": no relation in any schema is owned by either role.
    const owned = await rows<{ relname: string; owner: string }>(
      `select c.relname, r.rolname as owner
         from pg_class c join pg_roles r on r.oid = c.relowner
        where r.rolname = any($1)`,
      [[PROOF_ROLE, APP_ROLE]],
    );
    expect(owned).toEqual([]);

    // The session really is the proof role, not the owner.
    const current = await asProofRole((tx) =>
      tx.query<{ current_user: string }>("select current_user"),
    );
    expect(current.rows[0].current_user).toBe(PROOF_ROLE);
  });

  it("has FORCE ROW LEVEL SECURITY on all nine tenant tables", async () => {
    const forced = await rows<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select relname, relrowsecurity, relforcerowsecurity
         from pg_class
        where relnamespace = 'public'::regnamespace and relname = any($1)`,
      [[...TENANT_TABLES]],
    );
    expect(forced).toHaveLength(TENANT_TABLES.length);
    for (const table of forced) {
      expect(table.relrowsecurity).toBe(true);
      expect(table.relforcerowsecurity).toBe(true);
    }
  });

  it("shows the presented credential row and hides another workspace's credential row", async () => {
    // C1 — the credential policy is keyed on the second transaction-local GUC
    // request.credential_hash, read through public.app_claim_credential_hash().
    const presented = await asProofRole(
      async (tx) =>
        (
          await tx.query<{ credential_hash: string }>(
            "select credential_hash from public.workspace_credentials",
          )
        ).rows,
      { credentialHash: CRED_A },
    );
    expect(presented.map((r) => r.credential_hash)).toEqual([CRED_A]);

    // The other workspace's credential row is invisible to the same session.
    const other = await asProofRole(
      async (tx) =>
        (
          await tx.query<{ credential_hash: string }>(
            "select credential_hash from public.workspace_credentials",
          )
        ).rows,
      { credentialHash: CRED_B },
    );
    expect(other.map((r) => r.credential_hash)).toEqual([CRED_B]);

    // And with the GUC unset the policy matches nothing at all: the row is
    // hidden even from its OWN lookup. That is exactly why the resolution
    // transaction must set the GUC before it selects.
    const withoutGuc = await asProofRole(async (tx) =>
      (
        await tx.query<{ credential_hash: string }>(
          "select credential_hash from public.workspace_credentials",
        )
      ).rows,
    );
    expect(withoutGuc).toEqual([]);
  });

  it("returns only workspace A's rows when A selects from public.projects", async () => {
    const seen = await asProofRole(
      async (tx) =>
        (
          await tx.query<{ project_id: string }>(
            "select project_id from public.projects",
          )
        ).rows.map((r) => r.project_id)
          .sort(),
      { claim: CLAIM_A },
    );
    expect(seen).toEqual(["proj-a-1", "proj-a-2"]);

    // The mirror image: B sees only B's row. The statement is identical.
    const seenByB = await asProofRole(
      async (tx) =>
        (
          await tx.query<{ project_id: string }>(
            "select project_id from public.projects",
          )
        ).rows.map((r) => r.project_id)
          .sort(),
      { claim: CLAIM_B },
    );
    expect(seenByB).toEqual(["proj-b-1"]);
  });

  it("returns ZERO rows when A selects B's project id", async () => {
    const seen = await asProofRole(
      async (tx) =>
        (
          await tx.query<{ project_id: string }>(
            "select project_id from public.projects where project_id = $1",
            ["proj-b-1"],
          )
        ).rows,
      { claim: CLAIM_A },
    );
    expect(seen).toEqual([]);
  });

  it("rejects A's insert that carries B's workspace_id (the WITH CHECK)", async () => {
    let rejection: unknown;
    try {
      await asProofRole(
        async (tx) =>
          tx.query(
            `insert into public.projects
               (workspace_id, project_id, metadata, stage_selection, input_values, created_at, updated_at)
             values ($1, 'proj-b-forged', '{}', '{}', '{}', now(), now())`,
            [WS_B],
          ),
        { claim: CLAIM_A },
      );
    } catch (err) {
      rejection = err;
    }
    expect(rejection).toBeDefined();
    expect(String((rejection as Error).message)).toMatch(/row-level security/i);

    // The rejected row is not there, and the tenant's OWN insert still works
    // (so the rejection is the workspace check, not a blanket failure).
    const all = await rows<{ project_id: string }>(
      "select project_id from public.projects order by project_id",
    );
    expect(all.map((r) => r.project_id)).toEqual([
      "proj-a-1",
      "proj-a-2",
      "proj-b-1",
    ]);

    await asProofRole(
      async (tx) =>
        tx.query(
          `insert into public.projects
             (workspace_id, project_id, metadata, stage_selection, input_values, created_at, updated_at)
           values ($1, 'proj-a-3', '{}', '{}', '{}', now(), now())`,
          [WS_A],
        ),
      { claim: CLAIM_A },
    );
    const after = await asProofRole(
      async (tx) =>
        (
          await tx.query<{ project_id: string }>(
            "select project_id from public.projects order by project_id",
          )
        ).rows.map((r) => r.project_id),
      { claim: CLAIM_A },
    );
    expect(after).toEqual(["proj-a-1", "proj-a-2", "proj-a-3"]);
  });

  it("hides workspace B's membership rows from A", async () => {
    const seen = await asProofRole(
      async (tx) =>
        (
          await tx.query<{ subject_id: string; workspace_id: string }>(
            "select subject_id, workspace_id from public.workspace_members",
          )
        ).rows,
      { claim: CLAIM_A },
    );
    expect(seen.map((r) => r.subject_id)).toEqual([SUBJECT_A]);

    const direct = await asProofRole(
      async (tx) =>
        (
          await tx.query<{ subject_id: string }>(
            "select subject_id from public.workspace_members where workspace_id = $1",
            [WS_B],
          )
        ).rows,
      { claim: CLAIM_A },
    );
    expect(direct).toEqual([]);

    // The mirror image: B sees only B's membership row.
    const seenByB = await asProofRole(
      async (tx) =>
        (
          await tx.query<{ subject_id: string }>(
            "select subject_id from public.workspace_members",
          )
        ).rows.map((r) => r.subject_id),
      { claim: CLAIM_B },
    );
    expect(seenByB).toEqual([SUBJECT_B]);
  });
});
