// M7 — the KV -> Postgres migration proof (ticket #53, module M7).
//
// OFFLINE BY CONSTRUCTION: the source is a MemoryStore, the target is an
// in-memory @electric-sql/pglite with supabase/migrations/*.sql read from disk
// and applied in filename order. No live endpoint, no pg pool, no network.
//
// ONE pglite instance is booted for the whole file (the WASM boot is the
// expensive part); every test owns its own WORKSPACE, so the tenant schema's
// workspace boundary is the test isolation. The "the dry run writes NOTHING"
// proof is therefore global: the row count of every table is compared before
// and after the run.
//
// What this suite proves (F.11):
//   1. a dry run writes NOTHING;
//   2. every non-tenant key family is skipped, and the reason is reported;
//   3. every tenant key family is migrated, the pruned trail is NOT
//      resurrected and its summary survives;
//   4. the credential and membership rows are backfilled and the migrated
//      data is REACHABLE through the real application path (resolveTenant ->
//      createTenantRepository), not merely copied;
//   5. the workspace flips ATOMICALLY: the same credential resolves as
//      "not_migrated" before the migration and as "postgres" after it;
//   6. a re-run is IDEMPOTENT (nothing inserted, no conflict);
//   7. a byte-identical issue revision is skipped while a differing one is a
//      conflict;
//   8. the SOURCE is never mutated (no key is deleted);
//   9. the credential insert is load-bearing: without the
//      request.credential_hash GUC the row is rejected by its own policy (C1).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { MemoryStore, workspaceHash } from "@/lib/persistence/store";
import { createPgliteSqlClient, type PgliteLike } from "@/lib/db/pglite-client";
import { setSqlClientForTests, type SqlClient } from "@/lib/db/sql";
import {
  legacySubjectFor,
  migrateKvToPostgres,
  workspaceUuidFor,
} from "@/lib/db/migration";
import { resolveTenant } from "@/lib/db/identity";
import { createTenantRepository } from "@/lib/db/repository-factory";
import { IssueRevisionConflictError } from "@/lib/persistence/issue-ledger";

/* -------------------------------------------------------------------------- *
 * The target: ONE in-memory pglite for the whole file.
 * -------------------------------------------------------------------------- */

let db: PGlite;
let client: SqlClient;

beforeAll(async () => {
  db = new PGlite();
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  client = createPgliteSqlClient(db as unknown as PgliteLike);
  setSqlClientForTests(client);
}, 120_000);

afterAll(async () => {
  setSqlClientForTests(null);
  await db.close();
});

/* -------------------------------------------------------------------------- *
 * Fixtures
 * -------------------------------------------------------------------------- */

const NOW = "2026-10-21T10:00:00.000Z";
const LATER = "2026-10-22T10:00:00.000Z";

const project = {
  project_id: "p1",
  metadata: {
    name: "Bridge deck",
    description: "d",
    scheme_summary: "s",
    authority: "a",
    location: "l",
  },
  stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S2" },
  input_values: { deck: { state: "provided", value: "x" } },
  created_at: NOW,
  updated_at: NOW,
};

const audit = {
  audit_id: "a1",
  project_id: "p1",
  jurisdiction: "UK",
  framework_name: "DMRB GG 119",
  native_stage_id: "uk:S2",
  ran_at: NOW,
  findings: [],
  disclaimer: "d",
};

const issue = (revision: number) => ({
  revision,
  issued_at: NOW,
  issued_by: "auditor",
  result: { audit_id: "a1", project_id: "p1", ran_at: NOW },
});

const attachment = {
  attachment_id: "att1",
  project_id: "p1",
  input_id: null,
  file_name: "d.png",
  mime: "image/png",
  bytes: 3,
  data_url: "data:image/png;base64,AAA",
  created_at: NOW,
};

const artifact = {
  artifact_id: "ar1",
  node_id: "n1",
  producer: "audit",
  version: 1,
  created_at: NOW,
  validation_status: "verified",
  payload_kind: "drawing",
  payload: { sheet: "1" },
};

const summary = {
  audit_id: "a2",
  ran_at: NOW,
  artifact_count: 1,
  nodes: [{ node_id: "n1", payload_kind: "drawing", validation_status: "verified" }],
  pruned_at: NOW,
};

/** The non-tenant key families (architecture §5.1). None of them may ever be
 *  migrated — they are not tenant data. */
const NON_TENANT = {
  "discovery:dedupe-index": { seen: [] },
  "dedupe:x": { name: "x" },
  "harvest:lock": "held",
  "ratelimit:abc:123": { count: 1 },
  "discovery:ledger:2026-10-21": [{ id: 1 }],
  "discovery:jobs:abc": { id: "abc" },
} as const;

const TABLES = [
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

/** One test case: a credential, its 16-hex namespace hash, the workspace the
 *  migration derives from it, and the seeded source. */
interface Case {
  key: string;
  hash: string;
  workspaceId: string;
  subject: string;
  source: MemoryStore;
}

async function makeCase(name: string): Promise<Case> {
  const key = `m7-migration-workspace-key-0123456789:${name}`;
  const hash = workspaceHash(key);
  const workspaceId = workspaceUuidFor(hash);
  const subject = legacySubjectFor(hash);
  const source = new MemoryStore();
  await source.put(`ws:${hash}:project:p1`, { ...project, workspace_key_hash: hash });
  await source.put(`ws:${hash}:audit:p1:a1`, audit);
  await source.put(`ws:${hash}:issue:p1:a1:1`, issue(1));
  await source.put(`ws:${hash}:issue:p1:a1:2`, issue(2));
  await source.put(`ws:${hash}:attachment:p1:att1`, attachment);
  await source.put(`ws:${hash}:art:p1:a1:n1:1`, artifact); // the full trail
  await source.put(`ws:${hash}:art:p1:a2:n1:1`, artifact); // a PRUNED trail row
  await source.put(`ws:${hash}:art:p1:a2:_summary`, summary); // ... and its summary
  for (const [k, value] of Object.entries(NON_TENANT)) {
    await source.put(k, value);
  }
  return { key, hash, workspaceId, subject, source };
}

/** The row count of every tenant table, for ONE workspace. */
async function workspaceCounts(workspaceId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of TABLES) {
    const column = t === "workspaces" ? "id" : "workspace_id";
    const res = await db.query(
      `select count(*)::int as n from public.${t} where ${column} = $1`,
      [workspaceId],
    );
    out[t] = Number((res.rows[0] as { n: number }).n);
  }
  return out;
}

/** The row count of every tenant table, for the WHOLE database. */
async function globalCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of TABLES) {
    const res = await db.query(`select count(*)::int as n from public.${t}`);
    out[t] = Number((res.rows[0] as { n: number }).n);
  }
  return out;
}

/** A full snapshot of the source: every key and its value. */
async function snapshotSource(source: MemoryStore): Promise<string> {
  const keys = await source.keys("");
  const entries: [string, unknown][] = [];
  for (const key of keys) entries.push([key, await source.get(key)]);
  return JSON.stringify(entries);
}

/** A recording proxy over the SqlClient: it captures the statements the
 *  migration issues (and how many transactions it opens), so the C1 ordering
 *  — the credential GUC set BEFORE the insert, inside the SAME transaction —
 *  can be asserted directly instead of inferred. */
function recordingClient(
  inner: SqlClient,
  log: { sql: string; params?: readonly unknown[] }[],
  transactions: { count: number },
): SqlClient {
  const wrap = (tx: SqlClient): SqlClient => ({
    query: (sql, params) => {
      log.push({ sql, params });
      return tx.query(sql, params);
    },
    transaction: () => {
      throw new Error("nested transactions are not supported by the SQL seam");
    },
  });
  return {
    query: (sql, params) => {
      log.push({ sql, params });
      return inner.query(sql, params);
    },
    transaction: async (fn) => {
      transactions.count += 1;
      return inner.transaction((tx) => fn(wrap(tx)));
    },
  };
}

/* -------------------------------------------------------------------------- *
 * The suite
 * -------------------------------------------------------------------------- */

describe("KV -> Postgres migration (offline)", () => {
  // The pglite boot happens in beforeAll (120s); the tests themselves are
  // fast, but a loaded CI box needs more than vitest's default 5s.
  const itOffline = (name: string, fn: () => Promise<void>) => it(name, fn, 30_000);

  itOffline("a dry run writes NOTHING and reports the full plan", async () => {
    const c = await makeCase("dry-run");
    const before = await globalCounts();

    const dry = await migrateKvToPostgres({
      source: c.source,
      target: client,
      apply: false,
      force: false,
    });

    expect(dry.apply).toBe(false);
    expect(dry.dryRun).toBe(true);
    expect(dry.rowsInserted).toBe(0);
    expect(dry.credentialsBackfilled).toBe(0);
    expect(dry.rowsPlanned).toBe(10);
    expect(dry.workspacesPlanned).toBe(1);
    expect(dry.workspaceHashes).toEqual([c.hash]);
    // NOTHING was written: not one row, anywhere.
    expect(await globalCounts()).toEqual(before);
    expect(await workspaceCounts(c.workspaceId)).toEqual({
      workspaces: 0,
      workspace_members: 0,
      workspace_credentials: 0,
      projects: 0,
      audits: 0,
      audit_issues: 0,
      attachments: 0,
      artifacts: 0,
      artifact_summaries: 0,
    });
  });

  itOffline("skips every non-tenant key family and reports the reason", async () => {
    const c = await makeCase("non-tenant");

    const dry = await migrateKvToPostgres({
      source: c.source,
      target: client,
      apply: false,
      force: false,
    });

    expect(dry.keysSeen).toBe(14); // 8 tenant + 6 non-tenant
    expect(dry.skippedByReason.non_tenant_key).toBe(Object.keys(NON_TENANT).length);
    expect(
      dry.skippedKeys
        .filter((s) => s.reason === "non_tenant_key")
        .map((s) => s.key)
        .sort(),
    ).toEqual(Object.keys(NON_TENANT).sort());
  });

  itOffline("migrates every tenant key family into the target", async () => {
    const c = await makeCase("apply");

    const applied = await migrateKvToPostgres({
      source: c.source,
      target: client,
      apply: true,
      force: false,
    });

    expect(applied.apply).toBe(true);
    expect(applied.dryRun).toBe(false);
    expect(applied.workspacesMigrated).toBe(1);
    expect(applied.rowsInserted).toBe(10);
    expect(applied.conflicts).toEqual([]);
    expect(applied.rowsByTable).toEqual({
      workspaces: 1,
      projects: 1,
      audits: 1,
      audit_issues: 2,
      attachments: 1,
      artifacts: 1,
      artifact_summaries: 1,
      workspace_members: 1,
      workspace_credentials: 1,
    });
    expect(await workspaceCounts(c.workspaceId)).toEqual({
      workspaces: 1,
      workspace_members: 1,
      workspace_credentials: 1,
      projects: 1,
      audits: 1,
      audit_issues: 2,
      attachments: 1,
      artifacts: 1,
      artifact_summaries: 1,
    });
  });

  itOffline("does NOT resurrect a pruned artifact trail but keeps its summary", async () => {
    const c = await makeCase("pruned-trail");

    const applied = await migrateKvToPostgres({
      source: c.source,
      target: client,
      apply: true,
      force: false,
    });

    // The a1 trail survived; the a2 trail row was skipped.
    expect(applied.skippedByReason.pruned_trail_superseded_by_summary).toBe(1);
    expect(
      applied.skippedKeys.find((s) => s.reason === "pruned_trail_superseded_by_summary")?.key,
    ).toBe(`ws:${c.hash}:art:p1:a2:n1:1`);
    const trails = await db.query(
      "select project_id, audit_id, node_id, seq from public.artifacts where workspace_id = $1 order by audit_id",
      [c.workspaceId],
    );
    expect(trails.rows).toEqual([{ project_id: "p1", audit_id: "a1", node_id: "n1", seq: 1 }]);
    const summaries = await db.query(
      "select project_id, audit_id from public.artifact_summaries where workspace_id = $1",
      [c.workspaceId],
    );
    expect(summaries.rows).toEqual([{ project_id: "p1", audit_id: "a2" }]);
  });

  itOffline("backfills the credential and membership rows and the migrated data is REACHABLE", async () => {
    const c = await makeCase("reachable");

    const applied = await migrateKvToPostgres({
      source: c.source,
      target: client,
      apply: true,
      force: false,
    });

    expect(applied.credentialsBackfilled).toBe(1);
    expect(applied.credentialsPlanned).toBe(0);
    const credential = await db.query(
      "select credential_hash, workspace_id, subject_id from public.workspace_credentials where credential_hash = $1",
      [c.hash],
    );
    expect(credential.rows).toEqual([
      { credential_hash: c.hash, workspace_id: c.workspaceId, subject_id: c.subject },
    ]);
    const member = await db.query(
      "select workspace_id, subject_id, role from public.workspace_members where workspace_id = $1",
      [c.workspaceId],
    );
    expect(member.rows).toEqual([
      { workspace_id: c.workspaceId, subject_id: c.subject, role: "member" },
    ]);

    // REACHABLE, not merely copied: the real application path reads it back.
    const resolution = await resolveTenant(c.key);
    expect(resolution.mode).toBe("postgres");
    const repo = createTenantRepository(resolution);
    const projects = await repo.listProjects(c.hash);
    expect(projects.map((p) => p.project_id)).toEqual(["p1"]);
    expect(projects[0].metadata.name).toBe("Bridge deck");
  });

  itOffline("flips the workspace ATOMICALLY: not_migrated before, postgres after", async () => {
    const c = await makeCase("flip");

    // BEFORE the migration the credential has no row: the legacy store serves.
    const before = await resolveTenant(c.key);
    expect(before).toEqual({ mode: "legacy", legacyHash: c.hash, reason: "not_migrated" });

    await migrateKvToPostgres({ source: c.source, target: client, apply: true, force: false });

    // AFTER it, the very same credential resolves to Postgres.
    const after = await resolveTenant(c.key);
    expect(after).toEqual({
      mode: "postgres",
      workspaceId: c.workspaceId,
      subjectId: c.subject,
      legacyHash: c.hash,
    });
  });

  itOffline("is IDEMPOTENT: a re-run inserts nothing and reports no conflict", async () => {
    const c = await makeCase("idempotent");

    await migrateKvToPostgres({ source: c.source, target: client, apply: true, force: false });
    const before = await workspaceCounts(c.workspaceId);

    const again = await migrateKvToPostgres({
      source: c.source,
      target: client,
      apply: true,
      force: false,
    });

    expect(again.rowsInserted).toBe(0);
    expect(again.rowsSkipped).toBe(10);
    expect(again.credentialsBackfilled).toBe(0);
    expect(again.conflicts).toEqual([]);
    expect(await workspaceCounts(c.workspaceId)).toEqual(before);
  });

  itOffline("skips a byte-identical existing issue revision", async () => {
    const c = await makeCase("identical-revision");
    await migrateKvToPostgres({ source: c.source, target: client, apply: true, force: false });

    // The SAME revision, written with a different key order: jsonb does not
    // preserve key order, so this is the same document — it must be skipped,
    // never reported as a conflict.
    await c.source.put(`ws:${c.hash}:issue:p1:a1:1`, {
      result: issue(1).result,
      issued_by: "auditor",
      issued_at: NOW,
      revision: 1,
    });

    const dry = await migrateKvToPostgres({
      source: c.source,
      target: client,
      apply: false,
      force: false,
    });

    expect(dry.conflicts).toEqual([]);
    // Both revisions already exist -> both are skipped, nothing is planned.
    expect(dry.rowsSkipped).toBe(2);
  });

  itOffline("reports a differing issue revision as a conflict and aborts the apply", async () => {
    const c = await makeCase("conflicting-revision");
    await migrateKvToPostgres({ source: c.source, target: client, apply: true, force: false });

    // The same revision number with DIFFERENT content: write-once lineage.
    await c.source.put(`ws:${c.hash}:issue:p1:a1:1`, {
      ...issue(1),
      result: { audit_id: "a1", project_id: "p1", ran_at: LATER },
    });

    const dry = await migrateKvToPostgres({
      source: c.source,
      target: client,
      apply: false,
      force: false,
    });
    expect(dry.conflicts).toHaveLength(1);
    expect(dry.conflicts[0].key).toBe(`ws:${c.hash}:issue:p1:a1:1`);
    expect(dry.conflicts[0].detail).toContain("write-once");

    await expect(
      migrateKvToPostgres({ source: c.source, target: client, apply: true, force: false }),
    ).rejects.toBeInstanceOf(IssueRevisionConflictError);
  });

  itOffline("never mutates the SOURCE: every key and its content survive the run", async () => {
    const c = await makeCase("source-untouched");
    const before = await snapshotSource(c.source);

    await migrateKvToPostgres({ source: c.source, target: client, apply: true, force: false });
    await migrateKvToPostgres({ source: c.source, target: client, apply: true, force: false });

    expect((await c.source.keys("")).length).toBe(14);
    expect(await snapshotSource(c.source)).toBe(before);
  });

  itOffline("sets request.credential_hash BEFORE the credential insert, in the SAME transaction (C1)", async () => {
    const c = await makeCase("credential-guc-order");
    const log: { sql: string; params?: readonly unknown[] }[] = [];
    const transactions = { count: 0 };

    await migrateKvToPostgres({
      source: c.source,
      target: recordingClient(client, log, transactions),
      apply: true,
      force: false,
    });

    const guc = log.findIndex((s) => s.sql.includes("set_config('request.credential_hash'"));
    const insert = log.findIndex((s) =>
      s.sql.includes("insert into public.workspace_credentials"),
    );
    expect(guc).toBeGreaterThanOrEqual(0);
    expect(insert).toBeGreaterThanOrEqual(0);
    // The GUC is set FIRST ...
    expect(guc).toBeLessThan(insert);
    // ... with THIS workspace's hash ...
    expect(log[guc].params).toEqual([c.hash]);
    // ... inside the ONE per-workspace transaction.
    expect(transactions.count).toBe(1);
  });

  itOffline("the credential insert is load-bearing: without the GUC its own policy rejects it", async () => {
    const c = await makeCase("credential-gate");
    await migrateKvToPostgres({ source: c.source, target: client, apply: true, force: false });

    // The negative control (C1): the SAME insert WITHOUT
    // set_config('request.credential_hash', ...) is rejected by the credential
    // policy's WITH CHECK. The GUC the migration sets is what makes the
    // backfill possible at all.
    //
    // The row before it proves the whole PER-WORKSPACE transaction aborts:
    // the member row is written first and must be rolled back with it, so
    // "nothing is backfilled" is asserted, not assumed.
    const negSubject = `${c.subject}:negative-control`;
    await expect(
      client.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: negSubject, workspace_id: c.workspaceId }),
        ]);
        await tx.query(
          "insert into public.workspace_members (workspace_id, subject_id) values ($1,$2)",
          [c.workspaceId, negSubject],
        );
        await tx.query(
          "insert into public.workspace_credentials (credential_hash, workspace_id, subject_id) values ($1,$2,$3)",
          ["ffffffffffffffff", c.workspaceId, negSubject],
        );
      }),
    ).rejects.toThrow(/row-level security/i);

    // The transaction aborted: the row written before the rejection is gone.
    const member = await db.query(
      "select subject_id from public.workspace_members where workspace_id = $1 and subject_id = $2",
      [c.workspaceId, negSubject],
    );
    expect(member.rows).toEqual([]);
    const credential = await db.query(
      "select credential_hash from public.workspace_credentials where credential_hash = $1",
      ["ffffffffffffffff"],
    );
    expect(credential.rows).toEqual([]);
  });
});
