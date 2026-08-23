// AG-ADJUDICATION — Human Adjudication (human class). Without recorded human
// decisions the batch path carries deterministic drafts forward unchanged and
// unverified. Edited recommendations pass the wording gate; violations are
// recorded and the edit is not applied. Decisions targeting unknown finding
// ids are recorded loudly (skipped_decision_refs → result limitations), never
// silently dropped.
import { validateRecommendationWording } from "@/domain/pipeline/wording";
import { requireSlice } from "@/domain/pipeline/result";
import { makeArtifact } from "@/domain/pipeline/nodes/shared";
import type {
  AdjudicationSlice,
  NodeFn,
} from "@/domain/pipeline/types";
import type { Finding } from "@/domain/types";

export const runAdjudication: NodeFn = (state, ctx) => {
  const rules = requireSlice("AG-ADJUDICATION", state, "rule_results");
  const decisions = ctx.decisions ?? [];

  let final: Finding[] = rules.deterministic_findings;
  let violations: { finding_id: string; violations: string[] }[] = [];
  let skippedRefs: string[] = [];

  if (decisions.length > 0) {
    const byId = new Map(rules.deterministic_findings.map((f) => [f.finding_id, f]));
    final = rules.deterministic_findings.map((f) => f);
    for (const d of decisions) {
      const idx = final.findIndex((f) => f.finding_id === d.finding_id);
      if (idx === -1 || !byId.has(d.finding_id)) {
        skippedRefs = [...skippedRefs, d.finding_id];
        continue;
      }

      if (
        d.action === "accept_with_edits" &&
        d.edited_recommendation_text !== undefined &&
        d.edited_recommendation_text !== ""
      ) {
        const gate = validateRecommendationWording(d.edited_recommendation_text);
        if (!gate.ok) {
          // Wording gate blocks the edit; record it loudly instead.
          violations = [...violations, { finding_id: d.finding_id, violations: gate.violations }];
          continue;
        }
      }

      const base: Finding = { ...final[idx] };
      if (d.action === "accept_with_edits") {
        if (d.edited_statement_text !== undefined)
          base.statement = { ...base.statement, text: d.edited_statement_text };
        if (d.edited_recommendation_text !== undefined && d.edited_recommendation_text !== "")
          base.recommendation = d.edited_recommendation_text;
        base.reviewer_status = "accepted_with_edits";
      } else if (d.action === "accept") {
        base.reviewer_status = "accepted";
      } else if (d.action === "reject") {
        base.reviewer_status = "rejected";
      } else {
        base.reviewer_status = "escalated";
      }
      if (d.reviewer_note !== undefined) base.reviewer_note = d.reviewer_note;
      final[idx] = base;
    }
  }

  const slice: AdjudicationSlice = {
    final_findings: final,
    wording_violations: violations,
    skipped_decision_refs: skippedRefs,
  };
  return {
    artifacts: [
      makeArtifact(
        "AG-ADJUDICATION",
        "finding-adjudicator",
        "adjudication.decisions",
        1,
        ctx,
        decisions.length > 0 && violations.length === 0 ? "verified" : "draft",
        slice,
      ),
    ],
    patch: { adjudication: slice },
  };
};
