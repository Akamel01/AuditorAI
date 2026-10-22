// v3-F4 contract matrix prep (probe-only, no src edits, no new dependencies):
// the SAME read/write/overwrite/missing-key assertions run against MemoryStore
// and a minimal in-test KV-conforming fake implementing the DataStore seam.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { MemoryStore } from "@/lib/persistence/store";
import type { DataStore } from "@/lib/persistence/store";
import { Repository } from "@/lib/persistence";
import { UnknownAttachmentError } from "@/lib/persistence/project-store";
import { createPgliteSqlClient, type PgliteLike } from "@/lib/db/pglite-client";
import { legacySubjectFor, workspaceUuidFor } from "@/lib/db/migration";
import { PostgresTenantRepository } from "@/lib/db/tenant-store";
import type { TenantRepository } from "@/lib/db/tenant-repository";
import { workspaceHash } from "@/lib/persistence/store";
import type { Attachment, AuditResult, Project } from "@/domain/types";
import type { AgNodeId, AuditArtifact } from "@/domain/pipeline/types";

/** Minimal in-test KV-conforming fake: DataStore seam only, Map-backed. */
class FakeKvStore implements DataStore {
  readonly kind = "kv" as const;
  private m = new Map<string, string>();
  async put(key: string, value: unknown): Promise<void> {
    this.m.set(key, JSON.stringify(value));
  }
  async get<T>(key: string): Promise<T | null> {
    const raw = this.m.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }
  async keys(prefix: string): Promise<string[]> {
    return [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
  async del(key: string): Promise<void> {
    this.m.delete(key);
  }
  async delByPrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const k of [...this.m.keys()]) {
      if (k.startsWith(prefix)) {
        this.m.delete(k);
        n += 1;
      }
    }
    return n;
  }
}

const stores: Array<[string, () => DataStore]> = [
  ["MemoryStore", () => new MemoryStore()],
  ["FakeKvStore", () => new FakeKvStore()],
];

describe.each(stores)("persistence contract: %s", (_name, make) => {
  it("write then read returns the stored value", async () => {
    const store = make();
    await store.put("ws:test:k1", { note: "hello" });
    await expect(store.get<{ note: string }>("ws:test:k1")).resolves.toEqual({ note: "hello" });
  });

  it("overwrite replaces the stored value", async () => {
    const store = make();
    await store.put("ws:test:k1", { v: 1 });
    await store.put("ws:test:k1", { v: 2 });
    await expect(store.get<{ v: number }>("ws:test:k1")).resolves.toEqual({ v: 2 });
  });

  it("missing key resolves to null (not an error)", async () => {
    const store = make();
    await expect(store.get("ws:test:nope")).resolves.toBeNull();
  });

  it("getMany is positional with nulls for absent keys", async () => {
    const store = make();
    await store.put("ws:test:present", { v: 1 });
    await expect(store.getMany(["ws:test:present", "ws:test:absent"])).resolves.toEqual([
      { v: 1 },
      null,
    ]);
  });
});

// ---------------------------------------------------------------------------
// M7 (ticket #53): the REPOSITORY-level contract, run against the legacy
// Repository (MemoryStore) AND the Postgres tenant repository (in-memory
// pglite). The DataStore matrix above is left exactly as it was; this sibling
// block adds the third store under test — Postgres — so a DIVERGENCE between
// the legacy and the Postgres repository fails the suite instead of hiding.
//
// The two columns are interchangeable behind the TenantRepository interface
// (architecture D16), so they must honour the SAME contract:
//   write -> read, overwrite, missing -> null, ordering.
//
// ONE pglite instance is booted for the whole file (the WASM boot dominates
// the runtime); every test owns its own WORKSPACE, so the tenant schema's
// workspace boundary is the test isolation.
// ---------------------------------------------------------------------------

/** The legacy namespace both columns use. For Postgres it is the credential
 *  hash (the 16-hex workspaceHash); for the KV it is the key namespace. */
const WS = "0123456789abcdef";

const NOW = "2026-01-01T00:00:00.000Z";
const MID = "2026-02-01T00:00:00.000Z";
const LATE = "2026-03-01T00:00:00.000Z";

function projectFixture(id: string, updatedAt: string): Project {
  return {
    project_id: id,
    workspace_key_hash: WS,
    metadata: {
      name: `project ${id}`,
      description: "d",
      scheme_summary: "s",
      authority: "a",
      location: "l",
    },
    stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S2" },
    input_values: { deck: { state: "provided", value: "x" } },
    created_at: NOW,
    updated_at: updatedAt,
  };
}

function auditFixture(auditId: string, ranAt: string): AuditResult {
  return {
    audit_id: auditId,
    project_id: "P-1",
    jurisdiction: "UK",
    framework_name: "DMRB GG 119",
    native_stage_id: "uk:S2",
    native_stage_display_name: "Stage 2",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    mapping_confidence: "authoritative",
    ran_at: ranAt,
    odd_declaration_version: "1.0.1",
    odd_status: "in",
    odd_stamp: null,
    odd_floor_satisfied: null,
    input_manifest: [],
    findings: [],
    missing_information: [],
    audit_questions: [],
    limitations: [],
    disclaimer: "d",
  };
}

function attachmentFixture(id: string, createdAt: string): Attachment {
  return {
    attachment_id: id,
    project_id: "P-1",
    input_id: "deck",
    file_name: `${id}.png`,
    mime: "image/png",
    bytes: 3,
    data_url: "data:image/png;base64,AAA",
    created_at: createdAt,
  };
}

function artifactFixture(nodeId: AgNodeId, name: string): AuditArtifact {
  return {
    artifact_id: `ar-${name}`,
    node_id: nodeId,
    producer: "repository",
    version: 1,
    created_at: NOW,
    validation_status: "verified",
    payload_kind: "persistence.receipt",
    payload: { name },
  };
}

/** The Postgres target: ONE in-memory pglite with the tenant schema applied
 *  from disk. OFFLINE — no live endpoint, no pg pool. */
let pgDb: PGlite;

beforeAll(async () => {
  pgDb = new PGlite();
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).sort()) {
    await pgDb.exec(readFileSync(path.join(dir, file), "utf8"));
  }
}, 120_000);

afterAll(async () => {
  await pgDb.close();
});

let pgSeq = 0;

/** A Postgres repository bound to its OWN workspace, so the tests are
 *  isolated by the tenant boundary the schema already enforces. */
async function newPostgresRepository(): Promise<TenantRepository> {
  pgSeq += 1;
  const legacyHash = workspaceHash(`m7-matrix-workspace-${pgSeq}`);
  const workspaceId = workspaceUuidFor(legacyHash);
  const subjectId = legacySubjectFor(legacyHash);
  await pgDb.query(
    "insert into public.workspaces (id, name, legacy_key_hash) values ($1,$2,$3)",
    [workspaceId, `matrix-${pgSeq}`, legacyHash],
  );
  const client = createPgliteSqlClient(pgDb as unknown as PgliteLike);
  return new PostgresTenantRepository(client, { workspaceId, subjectId, legacyHash });
}

const repositories: Array<[string, () => Promise<TenantRepository>]> = [
  ["legacy Repository (MemoryStore)", async () => new Repository(new MemoryStore())],
  ["PostgresTenantRepository (pglite)", newPostgresRepository],
];

describe.each(repositories)("repository contract: %s", (_name, make) => {
  // The pglite boot happens in beforeAll (120s); the tests themselves are
  // fast, but a loaded CI box needs more than vitest's default 5s.
  const itRepo = (name: string, fn: () => Promise<void>) => it(name, fn, 30_000);

  itRepo("writes a project then reads it back unchanged", async () => {
    const repo = await make();
    const project = projectFixture("P-1", NOW);
    await repo.saveProject(WS, project);
    expect(await repo.getProject(WS, "P-1")).toEqual(project);
  });

  itRepo("overwriting a project replaces the stored value", async () => {
    const repo = await make();
    await repo.saveProject(WS, projectFixture("P-1", NOW));
    await repo.saveProject(WS, {
      ...projectFixture("P-1", LATE),
      metadata: { ...projectFixture("P-1", LATE).metadata, name: "second" },
    });
    expect((await repo.getProject(WS, "P-1"))?.metadata.name).toBe("second");
  });

  itRepo("a missing project resolves to null", async () => {
    const repo = await make();
    expect(await repo.getProject(WS, "nope")).toBeNull();
  });

  itRepo("lists projects by updated_at descending", async () => {
    const repo = await make();
    await repo.saveProject(WS, projectFixture("P-1", NOW));
    await repo.saveProject(WS, projectFixture("P-2", LATE));
    await repo.saveProject(WS, projectFixture("P-3", MID));
    const listed = await repo.listProjects(WS);
    expect(listed.map((p) => p.project_id)).toEqual(["P-2", "P-3", "P-1"]);
  });

  itRepo("writes an audit then reads it back unchanged", async () => {
    const repo = await make();
    const audit = auditFixture("A-1", NOW);
    await repo.saveAudit(WS, audit);
    expect(await repo.getAudit(WS, "P-1", "A-1")).toEqual(audit);
  });

  itRepo("a missing audit resolves to null", async () => {
    const repo = await make();
    expect(await repo.getAudit(WS, "P-1", "nope")).toBeNull();
  });

  itRepo("lists audits by ran_at descending", async () => {
    const repo = await make();
    await repo.saveAudit(WS, auditFixture("A-1", NOW));
    await repo.saveAudit(WS, auditFixture("A-2", LATE));
    await repo.saveAudit(WS, auditFixture("A-3", MID));
    const listed = await repo.listAudits(WS, "P-1");
    expect(listed.map((a) => a.audit_id)).toEqual(["A-2", "A-3", "A-1"]);
  });

  itRepo("issues sequential write-once revisions and lists them ascending", async () => {
    const repo = await make();
    const first = await repo.saveIssue(WS, "P-1", "A-1", auditFixture("A-1", NOW), NOW);
    const second = await repo.saveIssue(WS, "P-1", "A-1", auditFixture("A-1", LATE), LATE);
    expect(first.revision).toBe(1);
    expect(second.revision).toBe(2);
    const listed = await repo.listIssues(WS, "P-1", "A-1");
    expect(listed.map((i) => i.revision)).toEqual([1, 2]);
    expect(await repo.getIssue(WS, "P-1", "A-1", 1)).toEqual(first);
  });

  itRepo("a missing issue revision resolves to null", async () => {
    const repo = await make();
    await repo.saveIssue(WS, "P-1", "A-1", auditFixture("A-1", NOW), NOW);
    expect(await repo.getIssue(WS, "P-1", "A-1", 2)).toBeNull();
  });

  itRepo("writes an attachment then reads it back unchanged", async () => {
    const repo = await make();
    const attachment = attachmentFixture("att1", NOW);
    await repo.saveAttachment(WS, attachment);
    expect(await repo.getAttachment(WS, "P-1", "att1")).toEqual(attachment);
  });

  itRepo("a missing attachment resolves to null", async () => {
    const repo = await make();
    expect(await repo.getAttachment(WS, "P-1", "nope")).toBeNull();
  });

  itRepo("lists attachments by created_at ascending", async () => {
    const repo = await make();
    await repo.saveAttachment(WS, attachmentFixture("att2", LATE));
    await repo.saveAttachment(WS, attachmentFixture("att1", NOW));
    await repo.saveAttachment(WS, attachmentFixture("att3", MID));
    const listed = await repo.listAttachments(WS, "P-1");
    expect(listed.map((a) => a.attachment_id)).toEqual(["att1", "att3", "att2"]);
  });

  itRepo("deletes an attachment and repairs the project's input references", async () => {
    const repo = await make();
    const project = projectFixture("P-1", NOW);
    project.input_values = {
      deck: { state: "provided", value: "x", attachments: ["att1"] },
    };
    await repo.saveProject(WS, project);
    await repo.saveAttachment(WS, attachmentFixture("att1", NOW));

    await repo.deleteAttachment(WS, "P-1", "att1");

    expect(await repo.getAttachment(WS, "P-1", "att1")).toBeNull();
    expect(await repo.listAttachments(WS, "P-1")).toEqual([]);
    // The reference is stripped and the emptied array is removed.
    expect((await repo.getProject(WS, "P-1"))?.input_values).toEqual({
      deck: { state: "provided", value: "x" },
    });
  });

  itRepo("deleting a missing attachment throws UnknownAttachmentError", async () => {
    const repo = await make();
    await expect(repo.deleteAttachment(WS, "P-1", "nope")).rejects.toBeInstanceOf(
      UnknownAttachmentError,
    );
  });

  itRepo("stores an artifact trail and reads it back in seq order", async () => {
    const repo = await make();
    const first = artifactFixture("AG-PERSIST", "one");
    const second = artifactFixture("AG-REPORT", "two");
    const stored = await repo.saveArtifactTrailFor(
      WS,
      { projectId: "P-1", auditId: "A-1" },
      [first, second],
    );
    expect(stored.stored).toBe(2);
    expect(await repo.listArtifacts(WS, "P-1", "A-1")).toEqual([first, second]);
    expect(await repo.getArtifact(WS, "P-1", "A-1", "AG-PERSIST", 1)).toEqual(first);
  });

  itRepo("a missing artifact resolves to null", async () => {
    const repo = await make();
    expect(await repo.getArtifact(WS, "P-1", "A-1", "AG-PERSIST", 1)).toBeNull();
  });
});
