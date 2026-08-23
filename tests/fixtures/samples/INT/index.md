# INT — Road Safety Audit sample collection (International sources)

Collected 2026-08-23 by sample-audit collection agent. Public-access sources only;
no login-wall circumvention. Wayback retrieval used only for public-origin documents
(AfDB PDF is bot-blocked live; fetched its own archived public copy). Early stages
(feasibility/conceptual + preliminary design) prioritized per mission.

Native stage naming recorded per source body:
- **Transport Scotland / Scottish trunk-road contracts** (DMRB GG 119 lineage): Stage 1
  (completion of preliminary design), Stage 2 (detailed design), combined "Stage 1 & 2"
  audits used for small schemes; Stage 3 pre-opening, Stage 4 monitoring.
- **TII Ireland** (GE-STY-01024): audit-stage columns F, 1, 2, 1&2, 3, 4 — F = feasibility,
  1/2 as UK-equivalent preliminary/detailed design, 3 pre-opening, 4 post-opening.
- **ADB/CAREC manual**: feasibility → preliminary design → detailed design → roadworks →
  pre-opening (case studies labelled "Detailed Design Stage", "Roadworks Stage",
  "Preopening Stage").
- **AfDB Road Safety Manuals for Africa**: Stage 1 Feasibility Study → Stage 2 Preliminary
  Design → Stage 3 Detailed Design → Stage 4 Pre-Opening → Stage 5 Post-Opening.
- **iRAP SR4D**: "design stage" assessment of coded designs before construction.

Canonical mapping note: UK/IE Stage 1 ≈ `PRELIMINARY_DESIGN`; CAREC/AfDB numbered stages map
directly onto `FEASIBILITY_CONCEPT` → `PRELIMINARY_DESIGN` → `DETAILED_DESIGN`; iRAP design
stage ≈ `PRELIMINARY_DESIGN`–`DETAILED_DESIGN`. Mappings shown alongside native vocabulary only.

## Downloaded samples

### INT-001 · CAREC Road Safety Engineering Manual 1: Road Safety Audit (worked case studies)

- id: `int-001-carec-rsa-manual-adb-2018`
- title: CAREC Road Safety Engineering Manual 1: Road Safety Audit
- source_url: https://www.carecprogram.org/uploads/CAREC-Manual-1_RSA_English_FIN.pdf (publication page: https://www.adb.org/publications/carec-road-safety-audit-engineering-manual)
- publisher: Asian Development Bank / CAREC Secretariat (TA 8804-REG), March 2018, 64 pp., CC BY 3.0 IGO
- retrieved_date: 2026-08-23
- country/body: Central Asia Regional Economic Cooperation programme (11 member countries incl. Kazakhstan)
- native_stage: feasibility → preliminary design → detailed design → roadworks → pre-opening; stage checklists for each
- input_types present: scheme_description (four worked case-study schemes: duplication of a national highway; reconstruction of a 300-km section; upgrading two sections of an international highway; 120-km national-highway section, Western Province)
- output_types present: findings_report (per-case-study findings tables), checklists (full stage checklist set annexed), recommendations (within case studies)
- completeness: excerpt — worked examples embedded in a manual; no drawings/traffic data/response reports
- filename+sha256: carec-manual1-rsa-adb-2018.pdf `3234424a3c07587cfaf967dda624018bbc3246101f44b90ad99d68cdd88cc9b9`
- notes: Case studies 1–2 are detailed-design audits (early-stage relevant); case study 3 roadworks; case study 4 pre-opening. Direct open mirror on carecprogram.org bypasses adb.org bot-wall. Complements (does not duplicate) the PIARC 2023R40EN already in docs/references/INT/.

### INT-002 · iRAP Star Rating of road designs — KSHIP, Karnataka, India (SR4D lineage)

- id: `int-002-irap-kship-sr4d-design-assessment`
- title: iRAP Star Ratings of road designs, Karnataka State Highways Improvement Project (KSHIP) — 550 km of concession roads (doc ref 502.15.17)
- source_url: https://indiarap.org/wp-content/uploads/2020/08/2012-iRAP-SR4D-KSHIP.pdf
- publisher: iRAP + KSHIP (Govt. of Karnataka PWD) + Scott Wilson India, 1 March 2012
- retrieved_date: 2026-08-23
- country/body: India (World Bank-supported KSHIP; MDB design-safety performance context)
- native_stage: iRAP design-stage assessment — existing-network baseline vs initial designs vs improved designs (pre-construction); canonical ≈ PRELIMINARY_DESIGN→DETAILED_DESIGN
- input_types present: scheme_description (design schedules e.g. speed-restricted sections, standard cross-sections, drawings), traffic_data (flows assumed from baseline survey; crash-data-derived calibration referenced)
- output_types present: findings_report-equivalent (star ratings per user group per design iteration), recommendations (countermeasure schedules, coding assumptions), FSI-savings estimates
- completeness: outputs-only — designs summarized via schedules/excerpt drawings, not full drawing sets
- filename+sha256: irap-kship-sr4d-design-assessment-india-2012.pdf `b7d3d687e1a14c71603bbe873976e544a70c469ac4547ba3729fa05661b2ab61`
- notes: Closest publicly documented planning/preliminary-stage safety examination with explicit inputs→outputs chain (design attribute coding rules §2.4 are directly reusable as intake-validation logic). Result: vehicle-occupant 1–2-star share cut 86% → 2% across the final designs.

### INT-003 · AfDB Road Safety Manuals for Africa — New Roads and Schemes: Road Safety Audit (incl. sample RSA report)

- id: `int-003-afdb-rsa-manual-africa-2014`
- title: ROAD SAFETY MANUALS FOR AFRICA — New Roads and Schemes: Road Safety Audit
- source_url: https://www.afdb.org/fileadmin/uploads/afdb/Documents/Publications/ROAD_SAFETY_MANUALS_FOR_AFRICA_-_New_Roads_and_Schemes___Road_Safety_Audit.pdf (retrieved via Wayback capture 20220120152032 of this public-origin URL; live afdb.org serves 403 to non-browser clients)
- wayback_url: https://web.archive.org/web/20220120152032if_/https://www.afdb.org/fileadmin/uploads/afdb/Documents/Publications/ROAD_SAFETY_MANUALS_FOR_AFRICA_-_New_Roads_and_Schemes___Road_Safety_Audit.pdf
- publisher: African Development Bank, Transport & ICT Department (TRI Ltd + BRRC), July 2014
- retrieved_date: 2026-08-23
- country/body: Pan-African (regional development bank; draws on South African RSAM 2nd ed., Tanzania auditing guide v7, Uganda RSAM, UK HD 19/03)
- native_stage: Stage 1 Feasibility Study → Stage 5 Post-Opening (numbered, feasibility-forward)
- input_types present: scheme_description (process-level; audit-brief content lists)
- output_types present: findings_report (**Appendix C: Sample Road Safety Audit Report** — specimen structure/content), checklists/prompts (Appendix B), countermeasure catalogue (Appendix A, adapted from iRAP Road Safety Toolkit with permission)
- completeness: excerpt — manual with annexed specimen report and prompts; no real-scheme inputs
- filename+sha256: afdb-rsa-manual-africa-new-roads-2014.pdf `20c32bdb08dd44999446c78fa9a2d71ef1cf5c15f0e3302e5b8e6bd647273df3`
- notes: qpdf hint-table warning benign (same class as documented in docs/references/INT/MANIFEST.md). The PIARC RSM cites this AfDB volume as the LMIC-specific RSA guidance.

### INT-004 · A9/A924 Pitlochry South VRS — combined Stage 1 & 2 Road Safety Audit report (real UK trunk-road audit)

- id: `int-004-ts-a9-pitlochry-south-stage1-2-rsa-report`
- title: A9 A924 Pitlochry South (VRS) — Stage 1 & 2 Road Safety Audit, Audit Ref NMC/RSA/012, Scheme ID 22/NW/0801/124 (final report 15/12/2022)
- source_url: https://www.gov.scot/binaries/content/documents/govscot/publications/foi-eir-release/2023/12/a9-accidents-safety-and-dualling-eir-release/documents/annex-l---a9-a924-pitlochry-sth-st-1-2-rsa-report/annex-l---a9-a924-pitlochry-sth-st-1-2-rsa-report/govscot%3Adocument/Annex%2BL%2B-%2BA9%2BA924%2BPitlochry%2BSth%2BSt%2B1-2%2BRSA%2Breport.pdf (parent FOI/EIR release: https://www.gov.scot/publications/a9-accidents-safety-and-dualling-eir-release/, FOI 202300341022, published 2023-12-07)
- publisher: Transport Scotland Roads Directorate (client) / BEAR Scotland Ltd NW Unit (audit team) — released under EIR(S)R 2004
- retrieved_date: 2026-08-23
- country/body: Scotland, UK (Scottish Trunk Road Network Management Contract, North West Unit)
- native_stage: **Stage 1 & 2 combined** (GG 119-lineage vocabulary; combined early-stage audit permitted for small schemes — here a Vehicle Restraint System improvement)
- input_types present: scheme_description + drawings inventory ("Documents Forming the Audit Brief" + List of Drawings and Documents Reviewed with drawing numbers/revisions — drawings themselves not released)
- output_types present: findings_report (problems raised at this Stage 1&2 audit + recommendations + unresolved-items carry-over from previous audits)
- completeness: outputs-only (audit brief/drawings not included; FOI redactions under reg. 11(2))
- filename+sha256: uk-ts-a9-pitlochry-south-stage1-2-rsa-report.pdf `8b22e1aa4d7b5e45aa535dbc7b2cb4cf1789ecb18b8f11d9a685cd645fe5127e`
- notes: Real production audit artifact on a named trunk-road scheme; demonstrates combined Stage 1/2 practice and BEAR Form #359 report template. Early-stage emphasis satisfied (Stage 1&2).

### INT-005 · A9 Drumochter South VRS — combined Stage 1 & 2 Road Safety Audit report (real UK trunk-road audit)

- id: `int-005-ts-a9-drumochter-south-stage1-2-rsa-report`
- title: A9 Drumochter South (VRS) — Stage 1&2 Road Safety Audit, Scheme ID 22/NW/0801/103
- source_url: https://www.gov.scot/binaries/content/documents/govscot/publications/foi-eir-release/2023/12/a9-accidents-safety-and-dualling-eir-release/documents/annex-m---a9-drumochter-sth-st-1-2-rsa-report/annex-m---a9-drumochter-sth-st-1-2-rsa-report/govscot%3Adocument/Annex%2BM%2B-%2BA9%2BDrumochter%2BSth%2BSt%2B1.2%2BRSA%2BReport.pdf (parent release as INT-004)
- publisher: Transport Scotland Roads Directorate / BEAR Scotland Ltd
- retrieved_date: 2026-08-23
- country/body: Scotland, UK
- native_stage: **Stage 1 & 2 combined**
- input_types present: scheme_description + drawings inventory (as INT-004)
- output_types present: findings_report (problems at this Stage 1&2 audit + recommendations)
- completeness: outputs-only (FOI redactions)
- filename+sha256: uk-ts-a9-drumochter-south-stage1-2-rsa-report.pdf `f1e262e1d9c85fa527a8870483e694a36eccf5412c038fbb29638e8f98bc0e40`
- notes: Second same-programme example — enables cross-sample comparison of problem phrasing on comparable VRS schemes.

### INT-006 · A9 Helmsdale Footway Improvements — Stage 1 RSA Response Report (designer-response artifact)

- id: `int-006-ts-a9-helmsdale-stage1-rsa-response-report`
- title: A9 Helmsdale Footway Improvements — Road Safety Audit Response Report (Stage 1), Scheme ID 22-NW-0801-63, Audit Ref 006
- source_url: https://www.gov.scot/binaries/content/documents/govscot/publications/foi-eir-release/2023/12/a9-accidents-safety-and-dualling-eir-release/documents/annex-n---rsa-response-report_stg-1/annex-n---rsa-response-report_stg-1/govscot%3Adocument/Annex%2BN%2B-%2BRSA%2BResponse%2BReport_Stg%2B1.pdf (parent release as INT-004)
- publisher: Transport Scotland Roads Directorate / BEAR Scotland Ltd (Form #220)
- retrieved_date: 2026-08-23
- country/body: Scotland, UK
- native_stage: Stage 1 response
- input_types present: none (response document)
- output_types present: response_report (problem-by-problem designer response, action status, sign-off blocks)
- completeness: outputs-only
- filename+sha256: uk-ts-a9-dualling-stage1-rsa-response-report-foi.pdf `2c88ceb964fe6437a603322641628092740cbce22440321c79aceb5feede9111`
- notes: Pairs the Designer-response side of the contract with the INT-004/005 findings reports — the response half of an input→findings→response loop.

### INT-007 · A9 Ballinluig Safety Signage Improvements — Stage 2 RSA Response Report

- id: `int-007-ts-a9-ballinluig-stage2-rsa-response-report`
- title: A9 Ballinluig Road Safety Signage Improvements — Road Safety Audit Response Report (Stage 2), Scheme ID 22-NW-0801-084, Audit Ref 327
- source_url: https://www.gov.scot/binaries/content/documents/govscot/publications/foi-eir-release/2023/12/a9-accidents-safety-and-dualling-eir-release/documents/annex-k---rsa-response-report_stage-2/annex-k---rsa-response-report_stage-2/govscot%3Adocument/Annex%2BK%2B-%2BRSA%2BResponse%2BReport_Stage%2B2.pdf (parent release as INT-004)
- publisher: Transport Scotland Roads Directorate / BEAR Scotland Ltd
- retrieved_date: 2026-08-23
- country/body: Scotland, UK
- native_stage: Stage 2 response
- input_types present: none
- output_types present: response_report
- completeness: outputs-only
- filename+sha256: uk-ts-a9-stage2-rsa-response-report.pdf `3cd2fcd5afb3c51b90a6ac62294f5d0262529e5af5dba2fd9a2d2a3e033ccab4`
- notes: With INT-004…007 the collection holds one coherent multi-artifact UK programme slice (two Stage 1&2 findings reports + Stage 1 and Stage 2 responses). Same release also contains Annex O (Munlochy junction temporary barrier Stage 1/2 audit, 14 pp.) left un-downloaded within the ~8-download cap.

### INT-008 · Great North Road residential access — Stage 1 RSA with embedded responses and reference plan (UK development-control audit)

- id: `int-008-uk-great-north-road-stage1-rsa-full-package`
- title: Heathfield Lodge, Great North Road, London — Stage 1 Road Safety Audit (Issue 1, August 2024) incl. Designer's Response, Adopting Authority Response block and Appendix 1 Audit Reference Plan
- source_url: https://planning.welhat.gov.uk/Document/Download?module=PLA&recordNumber=107754&planId=2079274&imageId=5&isPlan=False&fileName=Stage%201%20Road%20Safety%20Report.pdf (Welwyn Hatfield Borough Council planning portal, application record 107754)
- publisher: Cole Easdon Consultants Ltd (audit team: Paul Salmon ATL, Caroline Shakespeare ATM) for Mr & Mrs Cooper; adopting highway authority Hertfordshire County Council
- retrieved_date: 2026-08-23
- country/body: England, UK (development-control RSA; ToR = IHT Guidelines + DMRB GG 119)
- native_stage: Stage 1 (preliminary design of a vehicle-crossover access serving a 6-flat development)
- input_types present: scheme_description (access arrangement, crossover history), drawings (Plan 9666/201 Site Access Visibility Splays "For Audit"; swept-path plans; Appendix 1 Audit Reference Plan), site observations (dated site visit, weather, observed users), crash context (5-year Crashmap review statement)
- output_types present: findings_report (Problem 3.1 + Commentary items), recommendations, response_report (Designer's response dated/signed 13/08/24; Adopting Authority certification block)
- completeness: **full-package** (single-file: inputs + findings + responses; minor scheme, no traffic counts or photos)
- filename+sha256: uk-welhat-great-north-road-stage1-rsa-with-responses-2024.pdf `b96a3ff503c72e9ef2f5c5d0acee8267039fc4649769fc1e167f5860ea982591`
- notes: Only true end-to-end single-document package found in open access; small-scale but structurally complete (brief → independence statement → findings → designer response → authority sign-off). PDF/A-1b.

### INT-009 · Lackareagh Wind Farm, Co. Clare — Stage 1 Road Safety Audit (Irish EIAR appendix)

- id: `int-009-ie-lackareagh-wind-farm-stage1-rsa`
- title: Lackareagh Wind Farm, Co. Clare — Stage 1 Road Safety Audit (240077RPT001_RSA1 Rev 1, Aug 2024), published as EIAR Appendix 15-4 (An Bord Pleanála case 321285)
- source_url: https://www.pleanala.ie/publicaccess/EIAR-NIS/321285/EIAR/321285%20-%20eiar%20appendix%2015-4%20road%20safety%20audit.pdf
- publisher: Traffico (consultant) for EDF Renewables Ireland Ltd; released through An Bord Pleanála EIAR publication
- retrieved_date: 2026-08-23
- country/body: Ireland (TII GE-STY-01024-style RSA practice; wind-farm haulage/access scheme)
- native_stage: Stage 1 (Ireland F/1/2/1&2/3/4 vocabulary; turbine delivery route + access junctions onto local roads)
- input_types present: scheme_description (locations considered, turbine delivery route), drawings inventory (Table 1.3 Designers Drawing List — drawings not appended), site inspection details (Table 1.1)
- output_types present: findings_report (4 problems incl. walking-trail conflict, sightlines obscured by field boundary, access-road gradient, soft-verge stranding), recommendations, audit-team statement/certification, designer-response & feedback-form workflow section
- completeness: outputs-only (drawings listed but not appended; no separate completed feedback form)
- filename+sha256: ie-abp-eiar-appendix-road-safety-audit.pdf `144b921313565ea5fc1bf7418a5820835a7b20a3469a5d6f3bca1587e256e586`
- notes: Real Irish Stage 1 audit with VRU (walking trail) findings — good candidate-finding phrasing seed for rural access schemes; 9.4 MB scan-heavy file.

## Documented gaps / blocked targets (no file)

| target | what it is | why not collected |
|---|---|---|
| PIARC RSM case study "Kazakhstan: Road safety audit of 1062 km of road" | Priority-source full case-study PDF (~103 kB) behind the Ch.10.4 case-study link | Open HTML summary exists on roadsafety.piarc.org; file route `/system/files/media/file/rsm_pi_kazakhstan_roadsafetyaudit.pdf` returns 403 anonymous (login-wrapped, verified 2026-08-23). **No Wayback captures exist** (CDX queried for exact URL, `/system/files/media/file/*`, and `/en/media/*` — zero rows). Remedy: free PIARC registration per docs/references/INT/MANIFEST.md. |
| PIARC RSM case study "Australia: Application of the safe system approach through safe system audit/review" | Main Roads WA zero-deaths project safe-system audit case study (~79 kB PDF) | Same wall: `/system/files/media/file/rsm_pi_australia_applicationofsafesystemaudit.pdf` → 403; no Wayback captures. MRWA's underlying "Policy and Guidelines for Safe System Reviews" is unpublished (cited as such in Austroads AP-R509-16). |
| Austroads worked RSA examples | No standalone published completed RSAs; AGRS06 Part 6 carries templates only | Austroads publishes guidance/frameworks (AGRS06-19, AP-R509-16 SSF with framework-level examples), not filled scheme audits. Skipped to respect download cap; retrievable free if wanted later. |
| NZTA/Waka Kotahi scheme RSAs | Procedures doc (TFM9) includes only sample blank forms | No completed real-scheme audits published by NZTA located publicly. |
| SANRAL scheme RSAs | South Africa publishes methods (TRH 29 / SARRAM lineage), not individual audits | Individual SANRAL project RSAs not in open domain. |
| World Bank WE-WC corridor RSA reports | Kazakhstan South West Roads Project safeguards docs exist (Inspection Panel report etc.) | The actual RSA reports were never published; WB document portal holds safeguards/procurement records only. |
| Full multi-file packages (brief + drawings + report + response) | Mission's ideal package shape | Unobtainable publicly at trunk-road scale (client property); closest is INT-008 single-file development-control package. |

## Coverage summary

- Downloads: **9 files** (7 distinct sources; INT-004–007 form one coherent Transport Scotland programme slice).
- full-package: INT-008 (single-file, minor scheme).
- outputs-only (real named schemes): INT-002, INT-004, INT-005, INT-006, INT-007, INT-009.
- excerpt/manual-with-worked-content: INT-001 (CAREC case studies + checklists), INT-003 (AfDB specimen report).
- Early-stage emphasis: 6/9 samples sit at feasibility↔detailed-design equivalents (CAREC detailed-design case studies; AfDB Stage 1–3 definitions + specimen; iRAP design-stage; three UK/Irish Stage 1(/2) artifacts).
- Jurisdiction spread: ADB/CAREC (Kazakhstan among members), iRAP/India, AfDB/Pan-African, Scotland×4, England×1, Ireland×1. Australia/NZ/SANRAL: gap-documented (blocked/unpublished).
- Integrity: all files `%PDF`-verified and pass `qpdf --check` (benign linearization warnings only; no encryption; no protection removed).

## Non-goals respected

No US/CA/AE material collected (separate collections exist). GF-9 synthetic INT prelim-design interchange fixture untouched — no duplicate geometry sources fetched. No code, config, or git changes made; scratch extraction text kept outside the repo (temp dir).
