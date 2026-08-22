// AG-STAGE-SELECT — Stage Resolution & Eligibility (deterministic).
// Jurisdiction→Framework→NativeStage resolution; never substitutes stages or
// hides mapping confidence.
import { getPack, type PolicyPack } from "@/domain/packs";
import { StageNotEligibleError } from "@/domain/pipeline/constants";
import { makeArtifact } from "@/domain/pipeline/nodes/shared";
import type { NodeFn, StageContextSlice } from "@/domain/pipeline/types";

export type PolicyStage = PolicyPack["stages"][number];

export function requireStage(
  pack: PolicyPack,
  nativeStageId: string,
): PolicyStage {
  const stage = pack.stages.find((s) => s.native_stage_id === nativeStageId);
  if (!stage) {
    throw new StageNotEligibleError(
      pack.jurisdiction,
      nativeStageId,
      `Native stage ${nativeStageId} does not exist under ${pack.framework.name}`,
      pack.exceptions.flatMap((e) => e.evidence_ids).slice(0, 3),
    );
  }
  if (!stage.mvp_scope) {
    throw new StageNotEligibleError(
      pack.jurisdiction,
      nativeStageId,
      `Native stage ${nativeStageId} (${stage.display_name}) is outside MVP scope`,
      [],
    );
  }
  return stage;
}

export const runStageSelect: NodeFn = (_state, ctx) => {
  const pack = getPack(ctx.project.stage_selection.jurisdiction);
  const stage = requireStage(pack, ctx.project.stage_selection.native_stage_id);
  const slice: StageContextSlice = {
    jurisdiction: pack.jurisdiction,
    framework_name: pack.framework.name,
    native_stage_id: stage.native_stage_id,
    native_stage_display_name: stage.display_name,
    canonical_stages: stage.canonical_stages,
    mapping_confidence: stage.confidence,
  };
  return {
    artifacts: [
      makeArtifact("AG-STAGE-SELECT", "domain-engine", "context.snapshot", 1, ctx, "verified", slice),
    ],
    patch: { stage_context: slice },
  };
};
