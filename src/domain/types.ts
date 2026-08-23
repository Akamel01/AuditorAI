// Canonical domain types. Vocabulary is governed by CONTEXT.md.
// ADR-0002 governs stage semantics; ADR-0003 governs finding semantics.

export type CanonicalStage =
  | "FEASIBILITY_CONCEPT"
  | "PRELIMINARY_DESIGN"
  | "DETAILED_DESIGN";

export const CANONICAL_STAGES: CanonicalStage[] = [
  "FEASIBILITY_CONCEPT",
  "PRELIMINARY_DESIGN",
  "DETAILED_DESIGN",
];

export type JurisdictionId = "INT" | "UK" | "US" | "CA" | "AE";

export const JURISDICTION_IDS: JurisdictionId[] = ["INT", "UK", "US", "CA", "AE"];

/** M1 inline cap: a drawing must fit the KV free-tier value budget. */
export const ATTACHMENT_MAX_BYTES = 500 * 1000;

export const MAX_ATTACHMENTS_PER_PROJECT = 12;

/** §14 input states — never conflate Unknown with No. */
export type InputRequirementLevel =
  | "required"
  | "recommended"
  | "optional"
  | "unknown";

export type InputValueState =
  | "provided"
  | "required_missing"
  | "recommended_missing"
  | "optional_missing"
  | "unknown"
  | "not_applicable"
  | "not_available"
  | "conflicting";

export interface ProjectMetadata {
  name: string;
  description: string;
  scheme_summary: string;
  authority: string;
  location: string;
}

export interface StageSelection {
  jurisdiction: JurisdictionId;
  native_stage_id: string;
}

/** One pasted/uploaded drawing stored inline as a data-URL (M1 decision). */
export interface Attachment {
  attachment_id: string;
  project_id: string;
  input_id: string | null;
  file_name: string;
  mime: "image/png" | "image/jpeg" | "image/webp";
  bytes: number;
  data_url: string;
  created_at: string;
}

export interface InputValue {
  state: InputValueState;
  value?: string;
  /** Attachment ids referencing this input's drawings. */
  attachments?: string[];
}

export interface Project {
  project_id: string;
  workspace_key_hash: string;
  metadata: ProjectMetadata;
  stage_selection: StageSelection;
  /** input_id -> provided value/state */
  input_values: Record<string, InputValue>;
  created_at: string;
  updated_at: string;
}

export interface FindingEvidence {
  evidence_id: string;
  quote: string | null;
  use: "supports_concern" | "defines_requirement" | "context";
}

export interface SourceTrace {
  origin: "deterministic_rule" | "audit_question" | "ai_candidate" | "auditor_manual";
  rule_id?: string | null;
  question_id?: string | null;
  producer?: string | null;
}

/** ADR-0003 finding model. */
export interface Finding {
  finding_id: string;
  kind: "safety_concern" | "compliance_question";
  category: string;
  location: string | null;
  road_users: string[];
  scenario: string | null;
  statement: { text: string; normative_basis_note: string | null };
  evidence: FindingEvidence[];
  assumptions: { text: string; basis: string | null }[];
  risk_components: {
    severity: string | null;
    likelihood: string | null;
    exposure: string | null;
    scale_id: string | null;
  };
  confidence: { label: "high" | "medium" | "low"; basis: string };
  rationale: string;
  recommendation: string | null;
  source_trace: SourceTrace[];
  reviewer_status: "draft" | "accepted" | "accepted_with_edits" | "rejected" | "escalated";
  reviewer_note: string | null;
}

export interface MissingInformationQuestion {
  question_id: string;
  input_id: string;
  label: string;
  requirement_level: InputRequirementLevel;
  note: string;
  evidence_ids: string[];
}

/** ADR-0006: an AI-proposed finding awaiting auditor review. Structurally a
 *  strict subset of Finding plus provenance; it is never itself a report
 *  member — promotion mints the Finding. */
export interface CandidateFindingRecord {
  kind: Finding["kind"];
  category: string;
  location: string | null;
  road_users: string[];
  scenario: string | null;
  statement: Finding["statement"];
  evidence: Finding["evidence"];
  assumptions: Finding["assumptions"];
  rationale: string;
  recommendation: string | null;
  producer: string;
  /** Drawing ids this candidate was derived from (vision path). */
  source_attachment_ids?: string[];
}

export interface AuditContext {
  project_id: string;
  jurisdiction: JurisdictionId;
  framework_name: string;
  native_stage_id: string;
  canonical_stages: CanonicalStage[];
  mapping_confidence: "authoritative" | "interpreted" | "inferred";
  input_states: Record<string, InputValueState>;
}

export interface AuditResult {
  audit_id: string;
  project_id: string;
  jurisdiction: JurisdictionId;
  framework_name: string;
  native_stage_id: string;
  native_stage_display_name: string;
  canonical_stages: CanonicalStage[];
  mapping_confidence: "authoritative" | "interpreted" | "inferred";
  ran_at: string;
  input_manifest: {
    input_id: string;
    label: string;
    requirement_level: InputRequirementLevel;
    state: InputValueState;
    evidence_ids: string[];
  }[];
  findings: Finding[];
  missing_information: MissingInformationQuestion[];
  audit_questions: {
    question_id: string;
    text: string;
    topic: string;
    applies_to_canonical: CanonicalStage[];
    road_users: string[];
    source_note: string | null;
    addressed: boolean;
  }[];
  limitations: string[];
  disclaimer: string;
  /** ADR-0006: pending AI candidates on a live-path draft. Absent on
   *  deterministic results; consumed by promotion, never rendered as findings. */
  candidate_findings?: CandidateFindingRecord[];
}

/** ADR-0004 / DEC-0005: an immutable, numbered snapshot of an Audit's results
 *  at the moment of issuance. Issues are write-once and retained permanently;
 *  later runs mutate only the draft. */
export interface AuditIssue {
  revision: number;
  issued_at: string;
  issued_by: "auditor";
  result: AuditResult;
}
