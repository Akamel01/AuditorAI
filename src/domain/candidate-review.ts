// ADR-0006 candidate-review policy (pure domain): promotion of AI candidates
// into Findings on a stored draft. Candidates are their own species; review
// never flips a shared status — acceptance mints an F-AI-* Finding with
// explicit provenance, rejection drops the pending entry. Zero route/pipeline
// imports; routes parse requests and delegate here. ADR-0009: every applied
// disposition is captured best-effort as a CandidateOutcome row once the whole
// batch has applied cleanly — a logging failure is swallowed and can never
// fail or corrupt the promotion.
import { validateRecommendationWording } from "@/domain/pipeline/wording";
import { buildOutcomeRow, recordCandidateOutcome } from "@/domain/outcomes";
import type {
  AuditResult,
  CandidateFindingRecord,
  CandidateOutcome,
  Finding,
  RunProvenance,
} from "@/domain/types";

export const CANDIDATE_ACTIONS = ["accept", "accept_with_edits", "reject"] as const;
export type CandidateAction = (typeof CANDIDATE_ACTIONS)[number];

export interface CandidatePromotion {
  /** Position in the draft's pending candidate_findings array. */
  index: number;
  action: CandidateAction;
  edited_recommendation?: string;
  edited_statement?: string;
  /** ADR-0009 whitelist parity (ticket 05): category is free text validated
   *  server-side by the outcome schema; "" is a non-edit. */
  edited_category?: string;
  /** ADR-0009 whitelist parity: replacement evidence id set; ids not present
   *  on the candidate are dropped. Undefined is a non-edit. */
  edited_evidence_ids?: string[];
  reviewer_note?: string;
}

/** ADR-0009 §4 capture posture for outcome logging (ticket 05). Absent ⇒
 *  logged under the ambient CONSENT_VERSION with default pseudonym — the
 *  server default stays "logged" so devtab/tests are unaffected.
 *  {declined:true} ⇒ the disposition applies but NO row reaches the sink:
 *  an unconsented decision is never logged, not even as a tombstone. */
export type OutcomeConsent = { version: string } | { declined: true };

export interface ApplyPromotionsOptions {
  consent?: OutcomeConsent;
  /** Stable pseudonymous auditor id; defaults to DEFAULT_AUDITOR_PSEUDONYM. */
  auditor_pseudonym?: string;
  /** ADR-0012 audit-level provenance fallback (adapter/prompt identity at
   *  PATCH time) for candidates carrying no generation_provenance stamp;
   *  per-candidate stamps take precedence field-by-field. */
  run_provenance?: RunProvenance;
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
 *  recommendation exactly as it does for deterministic findings. Category and
 *  evidence edits (ADR-0009 whitelist) replace the copied values; unknown
 *  evidence ids are dropped rather than minted. */
export function promoteCandidate(
  candidate: CandidateFindingRecord,
  seq: number,
  edits?: Pick<
    CandidatePromotion,
    | "edited_recommendation"
    | "edited_statement"
    | "edited_category"
    | "edited_evidence_ids"
    | "reviewer_note"
  >,
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
  const category =
    edits?.edited_category !== undefined && edits.edited_category !== ""
      ? edits.edited_category
      : candidate.category;
  const evidence = edits?.edited_evidence_ids
    ? candidate.evidence.filter((e) => edits.edited_evidence_ids!.includes(e.evidence_id))
    : candidate.evidence;
  const edited =
    !!edits &&
    ((edits.edited_recommendation !== undefined && edits.edited_recommendation !== "") ||
      !!edits.edited_statement ||
      (edits.edited_category !== undefined && edits.edited_category !== "") ||
      edits.edited_evidence_ids !== undefined);
  return {
    ok: true,
    finding: {
      finding_id: `F-AI-${String(seq).padStart(3, "0")}`,
      kind: candidate.kind,
      category,
      location: candidate.location,
      road_users: candidate.road_users,
      scenario: candidate.scenario,
      statement,
      evidence,
      assumptions: candidate.assumptions,
      risk_components: { severity: null, likelihood: null, exposure: null, scale_id: null },
      confidence: { ...PROMOTED_CONFIDENCE },
      rationale: candidate.rationale,
      recommendation,
      source_trace: [{ origin: "ai_candidate", producer: candidate.producer }],
      reviewer_status: edited ? "accepted_with_edits" : "accepted",
      reviewer_note: edits?.reviewer_note ?? null,
    },
  };
}

/** Apply promotions onto a copy of the stored draft; the input object is never
 *  mutated. Any failure leaves nothing half-applied. Indexes refer to the
 *  pending array as the caller saw it: promotions apply highest-index-first so
 *  earlier removals never shift later targets. Rejected candidates are dropped
 *  from pending without minting a Finding (ADR-0006). ADR-0009: each applied
 *  disposition is captured as a CandidateOutcome row (snapshot = pre-edit
 *  candidate state, edited_fields only for accept_with_edits); rows flush only
 *  after the batch applies cleanly, so aborted promotions emit nothing.
 *  Ticket 05: options.consent === {declined:true} skips row construction
 *  entirely (nothing reaches the sink); otherwise rows carry the caller's
 *  auditor_pseudonym/consent version or the ADR-0009 defaults. */
export function applyCandidatePromotions(
  audit: AuditResult,
  promotions: readonly CandidatePromotion[],
  options?: ApplyPromotionsOptions,
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
  const occurredAt = new Date().toISOString();
  const outcomeRows: CandidateOutcome[] = [];
  const consent = options?.consent;
  const isDeclined = (x: OutcomeConsent | undefined): x is Extract<OutcomeConsent, { declined: true }> =>
    x !== undefined && "declined" in x;
  const consentDeclined = isDeclined(consent);
  const identity = {
    ...(options?.auditor_pseudonym !== undefined
      ? { auditor_pseudonym: options.auditor_pseudonym }
      : {}),
    ...(consent && !isDeclined(consent) ? { consent_version: consent.version } : {}),
  };
  // ADR-0012: audit-level fallback; buildOutcomeRow prefers each candidate's
  // own generation_provenance stamp field-by-field.
  const runProvenance = options?.run_provenance;

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
      if (!consentDeclined)
        outcomeRows.push(
          buildOutcomeRow({
            occurred_at: occurredAt,
            project_id: next.project_id,
            audit_id: next.audit_id,
            odd_stamp: next.odd_stamp,
            jurisdiction: next.jurisdiction,
            native_stage_id: next.native_stage_id,
            canonical_stage: next.canonical_stages[0] ?? null,
            action: "reject",
            candidate,
            run_provenance: runProvenance,
            ...identity,
            ...(promo.reviewer_note !== undefined ? { note: promo.reviewer_note } : {}),
          }),
        );
      continue;
    }
    const edits = {
      ...(promo.edited_recommendation !== undefined ? { edited_recommendation: promo.edited_recommendation } : {}),
      ...(promo.edited_statement !== undefined ? { edited_statement: promo.edited_statement } : {}),
      ...(promo.edited_category !== undefined ? { edited_category: promo.edited_category } : {}),
      ...(promo.edited_evidence_ids !== undefined ? { edited_evidence_ids: promo.edited_evidence_ids } : {}),
      ...(promo.reviewer_note !== undefined ? { reviewer_note: promo.reviewer_note } : {}),
    };
    const promoted = promoteCandidate(candidate, nextAiSeq(next.findings), edits);
    if (!promoted.ok) return promoted;
    next.findings = [...next.findings, promoted.finding];
    pending.splice(idx, 1);
    if (!consentDeclined)
      outcomeRows.push(
        buildOutcomeRow({
          occurred_at: occurredAt,
          project_id: next.project_id,
          audit_id: next.audit_id,
          odd_stamp: next.odd_stamp,
          jurisdiction: next.jurisdiction,
          native_stage_id: next.native_stage_id,
          canonical_stage: next.canonical_stages[0] ?? null,
          action: promo.action,
          candidate,
          run_provenance: runProvenance,
          ...identity,
          ...(promo.action === "accept_with_edits"
            ? {
                edited_fields: {
                  // Mirror promoteCandidate's edit semantics: "" is a non-edit.
                  ...(promo.edited_statement ? { statement_text: promo.edited_statement } : {}),
                  ...(promo.edited_category ? { category: promo.edited_category } : {}),
                  ...(promo.edited_recommendation ? { recommendation: promo.edited_recommendation } : {}),
                  ...(promo.edited_evidence_ids !== undefined
                    ? { evidence_ids: promo.edited_evidence_ids }
                    : {}),
                },
              }
            : {}),
          ...(promo.reviewer_note !== undefined ? { note: promo.reviewer_note } : {}),
        }),
      );
  }

  if (pending.length === 0) delete next.candidate_findings;
  else next.candidate_findings = pending;

  // Best-effort ADR-0009 capture, only for fully applied batches. A declined
  // consent leaves outcomeRows empty: nothing reaches the sink.
  for (const row of outcomeRows) recordCandidateOutcome(row);
  return { ok: true, value: next };
}

/** Loud-recording rule for issuance (DEC-2026-08-23 grill): freezing a draft
 *  with unreviewed candidates succeeds but names them in limitations. */
export function unreviewedCandidateLimitation(count: number): string {
  return `${count} AI-generated candidate finding${count === 1 ? " was" : "s were"} not reviewed by the auditor before issuance and ${
    count === 1 ? "is" : "are"
  } not reflected in this issue.`;
}
