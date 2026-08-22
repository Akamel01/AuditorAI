// A2 gates: contract-vs-behavior — each node emits ONLY its declared payload
// kind, the refusal path produces the degraded status artifact, and the
// CandidateFinding emission stays within its declared field subset.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DefaultAuditPipeline } from "@/domain/pipeline/pipeline";
import { BATCH_NODES, DESCRIPTORS } from "@/domain/pipeline/registry";
import type { CandidatesSlice } from "@/domain/pipeline/types";
import type { AiAdapter } from "@/lib/ai";
import { runAudit } from "@/domain/engine";
import type { InputValueState, JurisdictionId, Project } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";

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
  ) as {
    fixture_id?: string;
    jurisdiction: string;
    native_stage_id: string;
    metadata: Project["metadata"];
    inputs: Record<string, { state: InputValueState; value?: string }>;
  };
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

const CANDIDATE_FIELD_BOUND = [
  "kind",
  "category",
  "location",
  "road_users",
  "scenario",
  "statement",
  "evidence",
  "assumptions",
  "rationale",
  "recommendation",
  "producer",
];

describe("inference contracts (A2)", () => {
  const pipeline = new DefaultAuditPipeline();

  it.each(FILES)("every emitted artifact kind is the node's declared kind for %s", (file) => {
    const project = loadProject(file);
    const declared = new Map(DESCRIPTORS.map((d) => [d.id, d.emits]));

    let state = pipeline.initialState();
    for (const id of BATCH_NODES) {
      const res = pipeline.runNode(id, state, { ranAtIso: T0, project });
      for (const artifact of res.artifacts) {
        expect(declared.get(artifact.node_id)).toBe(artifact.payload_kind);
      }
      state = { ...state, ...res.patch };
    }
  });

  it("AG-AI-CANDIDATES refusal in sync context yields only the rejected status artifact", () => {
    const project = loadProject(FILES[0]);
    let calls = 0;
    const enabledButUndrivable: AiAdapter = {
      enabled: true,
      async generateCandidates() {
        calls += 1;
        return [];
      },
    };

    // Sync fold with an enabled adapter: uniform refusal, no provider call.
    let state = pipeline.initialState();
    const kinds: string[] = [];
    for (const id of BATCH_NODES) {
      const res = pipeline.runNode(id, state, {
        ranAtIso: T0,
        project,
        aiAdapter: enabledButUndrivable,
      });
      for (const a of res.artifacts) if (a.node_id === "AG-AI-CANDIDATES") kinds.push(a.validation_status);
      state = { ...state, ...res.patch };
    }

    expect(calls).toBe(0); // zero provider calls outside the live driver
    expect(state.candidate_findings).toBeNull();
    expect(kinds).toEqual(["rejected"]);
  });

  it("live candidates stay within the declared field subset", async () => {
    const rogue = {
      kind: "safety_concern",
      category: "x",
      location: null,
      road_users: [],
      scenario: null,
      statement: { text: "t", normative_basis_note: null },
      evidence: [{ evidence_id: "EV-UK-001", quote: null, use: "supports_concern" }],
      assumptions: [],
      rationale: "r",
      recommendation: null,
      producer: "model-tried-to-self-label",
      severity_guess: 5, // outside the bounded subset
    };
    const adapter: AiAdapter = {
      enabled: true,
      async generateCandidates(): Promise<CandidatesSlice> {
        return [rogue] as unknown as CandidatesSlice;
      },
    };

    const project = loadProject(FILES[0]);
    const { state } = await pipeline.runAllLiveArtifacts(project, T0, { aiAdapter: adapter });

    const candidate = state.candidate_findings![0] as Record<string, unknown>;
    for (const key of Object.keys(candidate)) {
      expect(CANDIDATE_FIELD_BOUND, `${key} is not a declared candidate field`).toContain(key);
    }
    expect(candidate.producer).toBe("safety-reasoning-agent"); // identity re-asserted
    void rogue;
  });

  it("deterministic output carries no AI provenance markers", () => {
    const project = loadProject(FILES[0]);
    const result = runAudit(project, T0);
    for (const f of result.findings) {
      expect(f.source_trace.some((t) => t.origin === "ai_candidate")).toBe(false);
    }
  });
});
