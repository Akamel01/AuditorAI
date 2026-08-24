// AuditResult assembly + slice precondition helpers. Parameterized by the
// calling node so missing-slice diagnostics always name the real caller
// (AG-REPORT batch assembly vs the AI live path's provisional assembly).
import { getPack } from "@/domain/packs";
import { oddClaimZone, oddFloorSatisfied, resolveOdd } from "@/domain/odd";
import { DISCLAIMER } from "@/domain/pipeline/constants";
import type {
  AgNodeId,
  SharedState,
} from "@/domain/pipeline/types";
import type { AuditResult } from "@/domain/types";

export class MissingSliceError extends Error {
  constructor(node: AgNodeId, slice: string) {
    super(`${node} requires slice '${slice}' which is absent from SharedState`);
  }
}

export function requireSlice<K extends keyof SharedState>(
  nodeId: AgNodeId,
  state: SharedState,
  slice: K,
): NonNullable<SharedState[K]> {
  const value = state[slice];
  if (value === undefined) throw new MissingSliceError(nodeId, String(slice));
  return value as NonNullable<SharedState[K]>;
}

/**
 * Assemble the AuditResult literal from shared slices. Key insertion order
 * mirrors the pre-pipeline engine exactly (golden byte-stability depends on
 * construction order under JSON.stringify). ran_at is the only
 * caller-injected variance and stays outside artifact payloads. `tag` names
 * the calling node in requireSlice diagnostics.
 */
export function assembleAuditResult(
  state: SharedState,
  ranAtIso: string,
  tag: AgNodeId,
): AuditResult {
  const pi = requireSlice(tag, state, "project_input");
  const sc = requireSlice(tag, state, "stage_context");
  const manifest = requireSlice(tag, state, "input_manifest");
  const rules = requireSlice(tag, state, "rule_results");
  const questions = requireSlice(tag, state, "audit_questions");
  const pack = getPack(pi.jurisdiction);

  const findings =
    state.adjudication?.final_findings ?? rules.deterministic_findings;

  const limitations: string[] = [];
  if (pack.framework.qualification_note) limitations.push(pack.framework.qualification_note);
  if (sc.mapping_confidence !== "authoritative") {
    limitations.push(
      `The ${sc.native_stage_display_name} → ${sc.canonical_stages.join("+")} mapping carries '${sc.mapping_confidence}' confidence; verify against ${pack.framework.name}.`,
    );
  }
  if (pack.framework.stage_limitation_note) {
    limitations.push(pack.framework.stage_limitation_note);
  }
  for (const ref of state.adjudication?.skipped_decision_refs ?? []) {
    limitations.push(
      `Adjudication recorded a decision targeting unknown finding id '${ref}'; it was not applied.`,
    );
  }

  // ODD declaration surface (ADR-0005): membership status, three-zone claim
  // stamp and input-floor satisfaction ride on every assembled result.
  const odd = resolveOdd(pack.jurisdiction, sc.canonical_stages);
  const zone = oddClaimZone(odd);
  const providedIds = new Set(
    manifest.filter((m) => m.state === "provided").map((m) => m.input_id),
  );
  const floorSatisfied = oddFloorSatisfied(odd, providedIds);
  if (zone.stamp) {
    limitations.push(`Capability claim: ${zone.stamp}.`);
  }
  if (floorSatisfied === false) {
    limitations.push(
      `Capability claim invalid: recorded inputs fall below the ODD input floor for this cell (ADR-0005).`,
    );
  }

  return {
    audit_id: `AUD-${pi.project_id}-${sc.native_stage_id.replace(/[^A-Za-z0-9]/g, "-")}`,
    project_id: pi.project_id,
    jurisdiction: pack.jurisdiction,
    framework_name: pack.framework.name,
    native_stage_id: sc.native_stage_id,
    native_stage_display_name: sc.native_stage_display_name,
    canonical_stages: sc.canonical_stages,
    mapping_confidence: sc.mapping_confidence,
    ran_at: ranAtIso,
    odd_declaration_version: odd.declaration_version,
    odd_status: odd.status === "in" ? "in" : "mapped_unproven",
    odd_stamp: zone.stamp,
    odd_floor_satisfied: floorSatisfied,
    input_manifest: manifest.map(({ conditional_on: _c, ...rest }) => rest),
    findings,
    missing_information: rules.missing_information,
    audit_questions: questions,
    limitations,
    disclaimer: DISCLAIMER,
  };
}
