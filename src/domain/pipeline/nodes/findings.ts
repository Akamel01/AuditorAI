// AG-FINDINGS — Deterministic Findings Shaping (deterministic). Gates the raw
// rule outcomes into schema-valid draft Findings: reviewer_status=draft, risk
// components null, recommendation null, deterministic source trace. Never
// fabricates safety_concern kinds.
import {
  makeArtifact,
  requireSlice,
} from "@/domain/pipeline/nodes/shared";
import type { NodeFn, RuleResultsSlice } from "@/domain/pipeline/types";
import type { Finding } from "@/domain/types";

export function shapeFinding(f: Finding): Finding {
  return {
    ...f,
    kind: f.kind === "safety_concern" ? f.kind : "compliance_question",
    risk_components: { severity: null, likelihood: null, exposure: null, scale_id: null },
    recommendation: null,
    reviewer_status: "draft",
    reviewer_note: null,
    source_trace: f.source_trace.map((t) =>
      t.origin === "deterministic_rule" ? t : { ...t, origin: "deterministic_rule" as const },
    ),
  };
}

export const runFindings: NodeFn = (state, ctx) => {
  const rules = requireSlice("AG-FINDINGS", state, "rule_results") as RuleResultsSlice;
  const shaped = rules.deterministic_findings.map(shapeFinding);
  const slice: RuleResultsSlice = { ...rules, deterministic_findings: shaped };
  return {
    artifacts: [
      makeArtifact(
        "AG-FINDINGS",
        "domain-engine",
        "findings.deterministic",
        1,
        ctx,
        "verified",
        shaped,
      ),
    ],
    patch: { rule_results: slice },
  };
};
