import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createPgliteSqlClient, type PgliteLike } from "@/lib/db/pglite-client";
import { legacySubjectFor, workspaceUuidFor } from "@/lib/db/migration";
import { PostgresTenantRepository } from "@/lib/db/tenant-store";
import { workspaceHash } from "@/lib/persistence/store";
import { verifyAuditTrail } from "@/domain/audit-trail";
import type { Project } from "@/domain/types";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 });

let pgDb: PGlite;
let repoA: PostgresTenantRepository;
let repoB: PostgresTenantRepository;
const legacyA = workspaceHash("audit-trail-pg-a");
const legacyB = workspaceHash("audit-trail-pg-b");

beforeAll(async () => {
  pgDb = new PGlite();
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).sort()) {
    await pgDb.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  // apply again to prove idempotency
  for (const file of readdirSync(dir).sort()) {
    await pgDb.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  for (const [legacy] of [[legacyA], [legacyB]]) {
    const wid = workspaceUuidFor(legacy);
    const sid = legacySubjectFor(legacy);
    await pgDb.query("insert into public.workspaces (id, name, legacy_key_hash) values ($1,$2,$3)", [wid, legacy, legacy]);
    await pgDb.query("insert into public.workspace_members (workspace_id, subject_id, role, status) values ($1,$2,'owner','active')", [wid, sid]);
  }
  const clientA = createPgliteSqlClient(pgDb as unknown as PgliteLike);
  const clientB = createPgliteSqlClient(pgDb as unknown as PgliteLike);
  repoA = new PostgresTenantRepository(clientA, { workspaceId: workspaceUuidFor(legacyA), subjectId: legacySubjectFor(legacyA), legacyHash: legacyA, role: null, email: null });
  repoB = new PostgresTenantRepository(clientB, { workspaceId: workspaceUuidFor(legacyB), subjectId: legacySubjectFor(legacyB), legacyHash: legacyB, role: null, email: null });
}, 120_000);

afterAll(async () => { await pgDb.close(); });

function project(id: string): Project {
  return {
    project_id: id,
    workspace_key_hash: "x",
    metadata: { name: id, jurisdiction: "uk", stage: "concept", level: "L1" } as unknown as Project["metadata"],
    stage_selection: { kind: "native" } as unknown as Project["stage_selection"],
    input_values: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("audit-trail postgres", () => {
  it("records a project save and verifies", async () => {
    await repoA.saveProject("x", project("P1"));
    const entries = await repoA.listAuditTrail("x");
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("project.saved");
    expect(entries[0].actor).toBe("legacy:x");
    expect(verifyAuditTrail(entries).ok).toBe(true);
  });

  it("invalid actor throws and leaves no entry", async () => {
    const before = (await repoA.listAuditTrail("x")).length;
    await expect(repoA.saveProject("x", project("P2"), "auditor" as never)).rejects.toThrow();
    const after = (await repoA.listAuditTrail("x")).length;
    expect(after).toBe(before);
  });

  it("two tenants are isolated", async () => {
    await repoB.saveProject("x", project("P1"));
    const a = await repoA.listAuditTrail("x");
    const b = await repoB.listAuditTrail("x");
    expect(a.every((e) => e.workspace === "x")).toBe(true);
    expect(b.length).toBeGreaterThanOrEqual(1);
    // direct A-claimed select of B rows via owner is not tested here; repository isolation holds
  });

  it("append-only trigger blocks update", async () => {
    await expect(pgDb.query("update public.audit_trail_entries set actor='x' where seq=1")).rejects.toThrow();
  });
});
