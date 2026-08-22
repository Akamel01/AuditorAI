// AG-RULES — Deterministic Rule Evaluation (deterministic). Completeness
// rules surface missing-information questions; process/eligibility rules fire
// compliance-question drafts. No scores, ever; output_discipline lives at
// adjudication save time.
import { getPack } from "@/domain/packs";
import {
  makeEligibilityFinding,
  makeProcessFinding,
} from "@/domain/pipeline/nodes/rules-findings";
import { makeArtifact, requireSlice } from "@/domain/pipeline/nodes/shared";
import type {
  NodeFn,
  RuleResultsSlice,
  StageContextSlice,
} from "@/domain/pipeline/types";
import type { Finding, MissingInformationQuestion } from "@/domain/types";

export const runRules: NodeFn = (state, ctx) => {
  const sc = requireSlice("AG-RULES", state, "stage_context") as StageContextSlice;
  const manifest = requireSlice("AG-RULES", state, "input_manifest");
  const pack = getPack(sc.jurisdiction);

  const missing_information: MissingInformationQuestion[] = [];
  const deterministic_findings: Finding[] = [];

  for (const rule of pack.rules) {
    if (!rule.applies_to_native_stage_ids.includes(sc.native_stage_id)) continue;

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
        deterministic_findings.push(
          makeProcessFinding(pack, sc.native_stage_id, rule, unsatisfied),
        );
      }
      continue;
    }

    if (rule.kind === "eligibility") {
      // Eligibility rules encode structural constraints (e.g., combined audits
      // need recorded eligibility). They fire as compliance questions so the
      // human decides, rather than silently passing or failing.
      deterministic_findings.push(makeEligibilityFinding(pack, sc.native_stage_id, rule));
      continue;
    }

    // output_discipline rules are enforced on save/adjudication
  }

  const slice: RuleResultsSlice = { missing_information, deterministic_findings };
  return {
    artifacts: [
      makeArtifact("AG-RULES", "domain-engine", "rules.results", 1, ctx, "verified", slice),
    ],
    patch: { rule_results: slice },
  };
};
