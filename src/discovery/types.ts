// Discovery domain types (D01..D10). Vocabulary governed by CONTEXT.md
// §Discovery & corpus growth; schemas live in contracts/schemas/discovery-*.schema.json.
// Mirrors src/domain/pipeline discipline: slices replaced whole, nodes write only
// their declared slices, ran_at stays outside payloads.
import type { CanonicalStage, JurisdictionId } from "@/domain/types";

export type { CanonicalStage, JurisdictionId };

export const DISCOVERY_NODE_IDS = [
  "D01-DISCOVER",
  "D02-QUALIFY",
  "D03-MATCH",
  "D04-ACQUIRE",
  "D05-CLASSIFY",
  "D06-PACKAGE",
  "D07-PROVENANCE",
  "D08-QUALITY",
  "D09-COVERAGE",
  "D10-QUEUE",
] as const;

export type DiscoveryNodeId = (typeof DISCOVERY_NODE_IDS)[number];

export type SourceType =
  | "search-engine"
  | "dot-portal"
  | "planning-portal"
  | "procurement"
  | "institutional-repo";

export type LicenceHint =
  | "ogl-v3"
  | "public-domain"
  | "cc-by"
  | "cc-by-sa"
  | "unknown"
  | "licensed-tier1-pending";

export interface DiscoveryHit {
  hit_id: string;
  url: string;
  source_type: SourceType;
  provider_id: string;
  portal_id: string | null;
  discovered_at: string;
  licence_hint: LicenceHint;
  http_status: number | null;
  sha256_hint: string | null;
  title_hint: string | null;
  jurisdiction_guess: JurisdictionId | null;
}

export type QualificationVerdict = "in_scope" | "reserve" | "reject";

export interface Qualification {
  qualification_id: string;
  hit_id: string;
  verdict: QualificationVerdict;
  reasons: string[];
  scheme_hint: string | null;
  jurisdiction_guess: JurisdictionId | null;
}

export interface MatchAssignment {
  match_id: string;
  qualification_id: string;
  jurisdiction: JurisdictionId;
  native_stage_id: string | null;
  canonical_stages: CanonicalStage[];
  mapping_confidence: "authoritative" | "interpreted" | "inferred";
  odd_status: "in" | "mapped_unproven";
  matched_by: string;
}

export interface AcquiredPage {
  page_no: number;
  png_sha256: string | null;
  ocr_sha256: string | null;
  ocr_conf: number | null;
}

export interface AcquiredDocument {
  doc_id: string;
  url: string;
  sha256: string;
  bytes: number;
  mime: "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
  page_count: number;
  pages: AcquiredPage[];
  extraction: { engine: string; text_sha256: string | null };
}

export interface AcquisitionBundle {
  bundle_id: string;
  match_id: string;
  documents: AcquiredDocument[];
}

export type DocRole =
  | "rsa_report"
  | "checklist"
  | "designer_response"
  | "drawing_set"
  | "supporting_document";

export interface DocLabel {
  doc_id: string;
  role: DocRole;
  confidence: number;
}

export interface LabelSet {
  labelset_id: string;
  bundle_id: string;
  labels: DocLabel[];
  classifier_trace: {
    classifier_id: string;
    ruleset_version: string;
    auto_reserved_doc_ids: string[];
  };
}

export type Completeness =
  | "full-package"
  | "outputs-only"
  | "inputs-only"
  | "excerpt"
  | "unassigned";

export interface ProjectPackageAssembly {
  package_id: string;
  match_id: string;
  metadata: {
    title: string;
    scheme_summary: string | null;
    authority_hint: string | null;
    location_hint: string | null;
    source_urls: string[];
  };
  inputs: { drawing_doc_ids: string[]; other_doc_ids: string[] };
  outputs: {
    rsa_report_doc_ids: string[];
    checklist_doc_ids: string[];
    designer_response_doc_ids: string[];
  };
  completeness: Completeness;
}

export interface ProvenanceRecord {
  provenance_id: string;
  package_id: string;
  source_urls: string[];
  retrieved_at: string;
  sha256_chain: { doc_id: string; sha256: string }[];
  extraction: { pdf_engine: string; ocr_engine: string | null };
  classification: { classifier_id: string; ruleset_version: string };
  licence: LicenceHint;
  odd_cell: {
    jurisdiction_id: JurisdictionId;
    canonical_stage: CanonicalStage[];
    status: "in" | "mapped_unproven";
  };
  firewall_tainted: boolean;
}

export type DedupeStatus = "unique" | "duplicate" | "near_dup";

export interface QualityVerdictRecord {
  package_id: string;
  completeness: Completeness;
  dedupe_status: DedupeStatus;
  canonical_package_id: string | null;
  quality_score: number;
  human_required: boolean;
  reasons: string[];
}

export type CoverageLabel =
  | "COVERED"
  | "UNDER-COVERED"
  | "MISSING"
  | "OVER-REPRESENTED"
  | "EXCLUDED";

export interface CoverageCellView {
  cell_key: string;
  jurisdiction_id: JurisdictionId;
  native_stage_id: string | null;
  canonical_stage: CanonicalStage[];
  status: "in" | "mapped_unproven" | "structurally_absent";
  fixture_ids: string[];
  target: number;
  have_full_package: number;
  have_total: number;
  label: CoverageLabel;
  priority: number;
  uncovered_reasons: string[];
}

export interface OddCoverageView {
  schema_version: "1.0.0";
  declaration_version: string;
  generated: string;
  target_total: number;
  cells: CoverageCellView[];
  gaps_ranked: string[];
}

export interface QueueItem {
  rank: number;
  cell_key: string;
  jurisdiction_id: JurisdictionId;
  query_theme: string;
  reason: string;
}

// ---- SharedState slices (discovery) ------------------------------------------

export const DISCOVERY_SLICES = [
  "discovery_hits",
  "qualified",
  "matched",
  "acquired",
  "classified",
  "package",
  "provenance",
  "quality",
  "coverage",
  "queue",
] as const;

export type DiscoverySliceName = (typeof DISCOVERY_SLICES)[number];

export interface DiscoverySharedState {
  discovery_hits?: DiscoveryHit[];
  qualified?: Qualification[];
  matched?: MatchAssignment[];
  acquired?: AcquisitionBundle[];
  classified?: LabelSet[];
  package?: ProjectPackageAssembly[];
  provenance?: ProvenanceRecord[];
  quality?: QualityVerdictRecord[];
  coverage?: OddCoverageView;
  queue?: QueueItem[];
}

export type PayloadKind =
  | "discovery.hitset"
  | "qualification.verdicts"
  | "match.assignments"
  | "acquisition.bundles"
  | "classification.labelsets"
  | "package.assemblies"
  | "provenance.records"
  | "quality.verdicts"
  | "coverage.view"
  | "queue.items";

export interface DiscoveryArtifact<P = unknown> {
  artifact_id: string;
  node_id: DiscoveryNodeId;
  payload_kind: PayloadKind;
  validation_status: "draft" | "verified";
  created_at: string;
  payload: P;
}
