// Node-internal helpers shared across pipeline node modules.
import { getPack } from "@/domain/packs";
import { DISCLAIMER } from "@/domain/pipeline/constants";
import type {
  AgNodeId,
  AuditArtifact,
  NodeRunCtx,
  ProducerId,
  PayloadKind,
  SharedState,
  ValidationStatus,
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

export function makeArtifact<P>(
  node: AgNodeId,
  producer: ProducerId,
  kind: PayloadKind,
  seq: number,
  ctx: NodeRunCtx,
  status: ValidationStatus,
  payload: P,
): AuditArtifact<P> {
  return {
    artifact_id: `ART-${node.replace(/^AG-/, "")}-${seq}`,
    node_id: node,
    producer,
    version: (ctx.versionStart ?? 1) + seq - 1,
    created_at: ctx.ranAtIso,
    validation_status: status,
    payload_kind: kind,
    payload,
  };
}

/**
 * Assemble the AuditResult literal from shared slices. Key insertion order
 * mirrors the pre-pipeline engine exactly (golden byte-stability depends on
 * construction order under JSON.stringify). ran_at is the only
 * caller-injected variance and stays outside artifact payloads.
 */
export function assembleAuditResult(state: SharedState, ranAtIso: string): AuditResult {
  const pi = requireSlice("AG-REPORT", state, "project_input");
  const sc = requireSlice("AG-REPORT", state, "stage_context");
  const manifest = requireSlice("AG-REPORT", state, "input_manifest");
  const rules = requireSlice("AG-REPORT", state, "rule_results");
  const questions = requireSlice("AG-REPORT", state, "audit_questions");
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
  const unscored = !pack.rules.some((r) => r.severity_hint && r.severity_hint !== "none");
  if (unscored && pack.framework.status === "authoritative_current" && pack.jurisdiction === "UK") {
    limitations.push(
      "GG 119 assigns no severity scores to findings; formal risk assessment sits in the designer response [EV-UK-024].",
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
    input_manifest: manifest.map(({ conditional_on: _c, ...rest }) => rest),
    findings,
    missing_information: rules.missing_information,
    audit_questions: questions,
    limitations,
    disclaimer: DISCLAIMER,
  };
}
