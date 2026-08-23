// N3 gates: artifact trail persistence over the DataStore seam — key scheme,
// retention pruning to summaries, byte caps, replay trust semantics.
import { describe, expect, it } from "vitest";
import {
  ArtifactTooLargeError,
  MAX_ARTIFACT_BYTES,
  MemoryStore,
  Repository,
  UnknownAttachmentError,
} from "@/lib/persistence";
import type { AuditArtifact } from "@/domain/pipeline/types";
import type { Project } from "@/domain/types";

const WS = "wshash0001";

function art(node: string, seq: number, status: AuditArtifact["validation_status"] = "verified") {
  return {
    artifact_id: `ART-${node.replace("AG-", "")}-${seq}`,
    node_id: node,
    producer: "domain-engine",
    version: seq,
    created_at: "2026-08-22T00:00:00.000Z",
    validation_status: status,
    payload_kind: "rules.results",
    payload: { note: "demo" },
  } as AuditArtifact;
}

function repo() {
  return new Repository(new MemoryStore());
}

describe("artifact trail persistence (N3)", () => {
  it("stores and reads back the full trail under the ws:art key scheme", async () => {
    const r = repo();
    const trail = [art("AG-RULES", 1), art("AG-FINDINGS", 1)];
    const res = await r.saveArtifactTrailFor(WS, { projectId: "P-x", auditId: "AUD-x" }, trail);
    expect(res.stored).toBe(2);

    const got = await r.getArtifact(WS, "P-x", "AUD-x", "AG-RULES", 1);
    expect(got?.node_id).toBe("AG-RULES");
    expect(got?.payload_kind).toBe("rules.results");

    const list = await r.listArtifacts(WS, "P-x", "AUD-x");
    expect(list).toHaveLength(2);
  });

  it("prunes a previous run to a summary when a new trail lands", async () => {
    const store = new MemoryStore();
    const r = new Repository(store);
    await r.saveArtifactTrailFor(WS, { projectId: "P-x", auditId: "AUD-y" }, [
      art("AG-RULES", 1),
      art("AG-FINDINGS", 1),
    ]);
    // Second (latest) run of the same audit id.
    await r.saveArtifactTrailFor(WS, { projectId: "P-x", auditId: "AUD-y" }, [art("AG-REPORT", 1)]);

    const list = await r.listArtifacts(WS, "P-x", "AUD-y");
    expect(list).toHaveLength(1); // only latest full trail remains
    expect(list[0].node_id).toBe("AG-REPORT");

    const keys = await store.keys(`ws:${WS}:art:P-x:AUD-y:`);
    expect(keys.some((k) => k.endsWith(":_summary"))).toBe(true);
    const summary = await store.get<{ artifact_count: number }>(
      `ws:${WS}:art:P-x:AUD-y:_summary`,
    );
    expect(summary?.artifact_count).toBe(2);
  });

  it("rejects oversized artifacts with the typed error before storing", async () => {
    const r = repo();
    const big = art("AG-MANIFEST", 1);
    big.payload = { blob: "x".repeat(MAX_ARTIFACT_BYTES + 10) };
    await expect(
      r.saveArtifactTrailFor(WS, { projectId: "P-x", auditId: "AUD-z" }, [big]),
    ).rejects.toBeInstanceOf(ArtifactTooLargeError);
  });

  it("replay trusts verified artifacts and regenerates the rest", () => {
    const r = repo();
    const trail = [
      art("AG-RULES", 1, "verified"),
      art("AG-AI-CANDIDATES", 1, "draft"),
      art("AG-ADJUDICATION", 1, "rejected"),
    ];
    const plan = r.replayPlan(trail);
    expect(plan.trusted.map((a) => a.node_id)).toEqual(["AG-RULES"]);
    expect(plan.regenerate.map((a) => a.validation_status)).toEqual(["draft", "rejected"]);
  });

  it("orders the trail by numeric seq, surviving seq >= 10 (regression)", async () => {
    const r = repo();
    // Node ids chosen so lexicographic key order would differ from seq order.
    const trail = Array.from({ length: 12 }, (_, i) =>
      art(i === 0 ? "AG-MANIFEST" : `AG-ZNODE-${i}`, i + 1),
    );
    await r.saveArtifactTrailFor(WS, { projectId: "P-x", auditId: "AUD-seq" }, trail);

    const list = await r.listArtifacts(WS, "P-x", "AUD-seq");
    expect(list).toHaveLength(12);
    const versions = list.map((a) => a.version);
    expect(versions).toEqual([...Array.from({ length: 12 }, (_, i) => i + 1)]);
  });

  it("getMany returns values positionally with nulls for absent keys", async () => {
    const store = new MemoryStore();
    const r = new Repository(store);
    await r.saveProject(WS, {
      project_id: "P-a",
      workspace_key_hash: WS,
      metadata: { name: "A", description: "", scheme_summary: "", authority: "", location: "" },
      stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S2" },
      input_values: {},
      created_at: "2026-08-22T00:00:00.000Z",
      updated_at: "2026-08-22T00:00:00.000Z",
    } satisfies Project);

    const got = await store.getMany<object>([
      Repository.projectKey(WS, "P-a"),
      Repository.projectKey(WS, "P-missing"),
    ]);
    expect(got).toHaveLength(2);
    expect((got[0] as { project_id: string }).project_id).toBe("P-a");
    expect(got[1]).toBeNull();
  });

  it("delByPrefix removes everything under a prefix and reports the count", async () => {
    const store = new MemoryStore();
    const r = new Repository(store);
    const trail = Array.from({ length: 3 }, (_, i) => art(`AG-N${i}`, i + 1));
    await r.saveArtifactTrailFor(WS, { projectId: "P-x", auditId: "AUD-del" }, trail);

    const deleted = await store.delByPrefix(`ws:${WS}:art:P-x:AUD-del:`);
    expect(deleted).toBeGreaterThanOrEqual(3);
    expect(await r.listArtifacts(WS, "P-x", "AUD-del")).toHaveLength(0);
  });

  it("deleteAttachment repairs input_values references as one operation", async () => {
    const store = new MemoryStore();
    const r = new Repository(store);
    await r.saveProject(WS, {
      project_id: "P-fix",
      workspace_key_hash: WS,
      metadata: { name: "Fix", description: "", scheme_summary: "", authority: "", location: "" },
      stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S2" },
      input_values: {
        drawing_document_register: {
          state: "provided",
          value: "v",
          attachments: ["ATT-gone", "ATT-stays"],
        },
        other_input: { state: "provided", value: "w", attachments: ["ATT-gone"] },
        text_only_input: { state: "provided", value: "x" },
      },
      created_at: "2026-08-22T00:00:00.000Z",
      updated_at: "2026-08-22T00:00:00.000Z",
    });
    await r.saveAttachment(WS, {
      attachment_id: "ATT-gone",
      project_id: "P-fix",
      input_id: null,
      file_name: "g.png",
      mime: "image/png",
      bytes: 10,
      data_url: "data:image/png;base64,AA==",
      created_at: "2026-08-22T00:00:00.000Z",
    });

    await r.deleteAttachment(WS, "P-fix", "ATT-gone");

    expect(await r.getAttachment(WS, "P-fix", "ATT-gone")).toBeNull();
    const project = (await r.getProject(WS, "P-fix"))!;
    expect(project.input_values.drawing_document_register.attachments).toEqual(["ATT-stays"]);
    expect(project.input_values.other_input.attachments).toBeUndefined();
    expect(project.input_values.other_input.state).toBe("provided");
    expect(project.input_values.text_only_input.attachments).toBeUndefined();
  });

  it("deleteAttachment on an unknown id throws the typed error", async () => {
    const r = repo();
    await expect(r.deleteAttachment(WS, "P-x", "ATT-nope")).rejects.toBeInstanceOf(
      UnknownAttachmentError,
    );
  });
});
