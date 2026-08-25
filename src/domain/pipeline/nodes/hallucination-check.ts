// AG-HALLUCINATION-CHECK — Hallucination Check (deterministic, ADR-0010).
// Population: candidate findings when present (AI on); engine deterministic
// findings otherwise (AI off — baseline audited by the same rules). Checks:
// cited evidence_id exists in the compiled registry; each asserted quote
// matches the registry record's quote under whitespace normalization; and,
// for the candidate population only, category/road_users membership in the
// pack vocabulary (engine finding categories are the engine's own taxonomy,
// not bounded by CandidateVocabulary). Failures annotate with
// validation:{status:"auto-flagged", reasons[]} — items are never removed.
// No model calls anywhere.
import { getPack } from "@/domain/packs";
import { tryGetEvidence } from "@/lib/evidence";
import { requireSlice } from "@/domain/pipeline/result";
import { makeArtifact } from "@/domain/pipeline/nodes/shared";
import { annotate, normalizeWhitespace } from "@/domain/pipeline/nodes/validation-shared";
import type {
  NodeFn,
  RuleResultsSlice,
  StageContextSlice,
  ValidationSummarySlice,
} from "@/domain/pipeline/types";
import type {
  CandidateFindingRecord,
  Finding,
  FindingEvidence,
} from "@/domain/types";

/** Registry records carry an optional verbatim quote; the accessor's type
 *  predates it, so widen locally instead of touching the lib seam. */
type RecordWithQuote = { quote?: string | null };

function evidenceReasons(citations: readonly FindingEvidence[]): string[] {
  const reasons: string[] = [];
  for (const c of citations) {
    const rec = tryGetEvidence(c.evidence_id);
    if (!rec) {
      reasons.push(`unknown-evidence-id:${c.evidence_id}`);
      continue;
    }
    const claimed = c.quote ?? null;
    if (claimed !== null && claimed !== "") {
      // A verbatim quote is asserted: it must match what the registry record
      // attests. Records without a stored quote cannot confirm it.
      const attested = (rec as RecordWithQuote).quote ?? null;
      if (
        attested === null ||
        normalizeWhitespace(claimed) !== normalizeWhitespace(attested)
      ) {
        reasons.push(`quote-mismatch:${c.evidence_id}`);
      }
    }
  }
  return reasons;
}

function vocabularyReasons(
  packVocab: { issue_categories: readonly string[]; road_user_categories: readonly string[] },
  item: Pick<CandidateFindingRecord, "category" | "road_users">,
): string[] {
  const reasons: string[] = [];
  if (!packVocab.issue_categories.includes(item.category)) {
    reasons.push(`vocabulary-violation:category:${item.category}`);
  }
  for (const r of item.road_users) {
    if (!packVocab.road_user_categories.includes(r)) {
      reasons.push(`vocabulary-violation:road_user:${r}`);
    }
  }
  return reasons;
}

export const runHallucinationCheck: NodeFn = (state, ctx) => {
  const rules = requireSlice(
    "AG-HALLUCINATION-CHECK",
    state,
    "rule_results",
  ) as RuleResultsSlice;
  const sc = requireSlice(
    "AG-HALLUCINATION-CHECK",
    state,
    "stage_context",
  ) as StageContextSlice;
  const pack = getPack(sc.jurisdiction);

  const candidates = state.candidate_findings ?? null;
  const onCandidates = candidates !== null;
  const population: (CandidateFindingRecord | Finding)[] =
    candidates ?? rules.deterministic_findings;

  let flaggedCount = 0;
  let changed = false;
  const annotated = population.map((item) => {
    const reasons = [
      ...evidenceReasons(item.evidence),
      ...(onCandidates ? vocabularyReasons(pack, item) : []),
    ];
    if (reasons.length === 0) return item;
    flaggedCount += 1;
    changed = true;
    return annotate(item, reasons);
  });

  const summary: ValidationSummarySlice = {
    checked: population.length,
    flagged: flaggedCount,
    rate: population.length === 0 ? 0 : flaggedCount / population.length,
  };

  const patch: {
    candidate_findings?: CandidateFindingRecord[];
    rule_results?: RuleResultsSlice;
    validation_summary: ValidationSummarySlice;
  } = { validation_summary: summary };
  if (changed) {
    if (onCandidates) patch.candidate_findings = annotated as CandidateFindingRecord[];
    else
      patch.rule_results = {
        ...rules,
        deterministic_findings: annotated as Finding[],
      };
  }

  return {
    artifacts: [
      makeArtifact(
        "AG-HALLUCINATION-CHECK",
        "domain-engine",
        "validation.hallucination",
        1,
        ctx,
        "verified",
        summary,
      ),
    ],
    patch,
  };
};
