// ADR-0003 reviewer adjudication vocabulary for audit-review surfaces: the
// status actions an auditor may record and the canonical PATCH payload shape.
// The reviewer_status union itself is owned by domain/types — never redeclared.
import type { Finding } from "@/domain/types";

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
