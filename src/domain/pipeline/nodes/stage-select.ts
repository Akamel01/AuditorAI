// AG-STAGE-SELECT — Stage Resolution & Eligibility (deterministic).
// Jurisdiction→Framework→NativeStage resolution; never substitutes stages or
// hides mapping confidence.
import { getPack, type PolicyPack } from "@/domain/packs";
import { resolveOdd } from "@/domain/odd";
import {
  OddOutsideDomainError,
  StageNotEligibleError,
} from "@/domain/pipeline/constants";
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

  // ODD gate (ADR-0005): structurally-absent and unlisted selections refuse;
  // mapped-unproven proceeds but is stamped downstream. Split-by-reason.
  const odd = resolveOdd(pack.jurisdiction, stage.canonical_stages);
  if (odd.status === "structurally_absent") {
    throw new OddOutsideDomainError(
      pack.jurisdiction,
      stage.native_stage_id,
      "structurally_absent",
      `${pack.framework.name} defines no such audit at ${stage.native_stage_id}: the ODD matrix records this position as structurally absent, so no run may claim it.`,
    );
  }
  if (odd.status === "unlisted") {
    throw new OddOutsideDomainError(
      pack.jurisdiction,
      stage.native_stage_id,
      "unlisted",
      `Selection ${pack.jurisdiction}/${stage.native_stage_id} is not listed in the ODD declaration (v${odd.declaration_version}); unlisted selections are outside the domain by default.`,
    );
  }

  const slice: StageContextSlice = {
    jurisdiction: pack.jurisdiction,
    framework_name: pack.framework.name,
    native_stage_id: stage.native_stage_id,
    native_stage_display_name: stage.display_name,
    canonical_stages: stage.canonical_stages,
    mapping_confidence: stage.confidence,
    odd_status: odd.status,
    odd_declaration_version: odd.declaration_version,
  };
  return {
    artifacts: [
      makeArtifact("AG-STAGE-SELECT", "domain-engine", "context.snapshot", 1, ctx, "verified", slice),
    ],
    patch: { stage_context: slice },
  };
};
