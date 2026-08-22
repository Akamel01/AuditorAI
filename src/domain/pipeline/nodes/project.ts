// AG-PROJECT — Project Intake (deterministic). Copies the stored Project
// record into the pipeline verbatim; hard-fails when the record is absent.
import { makeArtifact } from "@/domain/pipeline/nodes/shared";
import type { NodeFn, ProjectInputSlice } from "@/domain/pipeline/types";

export const runProject: NodeFn = (_state, ctx) => {
  const p = ctx.project;
  const slice: ProjectInputSlice = {
    project_id: p.project_id,
    jurisdiction: p.stage_selection.jurisdiction,
    native_stage_id: p.stage_selection.native_stage_id,
    input_values: p.input_values,
  };
  return {
    artifacts: [
      makeArtifact("AG-PROJECT", "domain-engine", "project.record", 1, ctx, "verified", slice),
    ],
    patch: { project_input: slice },
  };
};
