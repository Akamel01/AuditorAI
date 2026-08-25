// N2 pipeline gates: stepped-vs-batch equivalence, artifact envelope
// conformance, describe() completeness vs graph-state.json, AI-off behavior,
// and the step-mode persistence receipt.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import graphState from "../../state/graph-state.json";
import {
  DefaultAuditPipeline,
  mergeState,
} from "@/domain/pipeline/pipeline";
import { BATCH_NODES, DESCRIPTORS, NODE_FNS } from "@/domain/pipeline/registry";
import { AG_NODE_IDS, PAYLOAD_KINDS } from "@/domain/pipeline/types";
import { MemoryStore, Repository } from "@/lib/persistence";
import { runAudit } from "@/domain/engine";
import type { InputValueState, JurisdictionId, Project } from "@/domain/types";
import type { AiAdapter } from "@/lib/ai";
import type {
  AuditArtifact,
  NodeFn,
  SharedState,
} from "@/domain/pipeline/types";

const T0 = "2026-08-22T00:00:00.000Z";

interface Fixture {
  fixture_id?: string;
  jurisdiction: string;
  native_stage_id: string;
  metadata: Project["metadata"];
  inputs: Record<string, { state: InputValueState; value?: string }>;
}

const FILES = [
  "gf1-uk-urban-arterial-stage2.json",
  "gf2-usa-rural-highway-prelim.json",
  "gf3-uae-roundabout-combined-s12.json",
  "gf4-canada-pedestrian-planning.json",
  "gf5-int-roundabout-detailed.json",
];

function loadProject(file: string): Project {
  const fx = JSON.parse(
    readFileSync(path.join(process.cwd(), "tests/fixtures", file), "utf8"),
  ) as Fixture;
  return {
    project_id: `P-${fx.fixture_id ?? "X"}`,
    workspace_key_hash: "gf",
    metadata: fx.metadata,
    stage_selection: {
      jurisdiction: fx.jurisdiction as JurisdictionId,
      native_stage_id: fx.native_stage_id,
    },
    input_values: fx.inputs,
    created_at: T0,
    updated_at: T0,
  };
}

describe("pipeline describe()", () => {
  const pipeline = new DefaultAuditPipeline();
  const descriptors = pipeline.describe();

  it("covers exactly the audit_graph node ids", () => {
    const graphIds = graphState.graphs.audit_graph.nodes.map((n) => n.id).sort();
    expect(descriptors.map((d) => d.id).sort()).toEqual(graphIds);
    expect(new Set(descriptors.map((d) => d.id)).size).toBe(AG_NODE_IDS.length);
  });

  it("DESCRIPTORS ids ↔ AG_NODE_IDS ↔ generated graph nodes all equal, in order", () => {
    expect(DESCRIPTORS.map((d) => d.id)).toEqual([...AG_NODE_IDS]);
    expect(graphState.graphs.audit_graph.nodes.map((n) => n.id)).toEqual([
      ...AG_NODE_IDS,
    ]);
  });

  it("graph-state shadow nodes mirror DESCRIPTORS field-for-field (C2 codegen)", () => {
    for (const d of descriptors) {
      const n = graphState.graphs.audit_graph.nodes.find((x) => x.id === d.id);
      expect(n, `graph node ${d.id}`).toBeDefined();
      expect(n!.impl).toBe(d.impl);
      expect(n!.role).toBe(d.summary);
      expect(n!.node_class).toBe(d.node_class);
      expect(n!.producer).toBe(d.producer);
      expect(n!.reads).toEqual(d.reads);
      expect(n!.writes).toEqual(d.writes);
      expect(n!.emits).toBe(d.emits);
      expect(n!.depends_on).toEqual(d.depends_on);
      expect(n!.executed_in_batch).toBe(d.executed_in_batch);
      expect(fs.existsSync(path.join(process.cwd(), d.impl.split(" ")[0]))).toBe(true);
    }
  });

  it("depends_on is a superset of every declarative graph edge", () => {
    for (const edge of graphState.graphs.audit_graph.edges) {
      const target = descriptors.find((d) => d.id === edge.to);
      expect(target, `descriptor for ${edge.to}`).toBeDefined();
      expect(target!.depends_on, `${edge.from} -> ${edge.to}`).toContain(edge.from);
    }
  });

  it("dependency order is topologically consistent", () => {
    for (const d of descriptors) {
      for (const dep of d.depends_on) {
        expect(AG_NODE_IDS.indexOf(dep)).toBeLessThan(AG_NODE_IDS.indexOf(d.id));
      }
    }
  });

  it("emits only closed-set payload kinds and batch flags are sane", () => {
    for (const d of descriptors) {
      expect(PAYLOAD_KINDS).toContain(d.emits);
      expect(d.executed_in_batch).toBe(BATCH_NODES.includes(d.id));
      expect(AG_NODE_IDS).toContain(d.id);
    }
    expect(BATCH_NODES).not.toContain("AG-PERSIST");
  });
});

describe("pipeline execution", () => {
  const pipeline = new DefaultAuditPipeline();

  it.each(FILES)("folded runNode equals runAll for %s", (file) => {
    const project = loadProject(file);

    let state = pipeline.initialState();
    let versionCursor = 1;
    for (const id of BATCH_NODES) {
      const res = pipeline.runNode(id, state, {
        ranAtIso: T0,
        project,
        versionStart: versionCursor,
      });
      state = mergeState(state, res.patch);
      versionCursor += res.artifacts.length;
    }

    const batch = pipeline.runAllArtifacts(project, T0);
    expect(JSON.stringify(state.report_bundle?.json)).toBe(
      JSON.stringify(batch.result),
    );
    expect(batch.state.report_bundle?.markdown).toBe(
      state.report_bundle?.markdown,
    );
  });

  it.each(FILES)("runAudit delegates byte-identically to runAll for %s", (file) => {
    const project = loadProject(file);
    expect(JSON.stringify(runAudit(project, T0))).toBe(
      JSON.stringify(pipeline.runAll(project, T0)),
    );
  });

  it("emits conformant artifacts with monotonic versions", () => {
    const project = loadProject(FILES[0]);
    const { artifacts } = pipeline.runAllArtifacts(project, T0);

    expect(artifacts.length).toBe(BATCH_NODES.length - 1); // AI-off emits none
    const seenNodes = new Set<string>();
    artifacts.forEach((a: AuditArtifact, i) => {
      expect(a.artifact_id).toMatch(/^ART-[A-Z-]+-\d+$/);
      expect(AG_NODE_IDS).toContain(a.node_id);
      expect(PAYLOAD_KINDS).toContain(a.payload_kind);
      expect(["draft", "verified", "rejected"]).toContain(a.validation_status);
      expect(a.created_at).toBe(T0);
      expect(a.version).toBe(i + 1);
      expect(a.payload).toBeDefined();
      seenNodes.add(a.node_id);
    });
    expect(seenNodes.size).toBe(BATCH_NODES.length - 1);
    expect(seenNodes.has("AG-AI-CANDIDATES")).toBe(false);
  });

  it("AI-off emits a null candidates slice with zero provider calls", () => {
    let calls = 0;
    const spy: AiAdapter = {
      enabled: false,
      async generateCandidates() {
        calls += 1;
        return [];
      },
    };
    const project = loadProject(FILES[0]);
    const { state, artifacts } = pipeline.runAllArtifacts(project, T0);
    expect(state.candidate_findings).toBeNull();
    expect(artifacts.some((a) => a.payload_kind === "candidates.ai")).toBe(false);

    // Same fold with the spy adapter injected: still off ⇒ still zero calls.
    let s = pipeline.initialState();
    for (const id of BATCH_NODES) {
      const res = pipeline.runNode(id, s, {
        ranAtIso: T0,
        project,
        aiAdapter: spy,
      });
      s = mergeState(s, res.patch);
    }
    expect(calls).toBe(0);
    expect(s.candidate_findings).toBeNull();
  });

  it("batch runs never persist; step-mode persistRun writes a receipt", async () => {
    const project = loadProject(FILES[0]);
    const { state, artifacts } = pipeline.runAllArtifacts(project, T0);
    expect(state.persistence_ref).toBeUndefined();
    expect(artifacts.some((a) => a.payload_kind === "persistence.receipt")).toBe(false);

    const store = new MemoryStore();
    const receipt = await pipeline.persistRun(state, store, "ws-hash", {
      ranAtIso: T0,
    });
    expect(receipt.patch.persistence_ref?.audit_id).toBe(state.report_bundle!.json.audit_id);
    const stored = await store.get(
      Repository.auditKey(
        "ws-hash",
        state.report_bundle!.json.project_id,
        receipt.patch.persistence_ref!.audit_id,
      ),
    );
    expect(stored).not.toBeNull();
  });

  it("adjudication applies decisions and enforces the wording gate", () => {
    const project = loadProject(FILES[0]);
    const { state } = pipeline.runAllArtifacts(project, T0);
    const drafts = state.rule_results!.deterministic_findings;
    expect(drafts.length).toBeGreaterThan(0);
    const targetId = drafts[0].finding_id;

    const res = pipeline.runNode("AG-ADJUDICATION", state, {
      ranAtIso: T0,
      project,
      decisions: [
        { finding_id: targetId, action: "accept" },
        {
          finding_id: drafts[1]?.finding_id ?? targetId,
          action: "accept_with_edits",
          edited_recommendation_text: "Consider closing the mouth.",
        },
      ],
    });

    const adj = res.patch.adjudication!;
    expect(adj.final_findings.find((f) => f.finding_id === targetId)?.reviewer_status).toBe(
      "accepted",
    );
    expect(adj.wording_violations.length).toBeGreaterThan(0);
    expect(adj.wording_violations[0].violations).toContain("consider");
  });

  it("adjudication records decisions on unknown finding ids loudly, surfaced as limitations", () => {
    const project = loadProject(FILES[0]);
    const { state } = pipeline.runAllArtifacts(project, T0);

    const res = pipeline.runNode("AG-ADJUDICATION", state, {
      ranAtIso: T0,
      project,
      decisions: [
        { finding_id: "F-DOES-NOT-EXIST", action: "accept" },
        { finding_id: "F-ALSO-MISSING", action: "reject" },
      ],
    });
    expect(res.patch.adjudication!.skipped_decision_refs).toEqual([
      "F-DOES-NOT-EXIST",
      "F-ALSO-MISSING",
    ]);

    const reported = pipeline.runNode(
      "AG-REPORT",
      mergeState(state, res.patch),
      { ranAtIso: T0, project },
    );
    const limitations = reported.patch.report_bundle!.json.limitations;
    expect(limitations).toContain(
      "Adjudication recorded a decision targeting unknown finding id 'F-DOES-NOT-EXIST'; it was not applied.",
    );
    expect(limitations).toContain(
      "Adjudication recorded a decision targeting unknown finding id 'F-ALSO-MISSING'; it was not applied.",
    );
  });

  it("runNode rejects undeclared slice writes but accepts empty patches", () => {
    const project = loadProject(FILES[0]);
    const original = NODE_FNS["AG-PROJECT"];
    const rogue: NodeFn = () => ({
      artifacts: [],
      patch: { rogue_slice: true } as unknown as SharedState,
    });
    NODE_FNS["AG-PROJECT"] = rogue;
    try {
      expect(() =>
        pipeline.runNode("AG-PROJECT", pipeline.initialState(), { ranAtIso: T0, project }),
      ).toThrowError(
        /AG-PROJECT attempted undeclared slice write\(s\): rogue_slice; declared writes: project_input/,
      );
    } finally {
      NODE_FNS["AG-PROJECT"] = original;
    }

    const emptyPatch: NodeFn = () => ({ artifacts: [], patch: {} });
    NODE_FNS["AG-PROJECT"] = emptyPatch;
    try {
      const res = pipeline.runNode("AG-PROJECT", pipeline.initialState(), {
        ranAtIso: T0,
        project,
      });
      expect(res.patch).toEqual({});
    } finally {
      NODE_FNS["AG-PROJECT"] = original;
    }
  });

  it.each(FILES)("folded runNodeAsync equals runAllArtifacts for %s", async (file) => {
    const project = loadProject(file);
    let state = pipeline.initialState();
    const artifacts: AuditArtifact[] = [];
    for (const id of BATCH_NODES) {
      const out = await pipeline.runNodeAsync(id, state, { ranAtIso: T0, project }, artifacts);
      state = out.state;
      artifacts.push(...out.artifacts);
    }
    const batch = pipeline.runAllArtifacts(project, T0);
    expect(JSON.stringify(state.report_bundle?.json)).toBe(JSON.stringify(batch.result));
    expect(state.report_bundle?.markdown).toBe(batch.state.report_bundle?.markdown);
    expect(artifacts).toEqual(batch.artifacts);
  });

  it("runNodeAsync dispatches ai-bounded nodes to live inference via the registry", async () => {
    let calls = 0;
    const live: AiAdapter = {
      enabled: true,
      async generateCandidates() {
        calls += 1;
        return [];
      },
    };
    const project = loadProject(FILES[0]);
    const { state } = pipeline.runAllArtifacts(project, T0);

    const out = await pipeline.runNodeAsync(
      "AG-AI-CANDIDATES",
      state,
      { ranAtIso: T0, project, aiAdapter: live, allowLiveInference: true },
      [],
    );
    expect(calls).toBe(1);
    expect(out.artifacts.some((a) => a.payload_kind === "candidates.ai")).toBe(true);
    expect(out.state.candidate_findings).toEqual([]);
  });

  it("runNodeAsync dispatches the non-batch persistence node via io", async () => {
    const project = loadProject(FILES[0]);
    const { state } = pipeline.runAllArtifacts(project, T0);
    const store = new MemoryStore();

    const out = await pipeline.runNodeAsync(
      "AG-PERSIST",
      state,
      { ranAtIso: T0, project },
      [],
      { store, workspace: "ws-hash" },
    );
    expect(out.state.persistence_ref?.audit_id).toBe(state.report_bundle!.json.audit_id);
    const stored = await store.get(
      Repository.auditKey(
        "ws-hash",
        out.state.persistence_ref!.project_id,
        out.state.persistence_ref!.audit_id,
      ),
    );
    expect(stored).not.toBeNull();
  });
});
