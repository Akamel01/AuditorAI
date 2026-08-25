# Per-cell data table (generated-style, ticket 06)

Derived programmatically from `policies/odd.json` (declaration v1.1.2), `state/sample-corpus.json`
(generated 2026-08-25), and `state/readiness-report.json` (latest archive
`2026-08-25T07-34-03-343Z`). Zero hand-stated values; derivation rules in ticket
`.scratch/learning-loop/issues/06-per-cell-data-table.md` §Answer. Machine-readable mirror below
for ticket 04 rendering.

## Table — one row per ODD cell (16)

| cell | status | input floor classes | few-shot n (ids) | calib n | fixtures (gate from latest archive) | sustain/promote need |
|---|---|---|---|---|---|---|
| uk×PRELIMINARY_DESIGN (uk:S1) | in | 6: scheme_description_objectives, design_standards_applied, design_speeds_and_speed_limits, traffic_flows_existing_forecast, collision_data_analysis_36mo, strategic_decisions_excluded | 1 (int-008-uk-great-north-road-stage1-rsa-full-package) | 11 | GF-6 (PASS, scored 1/unscored 1), GF-11 (PASS, 2/0) | keep fixtures green |
| usa×PRELIMINARY_DESIGN (us-fhwa:preliminary-design) | in | 2: project_information_package, design_drawings_current_phase | 2 (us-008-ma-hingham-derby-st-route3-rsa, us-017-somerville-mcgrath-hwy-rsa) | 0 | GF-7 (PASS, 2/0), GF-12 (PASS, 2/0), GF-14 (PASS, 2/0) | keep fixtures green |
| usa×DETAILED_DESIGN (us-fhwa:final-design) | in | 2: project_information_package, design_drawings_current_phase | 0 | 0 | GF-8 (PASS, 2/0) | keep fixtures green |
| international×PRELIMINARY_DESIGN (int:preliminary-design) | in | 2: project_description_objectives, plans_appropriate_to_stage | 0 | 1 | GF-9 (PASS, 2/0), GF-16 (PASS, 2/0) | keep fixtures green |
| canada×FEASIBILITY_CONCEPT (ca-tac:planning) | in | 2: design_criteria, route_choice_project_scope | 2 (ca-001-ab-neahd-planning-stage-rsa, ca-011-34st-fps-appendix-h-alignment-sheets) | 1 | GF-10 (PASS, 2/0), GF-13 (PASS, 2/0), GF-15 (PASS, 2/0) | keep fixtures green |
| uae×FEASIBILITY_CONCEPT (ae-ad:S0) | mapped_unproven | 1: concept_or_master_plan_options | 0 | 0 | none | needs 1 authentic fixture + Tier-1 pass |
| uae×PRELIMINARY_DESIGN (ae-ad:S1) | mapped_unproven | 1: general_detail_drawings | 0 | 0 | none | needs 1 authentic fixture + Tier-1 pass |
| uae×PRELIMINARY_DESIGN+DETAILED_DESIGN (ae-ad:S12-combined) | mapped_unproven | 1: general_detail_drawings | 0 | 0 | none | needs 1 authentic fixture + Tier-1 pass |
| uae×DETAILED_DESIGN (ae-ad:S2) | mapped_unproven | 1: full_detailed_design_set | 0 | 0 | none | needs 1 authentic fixture + Tier-1 pass |
| uk×FEASIBILITY_CONCEPT (native stage absent) | structurally_absent | 0 | 0 | 0 | none | never IN — pack forbids |
| canada×DETAILED_DESIGN (ca-tac:detailed-design) | mapped_unproven | 0 | 0 | 0 | none | floor definition needed |
| canada×PRELIMINARY_DESIGN (ca-tac:preliminary-design) | mapped_unproven | 0 | 0 | 0 | none | floor definition needed |
| international×DETAILED_DESIGN (int:detailed-design) | mapped_unproven | 0 | 0 | 1 | none | floor definition needed |
| international×FEASIBILITY_CONCEPT (int:feasibility-concept) | mapped_unproven | 0 | 0 | 0 | none | floor definition needed |
| uk×DETAILED_DESIGN (uk:S2) | mapped_unproven | 0 | 0 | 3 | none | floor definition needed |
| usa×FEASIBILITY_CONCEPT (us-fhwa:planning) | mapped_unproven | 0 | 0 | 0 | none | floor definition needed |

Cell sum: **16** (5 in · 10 mapped_unproven · 1 structurally_absent).

## Fragile cells (IN with <2 fixtures)

- **usa×DETAILED_DESIGN** — single fixture GF-8 (the "USA-final single fixture" flag from the
  ticket). One regression drops the cell out of IN under conjunctive membership (ADR-0005 §2).

All other IN cells carry ≥2 fixtures (uk×PRELIM: 2; usa×PRELIM: 3; international×PRELIM: 2;
canada×FEASIBILITY_CONCEPT: 3). All 11 cell-assigned fixtures PASS at the latest archive;
`incident_flags` are empty in `policies/odd.json` (CA planning incident cleared per ADR-0005
declaration log v1.0.1).

## Unattributed corpus mass (not counted per cell)

Derivation could not pin these to exactly one declared cell without invention; they are excluded
from the per-cell columns above:

- few-shot (1 of 6): us-010-us12-briefing-book ("pre-audit packet (no cell alone)"; its output
  half us-011 is existing-road → Reserve).
- judge-calibration (11 of 26): ae-001 (UAE, no single stage named), us-cat (10-case compilation,
  mixed stages), int-020 ("stage class per doc", no stage), int-028 / int-030 / int-031 /
  us-028 / us-029 (no stage or cross-cell compilations), ca-010 (explicit concept/prelim boundary),
  us-026 / us-027 (existing-road lifecycle material).

## Machine-readable mirror (for ticket 04)

```json
{
  "meta": {
    "sources": [
      "policies/odd.json@v1.1.2",
      "state/sample-corpus.json@generated=2026-08-25",
      "state/readiness-report.json@archive=2026-08-25T07-34-03-343Z"
    ],
    "cell_total": 16,
    "status_counts": { "in": 5, "mapped_unproven": 10, "structurally_absent": 1 },
    "unattributed": {
      "fewshot_ids": ["us-010-us12-briefing-book"],
      "calib_ids": ["ae-001-arrb-abudhabi-internal-roads-rsa", "us-cat-fhwa-case-studies-compilation", "int-020-a90-swallow-hotel-rsa", "int-028-signed-designer-response-report", "int-030-carec-manual4-pedestrian-safety-adb-2021", "int-031-irap-gdci-gsdg-star-rated-street-designs", "us-028-nchrp-synthesis-336-road-safety-audits", "us-029-fhwa-sa-16-120-transit-rsa-casestudies", "ca-010-34st-fps-tsa-mobility-review", "us-026-us-12-post-audit-presentation", "us-027-hwy-7-minnetonka-rsa"]
    }
  },
  "cells": [
    { "id": "uk×PRELIMINARY_DESIGN", "jurisdiction_id": "uk", "framework_id": "uk-dmrb-gg119", "native_stage_id": "uk:S1", "canonical_stage": ["PRELIMINARY_DESIGN"], "status": "in", "input_floor": ["scheme_description_objectives", "design_standards_applied", "design_speeds_and_speed_limits", "traffic_flows_existing_forecast", "collision_data_analysis_36mo", "strategic_decisions_excluded"], "fewshot": { "n": 1, "ids": ["int-008-uk-great-north-road-stage1-rsa-full-package"] }, "calib": { "n": 11, "ids": ["int-004-ts-a9-pitlochry-south-stage1-2-rsa-report", "int-005-ts-a9-drumochter-south-stage1-2-rsa-report", "int-006-ts-a9-helmsdale-stage1-rsa-response-report", "int-007-ts-a9-ballinluig-stage2-rsa-response-report", "int-009-ie-lackareagh-wind-farm-stage1-rsa", "int-010-a7-boleside-vrs-stage12-rsa", "int-011-keadby3-a18-access-stage1-rsa", "int-012-sunnica-newmarket-rd-stage1-rsa", "int-013-northampton-gateway-stage1-response", "int-015-milltown-park-dublin-stage1-rsa", "int-025-oxfordshire-iffley-stage1-response"] }, "fixtures": [ { "id": "GF-6", "gate_mark": "PASS", "scored": 1, "unscored": 1 }, { "id": "GF-11", "gate_mark": "PASS", "scored": 2, "unscored": 0 } ], "promote_need": "keep fixtures green", "fragile": false },
    { "id": "usa×PRELIMINARY_DESIGN", "jurisdiction_id": "usa", "framework_id": "us-fhwa-rsa", "native_stage_id": "us-fhwa:preliminary-design", "canonical_stage": ["PRELIMINARY_DESIGN"], "status": "in", "input_floor": ["project_information_package", "design_drawings_current_phase"], "fewshot": { "n": 2, "ids": ["us-008-ma-hingham-derby-st-route3-rsa", "us-017-somerville-mcgrath-hwy-rsa"] }, "calib": { "n": 0, "ids": [] }, "fixtures": [ { "id": "GF-7", "gate_mark": "PASS", "scored": 2, "unscored": 0 }, { "id": "GF-12", "gate_mark": "PASS", "scored": 2, "unscored": 0 }, { "id": "GF-14", "gate_mark": "PASS", "scored": 2, "unscored": 0 } ], "promote_need": "keep fixtures green", "fragile": false },
    { "id": "usa×DETAILED_DESIGN", "jurisdiction_id": "usa", "framework_id": "us-fhwa-rsa", "native_stage_id": "us-fhwa:final-design", "canonical_stage": ["DETAILED_DESIGN"], "status": "in", "input_floor": ["project_information_package", "design_drawings_current_phase"], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 0, "ids": [] }, "fixtures": [ { "id": "GF-8", "gate_mark": "PASS", "scored": 2, "unscored": 0 } ], "promote_need": "keep fixtures green", "fragile": true },
    { "id": "international×PRELIMINARY_DESIGN", "jurisdiction_id": "international", "framework_id": "int-piarc-baseline", "native_stage_id": "int:preliminary-design", "canonical_stage": ["PRELIMINARY_DESIGN"], "status": "in", "input_floor": ["project_description_objectives", "plans_appropriate_to_stage"], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 1, "ids": ["int-002-irap-kship-sr4d-design-assessment"] }, "fixtures": [ { "id": "GF-9", "gate_mark": "PASS", "scored": 2, "unscored": 0 }, { "id": "GF-16", "gate_mark": "PASS", "scored": 2, "unscored": 0 } ], "promote_need": "keep fixtures green", "fragile": false },
    { "id": "canada×FEASIBILITY_CONCEPT", "jurisdiction_id": "canada", "framework_id": "ca-tac-crsag-alberta", "native_stage_id": "ca-tac:planning", "canonical_stage": ["FEASIBILITY_CONCEPT"], "status": "in", "input_floor": ["design_criteria", "route_choice_project_scope"], "fewshot": { "n": 2, "ids": ["ca-001-ab-neahd-planning-stage-rsa", "ca-011-34st-fps-appendix-h-alignment-sheets"] }, "calib": { "n": 1, "ids": ["us-014-fhwa-sa-14-003-3dviz-case-studies"] }, "fixtures": [ { "id": "GF-10", "gate_mark": "PASS", "scored": 2, "unscored": 0 }, { "id": "GF-13", "gate_mark": "PASS", "scored": 2, "unscored": 0 }, { "id": "GF-15", "gate_mark": "PASS", "scored": 2, "unscored": 0 } ], "promote_need": "keep fixtures green", "fragile": false },
    { "id": "uae×FEASIBILITY_CONCEPT", "jurisdiction_id": "uae", "framework_id": "ae-ad-dmt-tr540", "native_stage_id": "ae-ad:S0", "canonical_stage": ["FEASIBILITY_CONCEPT"], "status": "mapped_unproven", "input_floor": ["concept_or_master_plan_options"], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 0, "ids": [] }, "fixtures": [], "promote_need": "needs 1 authentic fixture + Tier-1 pass", "fragile": false },
    { "id": "uae×PRELIMINARY_DESIGN", "jurisdiction_id": "uae", "framework_id": "ae-ad-dmt-tr540", "native_stage_id": "ae-ad:S1", "canonical_stage": ["PRELIMINARY_DESIGN"], "status": "mapped_unproven", "input_floor": ["general_detail_drawings"], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 0, "ids": [] }, "fixtures": [], "promote_need": "needs 1 authentic fixture + Tier-1 pass", "fragile": false },
    { "id": "uae×PRELIMINARY_DESIGN+DETAILED_DESIGN", "jurisdiction_id": "uae", "framework_id": "ae-ad-dmt-tr540", "native_stage_id": "ae-ad:S12-combined", "canonical_stage": ["PRELIMINARY_DESIGN", "DETAILED_DESIGN"], "status": "mapped_unproven", "input_floor": ["general_detail_drawings"], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 0, "ids": [] }, "fixtures": [], "promote_need": "needs 1 authentic fixture + Tier-1 pass", "fragile": false },
    { "id": "uae×DETAILED_DESIGN", "jurisdiction_id": "uae", "framework_id": "ae-ad-dmt-tr540", "native_stage_id": "ae-ad:S2", "canonical_stage": ["DETAILED_DESIGN"], "status": "mapped_unproven", "input_floor": ["full_detailed_design_set"], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 0, "ids": [] }, "fixtures": [], "promote_need": "needs 1 authentic fixture + Tier-1 pass", "fragile": false },
    { "id": "uk×FEASIBILITY_CONCEPT", "jurisdiction_id": "uk", "framework_id": "uk-dmrb-gg119", "native_stage_id": null, "canonical_stage": ["FEASIBILITY_CONCEPT"], "status": "structurally_absent", "input_floor": [], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 0, "ids": [] }, "fixtures": [], "promote_need": "never IN — pack forbids", "fragile": false },
    { "id": "canada×DETAILED_DESIGN", "jurisdiction_id": "canada", "framework_id": "ca-tac-crsag-alberta", "native_stage_id": "ca-tac:detailed-design", "canonical_stage": ["DETAILED_DESIGN"], "status": "mapped_unproven", "input_floor": [], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 0, "ids": [] }, "fixtures": [], "promote_need": "floor definition needed", "fragile": false },
    { "id": "canada×PRELIMINARY_DESIGN", "jurisdiction_id": "canada", "framework_id": "ca-tac-crsag-alberta", "native_stage_id": "ca-tac:preliminary-design", "canonical_stage": ["PRELIMINARY_DESIGN"], "status": "mapped_unproven", "input_floor": [], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 0, "ids": [] }, "fixtures": [], "promote_need": "floor definition needed", "fragile": false },
    { "id": "international×DETAILED_DESIGN", "jurisdiction_id": "international", "framework_id": "int-piarc-baseline", "native_stage_id": "int:detailed-design", "canonical_stage": ["DETAILED_DESIGN"], "status": "mapped_unproven", "input_floor": [], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 1, "ids": ["int-002-irap-kship-sr4d-design-assessment"] }, "fixtures": [], "promote_need": "floor definition needed", "fragile": false },
    { "id": "international×FEASIBILITY_CONCEPT", "jurisdiction_id": "international", "framework_id": "int-piarc-baseline", "native_stage_id": "int:feasibility-concept", "canonical_stage": ["FEASIBILITY_CONCEPT"], "status": "mapped_unproven", "input_floor": [], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 0, "ids": [] }, "fixtures": [], "promote_need": "floor definition needed", "fragile": false },
    { "id": "uk×DETAILED_DESIGN", "jurisdiction_id": "uk", "framework_id": "uk-dmrb-gg119", "native_stage_id": "uk:S2", "canonical_stage": ["DETAILED_DESIGN"], "status": "mapped_unproven", "input_floor": [], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 3, "ids": ["int-010-a7-boleside-vrs-stage12-rsa", "int-014-ardee-old-railway-lands-stage12-rsa", "int-018-ardee-main-street-stage2-rsa"] }, "fixtures": [], "promote_need": "floor definition needed", "fragile": false },
    { "id": "usa×FEASIBILITY_CONCEPT", "jurisdiction_id": "usa", "framework_id": "us-fhwa-rsa", "native_stage_id": "us-fhwa:planning", "canonical_stage": ["FEASIBILITY_CONCEPT"], "status": "mapped_unproven", "input_floor": [], "fewshot": { "n": 0, "ids": [] }, "calib": { "n": 0, "ids": [] }, "fixtures": [], "promote_need": "floor definition needed", "fragile": false }
  ]
}
```
