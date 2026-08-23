// The audit engine: deterministic execution of one audit for a Project at its
// selected Native Stage. Since N2 this is a thin compatibility shell over the
// step-mode AuditPipeline (src/domain/pipeline/) — runAudit delegates to
// runAll, whose batch fold is behavior-identical to the pre-pipeline monolith.
//
// Purity contract: identical (project, packs) => identical AuditResult except
// ran_at, which is injected by the caller. No randomness, no AI involvement in
// the deterministic path (AI candidates arrive bounded and labelled, off by
// default).
import type { AuditResult, Project } from "./types";
import { getPipeline } from "./pipeline";

export { DISCLAIMER, StageNotEligibleError } from "./pipeline/constants";
export { validateRecommendationWording } from "./pipeline/wording";

export function runAudit(project: Project, ranAtIso: string): AuditResult {
  return getPipeline().runAll(project, ranAtIso);
}
