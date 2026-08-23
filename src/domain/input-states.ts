// §27 input-state derivation for the client checklist, as pure domain
// functions: default states from requirement levels, stage filtering of the
// jurisdiction catalog, the missing-state → select-value inverse, and the
// attachment-list merge. The pipeline node (AG-MANIFEST) shares the level→
// missing-state table; the node additionally downgrades a stored "provided"
// with a blank value to the level-appropriate missing state — the client
// checklist shows the stored state verbatim (recorded vs derived display).
import type { InputValueState } from "@/domain/types";
import { MAX_ATTACHMENTS_PER_PROJECT } from "@/domain/types";

export interface WithStageIds {
  stage_ids: readonly string[];
}

export interface StoredInputValueLike {
  state?: InputValueState;
  value?: string;
  attachments?: readonly string[];
}

export function missingStateFor(requirementLevel: string): InputValueState {
  switch (requirementLevel) {
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

const MISSING_STATES: readonly InputValueState[] = [
  "required_missing",
  "recommended_missing",
  "optional_missing",
];

export function isMissingState(state: InputValueState): boolean {
  return MISSING_STATES.includes(state);
}

/** Canonical client derivation: a stored record is shown verbatim; only an
 *  absent record falls back to the level-appropriate missing state. */
export function deriveInputState(
  requirementLevel: string,
  stored?: StoredInputValueLike,
): InputValueState {
  return stored?.state ?? missingStateFor(requirementLevel);
}

/** Inverse mapping for the checklist <select>: derived missing states render
 *  as the blank placeholder option instead of a concrete choice. */
export function selectValueFor(state: InputValueState): string {
  return isMissingState(state) ? "" : state;
}

export function filterInputsForStage<T extends WithStageIds>(
  inputs: readonly T[],
  nativeStageId: string,
): T[] {
  return inputs.filter((i) => i.stage_ids.includes(nativeStageId));
}

/** Append an attachment id without duplicates, capped at the M1 per-project
 *  budget (mirrors the intake policy enforced server-side at upload time). */
export function mergeAttachment(
  existing: readonly string[] | undefined,
  attachmentId: string,
): string[] {
  const list = existing ?? [];
  if (list.includes(attachmentId)) return [...list];
  if (list.length >= MAX_ATTACHMENTS_PER_PROJECT) return [...list];
  return [...list, attachmentId];
}
