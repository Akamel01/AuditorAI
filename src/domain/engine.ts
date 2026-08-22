// The audit engine: deterministic execution of one audit for a Project at its
// selected Native Stage (§19 pipeline, deterministic subset).
//
// Purity contract: identical (project, packs) => identical AuditResult except
// ran_at, which is injected by the caller. No randomness, no I/O beyond pack
// loading, no AI involvement here (AI candidates arrive post-hoc, labelled).
import {
  type AuditContext,
  type AuditResult,
  type Finding,
  type InputValueState,
  type JurisdictionId,
  type MissingInformationQuestion,
  type Project,
} from "./types";
import { getPack, type PolicyPack } from "./packs";

export const DISCLAIMER =
  "This software assists the Road Safety Audit process. It does not replace professional judgment: final responsibility remains with the qualified auditor and the road authority. Compliance-oriented outputs never imply that a scheme is 'safe'.";

export class StageNotEligibleError extends Error {
  constructor(
    public readonly jurisdiction: JurisdictionId,
    public readonly native_stage_id: string,
    reason: string,
    public readonly evidence_ids: string[],
  ) {
    super(reason);
  }
}

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
  const pack = getPack(project.stage_selection.jurisdiction);
  const stage = requireStage(pack, project.stage_selection.native_stage_id);

  // ---- Input manifest -----------------------------------------------------
  const manifest = pack.inputs
    .filter((i) => i.stage_ids.includes(stage.native_stage_id))
    .map((i) => {
      const stored = project.input_values[i.input_id];
      const state = resolveState(stored, i.requirement_level);
      return {
        input_id: i.input_id,
        label: i.label,
        requirement_level: i.requirement_level,
        state,
        evidence_ids: i.evidence_ids ?? [],
        conditional_on: i.conditional_on ?? null,
      };
    });

  // ---- Deterministic rules -------------------------------------------------
  const missing_information: MissingInformationQuestion[] = [];
  const findings: Finding[] = [];

  for (const rule of pack.rules) {
    if (!rule.applies_to_native_stage_ids.includes(stage.native_stage_id)) continue;

    if (rule.kind === "completeness") {
      for (const inputId of rule.requires_input_ids ?? []) {
        const entry = manifest.find((m) => m.input_id === inputId);
        if (!entry) continue;
        const blocking =
          entry.state === "required_missing" ||
          entry.state === "recommended_missing" ||
          entry.state === "unknown" ||
          entry.state === "conflicting";
        if (!blocking) continue;
        missing_information.push({
          question_id: `MI-${rule.rule_id}-${entry.input_id}`,
          input_id: entry.input_id,
          label: entry.label,
          requirement_level: entry.requirement_level,
          note: `${rule.description} (state: ${entry.state})`,
          evidence_ids: [...new Set([...(rule.evidence_ids ?? []), ...entry.evidence_ids])],
        });
      }
      continue;
    }

    if (rule.kind === "process") {
      const unsatisfied = (rule.requires_input_ids ?? []).filter((inputId) => {
        const entry = manifest.find((m) => m.input_id === inputId);
        return entry && entry.state !== "provided" && entry.state !== "not_applicable";
      });
      if (unsatisfied.length > 0) {
        findings.push(makeProcessFinding(pack, stage.native_stage_id, rule, unsatisfied));
      }
      continue;
    }

    if (rule.kind === "eligibility") {
      // Eligibility rules encode structural constraints (e.g., combined audits
      // need recorded eligibility). They fire as compliance questions so the
      // human decides, rather than silently passing or failing.
      findings.push(makeEligibilityFinding(pack, stage.native_stage_id, rule));
      continue;
    }

    // output_discipline rules are enforced on save/adjudication (see validateRecommendationWording)
  }

  // ---- Audit questions ------------------------------------------------------
  const questions = pack.audit_questions
    .filter((q) => q.applies_to_canonical.some((c) => stage.canonical_stages.includes(c as never)))
    .map((q) => ({
      question_id: q.question_id,
      text: q.text,
      topic: q.topic,
      applies_to_canonical: q.applies_to_canonical as AuditResult["audit_questions"][number]["applies_to_canonical"],
      road_users: q.road_users ?? [],
      source_note: q.source_note ?? null,
      addressed: false,
    }));

  // ---- Limitations ----------------------------------------------------------
  const limitations: string[] = [];
  if (pack.framework.qualification_note) limitations.push(pack.framework.qualification_note);
  if (stage.confidence !== "authoritative") {
    limitations.push(
      `The ${stage.display_name} → ${stage.canonical_stages.join("+")} mapping carries '${stage.confidence}' confidence; verify against ${pack.framework.name}.`,
    );
  }
  const unscored = !pack.rules.some((r) => r.severity_hint && r.severity_hint !== "none");
  if (unscored && pack.framework.status === "authoritative_current" && pack.jurisdiction === "UK") {
    limitations.push(
      "GG 119 assigns no severity scores to findings; formal risk assessment sits in the designer response [EV-UK-024].",
    );
  }

  return {
    audit_id: `AUD-${project.project_id}-${stage.native_stage_id.replace(/[^A-Za-z0-9]/g, "-")}`,
    project_id: project.project_id,
    jurisdiction: pack.jurisdiction,
    framework_name: pack.framework.name,
    native_stage_id: stage.native_stage_id,
    native_stage_display_name: stage.display_name,
    canonical_stages: stage.canonical_stages,
    mapping_confidence: stage.confidence,
    ran_at: ranAtIso,
    input_manifest: manifest.map(({ conditional_on: _c, ...rest }) => rest),
    findings,
    missing_information,
    audit_questions: questions,
    limitations,
    disclaimer: DISCLAIMER,
  };
}

// ---- Recommendation wording discipline (ADR-0003, canonical across packs) ----
const BANNED_WORDS = ["consider", "must"];

export function validateRecommendationWording(text: string): {
  ok: boolean;
  violations: string[];
} {
  const lower = text.toLowerCase();
  const violations = BANNED_WORDS.filter((w) =>
    new RegExp(`\\b${w}\\b`).test(lower),
  );
  return { ok: violations.length === 0, violations };
}

// ---- helpers -----------------------------------------------------------------

function requireStage(
  pack: ReturnType<typeof getPack>,
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

type PolicyStage = PolicyPack["stages"][number];
type PackRule = PolicyPack["rules"][number];

function resolveState(
  stored: { state: InputValueState; value?: string } | undefined,
  level: "required" | "recommended" | "optional" | "unknown",
): InputValueState {
  if (stored) {
    if (stored.state === "provided" && !stored.value?.trim()) {
      return missingStateFor(level);
    }
    return stored.state;
  }
  return missingStateFor(level);
}

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

function makeProcessFinding(
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

function makeEligibilityFinding(
  pack: PolicyPack,
  stageId: string,
  rule: PackRule,
): Finding {
  const exception = pack.exceptions.find((e) =>
    e.spans_native_stage_ids.includes(stageId) || e.kind === "no_native_equivalent",
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
