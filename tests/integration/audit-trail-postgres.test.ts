import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createPgliteSqlClient, type PgliteLike } from "@/lib/db/pglite-client";
import { legacySubjectFor, workspaceUuidFor } from "@/lib/db/migration";
import { PostgresTenantRepository } from "@/lib/db/tenant-store";
import { workspaceHash } from "@/lib/persistence/store";
import { claimsJson } from "@/lib/db/identity";
import { verifyAuditTrail, auditTrailPayloadHash } from "@/domain/audit-trail";
import type { Attachment, AuditResult, Project } from "@/domain/types";
import type { AuditArtifact } from "@/domain/pipeline/types";
import type { SqlClient } from "@/lib/db/sql";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 });

let pgDb: PGlite;

beforeAll(async () => {
  pgDb = new PGlite();
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) await pgDb.exec(readFileSync(path.join(dir, f), "utf8"));
  for (const f of files) await pgDb.exec(readFileSync(path.join(dir, f), "utf8"));
}, 120_000);

afterAll(async () => { await pgDb.close(); });

interface Seeded {
  ws: string;
  legacy: string;
  workspaceId: string;
  subjectId: string;
  repo: PostgresTenantRepository;
  client: SqlClient;
}

async function seedWorkspace(): Promise<Seeded> {
  const legacy = workspaceHash(`audit-trail-pg-${Math.random().toString(36).slice(2)}`);
  const workspaceId = workspaceUuidFor(legacy);
  const subjectId = legacySubjectFor(legacy);
  await pgDb.query("insert into public.workspaces (id, name, legacy_key_hash) values ($1,$2,$3)", [workspaceId, legacy, legacy]);
  await pgDb.query("insert into public.workspace_members (workspace_id, subject_id, role, status) values ($1,$2,'owner','active')", [workspaceId, subjectId]);
  const client = createPgliteSqlClient(pgDb as unknown as PgliteLike);
  const repo = new PostgresTenantRepository(client, { workspaceId, subjectId, legacyHash: legacy, role: null, email: null });
  return { ws: legacy, legacy, workspaceId, subjectId, repo, client };
}

function project(id: string): Project {
  return {
    project_id: id,
    workspace_key_hash: "x",
    metadata: { name: id, description: "", scheme_summary: "", authority: "", location: "", jurisdiction: "uk", stage: "concept", level: "L1" } as unknown as Project["metadata"],
    stage_selection: { jurisdiction: "uk", native_stage_id: "S1", native_stage_display_name: "S1" } as unknown as Project["stage_selection"],
    input_values: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function draftAudit(id: string): AuditResult {
  return {
    audit_id: id,
    project_id: "P-1",
    jurisdiction: "uk" as AuditResult["jurisdiction"],
    framework_name: "fw",
    native_stage_id: "S1",
    native_stage_display_name: "S1",
    canonical_stages: [],
    mapping_confidence: "authoritative",
    ran_at: "2026-01-01T00:00:00.000Z",
    odd_declaration_version: "1",
    odd_status: "in",
    odd_stamp: null,
    odd_floor_satisfied: true,
    input_manifest: [],
    findings: [{ evidence: [{ evidence_id: "e1" }] } as unknown as AuditResult["findings"][number]],
    missing_information: [{ evidence_ids: ["e2"] } as unknown as AuditResult["missing_information"][number]],
    audit_questions: [],
  } as unknown as AuditResult;
}

function attachment(id: string): Attachment {
  return {
    attachment_id: id,
    project_id: "P-1",
    input_id: "deck",
    file_name: `${id}.png`,
    mime: "image/png",
    bytes: 3,
    data_url: "data:image/png;base64,AAA",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("audit-trail postgres", () => {
  it("a. schema/rls/privileges and double apply", async () => {
    const cols = await pgDb.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='public' and table_name='audit_trail_entries' order by ordinal_position",
    );
    expect(cols.rows.length).toBeGreaterThan(0);
    const pk = await pgDb.query<{ constraint_name: string }>(
      "select constraint_name from information_schema.table_constraints where table_name='audit_trail_entries' and constraint_type='PRIMARY KEY'",
    );
    expect(pk.rows.length).toBe(1);
    const rls = await pgDb.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      "select relrowsecurity, relforcerowsecurity from pg_class where relname='audit_trail_entries'",
    );
    expect(rls.rows[0].relrowsecurity).toBe(true);
    expect(rls.rows[0].relforcerowsecurity).toBe(true);
    const policies = await pgDb.query<{ policyname: string; cmd: string }>(
      "select policyname, cmd from pg_policies where tablename='audit_trail_entries'",
    );
    expect(policies.rows.map((p) => p.cmd).sort()).toEqual(["INSERT", "SELECT"]);
    // app role privileges
    const privs = await pgDb.query<{ privilege_type: string }>(
      "select privilege_type from information_schema.role_table_grants where table_name='audit_trail_entries' and grantee='auditorai_app'",
    );
    const set = new Set(privs.rows.map((p) => p.privilege_type));
    expect(set.has("SELECT")).toBe(true);
    expect(set.has("INSERT")).toBe(true);
    expect(set.has("UPDATE")).toBe(false);
    expect(set.has("DELETE")).toBe(false);
    expect(set.has("TRUNCATE")).toBe(false);
  });

  it("b. six mutations in order", async () => {
    const s = await seedWorkspace();
    const ws = s.ws;
    await s.repo.saveProject(ws, project("P-1"));
    await s.repo.saveAudit(ws, draftAudit("A-1"));
    await s.repo.saveIssue(ws, "P-1", "A-1", draftAudit("A-1"), "2026-01-01T00:00:00.000Z");
    await s.repo.saveAttachment(ws, attachment("att-1"));
    await s.repo.deleteAttachment(ws, "P-1", "att-1");
    await s.repo.saveArtifactTrailFor(ws, { projectId: "P-1", auditId: "A-1" }, [{ node_id: "n1" } as unknown as AuditArtifact]);
    const entries = await s.repo.listAuditTrail(ws);
    expect(entries.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(entries.map((e) => e.action)).toEqual([
      "project.saved", "audit.saved", "issue.issued", "attachment.saved", "attachment.deleted", "artifact_trail.saved",
    ]);
    expect(verifyAuditTrail(entries).ok).toBe(true);
    for (const e of entries) {
      expect(e.payload_hash).toBe(auditTrailPayloadHash(e.payload));
    }
  });

  it("c. actor propagation", async () => {
    const s = await seedWorkspace();
    const ws = s.ws;
    await s.repo.saveProject(ws, project("P-1"), "u:abc");
    let entries = await s.repo.listAuditTrail(ws);
    expect(entries[0].actor).toBe("u:abc");
    const s2 = await seedWorkspace();
    const ws2 = s2.ws;
    await s2.repo.saveProject(ws2, project("P-1"));
    entries = await s2.repo.listAuditTrail(ws2);
    expect(entries[0].actor).toBe(`legacy:${ws2}`);
    const s3 = await seedWorkspace();
    const ws3 = s3.ws;
    await s3.repo.saveArtifactTrailFor(ws3, { projectId: "P-1", auditId: "A-1" }, [{ node_id: "n1" } as unknown as AuditArtifact], "u:abc");
    entries = await s3.repo.listAuditTrail(ws3);
    expect(entries).toHaveLength(1);
    expect(entries[0].actor).toBe("u:abc");
    expect(entries[0].action).toBe("artifact_trail.saved");
    expect(entries[0].payload.stored).toBe(1);
    const s4 = await seedWorkspace();
    const ws4 = s4.ws;
    await s4.repo.saveArtifactTrailFor(ws4, { projectId: "P-1", auditId: "A-1" }, [{ node_id: "n1" } as unknown as AuditArtifact]);
    entries = await s4.repo.listAuditTrail(ws4);
    expect(entries[0].actor).toBe(`legacy:${ws4}`);
  });

  it("d. evidence refs round trip", async () => {
    const s = await seedWorkspace();
    const ws = s.ws;
    await s.repo.saveAudit(ws, draftAudit("A-1"));
    await s.repo.saveIssue(ws, "P-1", "A-1", draftAudit("A-1"), "2026-01-01T00:00:00.000Z");
    const entries = await s.repo.listAuditTrail(ws);
    const auditEntry = entries.find((e) => e.action === "audit.saved")!;
    const issueEntry = entries.find((e) => e.action === "issue.issued")!;
    expect(auditEntry.evidence_refs).toEqual(["e1", "e2"]);
    expect(issueEntry.evidence_refs).toEqual(["e1", "e2"]);
  });

  it("e. failed mutations append nothing", async () => {
    const s = await seedWorkspace();
    const ws = s.ws;
    await s.repo.saveIssue(ws, "P-1", "A-1", draftAudit("A-1"), "2026-01-01T00:00:00.000Z");
    const before = (await s.repo.listAuditTrail(ws)).length;
    // wrap client to force revision 0
    const realClient = s.client;
    const wrapped: SqlClient = {
      query: async (sql, params) => {
        if (String(sql).includes("coalesce(max(revision)")) {
          return { rows: [{ revision: 0 }], rowCount: 1 } as never;
        }
        return realClient.query(sql, params);
      },
      transaction: (fn) => realClient.transaction((tx) => {
        const wtx: SqlClient = {
          query: async (sql, params) => {
            if (String(sql).includes("coalesce(max(revision)")) {
              return { rows: [{ revision: 0 }], rowCount: 1 } as never;
            }
            return tx.query(sql, params);
          },
          transaction: (f) => tx.transaction(f),
        };
        return fn(wtx);
      }),
    };
    const wrappedRepo = new PostgresTenantRepository(wrapped, { workspaceId: (s as Seeded).workspaceId, subjectId: s.subjectId, legacyHash: s.legacy, role: null, email: null });
    await expect(wrappedRepo.saveIssue(ws, "P-1", "A-1", draftAudit("A-1"), "2026-01-01T00:00:00.000Z")).rejects.toBeInstanceOf(Error);
    const issues = await s.repo.listIssues(ws, "P-1", "A-1");
    expect(issues).toHaveLength(1);
    const after = (await s.repo.listAuditTrail(ws)).length;
    expect(after).toBe(before);

    // missing attachment
    const s2 = await seedWorkspace();
    const ws2 = s2.ws;
    await s2.repo.saveProject(ws2, project("P-1"));
    const before2 = (await s2.repo.listAuditTrail(ws2)).length;
    await expect(s2.repo.deleteAttachment(ws2, "P-1", "nope")).rejects.toThrow();
    const after2 = (await s2.repo.listAuditTrail(ws2)).length;
    expect(after2).toBe(before2);

    // invalid actor
    const s3 = await seedWorkspace();
    const ws3 = s3.ws;
    const before3 = (await s3.repo.listAuditTrail(ws3)).length;
    await expect(s3.repo.saveProject(ws3, project("P-1"), "auditor" as never)).rejects.toThrow();
    expect(await s3.repo.getProject(ws3, "P-1")).toBeNull();
    const after3 = (await s3.repo.listAuditTrail(ws3)).length;
    expect(after3).toBe(before3);
    await expect(s3.repo.saveIssue(ws3, "P-1", "A-1", draftAudit("A-1"), "2026-01-01T00:00:00.000Z", "auditor" as never)).rejects.toThrow();
    const after4 = (await s3.repo.listAuditTrail(ws3)).length;
    expect(after4).toBe(after3);
  });

  it("f. deleteAttachment three success shapes", async () => {
    // project row absent
    const s1 = await seedWorkspace();
    const ws1 = s1.ws;
    await s1.repo.saveAttachment(ws1, attachment("att-1"));
    // no project row
    await s1.repo.deleteAttachment(ws1, "P-1", "att-1");
    let entries = await s1.repo.listAuditTrail(ws1);
    const last1 = entries[entries.length - 1];
    expect(last1.action).toBe("attachment.deleted");
    expect(last1.payload.attachment_id).toBe("att-1");

    // not referenced
    const s2 = await seedWorkspace();
    const ws2 = s2.ws;
    await s2.repo.saveProject(ws2, project("P-1"));
    await s2.repo.saveAttachment(ws2, attachment("att-2"));
    await s2.repo.deleteAttachment(ws2, "P-1", "att-2");
    entries = await s2.repo.listAuditTrail(ws2);
    const last2 = entries[entries.length - 1];
    expect(last2.action).toBe("attachment.deleted");

    // referenced + repaired
    const s3 = await seedWorkspace();
    const ws3 = s3.ws;
    const p = project("P-1");
    p.input_values = { deck: { state: "provided", attachments: ["att-3"] } as unknown as Project["input_values"][string] };
    await s3.repo.saveProject(ws3, p);
    await s3.repo.saveAttachment(ws3, attachment("att-3"));
    await s3.repo.deleteAttachment(ws3, "P-1", "att-3");
    const got = await s3.repo.getProject(ws3, "P-1");
    expect((got?.input_values.deck as { attachments?: string[] })?.attachments).toBeUndefined();
    entries = await s3.repo.listAuditTrail(ws3);
    const last3 = entries[entries.length - 1];
    expect(last3.action).toBe("attachment.deleted");
    expect(last3.payload.attachment_id).toBe("att-3");
  });

  it("g. two-tenant isolation", async () => {
    const a = await seedWorkspace();
    const b = await seedWorkspace();
    await a.repo.saveProject(a.ws, project("P-1"));
    const aEntries = await a.repo.listAuditTrail(a.ws);
    const bEntries = await b.repo.listAuditTrail(b.ws);
    expect(aEntries.every((e) => e.workspace === a.ws)).toBe(true);
    // direct A-claimed select of B rows returns zero
    const rows = await pgDb.transaction(async (tx) => {
      await tx.query("set local role auditorai_app");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [claimsJson(a.subjectId, a.workspaceId, null, null)]);
      const res = await tx.query<{ c: string }>("select count(*)::text as c from public.audit_trail_entries where workspace_id = $1", [b.workspaceId]);
      return res.rows;
    });
    expect(Number(rows[0].c)).toBe(0);
    void bEntries;
  });

  it("h. append-only privileges", async () => {
    const s = await seedWorkspace();
    const ws = s.ws;
    await s.repo.saveProject(ws, project("P-1"));
    // owner update/delete throw (trigger)
    await expect(pgDb.query("update public.audit_trail_entries set actor='x' where seq=1")).rejects.toThrow();
    await expect(pgDb.query("delete from public.audit_trail_entries where seq=1")).rejects.toThrow();
    // app role update/delete throw (privilege) via claimed transaction
    await expect(pgDb.transaction(async (tx) => {
      await tx.query("set local role auditorai_app");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [claimsJson(s.subjectId, s.workspaceId, null, null)]);
      await tx.query("update public.audit_trail_entries set actor='x' where seq=1");
    })).rejects.toThrow();
    await expect(pgDb.transaction(async (tx) => {
      await tx.query("set local role auditorai_app");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [claimsJson(s.subjectId, s.workspaceId, null, null)]);
      await tx.query("delete from public.audit_trail_entries where seq=1");
    })).rejects.toThrow();
  });

  it("i. concurrency", async () => {
    const s = await seedWorkspace();
    const ws = s.ws;
    await Promise.all(Array.from({ length: 5 }, (_, i) => s.repo.saveProject(ws, project(`P${i}`))));
    const entries = await s.repo.listAuditTrail(ws);
    expect(entries.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(verifyAuditTrail(entries).ok).toBe(true);
  });

  it("j. empty trail", async () => {
    const s = await seedWorkspace();
    const ws = s.ws;
    const entries = await s.repo.listAuditTrail(ws);
    expect(entries).toEqual([]);
    const v = verifyAuditTrail(entries);
    expect(v.ok).toBe(true);
    expect(v.warnings).toContain("empty_trail");
  });
});
