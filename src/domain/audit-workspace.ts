// Audit workspace orchestration — lifted from
// src/app/projects/[projectId]/audits/[auditId]/page.tsx for C7 (919→thin).
// Page + CandidateAdjudication become pure render; this module owns fetch
// orchestration (load), FindingCard.patch payload construction (saveFinding),
// CandidateCard.submit + posture (promote/buildPromotion), and issuance.
// All PATCH shapes reuse buildFindingUpdate / CandidatePromotion contracts
// verbatim — no ADR-0006 merge, zero domain import beyond those kernels.
// Route transport is injected via WorkspaceApiAdapter so tests can record
// payloads without DOM/mount and verify index-stable batching.
import { buildFindingUpdate, type ReviewerStatusAction } from "@/domain/finding-review";
import type { CandidatePromotion, OutcomeConsent } from "@/domain/candidate-review";
import { CONSENT_VERSION, DEFAULT_AUDITOR_PSEUDONYM } from "@/domain/outcome-contracts";
import type { AuditIssue, AuditResult, CandidateFindingRecord } from "@/domain/types";

// ── adapter seam ────────────────────────────────────────────────────────
// Mirrors lib/client api<T>(path, init?) but abstracted for injection.
// Using a single generic function keeps call sites identical to the page's
// original `api(...)` while allowing a recording stub in tests.
export type WorkspaceApiAdapter = <T>(
  path: string,
  init?: { method?: string; json?: unknown },
) => Promise<T>;

// ── helpers ─────────────────────────────────────────────────────────────
function auditPath(projectId: string, auditId: string): string {
  return `/api/projects/${projectId}/audits/${auditId}`;
}
function issuesPath(projectId: string, auditId: string): string {
  return `/api/projects/${projectId}/audits/${auditId}/issues`;
}

// ── load ────────────────────────────────────────────────────────────────
// Fetch orchestration lifted from page.tsx:load(). Previously sequential
// (audit then issues); now parallel but behavior-identical — callers still
// receive {audit, issues} and surface catch identically.
export async function load(
  projectId: string,
  auditId: string,
  api: WorkspaceApiAdapter,
): Promise<{ audit: AuditResult; issues: AuditIssue[] }> {
  const [auditRes, issuesRes] = await Promise.all([
    api<{ audit: AuditResult }>(auditPath(projectId, auditId)),
    api<{ issues: AuditIssue[] }>(issuesPath(projectId, auditId)),
  ]);
  return { audit: auditRes.audit, issues: issuesRes.issues };
}
// Alias for spec's `load` naming recency — both exported.
export const loadWorkspace = load;

// ── saveFinding ─────────────────────────────────────────────────────────
// FindingCard.patch lifted verbatim: builds the single-entry
// finding_updates payload via buildFindingUpdate (the only construction
// point, preserved byte-for-byte) and PATCHes it. Caller supplies trimmed
// UI state; null-coercion stays inside buildFindingUpdate.
export interface SaveFindingInput {
  projectId: string;
  auditId: string;
  findingId: string;
  recommendation: string;
  reviewerNote: string;
  reviewerStatus?: ReviewerStatusAction | null;
}

export async function saveFinding(
  input: SaveFindingInput,
  api: WorkspaceApiAdapter,
): Promise<AuditResult> {
  const update = buildFindingUpdate({
    finding_id: input.findingId,
    ...(input.reviewerStatus ? { reviewer_status: input.reviewerStatus } : {}),
    recommendation: input.recommendation,
    reviewer_note: input.reviewerNote,
  });
  const res = await api<{ audit: AuditResult }>(auditPath(input.projectId, input.auditId), {
    method: "PATCH",
    json: { finding_updates: [update] },
  });
  return res.audit;
}

// ── question toggle (flag-and-show) ───────────────────────────────────
// Lifted from the stage-questions checkbox handler; same shape as FindingCard
// patch but for audit_questions. Exported for completeness — page reuses it.
export interface ToggleQuestionInput {
  projectId: string;
  auditId: string;
  questionId: string;
  addressed: boolean;
}

export async function setQuestionAddressed(
  input: ToggleQuestionInput,
  api: WorkspaceApiAdapter,
): Promise<AuditResult> {
  const res = await api<{ audit: AuditResult }>(auditPath(input.projectId, input.auditId), {
    method: "PATCH",
    json: { question_marked: [{ question_id: input.questionId, addressed: input.addressed }] },
  });
  return res.audit;
}

// ── candidate promotion ─────────────────────────────────────────────────
// Posture (ADR-0009 §4: consent + pseudonym) lifted from
// CandidateAdjudication. Kept as a pure builder so tests can verify the
// exact PATCH shape without mounting.
export interface CapturePosture {
  consent: OutcomeConsent;
  auditor_pseudonym: string;
}

export function buildPosture(consentLogged: boolean, pseudonym: string): CapturePosture {
  return {
    consent: consentLogged ? { version: CONSENT_VERSION } : { declined: true },
    auditor_pseudonym: pseudonym.trim() || DEFAULT_AUDITOR_PSEUDONYM,
  };
}

// UI edit state for a single candidate card — mirrors CandidateCard local
// state variables verbatim (statementText, category, recommendation,
// evidenceIdsText, note). All values are raw UI strings; trimming/diffing
// stays inside buildPromotion to mirror promoteCandidate semantics
// (empty string is a non-edit).
export interface CandidateEditInputs {
  statementText: string;
  category: string;
  recommendation: string;
  evidenceIdsText: string;
  note: string;
}

// Build one CandidatePromotion from UI state, diffing only actual edits
// against the presented candidate — exact lift of CandidateCard.buildPromotion
// so the wire payload never carries unchanged fields. Empty-string and
// identity checks mirror promoteCandidate's "is non-edit" contract.
export function buildPromotion(
  index: number,
  action: CandidatePromotion["action"],
  original: CandidateFindingRecord,
  edits: CandidateEditInputs,
): CandidatePromotion {
  const promo: CandidatePromotion = { index, action };
  if (action === "reject" || action === "accept_with_edits") {
    const n = edits.note.trim();
    if (n) promo.reviewer_note = n;
  }
  if (action === "accept_with_edits") {
    const stmt = edits.statementText.trim();
    if (stmt && stmt !== original.statement.text) promo.edited_statement = stmt;
    const cat = edits.category.trim();
    if (cat && cat !== original.category) promo.edited_category = cat;
    const rec = edits.recommendation.trim();
    if (rec && rec !== (original.recommendation ?? "").trim()) promo.edited_recommendation = rec;
    const ids = edits.evidenceIdsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const originalIds = original.evidence.map((e) => e.evidence_id);
    if (JSON.stringify(ids) !== JSON.stringify(originalIds)) {
      promo.edited_evidence_ids = ids;
    }
  }
  return promo;
}

// Promote — lifts CandidateCard.submit. Sends one PATCH with
// candidate_promotions containing the (already built) promotions, plus
// consent + pseudonym from posture. Supports single or batched callers;
// batch indexes are sent verbatim (no client-side shifting) — server
// applyCandidatePromotions sorts descending for index stability, tested via
// the recording adapter.
export interface PromoteInput {
  projectId: string;
  auditId: string;
  promotions: CandidatePromotion[];
  posture: CapturePosture;
}

export async function promote(
  input: PromoteInput,
  api: WorkspaceApiAdapter,
): Promise<AuditResult> {
  const res = await api<{ audit: AuditResult }>(auditPath(input.projectId, input.auditId), {
    method: "PATCH",
    json: {
      candidate_promotions: input.promotions,
      consent: input.posture.consent,
      auditor_pseudonym: input.posture.auditor_pseudonym,
    },
  });
  return res.audit;
}

// Convenience for single-promotion callers (mirrors original per-card submit).
export async function promoteOne(
  projectId: string,
  auditId: string,
  promotion: CandidatePromotion,
  posture: CapturePosture,
  api: WorkspaceApiAdapter,
): Promise<AuditResult> {
  return promote({ projectId, auditId, promotions: [promotion], posture }, api);
}

// ── issue ───────────────────────────────────────────────────────────────
// Lifts AuditPage.issueReport — POST freezes the draft into an immutable
// revision (ADR-0004). Returns the new issue; caller reloads workspace.
export async function issue(
  projectId: string,
  auditId: string,
  api: WorkspaceApiAdapter,
): Promise<{ revision: number; result: AuditResult }> {
  const res = await api<{ issue: { revision: number; result: AuditResult } }>(
    issuesPath(projectId, auditId),
    { method: "POST" },
  );
  return res.issue;
}

export const issueReport = issue;
