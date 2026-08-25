// Step-mode pipeline types realizing contracts/node-contracts/SHARED-STATE.md.
// Slices are replaced whole, never patched in place; a node may write only the
// slices its AG-*.md contract names. ran_at stays outside payloads.
import type {
  AuditResult,
  CanonicalStage,
  Finding,
  InputRequirementLevel,
  InputValueState,
  JurisdictionId,
  MissingInformationQuestion,
  Project,
} from "@/domain/types";
import type { AiAdapter, CandidateFinding, CandidateVocabulary } from "@/lib/ai";

export const AG_NODE_IDS = [
  "AG-PROJECT",
  "AG-STAGE-SELECT",
  "AG-MANIFEST",
  "AG-RULES",
  "AG-FINDINGS",
  "AG-QUESTIONS",
  "AG-AI-CANDIDATES",
  "AG-HALLUCINATION-CHECK",
  "AG-EVIDENCE-USE-AUDIT",
  "AG-ADJUDICATION",
  "AG-EVIDENCE-LINKS",
  "AG-REPORT",
  "AG-PERSIST",
] as const;

export type AgNodeId = (typeof AG_NODE_IDS)[number];

export const PAYLOAD_KINDS = [
  "project.record",
  "context.snapshot",
  "manifest.table",
  "rules.results",
  "findings.deterministic",
  "questions.set",
  "candidates.ai",
  "validation.hallucination",
  "audit.evidence-use",
  "adjudication.decisions",
  "evidence.linkset",
  "report.bundle",
  "persistence.receipt",
] as const;

export type PayloadKind = (typeof PAYLOAD_KINDS)[number];

export const PRODUCERS = [
  "domain-engine",
  "safety-reasoning-agent",
  "finding-adjudicator",
  "auditor-human",
  "report-builder",
  "repository",
] as const;

export type ProducerId = (typeof PRODUCERS)[number];

export type ValidationStatus = "draft" | "verified" | "rejected";

export type NodeClass = "deterministic" | "ai-bounded" | "human";

// ---- SharedState slices ------------------------------------------------------

export interface ProjectInputSlice {
  project_id: string;
  jurisdiction: JurisdictionId;
  native_stage_id: string;
  input_values: Project["input_values"];
}

export interface StageContextSlice {
  jurisdiction: JurisdictionId;
  framework_name: string;
  native_stage_id: string;
  native_stage_display_name: string;
  canonical_stages: CanonicalStage[];
  mapping_confidence: "authoritative" | "interpreted" | "inferred";
  /** ODD matrix membership for this selection (ADR-0005); absent cells refuse upstream. */
  odd_status: "in" | "mapped_unproven";
  odd_declaration_version: string;
}

/** Internal manifest entry; conditional_on is stripped in emitted results. */
export interface ManifestEntry {
  input_id: string;
  label: string;
  requirement_level: InputRequirementLevel;
  state: InputValueState;
  evidence_ids: string[];
  conditional_on: string | null;
}

export interface RuleResultsSlice {
  missing_information: MissingInformationQuestion[];
  deterministic_findings: Finding[];
}

export type QuestionsSlice = AuditResult["audit_questions"];
export type CandidatesSlice = CandidateFinding[];

export interface AdjudicationSlice {
  final_findings: Finding[];
  wording_violations: { finding_id: string; violations: string[] }[];
  /** Decisions targeting unknown finding ids, in arrival order; surfaced under limitations. */
  skipped_decision_refs: string[];
}

export interface EvidenceLinksetSlice {
  evidence_ids: string[];
  registry: string;
}

/** ADR-0010: per-run hallucination metrics, stamped by AG-HALLUCINATION-CHECK.
 *  rate = flagged / checked (0 when nothing was checked). */
export interface ValidationSummarySlice {
  checked: number;
  flagged: number;
  rate: number;
}

export interface ReportBundleSlice {
  json: AuditResult;
  markdown: string;
  disclaimer: string;
}

/** Stable audit coordinates, never physical storage keys: nodes must not know
 *  the store's key layout (ADR-0001; Repository owns that exclusively). */
export interface PersistenceRefSlice {
  audit_id: string;
  project_id: string;
  stored_at: string;
}

export const SHARED_STATE_SLICES = [
  "project_input",
  "stage_context",
  "input_manifest",
  "rule_results",
  "audit_questions",
  "candidate_findings",
  "validation_summary",
  "adjudication",
  "evidence_linkset",
  "report_bundle",
  "persistence_ref",
] as const;

export type SliceName = (typeof SHARED_STATE_SLICES)[number];

export interface SharedState {
  project_input?: ProjectInputSlice;
  stage_context?: StageContextSlice;
  input_manifest?: ManifestEntry[];
  rule_results?: RuleResultsSlice;
  audit_questions?: QuestionsSlice;
  /** null = node ran with AI off (zero provider calls); absent = not yet run. */
  candidate_findings?: CandidatesSlice | null;
  /** ADR-0010 per-run hallucination metrics (see ValidationSummarySlice). */
  validation_summary?: ValidationSummarySlice;
  adjudication?: AdjudicationSlice;
  evidence_linkset?: EvidenceLinksetSlice;
  report_bundle?: ReportBundleSlice;
  persistence_ref?: PersistenceRefSlice;
}

// Compile-time guarantee that the runtime slice list and SharedState's keys
// never drift apart (single source of truth for chartered slices).
type SliceSymmetricDifference =
  | Exclude<SliceName, keyof SharedState>
  | Exclude<keyof SharedState, SliceName>;
const _SLICES_MATCH_SHARED_STATE: SliceSymmetricDifference extends never
  ? true
  : never = true;

// ---- Artifacts ----------------------------------------------------------------

export interface AuditArtifact<P = unknown> {
  artifact_id: string;
  node_id: AgNodeId;
  producer: ProducerId;
  version: number;
  created_at: string;
  validation_status: ValidationStatus;
  payload_kind: PayloadKind;
  payload: P;
}

// ---- Node execution -------------------------------------------------------------

export interface AdjudicationDecision {
  finding_id: string;
  action: "accept" | "accept_with_edits" | "reject" | "escalate";
  edited_statement_text?: string;
  edited_recommendation_text?: string;
  reviewer_note?: string;
}

export interface NodeRunCtx {
  ranAtIso: string;
  project: Project;
  /** Seed for this node's artifact versions; threaded by runAll. */
  versionStart?: number;
  aiAdapter?: AiAdapter;
  decisions?: AdjudicationDecision[];
  /** A1 async driver only: permits live inference inside the pipeline. */
  allowLiveInference?: boolean;
  /** M3: resolved drawing attachments for the vision path (already loaded). */
  attachments?: { attachment_id: string; file_name: string; data_url: string }[];
  /** Pack vocabulary bounding candidate categories (issue/road-user). */
  candidateVocabulary?: CandidateVocabulary;
}

export interface NodeResult {
  artifacts: AuditArtifact[];
  patch: SharedState;
}

/**
 * Node functions are pure and synchronous: identical (state, ctx) => identical
 * result, no I/O inside nodes. Storage side effects live behind the pipeline's
 * dedicated async persist method; live AI inference gets its async driver in
 * A1 — the seam contact point is AG-AI-CANDIDATES consulting adapter.enabled.
 */
export type NodeFn = (state: SharedState, ctx: NodeRunCtx) => NodeResult;

// ---- Introspection ----------------------------------------------------------------

export interface NodeDescriptor {
  id: AgNodeId;
  name: string;
  node_class: NodeClass;
  reads: SliceName[];
  writes: SliceName[];
  emits: PayloadKind;
  depends_on: AgNodeId[];
  executed_in_batch: boolean;
  summary: string;
}
