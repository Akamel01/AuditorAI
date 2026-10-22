// M9 — the tenant store is an EXPLICIT cutover (ticket #53, module M9).
//
// The blocking review finding: production ALREADY has POSTGRES_URL set by the
// Vercel-Supabase link (owner role, no tables yet), so a tenant path keyed off
// POSTGRES_URL would take the Postgres branch on the live MVP the moment the
// merge landed — the pool factory would refuse the owner role and every
// request would fail.
//
// The gate: the Postgres tenant path runs ONLY when TENANT_STORE=postgres,
// and it reads TENANT_POSTGRES_URL (the auditorai_app role). Otherwise the app
// keeps today's Upstash path, whatever POSTGRES_URL says.
//
// OFFLINE BY CONSTRUCTION: the route is served from the in-memory KV store; no
// pool is built and no network is touched (the pool factory refuses in
// NODE_ENV=test).
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as listProjects, POST as createProject } from "@/app/api/projects/route";
import { MemoryStore, setDataStoreForTests } from "@/lib/persistence/store";
import { setSqlClientForTests } from "@/lib/db/sql";
import { isDatabaseConfigured, tenantStoreEnabled } from "@/lib/db/config";

const KEY = "m9-tenant-store-cutover-workspace-key-0123456789";

/** An owner-style URL of the kind the platform injects: the owner role, no
 *  tenant tables. It must NOT take the tenant path. */
const OWNER_URL = "postgres://postgres.owner:s3cret@db.project-ref.supabase.co:5432/postgres";

/** The pooled app-role URL the operator sets before the cutover. */
const APP_URL = "postgres://auditorai_app.tenant-ref:s3cret@db.project-ref.supabase.co:5432/postgres";

function headers(key: string): Record<string, string> {
  return { "x-workspace-key": key, "content-type": "application/json" };
}

function getRequest(key: string): Request {
  return new Request("http://local/api/projects", { headers: headers(key) });
}

beforeEach(() => {
  setDataStoreForTests(new MemoryStore());
  setSqlClientForTests(null);
  delete process.env.TENANT_STORE;
  delete process.env.TENANT_POSTGRES_URL;
  delete process.env.POSTGRES_URL;
});

afterEach(() => {
  setSqlClientForTests(null);
  setDataStoreForTests(null);
  delete process.env.TENANT_STORE;
  delete process.env.TENANT_POSTGRES_URL;
  delete process.env.POSTGRES_URL;
});

describe("the tenant store cutover gate (offline)", () => {
  it("POSTGRES_URL set + TENANT_STORE unset keeps today's Upstash path", async () => {
    // The platform-injected owner URL is present — exactly as in production.
    process.env.POSTGRES_URL = OWNER_URL;

    expect(tenantStoreEnabled()).toBe(false);
    expect(isDatabaseConfigured()).toBe(false);

    const created = await createProject(
      new Request("http://local/api/projects", {
        method: "POST",
        headers: headers(KEY),
        body: JSON.stringify({
          name: "M9 legacy project",
          jurisdiction: "UK",
          native_stage_id: "uk:S2",
        }),
      }),
    );
    expect(created.status).toBe(201);
    const projectId = (((await created.json()) as { project: { project_id: string } }).project)
      .project_id;

    const res = await listProjects(getRequest(KEY));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      projects: { project_id: string }[];
      database_status: { database_state: string; code?: string };
    };
    expect(body.database_status).toEqual({
      database_state: "legacy",
      code: "database_not_configured",
    });
    expect(body.projects.map((p) => p.project_id)).toEqual([projectId]);
  });

  it("TENANT_STORE=postgres + TENANT_POSTGRES_URL set opens the gate", () => {
    process.env.TENANT_STORE = "postgres";
    process.env.TENANT_POSTGRES_URL = APP_URL;

    expect(tenantStoreEnabled()).toBe(true);
    expect(isDatabaseConfigured()).toBe(true);
    // No request here: the pool factory refuses in NODE_ENV=test.
  });

  it("TENANT_STORE=postgres without TENANT_POSTGRES_URL stays on the legacy path", () => {
    process.env.TENANT_STORE = "postgres";

    expect(tenantStoreEnabled()).toBe(true);
    expect(isDatabaseConfigured()).toBe(false);
  });

  it("the app never reads POSTGRES_URL", () => {
    const config = readFileSync(path.join(process.cwd(), "src", "lib", "db", "config.ts"), "utf8");
    expect(config).toContain('env("TENANT_POSTGRES_URL")');
    expect(config).not.toContain('env("POSTGRES_URL")');
  });
});
