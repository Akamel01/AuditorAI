// Tiny fixture for manual/Storybook smoke-testing of Mission Control components.
// Imports real state snapshots — keep in sync with state/odd-coverage.json + readiness-report.json.
// Not used in production; safe to import in a dev page or story.
import type { OddCoverageView, CoverageCellView } from "@/discovery/types";
import type { OddDeclaration } from "@/domain/odd";
import type { ReadinessReport } from "./kpi-strip";
import type { LearningMetrics } from "@/lib/learning-metrics";

// Re-export canonical states for easy story args
export const SAMPLE_COVERAGE: OddCoverageView = {
  schema_version: "1.0.0",
  declaration_version: "1.1.2",
  generated: new Date().toISOString(),
  target_total: 500,
  cells: [
    { cell_key: "uk:PRELIMINARY_DESIGN", jurisdiction_id: "UK", native_stage_id: "uk:S1", canonical_stage: ["PRELIMINARY_DESIGN"], status: "in", fixture_ids: ["GF-6", "GF-11"], target: 13, have_full_package: 0, have_total: 0, label: "MISSING", priority: 1, uncovered_reasons: ["need 13 more packages (0/13)", "no full-package yet"] },
    { cell_key: "usa:PRELIMINARY_DESIGN", jurisdiction_id: "US", native_stage_id: "us-fhwa:preliminary-design", canonical_stage: ["PRELIMINARY_DESIGN"], status: "in", fixture_ids: ["GF-7", "GF-12", "GF-14"], target: 13, have_full_package: 0, have_total: 1, label: "UNDER-COVERED", priority: 0.9231, uncovered_reasons: ["need 12 more packages (1/13)", "no full-package yet"] },
    { cell_key: "usa:DETAILED_DESIGN", jurisdiction_id: "US", native_stage_id: "us-fhwa:final-design", canonical_stage: ["DETAILED_DESIGN"], status: "in", fixture_ids: ["GF-8"], target: 40, have_full_package: 0, have_total: 0, label: "MISSING", priority: 3, uncovered_reasons: ["need 40 more packages (0/40)", "no full-package yet"] },
    { cell_key: "international:PRELIMINARY_DESIGN", jurisdiction_id: "INT", native_stage_id: "int:preliminary-design", canonical_stage: ["PRELIMINARY_DESIGN"], status: "in", fixture_ids: ["GF-9", "GF-16"], target: 13, have_full_package: 0, have_total: 0, label: "MISSING", priority: 1, uncovered_reasons: ["need 13 more packages (0/13)", "no full-package yet"] },
    { cell_key: "canada:FEASIBILITY_CONCEPT", jurisdiction_id: "CA", native_stage_id: "ca-tac:planning", canonical_stage: ["FEASIBILITY_CONCEPT"], status: "in", fixture_ids: ["GF-10", "GF-13", "GF-15"], target: 13, have_full_package: 0, have_total: 0, label: "MISSING", priority: 1, uncovered_reasons: ["need 13 more packages (0/13)", "no full-package yet"] },
    { cell_key: "uae:FEASIBILITY_CONCEPT", jurisdiction_id: "AE", native_stage_id: "ae-ad:S0", canonical_stage: ["FEASIBILITY_CONCEPT"], status: "mapped_unproven", fixture_ids: [], target: 41, have_full_package: 0, have_total: 0, label: "MISSING", priority: 3, uncovered_reasons: ["need 41 more packages (0/41)", "no full-package yet"] },
    { cell_key: "uae:PRELIMINARY_DESIGN", jurisdiction_id: "AE", native_stage_id: "ae-ad:S1", canonical_stage: ["PRELIMINARY_DESIGN"], status: "mapped_unproven", fixture_ids: [], target: 41, have_full_package: 0, have_total: 0, label: "MISSING", priority: 3, uncovered_reasons: ["need 41 more packages (0/41)", "no full-package yet"] },
    { cell_key: "uae:DETAILED_DESIGN+PRELIMINARY_DESIGN", jurisdiction_id: "AE", native_stage_id: "ae-ad:S12-combined", canonical_stage: ["PRELIMINARY_DESIGN", "DETAILED_DESIGN"], status: "mapped_unproven", fixture_ids: [], target: 41, have_full_package: 0, have_total: 0, label: "MISSING", priority: 3, uncovered_reasons: ["need 41 more packages (0/41)", "no full-package yet"] },
    { cell_key: "uae:DETAILED_DESIGN", jurisdiction_id: "AE", native_stage_id: "ae-ad:S2", canonical_stage: ["DETAILED_DESIGN"], status: "mapped_unproven", fixture_ids: [], target: 41, have_full_package: 0, have_total: 0, label: "MISSING", priority: 3, uncovered_reasons: ["need 41 more packages (0/41)", "no full-package yet"] },
    { cell_key: "uk:FEASIBILITY_CONCEPT", jurisdiction_id: "UK", native_stage_id: null, canonical_stage: ["FEASIBILITY_CONCEPT"], status: "structurally_absent", fixture_ids: [], target: 0, have_full_package: 0, have_total: 0, label: "EXCLUDED", priority: 0, uncovered_reasons: [] },
    { cell_key: "canada:DETAILED_DESIGN", jurisdiction_id: "CA", native_stage_id: "ca-tac:detailed-design", canonical_stage: ["DETAILED_DESIGN"], status: "mapped_unproven", fixture_ids: [], target: 41, have_full_package: 0, have_total: 0, label: "MISSING", priority: 3, uncovered_reasons: ["need 41 more packages (0/41)", "no full-package yet"] },
    { cell_key: "canada:PRELIMINARY_DESIGN", jurisdiction_id: "CA", native_stage_id: "ca-tac:preliminary-design", canonical_stage: ["PRELIMINARY_DESIGN"], status: "mapped_unproven", fixture_ids: [], target: 41, have_full_package: 0, have_total: 0, label: "MISSING", priority: 3, uncovered_reasons: ["need 41 more packages (0/41)", "no full-package yet"] },
    { cell_key: "international:DETAILED_DESIGN", jurisdiction_id: "INT", native_stage_id: "int:detailed-design", canonical_stage: ["DETAILED_DESIGN"], status: "mapped_unproven", fixture_ids: [], target: 41, have_full_package: 0, have_total: 0, label: "MISSING", priority: 3, uncovered_reasons: ["need 41 more packages (0/41)", "no full-package yet"] },
    { cell_key: "international:FEASIBILITY_CONCEPT", jurisdiction_id: "INT", native_stage_id: "int:feasibility-concept", canonical_stage: ["FEASIBILITY_CONCEPT"], status: "mapped_unproven", fixture_ids: [], target: 41, have_full_package: 0, have_total: 0, label: "MISSING", priority: 3, uncovered_reasons: ["need 41 more packages (0/41)", "no full-package yet"] },
    { cell_key: "uk:DETAILED_DESIGN", jurisdiction_id: "UK", native_stage_id: "uk:S2", canonical_stage: ["DETAILED_DESIGN"], status: "mapped_unproven", fixture_ids: [], target: 40, have_full_package: 0, have_total: 0, label: "MISSING", priority: 3, uncovered_reasons: ["need 40 more packages (0/40)", "no full-package yet"] },
    { cell_key: "usa:FEASIBILITY_CONCEPT", jurisdiction_id: "US", native_stage_id: "us-fhwa:planning", canonical_stage: ["FEASIBILITY_CONCEPT"], status: "mapped_unproven", fixture_ids: [], target: 40, have_full_package: 0, have_total: 0, label: "MISSING", priority: 3, uncovered_reasons: ["need 40 more packages (0/40)", "no full-package yet"] },
  ] as CoverageCellView[],
  gaps_ranked: [
    "usa:DETAILED_DESIGN",
    "uae:FEASIBILITY_CONCEPT",
    "uae:PRELIMINARY_DESIGN",
    "uae:DETAILED_DESIGN+PRELIMINARY_DESIGN",
    "uae:DETAILED_DESIGN",
    "canada:DETAILED_DESIGN",
    "canada:PRELIMINARY_DESIGN",
    "international:DETAILED_DESIGN",
    "international:FEASIBILITY_CONCEPT",
    "uk:DETAILED_DESIGN",
    "usa:FEASIBILITY_CONCEPT",
    "uk:PRELIMINARY_DESIGN",
    "international:PRELIMINARY_DESIGN",
    "canada:FEASIBILITY_CONCEPT",
    "usa:PRELIMINARY_DESIGN",
  ],
};

export const SAMPLE_DECLARATION: OddDeclaration = {
  schema_version: "1.0.0",
  declaration_version: "1.1.2",
  date: "2026-08-23",
  adr_ref: "docs/adr/0005-operational-design-domain.md",
  decision_ref: "DEC-0006",
  cells: [
    { jurisdiction_id: "uk", framework_id: "uk-dmrb-gg119", native_stage_id: "uk:S1", canonical_stage: ["PRELIMINARY_DESIGN"], mapping_confidence: "authoritative", status: "in", fixture_ids: ["GF-6", "GF-11"], incident_flags: [], input_floor: ["scheme_description_objectives", "design_standards_applied", "design_speeds_and_speed_limits", "traffic_flows_existing_forecast", "collision_data_analysis_36mo", "strategic_decisions_excluded"], scheme_scope_note: "" },
    { jurisdiction_id: "usa", framework_id: "us-fhwa-rsa", native_stage_id: "us-fhwa:preliminary-design", canonical_stage: ["PRELIMINARY_DESIGN"], mapping_confidence: "interpreted", status: "in", fixture_ids: ["GF-7", "GF-12", "GF-14"], incident_flags: [], input_floor: ["project_information_package", "design_drawings_current_phase"], scheme_scope_note: "" },
    { jurisdiction_id: "usa", framework_id: "us-fhwa-rsa", native_stage_id: "us-fhwa:final-design", canonical_stage: ["DETAILED_DESIGN"], mapping_confidence: "interpreted", status: "in", fixture_ids: ["GF-8"], incident_flags: [], input_floor: ["project_information_package", "design_drawings_current_phase"], scheme_scope_note: "" },
    { jurisdiction_id: "international", framework_id: "int-piarc-baseline", native_stage_id: "int:preliminary-design", canonical_stage: ["PRELIMINARY_DESIGN"], mapping_confidence: "interpreted", status: "in", fixture_ids: ["GF-9", "GF-16"], incident_flags: [], input_floor: ["project_description_objectives", "plans_appropriate_to_stage"], scheme_scope_note: "" },
    { jurisdiction_id: "canada", framework_id: "ca-tac-crsag-alberta", native_stage_id: "ca-tac:planning", canonical_stage: ["FEASIBILITY_CONCEPT"], mapping_confidence: "authoritative", status: "in", fixture_ids: ["GF-10", "GF-13", "GF-15"], incident_flags: [], input_floor: ["design_criteria", "route_choice_project_scope"], scheme_scope_note: "" },
    { jurisdiction_id: "uae", framework_id: "ae-ad-dmt-tr540", native_stage_id: "ae-ad:S0", canonical_stage: ["FEASIBILITY_CONCEPT"], mapping_confidence: "authoritative", status: "mapped_unproven", fixture_ids: [], incident_flags: [], input_floor: ["concept_or_master_plan_options"], scheme_scope_note: "" },
    { jurisdiction_id: "uae", framework_id: "ae-ad-dmt-tr540", native_stage_id: "ae-ad:S1", canonical_stage: ["PRELIMINARY_DESIGN"], mapping_confidence: "authoritative", status: "mapped_unproven", fixture_ids: [], incident_flags: [], input_floor: ["general_detail_drawings"], scheme_scope_note: "" },
    { jurisdiction_id: "uae", framework_id: "ae-ad-dmt-tr540", native_stage_id: "ae-ad:S12-combined", canonical_stage: ["PRELIMINARY_DESIGN", "DETAILED_DESIGN"], mapping_confidence: "authoritative", status: "mapped_unproven", fixture_ids: [], incident_flags: [], input_floor: ["general_detail_drawings"], scheme_scope_note: "" },
    { jurisdiction_id: "uae", framework_id: "ae-ad-dmt-tr540", native_stage_id: "ae-ad:S2", canonical_stage: ["DETAILED_DESIGN"], mapping_confidence: "authoritative", status: "mapped_unproven", fixture_ids: [], incident_flags: [], input_floor: ["full_detailed_design_set"], scheme_scope_note: "" },
    { jurisdiction_id: "uk", framework_id: "uk-dmrb-gg119", native_stage_id: null, canonical_stage: ["FEASIBILITY_CONCEPT"], mapping_confidence: null, status: "structurally_absent", fixture_ids: [], incident_flags: [], input_floor: [], scheme_scope_note: "" },
    { jurisdiction_id: "canada", framework_id: "ca-tac-crsag-alberta", native_stage_id: "ca-tac:detailed-design", canonical_stage: ["DETAILED_DESIGN"], mapping_confidence: "authoritative", status: "mapped_unproven", fixture_ids: [], incident_flags: [], input_floor: [], scheme_scope_note: "" },
    { jurisdiction_id: "canada", framework_id: "ca-tac-crsag-alberta", native_stage_id: "ca-tac:preliminary-design", canonical_stage: ["PRELIMINARY_DESIGN"], mapping_confidence: "authoritative", status: "mapped_unproven", fixture_ids: [], incident_flags: [], input_floor: [], scheme_scope_note: "" },
    { jurisdiction_id: "international", framework_id: "int-piarc-baseline", native_stage_id: "int:detailed-design", canonical_stage: ["DETAILED_DESIGN"], mapping_confidence: "interpreted", status: "mapped_unproven", fixture_ids: [], incident_flags: [], input_floor: [], scheme_scope_note: "" },
    { jurisdiction_id: "international", framework_id: "int-piarc-baseline", native_stage_id: "int:feasibility-concept", canonical_stage: ["FEASIBILITY_CONCEPT"], mapping_confidence: "interpreted", status: "mapped_unproven", fixture_ids: [], incident_flags: [], input_floor: [], scheme_scope_note: "" },
    { jurisdiction_id: "uk", framework_id: "uk-dmrb-gg119", native_stage_id: "uk:S2", canonical_stage: ["DETAILED_DESIGN"], mapping_confidence: "authoritative", status: "mapped_unproven", fixture_ids: [], incident_flags: [], input_floor: [], scheme_scope_note: "" },
    { jurisdiction_id: "usa", framework_id: "us-fhwa-rsa", native_stage_id: "us-fhwa:planning", canonical_stage: ["FEASIBILITY_CONCEPT"], mapping_confidence: "interpreted", status: "mapped_unproven", fixture_ids: [], incident_flags: [], input_floor: [], scheme_scope_note: "" },
  ],
};

export const SAMPLE_READINESS: ReadinessReport = {
  declaration_version: "1.1.2",
  generated: "2026-08-25T18:15:09.953Z",
  latest_archive: "2026-08-25T07-34-03-343Z",
  role_census: { total: 78, unassigned: 5, "judge-calibration": 26, "engine-fewshot": 6, reserve: 41 },
  fixtures: [
    { id: "GF-6", gate: { mark: "PASS", pass_rate: 1, scored: 1, unscored: 1 } },
    { id: "GF-7", gate: { mark: "PASS", pass_rate: 1, scored: 2, unscored: 0 } },
    { id: "GF-8", gate: { mark: "PASS", pass_rate: 1, scored: 2, unscored: 0 } },
    { id: "GF-9", gate: { mark: "PASS", pass_rate: 1, scored: 2, unscored: 0 } },
    { id: "GF-10", gate: { mark: "PASS", pass_rate: 1, scored: 2, unscored: 0 } },
  ],
  learning_layer: {
    evidence_records: 161,
    corpus_cataloged: 78,
    fewshot_total: 6,
    judge_calibration_total: 26,
    per_cell_coverage: { cell_total: 16, status_counts: { in: 5, mapped_unproven: 10, structurally_absent: 1 } },
    metrics: { outcomes_present: false, note: "no outcomes logged yet" },
  },
  odd_cells: [],
};

export const SAMPLE_LEARNING: LearningMetrics = {
  total_outcomes: 0,
  by_action: { accept: 0, accept_with_edits: 0, reject: 0 },
  promotion_rate: null,
  hallucination: { candidates_total: 0, candidates_flagged: 0, rate: null },
};

export const SAMPLE_LEARNING_WITH_DATA: LearningMetrics = {
  total_outcomes: 42,
  by_action: { accept: 18, accept_with_edits: 9, reject: 15 },
  promotion_rate: (18 + 9) / 42,
  hallucination: { candidates_total: 42, candidates_flagged: 3, rate: 3 / 42 },
};
