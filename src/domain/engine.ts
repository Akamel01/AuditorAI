// The audit engine: deterministic execution of one audit for a Project at its
// selected Native Stage. Since N2 this is a thin compatibility shell over the
// step-mode AuditPipeline (src/domain/pipeline/) — runAudit delegates to
// runAll, whose batch fold is behavior-identical to the pre-pipeline monolith.
//
// Purity contract: identical (project, packs) => identical AuditResult except
// ran_at, which is injected by the caller. No randomness, no AI involvement in
// the deterministic path (AI candidates arrive bounded and labelled, off by
// default).
import type { AuditContext, AuditResult, Project } from "./types";
import { getPack } from "./packs";
import { requireStage } from "./pipeline/nodes/stage-select";
import { getPipeline } from "./pipeline";

export { DISCLAIMER, StageNotEligibleError } from "./pipeline/constants";
export { validateRecommendationWording } from "./pipeline/wording";

export function buildAuditContext(project: Project): AuditContext {
  const pack = getPack(project.stage_selection.jurisdiction);
  const stage = requireStage(pack, project.stage_selection.native_stage_id);
  return {
    project_id: project.project_id,
    jurisdiction: pack.jurisdiction,
    framework_name: pack.framework.name,
    native_stage_id: stage.native_stage_id,
    canonical_stages: stage.canonical_stages,
    mapping_confidence: stage.confidence,
    input_states: Object.fromEntries(
      Object.entries(project.input_values).map(([k, v]) => [k, v.state]),
    ),
  };
}

export function runAudit(project: Project, ranAtIso: string): AuditResult {
  return getPipeline().runAll(project, ranAtIso);
}
