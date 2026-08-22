// AG-MANIFEST — Input Manifest (deterministic). Normalizes recorded input
// values to §14/§27 states for the selected native stage; blank "provided"
// downgrades to the level-appropriate missing state; conditional_on retained.
import { getPack } from "@/domain/packs";
import { makeArtifact, requireSlice } from "@/domain/pipeline/nodes/shared";
import type {
  ManifestEntry,
  NodeFn,
} from "@/domain/pipeline/types";
import type {
  InputRequirementLevel,
  InputValueState,
} from "@/domain/types";

function missingStateFor(level: string): InputValueState {
  switch (level) {
    case "required":
      return "required_missing";
    case "recommended":
      return "recommended_missing";
    case "optional":
      return "optional_missing";
    default:
      return "unknown";
  }
}

function resolveState(
  stored: { state: InputValueState; value?: string } | undefined,
  level: InputRequirementLevel,
): InputValueState {
  if (stored) {
    if (stored.state === "provided" && !stored.value?.trim()) {
      return missingStateFor(level);
    }
    return stored.state;
  }
  return missingStateFor(level);
}

export const runManifest: NodeFn = (state, ctx) => {
  const sc = requireSlice("AG-MANIFEST", state, "stage_context");
  const pi = requireSlice("AG-MANIFEST", state, "project_input");
  const pack = getPack(sc.jurisdiction);

  const entries: ManifestEntry[] = pack.inputs
    .filter((i) => i.stage_ids.includes(sc.native_stage_id))
    .map((i) => {
      const stored = pi.input_values[i.input_id];
      const resolved = resolveState(stored, i.requirement_level);
      return {
        input_id: i.input_id,
        label: i.label,
        requirement_level: i.requirement_level,
        state: resolved,
        evidence_ids: i.evidence_ids ?? [],
        conditional_on: i.conditional_on ?? null,
      };
    });

  return {
    artifacts: [
      makeArtifact("AG-MANIFEST", "domain-engine", "manifest.table", 1, ctx, "verified", entries),
    ],
    patch: { input_manifest: entries },
  };
};
