// N3 gates: artifact trail persistence over the DataStore seam — key scheme,
// retention pruning to summaries, byte caps, replay trust semantics.
import { describe, expect, it } from "vitest";
import {
  ArtifactTooLargeError,
  MAX_ARTIFACT_BYTES,
  MemoryStore,
  Repository,
} from "@/lib/persistence";
import type { AuditArtifact } from "@/domain/pipeline/types";

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
});
