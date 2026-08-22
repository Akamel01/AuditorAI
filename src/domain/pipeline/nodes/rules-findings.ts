// Finding shapers shared by AG-RULES (raw instantiation) and AG-FINDINGS
// (schema-valid shaping gate). Moved verbatim from the legacy engine.
import type { PolicyPack } from "@/domain/packs";
import type { Finding } from "@/domain/types";

type PackRule = PolicyPack["rules"][number];

export function makeProcessFinding(
  pack: PolicyPack,
  stageId: string,
  rule: PackRule,
  unsatisfiedInputs: string[],
): Finding {
  return {
    finding_id: `F-${rule.rule_id}-${stageId.replace(/[^A-Za-z0-9]/g, "-")}`,
    kind: "compliance_question",
    category: "process_continuity",
    location: null,
    road_users: [],
    scenario: null,
    statement: {
      text: rule.description,
      normative_basis_note: `Applicable at ${stageId}`,
    },
    evidence: (rule.evidence_ids ?? []).map((id) => ({
      evidence_id: id,
      quote: null,
      use: "defines_requirement" as const,
    })),
    assumptions: [
      {
        text: `Required inputs not evidenced: ${unsatisfiedInputs.join(", ")}`,
        basis: "input manifest states",
      },
    ],
    risk_components: { severity: null, likelihood: null, exposure: null, scale_id: null },
    confidence: {
      label: "high",
      basis: "Deterministic rule over recorded input states.",
    },
    rationale:
      "Derived deterministically from the policy-pack rule and the project's recorded input states; distinguishable from quoted evidence.",
    recommendation: null,
    source_trace: [{ origin: "deterministic_rule", rule_id: rule.rule_id }],
    reviewer_status: "draft",
    reviewer_note: null,
  };
}

export function makeEligibilityFinding(
  pack: PolicyPack,
  stageId: string,
  rule: PackRule,
): Finding {
  const exception = pack.exceptions.find(
    (e) => e.spans_native_stage_ids.includes(stageId) || e.kind === "no_native_equivalent",
  );
  return {
    finding_id: `F-${rule.rule_id}-${stageId.replace(/[^A-Za-z0-9]/g, "-")}`,
    kind: "compliance_question",
    category: "eligibility",
    location: null,
    road_users: [],
    scenario: null,
    statement: {
      text: exception?.condition ?? rule.description,
      normative_basis_note: exception ? `Exception ${exception.exception_id}` : null,
    },
    evidence: (exception?.evidence_ids ?? rule.evidence_ids ?? []).map((id) => ({
      evidence_id: id,
      quote: null,
      use: "context" as const,
    })),
    assumptions: [],
    risk_components: { severity: null, likelihood: null, exposure: null, scale_id: null },
    confidence: {
      label: "high",
      basis: "Structural constraint encoded in the jurisdiction policy pack.",
    },
    rationale:
      "Eligibility conditions are recorded so the human auditor confirms applicability; nothing is silently assumed.",
    recommendation: null,
    source_trace: [{ origin: "deterministic_rule", rule_id: rule.rule_id }],
    reviewer_status: "draft",
    reviewer_note: null,
  };
}
