// ADR-0006 candidate-review policy (pure domain): promotion of AI candidates
// into Findings on a stored draft. Candidates are their own species; review
// never flips a shared status — acceptance mints an F-AI-* Finding with
// explicit provenance, rejection drops the pending entry. Zero route/pipeline
// imports; routes parse requests and delegate here.
import { validateRecommendationWording } from "@/domain/pipeline/wording";
import type { AuditResult, CandidateFindingRecord, Finding } from "@/domain/types";

export const CANDIDATE_ACTIONS = ["accept", "accept_with_edits", "reject"] as const;
export type CandidateAction = (typeof CANDIDATE_ACTIONS)[number];

export interface CandidatePromotion {
  /** Position in the draft's pending candidate_findings array. */
  index: number;
  action: CandidateAction;
  edited_recommendation?: string;
  edited_statement?: string;
  reviewer_note?: string;
}

type PendingCandidates = NonNullable<AuditResult["candidate_findings"]>;

/** Honest machine-origin provenance: confidence is never invented, never hidden
 *  (CONTEXT.md: Confidence); risk components stay unscored per ADR-0003. */
const PROMOTED_CONFIDENCE = {
  label: "low",
  basis: "promoted from an AI-generated candidate by the auditor; risk components unscored",
} as const;

function nextAiSeq(findings: readonly Finding[]): number {
  let max = 0;
  for (const f of findings) {
    const m = /^F-AI-(\d+)$/.exec(f.finding_id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** Mint a Finding from a candidate: fields copy verbatim, identity and
 *  provenance are minted here, wording gate applies to any edited
 *  recommendation exactly as it does for deterministic findings. */
export function promoteCandidate(
  candidate: CandidateFindingRecord,
  seq: number,
  edits?: Pick<CandidatePromotion, "edited_recommendation" | "edited_statement" | "reviewer_note">,
): { ok: true; finding: Finding } | { ok: false; error: string } {
  let recommendation = candidate.recommendation ?? null;
  if (edits?.edited_recommendation !== undefined && edits.edited_recommendation !== "") {
    const gate = validateRecommendationWording(edits.edited_recommendation);
    if (!gate.ok) {
      return { ok: false, error: `recommendation uses banned wording: ${gate.violations.join(", ")}` };
    }
    recommendation = edits.edited_recommendation;
  }
  const statement = edits?.edited_statement
    ? { ...candidate.statement, text: edits.edited_statement }
    : candidate.statement;
  return {
    ok: true,
    finding: {
      finding_id: `F-AI-${String(seq).padStart(3, "0")}`,
      kind: candidate.kind,
      category: candidate.category,
      location: candidate.location,
      road_users: candidate.road_users,
      scenario: candidate.scenario,
      statement,
      evidence: candidate.evidence,
      assumptions: candidate.assumptions,
      risk_components: { severity: null, likelihood: null, exposure: null, scale_id: null },
      confidence: { ...PROMOTED_CONFIDENCE },
      rationale: candidate.rationale,
      recommendation,
      source_trace: [{ origin: "ai_candidate", producer: candidate.producer }],
      reviewer_status:
        edits && (edits.edited_recommendation !== undefined || edits.edited_statement !== undefined)
          ? "accepted_with_edits"
          : "accepted",
      reviewer_note: edits?.reviewer_note ?? null,
    },
  };
}

/** Apply promotions onto a copy of the stored draft; the input object is never
 *  mutated. Any failure leaves nothing half-applied. Indexes refer to the
 *  pending array as the caller saw it: promotions apply highest-index-first so
 *  earlier removals never shift later targets. Rejected candidates are dropped
 *  from pending without minting a Finding (ADR-0006). */
export function applyCandidatePromotions(
  audit: AuditResult,
  promotions: readonly CandidatePromotion[],
): { ok: true; value: AuditResult } | { ok: false; error: string } {
  const next: AuditResult = {
    ...audit,
    findings: audit.findings.map((f) => ({ ...f })),
    ...(audit.candidate_findings
      ? { candidate_findings: audit.candidate_findings.map((c) => ({ ...c })) }
      : {}),
  };
  const pending: PendingCandidates = next.candidate_findings ?? [];
  const ordered = [...promotions].sort((a, b) => b.index - a.index);

  for (const promo of ordered) {
    if (!CANDIDATE_ACTIONS.includes(promo.action)) {
      return { ok: false, error: `unknown candidate action ${String(promo.action)}` };
    }
    const idx = promo.index;
    if (!Number.isInteger(idx) || idx < 0 || idx >= pending.length) {
      return { ok: false, error: `unknown candidate index ${String(promo.index)}` };
    }
    const candidate = pending[idx];
    if (promo.action === "reject") {
      pending.splice(idx, 1);
      continue;
    }
    const promoted = promoteCandidate(candidate, nextAiSeq(next.findings), {
      ...(promo.edited_recommendation !== undefined ? { edited_recommendation: promo.edited_recommendation } : {}),
      ...(promo.edited_statement !== undefined ? { edited_statement: promo.edited_statement } : {}),
      ...(promo.reviewer_note !== undefined ? { reviewer_note: promo.reviewer_note } : {}),
    });
    if (!promoted.ok) return promoted;
    next.findings = [...next.findings, promoted.finding];
    pending.splice(idx, 1);
  }

  if (pending.length === 0) delete next.candidate_findings;
  else next.candidate_findings = pending;
  return { ok: true, value: next };
}

/** Loud-recording rule for issuance (DEC-2026-08-23 grill): freezing a draft
 *  with unreviewed candidates succeeds but names them in limitations. */
export function unreviewedCandidateLimitation(count: number): string {
  return `${count} AI-generated candidate finding${count === 1 ? " was" : "s were"} not reviewed by the auditor before issuance and ${
    count === 1 ? "is" : "are"
  } not reflected in this issue.`;
}
