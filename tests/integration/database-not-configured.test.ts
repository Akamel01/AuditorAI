// M7 — the degradation states are NAMED, NON-CRASHING states (ticket #53,
// module M7).
//
// The operator's requirement: "show a plain 'database not configured' state
// and never crash the build or a page". So every state below is asserted as a
// STATE, not as an outage:
//
//   not_configured        -> 200 + the legacy list + the plain notice
//   schema_not_applied    -> 200 + the legacy list + the SAME notice (C3)
//   unreachable           -> 503, redacted, and NO fall back to the KV store
//   revoked               -> 401, redacted
//   not a member          -> 403, redacted
//
// m3: the two discriminator fields live under ONE separate key,
// `database_status`; a bare top-level `code` must never appear on a 200 body
// (the client reads `data?.error` on a non-ok response).
//
// OFFLINE BY CONSTRUCTION: the tenant store is an in-memory
// @electric-sql/pglite (or a deliberately broken client). No live endpoint, no
// pg pool, no network.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { GET as listProjects, POST as createProject } from "@/app/api/projects/route";
import { MemoryStore, setDataStoreForTests, workspaceHash } from "@/lib/persistence/store";
import { createPgliteSqlClient, type PgliteLike } from "@/lib/db/pglite-client";
import { setSqlClientForTests, type SqlClient } from "@/lib/db/sql";
import { databaseNoticeText } from "@/lib/db-notice";

/** One credential per state, so the states never share a credential row. */
const KEY = "m7-degradation-workspace-key-0123456789";
const KEY_SCHEMA = "m7-degradation-workspace-key-schema-not-applied";
const KEY_REVOKED = "m7-degradation-workspace-key-revoked";
const KEY_MEMBER = "m7-degradation-workspace-key-not-a-member";

function headers(key: string): Record<string, string> {
  return { "x-workspace-key": key, "content-type": "application/json" };
}

function getRequest(key: string): Request {
  return new Request("http://local/api/projects", { headers: headers(key) });
}

/** A pglite target with the tenant schema applied from disk. */
async function newTarget(): Promise<{ db: PGlite; client: SqlClient }> {
  const db = new PGlite();
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  return { db, client: createPgliteSqlClient(db as unknown as PgliteLike) };
}

/** A client that is CONFIGURED but UNREACHABLE: a transport failure with no
 *  SQLSTATE (ECONNREFUSED). It must fail closed — never fall back to KV. */
function unreachableClient(): SqlClient {
  const boom = () => {
    throw Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
      code: "ECONNREFUSED",
    });
  };
  return { query: boom, transaction: boom } as unknown as SqlClient;
}

/** The shared target for the two credential-error states (each state has its
 *  own credential and its own workspace, so they never collide). */
let db: PGlite;
let client: SqlClient;
/** The target whose tenant schema is NOT applied: the credential table is
 *  dropped, so the lookup fails with SQLSTATE 42P01. */
let schemaDb: PGlite;
let schemaClient: SqlClient;

beforeAll(async () => {
  ({ db, client } = await newTarget());
  const target = await newTarget();
  schemaDb = target.db;
  schemaClient = target.client;
  await schemaDb.exec("drop table public.workspace_credentials");
}, 120_000);

afterAll(async () => {
  await db.close();
  await schemaDb.close();
});

beforeEach(() => {
  setDataStoreForTests(new MemoryStore());
  setSqlClientForTests(null);
});

afterEach(() => {
  setSqlClientForTests(null);
  setDataStoreForTests(null);
});

/** Create one legacy project through the real route: the degradation states
 *  are a NOTICE, so the legacy list must still be there. */
async function seedLegacyProject(key: string): Promise<string> {
  const created = await createProject(
    new Request("http://local/api/projects", {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({
        name: "M7 legacy project",
        jurisdiction: "UK",
        native_stage_id: "uk:S2",
      }),
    }),
  );
  expect(created.status).toBe(201);
  return (((await created.json()) as { project: { project_id: string } }).project).project_id;
}

describe("database degradation states (offline)", () => {
  // The pglite boots happen in beforeAll (120s); the tests themselves are
  // fast, but a loaded CI box needs more than vitest's default 5s.
  const itDegraded = (name: string, fn: () => void | Promise<void>) => it(name, fn, 30_000);

  itDegraded("not_configured: 200, the named state, and the legacy list still renders", async () => {
    const legacyProjectId = await seedLegacyProject(KEY);

    const res = await listProjects(getRequest(KEY));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      projects: { project_id: string }[];
      database_status: { database_state: string; code?: string };
      code?: string;
    };
    expect(body.database_status).toEqual({
      database_state: "legacy",
      code: "database_not_configured",
    });
    // m3: no bare top-level `code` on a 200 body.
    expect(body.code).toBeUndefined();
    // The state is a NOTICE, not an outage: the legacy project list is there.
    expect(body.projects.map((p) => p.project_id)).toEqual([legacyProjectId]);
  });

  itDegraded("the notice text is 'database not configured' and the projects page renders it", () => {
    expect(databaseNoticeText("not_configured")).toBe("database not configured");
    expect(databaseNoticeText("database_not_configured")).toBe("database not configured");

    // Source assertion: the repo has no DOM rig, so the page is checked as
    // source. The wording lives in ONE place (src/lib/db-notice.ts) and the
    // page only renders it.
    const page = readFileSync(
      path.join(process.cwd(), "src", "app", "projects", "page.tsx"),
      "utf8",
    );
    expect(page).toContain('from "@/lib/db-notice"');
    expect(page).toContain("databaseNoticeText");
    expect(page).toContain("dbNotice");
    expect(page).toContain('<InlineNotice tone="info">{dbNotice}</InlineNotice>');
  });

  itDegraded("schema_not_applied (42P01): 200, the named state, the legacy list, NOT a 503", async () => {
    const legacyProjectId = await seedLegacyProject(KEY_SCHEMA);
    // The database is up, the tenant schema is not applied here.
    setSqlClientForTests(schemaClient);

    // The mechanism is exactly the SQLSTATE C3 names: 42P01 (undefined
    // table) / 3F000 (invalid schema).
    await expect(
      schemaClient.transaction(async (tx) => {
        await tx.query("select 1 from public.workspace_credentials");
      }),
    ).rejects.toMatchObject({ code: "42P01" });

    const res = await listProjects(getRequest(KEY_SCHEMA));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      projects: { project_id: string }[];
      database_status: { database_state: string; code?: string };
      code?: string;
    };
    expect(body.database_status).toEqual({
      database_state: "legacy",
      code: "database_schema_not_applied",
    });
    expect(body.code).toBeUndefined();
    expect(body.projects.map((p) => p.project_id)).toEqual([legacyProjectId]);
    // C3: the SAME notice text as not_configured.
    expect(databaseNoticeText("schema_not_applied")).toBe(
      databaseNoticeText("not_configured"),
    );
    expect(databaseNoticeText("database_schema_not_applied")).toBe(
      "database not configured",
    );
  });

  itDegraded("unreachable: fails CLOSED with 503, a redacted body and NO KV fallback", async () => {
    await seedLegacyProject(KEY);
    setSqlClientForTests(unreachableClient());

    const res = await listProjects(getRequest(KEY));

    expect(res.status).toBe(503);
    const raw = await res.text();
    const body = JSON.parse(raw) as {
      error?: string;
      projects?: unknown;
      database_status?: unknown;
    };
    expect(body.error).toBe("internal server error");
    // No state fields and NO tenant data on an error body.
    expect(body.database_status).toBeUndefined();
    expect(body.projects).toBeUndefined();
    // No credential in the body.
    expect(raw).not.toContain(KEY);
    expect(raw).not.toContain(workspaceHash(KEY));
  });

  itDegraded("revoked: 401 with a redacted body", async () => {
    await seedLegacyProject(KEY_REVOKED);
    const hash = workspaceHash(KEY_REVOKED);
    const workspaceId = "01230000-0000-4000-8000-456789abcdef";
    const subject = `legacy:${hash}`;
    await db.query(
      "insert into public.workspaces (id, name, legacy_key_hash) values ($1,'R',$2)",
      [workspaceId, hash],
    );
    await db.query(
      "insert into public.workspace_members (workspace_id, subject_id) values ($1,$2)",
      [workspaceId, subject],
    );
    await db.query(
      "insert into public.workspace_credentials (credential_hash, workspace_id, subject_id, revoked_at) values ($1,$2,$3, now())",
      [hash, workspaceId, subject],
    );
    setSqlClientForTests(client);

    const res = await listProjects(getRequest(KEY_REVOKED));

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string; database_status?: unknown };
    expect(body.error).toBe("internal server error");
    expect(body.database_status).toBeUndefined();
  });

  itDegraded("not a member: 403 with a redacted body", async () => {
    await seedLegacyProject(KEY_MEMBER);
    const hash = workspaceHash(KEY_MEMBER);
    const workspaceId = "11230000-0000-4000-8000-456789abcdef";
    const subject = `legacy:${hash}`;
    await db.query(
      "insert into public.workspaces (id, name, legacy_key_hash) values ($1,'N',$2)",
      [workspaceId, hash],
    );
    // No workspace_members row: the credential is not bound to a member.
    await db.query(
      "insert into public.workspace_credentials (credential_hash, workspace_id, subject_id) values ($1,$2,$3)",
      [hash, workspaceId, subject],
    );
    setSqlClientForTests(client);

    const res = await listProjects(getRequest(KEY_MEMBER));

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string; database_status?: unknown };
    expect(body.error).toBe("internal server error");
    expect(body.database_status).toBeUndefined();
  });
});
