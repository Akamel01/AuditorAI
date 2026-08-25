// runAllLive: the async driver that lets a live adapter conduct the
// AI-CANDIDATES node while the deterministic path stays byte-identical.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DefaultAuditPipeline } from "@/domain/pipeline/pipeline";
import type { AiAdapter, CandidateFinding } from "@/lib/ai";
import { runAudit } from "@/domain/engine";
import type { InputValueState, JurisdictionId, Project } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";

function gf1Project(): Project {
  const fx = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "tests/fixtures/gf1-uk-urban-arterial-stage2.json"),
      "utf8",
    ),
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

const pipeline = new DefaultAuditPipeline();

describe("pipeline runAllLive", () => {
  it("candidates land in shared state and the result stays deterministic", async () => {
    let calls = 0;
    const live: AiAdapter = {
      enabled: true,
      async generateCandidates(audit): Promise<CandidateFinding[]> {
        calls += 1;
        void audit;
        return [
          {
            kind: "safety_concern",
            category: "conflict_point",
            location: "School Lane junction",
            road_users: ["cyclists"],
            scenario: "Left-turning vehicle conflicts with through cyclist.",
            statement: { text: "Signal staging may obscure cyclists.", normative_basis_note: null },
            evidence: [{ evidence_id: "EV-UK-001", quote: null, use: "supports_concern" }],
            assumptions: [],
            rationale: "Geometric reasoning over layout.",
            recommendation: null,
            producer: "untrusted-model-label",
          },
        ];
      },
    };

    const project = gf1Project();
    const { state, artifacts } = await pipeline.runAllLiveArtifacts(project, T0, {
      aiAdapter: live,
    });

    expect(calls).toBe(1);
    expect(state.candidate_findings).toHaveLength(1);
    expect(state.candidate_findings![0].producer).toBe("safety-reasoning-agent"); // re-labelled
    const candArt = artifacts.find((a) => a.payload_kind === "candidates.ai");
    expect(candArt?.validation_status).toBe("draft");

    // Deterministic output unchanged by live candidates in batch assembly.
    // ADR-0010's additive hallucination_rate is the one intended difference:
    // each side reflects its own checked population (the flagged live
    // candidate vs the clean engine findings).
    const engine = runAudit(project, T0);
    const { hallucination_rate: _liveRate, ...liveJson } = state.report_bundle!.json;
    const { hallucination_rate: _engineRate, ...engineJson } = engine;
    expect(JSON.stringify(liveJson)).toBe(JSON.stringify(engineJson));
    expect(state.report_bundle!.json.hallucination_rate).toBe(1);
    expect(engine.hallucination_rate).toBe(0);
  });

  it("adapter failure degrades to zero candidates + rejected artifact", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing: AiAdapter = {
      enabled: true,
      async generateCandidates() {
        throw new Error("gateway down");
      },
    };

    const project = gf1Project();
    const { state, artifacts, result } = await pipeline.runAllLiveArtifacts(project, T0, {
      aiAdapter: failing,
    });

    expect(state.candidate_findings).toBeNull();
    const candArt = artifacts.find((a) => a.payload_kind === "candidates.ai");
    expect(candArt?.validation_status).toBe("rejected");
    expect(JSON.stringify(result)).toBe(JSON.stringify(runAudit(project, T0)));
    warn.mockRestore();
  });
});
