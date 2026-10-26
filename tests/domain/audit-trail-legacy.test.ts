/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { MemoryStore, Repository, setDataStoreForTests, IssueRevisionConflictError } from "@/lib/persistence";
import type { Attachment, AuditResult, Project } from "@/domain/types";
import { verifyAuditTrail } from "@/domain/audit-trail";
import * as Keys from "@/lib/persistence/keys";
import { TrailStore, AuditTrailCorruptError } from "@/lib/persistence/trail-store";

const NOW = "2026-08-23T12:00:00.000Z";
const WS = "0123456789abcdef";

function draft(auditId: string): AuditResult {
  return {
    audit_id: auditId,
    project_id: "P-1",
    jurisdiction: "UK",
    framework_name: "DMRB GG 119",
    native_stage_id: "uk:S1",
    native_stage_display_name: "Stage 1",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    mapping_confidence: "authoritative",
    ran_at: NOW,
    input_manifest: [],
    findings: [],
    missing_information: [],
    audit_questions: [],
    limitations: [],
    odd_declaration_version: "1.0.1",
    odd_status: "in",
    odd_stamp: null,
    odd_floor_satisfied: null,
    disclaimer: "d",
  } as AuditResult;
}

function project(id: string): Project {
  return {
    project_id: id,
    workspace_key_hash: "x",
    metadata: {} as Project["metadata"],
    stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S1" } as Project["stage_selection"],
    input_values: {},
    created_at: NOW,
    updated_at: NOW,
  };
}

function attachment(id: string): Attachment {
  return {
    attachment_id: id,
    project_id: "P-1",
    input_id: null,
    file_name: "f.png",
    mime: "image/png",
    bytes: 4,
    data_url: "data:image/png;base64,AAAA",
    created_at: NOW,
  };
}

describe("audit-trail legacy", () => {
  it("a: six mutations record six actions in order and verify", async () => {
    const store = new MemoryStore();
    setDataStoreForTests(store);
    const repo = new Repository(store);
    const ws = WS;
    await repo.saveProject(ws, project("P-1"), "u:abc");
    await repo.saveAudit(ws, draft("A-1"), "u:abc");
    await repo.saveIssue(ws, "P-1", "A-1", draft("A-1"), NOW, "u:abc");
    await repo.saveAttachment(ws, attachment("att-1"), "u:abc");
    await repo.deleteAttachment(ws, "P-1", "att-1", "u:abc");
    await repo.saveArtifactTrailFor(ws, { projectId: "P-1", auditId: "A-1" }, [], "u:abc");
    const entries = await repo.listAuditTrail(ws);
    expect(entries.map((e) => e.action)).toEqual([
      "project.saved",
      "audit.saved",
      "issue.issued",
      "attachment.saved",
      "attachment.deleted",
      "artifact_trail.saved",
    ]);
    entries.forEach((e, i) => expect(e.seq).toBe(i + 1));
    const { auditTrailPayloadHash } = await import("@/domain/audit-trail");
    for (const e of entries) expect(e.payload_hash).toBe(auditTrailPayloadHash(e.payload));
    expect(verifyAuditTrail(entries).ok).toBe(true);
  });

  it("b: actor handling and artifact stored", async () => {
    const store = new MemoryStore();
    setDataStoreForTests(store);
    const repo = new Repository(store);
    const ws = WS;
    await repo.saveProject(ws, project("P-1"), "u:abc");
    const e1 = (await repo.listAuditTrail(ws))[0];
    expect(e1.actor).toBe("u:abc");
    const store2 = new MemoryStore();
    setDataStoreForTests(store2);
    const repo2 = new Repository(store2);
    await repo2.saveProject(ws, project("P-1"));
    const e2 = (await repo2.listAuditTrail(ws))[0];
    expect(e2.actor).toBe(`legacy:${ws}`);
    // artifact
    const store3 = new MemoryStore();
    setDataStoreForTests(store3);
    const repo3 = new Repository(store3);
    await repo3.saveArtifactTrailFor(ws, { projectId: "P-1", auditId: "A-1" }, [{ node_id: "n", seq: 1 } as any], "u:abc");
    const ae = (await repo3.listAuditTrail(ws))[0];
    expect(ae.actor).toBe("u:abc");
    expect(ae.payload.stored).toBe(1);
    // fallback actor
    const store4 = new MemoryStore();
    setDataStoreForTests(store4);
    const repo4 = new Repository(store4);
    await repo4.saveArtifactTrailFor(ws, { projectId: "P-1", auditId: "A-1" }, []);
    const ae2 = (await repo4.listAuditTrail(ws))[0];
    expect(ae2.actor).toBe(`legacy:${ws}`);
    expect((await repo3.listAuditTrail(ws)).length).toBe(1);
  });

  it("c: auditor rejected before write", async () => {
    // saveProject
    {
      const store = new MemoryStore();
      setDataStoreForTests(store);
      const repo = new Repository(store);
      const ws = WS;
      await expect(repo.saveProject(ws, project("P-1"), "auditor" as any)).rejects.toThrow();
      expect(await repo.getProject(ws, "P-1")).toBeNull();
      expect((await repo.listAuditTrail(ws)).length).toBe(0);
    }
    // saveAudit
    {
      const store = new MemoryStore();
      setDataStoreForTests(store);
      const repo = new Repository(store);
      const ws = WS;
      await expect(repo.saveAudit(ws, draft("A-1"), "auditor" as any)).rejects.toThrow();
      expect(await repo.getAudit(ws, "P-1", "A-1")).toBeNull();
      expect((await repo.listAuditTrail(ws)).length).toBe(0);
    }
    // saveIssue
    {
      const store = new MemoryStore();
      setDataStoreForTests(store);
      const repo = new Repository(store);
      const ws = WS;
      await expect(repo.saveIssue(ws, "P-1", "A-1", draft("A-1"), NOW, "auditor" as any)).rejects.toThrow();
      expect(await repo.listIssues(ws, "P-1", "A-1")).toEqual([]);
      expect((await repo.listAuditTrail(ws)).length).toBe(0);
    }
    // saveAttachment
    {
      const store = new MemoryStore();
      setDataStoreForTests(store);
      const repo = new Repository(store);
      const ws = WS;
      await expect(repo.saveAttachment(ws, attachment("att-1"), "auditor" as any)).rejects.toThrow();
      expect(await repo.getAttachment(ws, "P-1", "att-1")).toBeNull();
      expect((await repo.listAuditTrail(ws)).length).toBe(0);
    }
    // deleteAttachment
    {
      const store = new MemoryStore();
      setDataStoreForTests(store);
      const repo = new Repository(store);
      const ws = WS;
      await repo.saveAttachment(ws, attachment("att-1"), "u:abc");
      const before = (await repo.listAuditTrail(ws)).length;
      await expect(repo.deleteAttachment(ws, "P-1", "att-1", "auditor" as any)).rejects.toThrow();
      expect(await repo.getAttachment(ws, "P-1", "att-1")).not.toBeNull();
      expect((await repo.listAuditTrail(ws)).length).toBe(before);
    }
    // saveArtifactTrailFor
    {
      const store = new MemoryStore();
      setDataStoreForTests(store);
      const repo = new Repository(store);
      const ws = WS;
      await expect(repo.saveArtifactTrailFor(ws, { projectId: "P-1", auditId: "A-1" }, [], "auditor" as any)).rejects.toThrow();
      expect(await repo.listArtifacts(ws, "P-1", "A-1")).toEqual([]);
      expect((await repo.listAuditTrail(ws)).length).toBe(0);
    }
  });

  it("d: duplicate revision conflict appends nothing", async () => {
    const store = new MemoryStore();
    setDataStoreForTests(store);
    const repo = new Repository(store);
    const ws = WS;
    await repo.saveIssue(ws, "P-1", "A-1", draft("A-1"), NOW, "u:abc");
    const before = (await repo.listAuditTrail(ws)).length;
    // wrap store so keys() hides issue keys
    const origKeys = store.keys.bind(store);
    store.keys = async (prefix: string) => {
      if (prefix.includes("issue:")) return [];
      return origKeys(prefix);
    };
    await expect(repo.saveIssue(ws, "P-1", "A-1", draft("A-1"), NOW, "u:abc")).rejects.toBeInstanceOf(IssueRevisionConflictError);
    store.keys = origKeys;
    const issues = await repo.listIssues(ws, "P-1", "A-1");
    expect(issues.length).toBe(1);
    const after = await repo.listAuditTrail(ws);
    expect(after.length).toBe(before);
  });

  it("e: deleteAttachment shapes", async () => {
    // missing id
    {
      const store = new MemoryStore();
      setDataStoreForTests(store);
      const repo = new Repository(store);
      const ws = WS;
      await expect(repo.deleteAttachment(ws, "P-1", "nope", "u:abc")).rejects.toThrow();
      expect((await repo.listAuditTrail(ws)).length).toBe(0);
    }
    // project row absent
    {
      const store = new MemoryStore();
      setDataStoreForTests(store);
      const repo = new Repository(store);
      const ws = WS;
      await repo.saveAttachment(ws, attachment("att-2"), "u:abc");
      await repo.deleteAttachment(ws, "P-1", "att-2", "u:abc");
      const entries = await repo.listAuditTrail(ws);
      const del = entries.find((e) => e.action === "attachment.deleted")!;
      expect(del.payload.attachment_id).toBe("att-2");
      expect(entries.length).toBe(2);
    }
    // project present but id not referenced
    {
      const store = new MemoryStore();
      setDataStoreForTests(store);
      const repo = new Repository(store);
      const ws = WS;
      await repo.saveProject(ws, project("P-1"), "u:abc");
      await repo.saveAttachment(ws, attachment("att-3"), "u:abc");
      await repo.deleteAttachment(ws, "P-1", "att-3", "u:abc");
      const entries = await repo.listAuditTrail(ws);
      expect(entries.filter((e) => e.action === "attachment.deleted").length).toBe(1);
    }
    // id referenced and repaired
    {
      const store = new MemoryStore();
      setDataStoreForTests(store);
      const repo = new Repository(store);
      const ws = WS;
      const p = project("P-1");
      p.input_values = { x: { state: "provided", attachments: ["att-4"] } as any };
      await repo.saveProject(ws, p, "u:abc");
      await repo.saveAttachment(ws, attachment("att-4"), "u:abc");
      await repo.deleteAttachment(ws, "P-1", "att-4", "u:abc");
      const entries = await repo.listAuditTrail(ws);
      expect(entries.filter((e) => e.action === "attachment.deleted").length).toBe(1);
      const proj = await repo.getProject(ws, "P-1");
      expect(JSON.stringify(proj?.input_values)).not.toContain("att-4");
    }
  });

  it("f: saveAudit rerun appends another entry", async () => {
    const store = new MemoryStore();
    setDataStoreForTests(store);
    const repo = new Repository(store);
    const ws = WS;
    await repo.saveAudit(ws, draft("A-1"), "u:abc");
    await repo.saveAudit(ws, draft("A-1"), "u:abc");
    const entries = await repo.listAuditTrail(ws);
    expect(entries.filter((e) => e.action === "audit.saved").length).toBe(2);
  });

  it("g: two workspaces independent", async () => {
    const store = new MemoryStore();
    setDataStoreForTests(store);
    const repo = new Repository(store);
    const ws1 = WS;
    const ws2 = "fedcba9876543210";
    await repo.saveProject(ws1, project("P-1"), "u:abc");
    await repo.saveProject(ws2, project("P-1"), "u:abc");
    const a = await repo.listAuditTrail(ws1);
    const b = await repo.listAuditTrail(ws2);
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
    expect(a[0].workspace).toBe(ws1);
    expect(b[0].workspace).toBe(ws2);
  });

  it("h: issue entries carry sorted unique evidence refs", async () => {
    const store = new MemoryStore();
    setDataStoreForTests(store);
    const repo = new Repository(store);
    const ws = WS;
    const r = draft("A-1");
    (r as any).findings = [{ evidence: [{ evidence_id: "b" }, { evidence_id: "a" }, { evidence_id: "a" }] }];
    (r as any).missing_information = [{ evidence_ids: ["c"] }];
    await repo.saveIssue(ws, "P-1", "A-1", r, NOW, "u:abc");
    const entry = (await repo.listAuditTrail(ws))[0];
    expect(entry.evidence_refs).toEqual(["a", "b", "c"]);
  });

  it("i: direct store tampering detected", async () => {
    const store = new MemoryStore();
    setDataStoreForTests(store);
    const repo = new Repository(store);
    const ws = WS;
    await repo.saveProject(ws, project("P-1"), "u:abc");
    await repo.saveProject(ws, project("P-2"), "u:abc");
    const forged = { seq: 2, workspace: ws, recorded_at: NOW, actor: "u:x", action: "project.saved", subject: { type: "project", id: "P-2", project_id: "P-2", audit_id: null }, evidence_refs: [], payload: { project_id: "P-2", updated_at: NOW }, payload_hash: "0".repeat(64), prev_hash: "0".repeat(64), entry_hash: "0".repeat(64) };
    await store.put(Keys.trailKey(ws, 2), forged);
    const entries = await repo.listAuditTrail(ws);
    const res = verifyAuditTrail(entries);
    expect(res.ok).toBe(false);
  });

  it("j: 10 concurrent saveProject produce contiguous seqs and verify", async () => {
    const store = new MemoryStore();
    setDataStoreForTests(store);
    const repo = new Repository(store);
    const ws = WS;
    await Promise.all(Array.from({ length: 10 }, (_, i) => repo.saveProject(ws, project(`P-${i}`), "u:abc")));
    const entries = await repo.listAuditTrail(ws);
    expect(entries.map((e) => e.seq)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    expect(verifyAuditTrail(entries).ok).toBe(true);
  });

  it("k: listAuditTrail empty returns []", async () => {
    const store = new MemoryStore();
    setDataStoreForTests(store);
    const repo = new Repository(store);
    const ws = WS;
    expect(await repo.listAuditTrail(ws)).toEqual([]);
  });

  it("n: TrailStore has no update/delete/remove", () => {
    expect((TrailStore as any).prototype.update).toBeUndefined();
    expect((TrailStore as any).prototype.delete).toBeUndefined();
    expect((TrailStore as any).prototype.remove).toBeUndefined();
  });

  it("m: failed append does not poison the chain", async () => {
    const store = new MemoryStore();
    let thrown = false;
    const origPut = store.put.bind(store);
    store.put = async (key: string, value: unknown) => {
      if (!thrown && String(key).includes(":trail:")) {
        thrown = true;
        throw new Error("boom");
      }
      return origPut(key, value);
    };
    setDataStoreForTests(store);
    const repo = new Repository(store);
    const ws = WS;
    await expect(repo.saveProject(ws, project("P-1"), "u:abc")).rejects.toThrow();
    await repo.saveProject(ws, project("P-2"), "u:abc");
    const entries = await repo.listAuditTrail(ws);
    expect(entries.length).toBe(1);
    expect(entries[0].seq).toBe(1);
    expect(verifyAuditTrail(entries).ok).toBe(true);
  });

  it("o: corrupt head fails closed", async () => {
    const store = new MemoryStore();
    setDataStoreForTests(store);
    const repo = new Repository(store);
    const ws = WS;
    await repo.saveProject(ws, project("P-1"), "u:abc");
    const entry1 = (await repo.listAuditTrail(ws))[0];
    const origGet = store.get.bind(store);
    store.get = async <T>(key: string) => {
      if (key === Keys.trailKey(ws, 1)) return null as T;
      return origGet<T>(key);
    };
    await expect(repo.saveProject(ws, project("P-2"), "u:abc")).rejects.toBeInstanceOf(AuditTrailCorruptError);
    // entry 1 unchanged, no seq 2
    store.get = origGet;
    const entries = await repo.listAuditTrail(ws);
    expect(entries.length).toBe(1);
    expect(entries[0].entry_hash).toBe(entry1.entry_hash);
    // restore get, append again -> seq 2
    await repo.saveProject(ws, project("P-2"), "u:abc");
    const entries2 = await repo.listAuditTrail(ws);
    expect(entries2.length).toBe(2);
    expect(entries2[1].seq).toBe(2);
    expect(entries2[1].prev_hash).toBe(entry1.entry_hash);
  });

  it("l: empty/blank workspace append throws and writes nothing", async () => {
    const store = new MemoryStore();
    const ts = new TrailStore(store);
    await expect(ts.append("", { actor: "u:abc", action: "project.saved", subject: { type: "project", id: "p", project_id: "p", audit_id: null } })).rejects.toThrow();
    await expect(ts.append("   ", { actor: "u:abc", action: "project.saved", subject: { type: "project", id: "p", project_id: "p", audit_id: null } })).rejects.toThrow();
    const keys = await store.keys("ws:");
    expect(keys.length).toBe(0);
  });
});
