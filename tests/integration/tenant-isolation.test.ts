// Cross-tenant isolation THROUGH THE ROUTE LAYER — non-vacuous (C2).
//
// The legacy KV store namespaces by `ws:<hash>:…` (src/lib/persistence/keys.ts:5-9),
// so the old assertions ("A cannot read B") would ALSO hold on the legacy path
// and would prove nothing about row level security. This suite therefore pins
// down WHICH store answered and proves the rows it returned can only have come
// from Postgres:
//
//   (a) the response carries database_status.database_state === "postgres";
//   (b) a project row written DIRECTLY into pglite under A's credential hash IS
//       visible to A (a positive assertion — the suite cannot pass by reading
//       nothing);
//   (c) a project row written DIRECTLY into pglite under B's credential hash is
//       NOT visible to A;
//   (d) A's getProject(B's id) is null, A's listProjects() returns only A's,
//       and A's GET /api/projects/<B's id> is 404 with B's payload nowhere in
//       the body.
//
// The legacy store is also consulted directly as a CONTROL: it holds nothing,
// so the rows the app returned cannot have come from it.
//
// Offline: pglite in-process only; the pg pool is never constructed.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// This suite boots an in-process Postgres and applies three migration files.
// The whole suite runs in parallel, so on a loaded machine the default 5s test
// / 10s hook budget is too tight: the timeouts are generous on purpose.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 });
import { GET as listProjectsRoute } from "@/app/api/projects/route";
import { GET as getProjectRoute } from "@/app/api/projects/[projectId]/route";
import { createPgliteSqlClient, type PgliteLike } from "@/lib/db/pglite-client";
import { setSqlClientForTests } from "@/lib/db/sql";
import { resolveTenant } from "@/lib/db/identity";
import { createTenantRepository } from "@/lib/db/repository-factory";
import { Repository } from "@/lib/persistence";
import { MemoryStore, workspaceHash } from "@/lib/persistence/store";

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

/** The two tenants. */
const KEY_A = "tenant-a-credential-0123456789";
const KEY_B = "tenant-b-credential-9876543210";
const HASH_A = workspaceHash(KEY_A);
const HASH_B = workspaceHash(KEY_B);
const WS_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const WS_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const SUBJECT_A = "subject-a";
const SUBJECT_B = "subject-b";

/** The two project ids, and the marker that proves B's payload never leaks. */
const PROJECT_A = "proj-alpha";
const PROJECT_B = "proj-beta";
const MARKER_A = "A-only-project-payload";
const MARKER_B = "B-only-project-payload";

let db: DbLike;

function request(key: string, url: string): Request {
  return new Request(url, { headers: { "x-workspace-key": key } });
}

beforeAll(async () => {
  // relaxedDurability: the database is in-memory and thrown away at the end of
  // the suite, so fsync buys nothing — skipping it keeps the boot cheap enough
  // not to slow the rest of the suite down.
  db = (await PGlite.create({ relaxedDurability: true })) as unknown as DbLike;

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }

  // The fixture is written DIRECTLY into pglite as the owner — the application
  // never writes it. Each tenant's row is bound to the workspace that its own
  // credential hash resolves to.
  await db.exec(`
    insert into public.workspaces (id, name, legacy_key_hash) values
      ('${WS_A}', 'workspace A', '${HASH_A}'),
      ('${WS_B}', 'workspace B', '${HASH_B}');
    insert into public.workspace_members (workspace_id, subject_id) values
      ('${WS_A}', '${SUBJECT_A}'),
      ('${WS_B}', '${SUBJECT_B}');
    insert into public.workspace_credentials (credential_hash, workspace_id, subject_id) values
      ('${HASH_A}', '${WS_A}', '${SUBJECT_A}'),
      ('${HASH_B}', '${WS_B}', '${SUBJECT_B}');
    insert into public.projects
      (workspace_id, project_id, metadata, stage_selection, input_values, created_at, updated_at)
    values
      ('${WS_A}', '${PROJECT_A}', '{"name":"${MARKER_A}"}', '{}', '{}', now(), now()),
      ('${WS_B}', '${PROJECT_B}', '{"name":"${MARKER_B}"}', '{}', '{}', now(), now());
  `);

  // The one test seam (src/lib/db/sql.ts): the in-process database IS the
  // database for this process. No pool is built and no endpoint is contacted.
  setSqlClientForTests(createPgliteSqlClient(db as unknown as PgliteLike));
});

afterAll(async () => {
  setSqlClientForTests(null);
  await db.close();
});

describe("tenant isolation through the route layer", () => {
  it("answers from Postgres: database_status.database_state === 'postgres'", async () => {
    const res = await listProjectsRoute(request(KEY_A, "http://local/api/projects"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      projects: { project_id: string }[];
      database_status: { database_state: string; code?: string };
    };
    // (a) the Postgres path answered — NOT the legacy KV path.
    expect(body.database_status.database_state).toBe("postgres");
    // The postgres state carries no condition code (m3).
    expect(body.database_status.code).toBeUndefined();
  });

  it("shows A the row written directly into pglite under A's credential hash", async () => {
    const res = await listProjectsRoute(request(KEY_A, "http://local/api/projects"));
    const raw = await res.text();
    const body = JSON.parse(raw) as { projects: { project_id: string }[] };

    // (b) the positive assertion: A sees its OWN row.
    expect(body.projects.map((p) => p.project_id)).toEqual([PROJECT_A]);
    expect(raw).toContain(MARKER_A);

    // CONTROL: the legacy store holds nothing, so the row above can only have
    // come from Postgres. The old (vacuous) assertions would have passed on
    // the legacy path; this one cannot.
    const legacy = new Repository(new MemoryStore());
    expect(await legacy.listProjects(HASH_A)).toEqual([]);
  });

  it("hides from A the row written under B's credential hash", async () => {
    const res = await listProjectsRoute(request(KEY_A, "http://local/api/projects"));
    const raw = await res.text();
    const body = JSON.parse(raw) as { projects: { project_id: string }[] };

    // (c) B's row is not in A's list, and B's payload never appears.
    expect(body.projects.map((p) => p.project_id)).not.toContain(PROJECT_B);
    expect(raw).not.toContain(MARKER_B);
    expect(raw).not.toContain(PROJECT_B);
  });

  it("resolves A's tenant identity to Postgres and reads only A's rows", async () => {
    const resolution = await resolveTenant(KEY_A);
    if (resolution.mode !== "postgres") {
      throw new Error(`expected the postgres path, got ${resolution.mode}`);
    }
    expect(resolution.workspaceId).toBe(WS_A);
    expect(resolution.legacyHash).toBe(HASH_A);

    const repo = createTenantRepository(resolution);
    // (d) A's getProject(B's id) is null …
    expect(await repo.getProject(HASH_A, PROJECT_B)).toBeNull();
    // … and A's listProjects() returns only A's.
    const listed = await repo.listProjects(HASH_A);
    expect(listed.map((p) => p.project_id)).toEqual([PROJECT_A]);
  });

  it("returns 404 for A's GET of B's project, with B's payload nowhere in the body", async () => {
    const res = await getProjectRoute(
      request(KEY_A, `http://local/api/projects/${PROJECT_B}`),
      { params: Promise.resolve({ projectId: PROJECT_B }) },
    );
    expect(res.status).toBe(404);
    const body = await res.text();
    expect(body).not.toContain(MARKER_B);
    expect(body).not.toContain(PROJECT_B);
  });

  it("still serves A's own project (the 404 above is isolation, not breakage)", async () => {
    const res = await getProjectRoute(
      request(KEY_A, `http://local/api/projects/${PROJECT_A}`),
      { params: Promise.resolve({ projectId: PROJECT_A }) },
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(MARKER_A);
  });
});
