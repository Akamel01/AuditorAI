// ADR-0003 reviewer adjudication vocabulary for audit-review surfaces: the
// status actions an auditor may record, the canonical PATCH payload shape, and
// the application of those edits onto a stored draft (backlog C3: this logic
// lived inline in the PATCH audit route until lifted verbatim — zero behavior
// change). The reviewer_status union itself is owned by domain/types — never
// redeclared. Zero route/pipeline imports beyond the canonical wording gate;
// routes parse requests and delegate here.
import { validateRecommendationWording } from "@/domain/pipeline/wording";
import type { AuditResult, Finding } from "@/domain/types";

export type ReviewerStatusAction = Exclude<Finding["reviewer_status"], "draft">;

export const REVIEWER_STATUS_ACTIONS = [
  "accepted",
  "accepted_with_edits",
  "rejected",
  "escalated",
] as const satisfies readonly ReviewerStatusAction[];

export interface FindingUpdateInput {
  finding_id: string;
  reviewer_status?: ReviewerStatusAction;
  recommendation?: string | null;
  reviewer_note?: string | null;
}

export interface FindingUpdate {
  finding_id: string;
  reviewer_status?: Finding["reviewer_status"];
  recommendation: string | null;
  reviewer_note: string | null;
}

/** Wire shape of one finding_updates[] PATCH entry: every field except the
 *  target id is optional, and present means "set" (including null ⇒ clear). */
export interface FindingUpdateEntry {
  finding_id: string;
  reviewer_status?: Finding["reviewer_status"];
  recommendation?: string | null;
  reviewer_note?: string | null;
  location?: string | null;
  severity?: string | null;
  likelihood?: string | null;
}

/** ADR-0003 flag-and-show annotation: a question stays listed once raised;
 *  PATCH toggles its addressed flag, never removes it. */
export interface QuestionMarkEntry {
  question_id: string;
  addressed: boolean;
}

/** Shared result of applying review edits onto a draft: the patched copy, or
 *  a loud client-caused rejection carrying its HTTP class. */
export type AuditPatchResult =
  | { ok: true; value: AuditResult }
  | { ok: false; error: { status: number; message: string } };

/** One construction point for a finding_updates entry: the status key is
 *  present only when a status action is given, and blank text is stored as
 *  null rather than an empty string. */
export function buildFindingUpdate(input: FindingUpdateInput): FindingUpdate {
  return {
    finding_id: input.finding_id,
    ...(input.reviewer_status ? { reviewer_status: input.reviewer_status } : {}),
    recommendation: input.recommendation || null,
    reviewer_note: input.reviewer_note || null,
  };
}

/** Apply reviewer edits to a copy of the stored draft; the input object is
 *  never mutated. Any failure leaves nothing half-applied. Per entry: unknown
 *  finding ids are rejected loudly; edited recommendations pass the wording
 *  gate (blank text bypasses it, matching the adjudication node's non-edit
 *  semantics); risk-component fields land on risk_components only; everything
 *  else assigns verbatim, null meaning clear. */
export function applyFindingUpdates(
  auditResult: AuditResult,
  updates: readonly FindingUpdateEntry[],
): AuditPatchResult {
  const next: AuditResult = {
    ...auditResult,
    findings: auditResult.findings.map((f) => ({
      ...f,
      risk_components: { ...f.risk_components },
    })),
  };
  for (const u of updates) {
    const f = next.findings.find((x) => x.finding_id === u.finding_id);
    if (!f)
      return {
        ok: false,
        error: { status: 400, message: `unknown finding ${u.finding_id}` },
      };
    if (u.reviewer_status) f.reviewer_status = u.reviewer_status;
    if (u.recommendation !== undefined) {
      if (u.recommendation) {
        const check = validateRecommendationWording(u.recommendation);
        if (!check.ok)
          return {
            ok: false,
            error: {
              status: 400,
              message: `recommendation uses banned wording: ${check.violations.join(", ")}`,
            },
          };
      }
      f.recommendation = u.recommendation;
    }
    if (u.reviewer_note !== undefined) f.reviewer_note = u.reviewer_note;
    if (u.location !== undefined) f.location = u.location;
    if (u.severity !== undefined) f.risk_components.severity = u.severity;
    if (u.likelihood !== undefined) f.risk_components.likelihood = u.likelihood;
  }
  return { ok: true, value: next };
}

/** Toggle the addressed flag on audit questions of a copy of the stored draft;
 *  the input object is never mutated. Unknown question ids are rejected
 *  loudly rather than silently dropped. */
export function applyQuestionMarks(
  auditResult: AuditResult,
  marks: readonly QuestionMarkEntry[],
): AuditPatchResult {
  const next: AuditResult = {
    ...auditResult,
    audit_questions: auditResult.audit_questions.map((q) => ({ ...q })),
  };
  for (const q of marks) {
    const item = next.audit_questions.find((x) => x.question_id === q.question_id);
    if (!item)
      return {
        ok: false,
        error: { status: 400, message: `unknown question ${q.question_id}` },
      };
    item.addressed = q.addressed;
  }
  return { ok: true, value: next };
}
