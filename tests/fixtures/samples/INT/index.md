# INT — Road Safety Audit sample collection (International sources)

Collected 2026-08-23 (Round 1) and 2026-08-24 (Round 2) by sample-audit collection agent.
Public-access sources only; no login-wall circumvention. Wayback retrieval used only for
public-origin documents (AfDB PDF and NZTA M2PP PDF are bot-blocked live; fetched their own
archived public copies). Early stages (feasibility/conceptual + preliminary design)
prioritized per mission.

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
- **NZTA/Waka Kotahi** (Safe System audit guidelines 2022 lineage): Stage 1 scheme/concept →
  Stage 2 preliminary design (scheme design) → Stage 3 detailed design → Stage 4
  pre-opening/post-construction; M2PP artifact predates the 2022 rename and uses
  "RSA stage 2: Scheme Design" decision-tracking forms (PMM 6.5a/6.6a).

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

### INT-010 · A7 Boleside Road VRS — combined Stage 1/2 Road Safety Audit report (real UK trunk-road audit)

- id: `int-010-ts-a7-boleside-stage1-2-rsa-report`
- title: A7 Hawthorns to Boleside (VRS) — Stage 1/2 Road Safety Audit, Scheme ID 23-SE-0801-15, Audit Ref NMC-A7-009 (BEAR Form #359, issue 7)
- source_url: https://www.gov.scot/binaries/content/documents/govscot/publications/foi-eir-release/2026/04-g/foi-202600509731/documents/foi-202600509731---information-released---annex/foi-202600509731---information-released---annex/govscot%3Adocument/FOI%2B202600509731%2B-%2BInformation%2Breleased%2B-%2BAnnex.pdf (parent FOI/EIR release: https://www.gov.scot/publications/foi-202600509731/, FOI/202600509731, published 2026-07-24; RSA report = scanned pp. 15–32 of the combined annex, extracted locally)
- publisher: Transport Scotland Roads Directorate (client) / BEAR Scotland Ltd SE Unit (audit team) — released under EIR(S)R 2004
- retrieved_date: 2026-08-24
- country/body: Scotland, UK (Scottish Trunk Road Network Management Contract, South East Unit; VRS improvement near Galashiels)
- native_stage: **Stage 1/2 combined** (GG 119 lineage; small-scheme combined early-stage audit, same practice class as INT-004/005)
- input_types present: scheme_description + drawings inventory (report structure lists documents reviewed; scan — OCR required before machine use)
- output_types present: findings_report (problems raised at this Stage 1/2 audit + recommendations)
- completeness: outputs-only (scan; audit brief/drawings not released; personal-data redactions under reg. 11(2) elsewhere in parent annex)
- filename+sha256: uk-ts-a7-boleside-stage1-2-rsa-report.pdf `8df6e7a2965fa0c76316d676517e68e29063a280879ee6435b69aabee51780f2`
- notes: Round-2 extension of the Transport Scotland programme slice to the SE Unit. gov.scot licence footer verbatim: "All content is available under the Open Government Licence v3.0, except for graphic assets and where otherwise stated". Parent annex also holds designer risk register + departure determination (Annexes H/I) — context for recommendation-viability reasoning.

### INT-011 · Keadby 3 Low Carbon Gas Power Station — ES Appendix 10B Stage 1 RSA report (A18 access junctions)

- id: `int-011-uk-keadby3-stage1-rsa`
- title: The Keadby 3 Low Carbon Gas Power Station Project — Environmental Statement Volume II Appendix 10B: Road Safety Audit Report Stage 1 (Doc Ref 6.3.11/App 10B rev VP1.0, May 2021)
- source_url: https://www.ssethermal.com/media/va4jhaw3/k3-document-6-3-11-es-appendix-10b-stage-1-road-safety-audit.pdf
- publisher: Keadby Generation Limited (applicant) / AECOM (author) — DCO examination record, Planning Inspectorate EN010114
- retrieved_date: 2026-08-24
- country/body: England, UK (NSIP development-control RSA; ToR GG 119 per §1.1.8)
- native_stage: Stage 1 (preliminary design of proposed access off the A18 incl. right-turn pocket and AIL route, Belton near Scunthorpe)
- input_types present: scheme_description (access strategy, TTRO 40 mph construction limit vs NSL), collision data review section (§2.2), drawings inventory (GA drawing 60625943-ACM-XX-XX-DR-D-0000-001 cited in problem tables)
- output_types present: findings_report (Problems 4.1.x with Location/Drawing/Summary/Recommendation rows incl. RRS redesign + RRRAP-assessment finding and speed-related loss-of-control finding), departures section (§3)
- completeness: outputs-only (drawings referenced, not appended)
- filename+sha256: uk-keadby3-stage1-rsa-report-2021.pdf `3ae40933a54bae3dd6398f400930721f1597e115dddcaf3708d9789a527c582c`
- notes: First England trunk-road-adjacent NSIP artifact in collection; RRRAP-related problem language is a good seed for restraint-system reasoning; published via applicant's DCO document set (Crown copyright planning record).

### INT-012 · Sunnica Energy Farm — Newmarket Rd/site-access junction Stage 1 RSA (NSIP CTMP annex)

- id: `int-012-uk-sunnica-newmarket-rd-stage1-rsa`
- title: Sunnica Energy Farm ES Appendix 13C Annex E — Sunnica Solar Farm: Newmarket Road / Site Access Junction Stage 1 Road Safety Audit (FINAL; AECOM project 60594170, Sept–Oct 2021)
- source_url: https://nsip-documents.planninginspectorate.gov.uk/published-documents/EN010106-004850-6.2_Appendix_13C_Framework%20Construction%20Traffic%20Management%20Plan%20and%20Travel%20Plan%20Appendix%20E%20%5BTRACKED%5D.pdf
- publisher: AECOM Limited for Sunnica Energy (client); Planning Inspectorate Scheme EN010106, Application Document EN010106/APP/6.2
- retrieved_date: 2026-08-24
- country/body: England, UK (temporary HGV construction-access T-junction on Newmarket Road near Mildenhall, Suffolk; ToR GG 119)
- native_stage: Stage 1 (preliminary design of a temporary 13-month construction access, removed post-construction)
- input_types present: scheme_description (HGV movement profile 9–12 vehicles/day tapering, left-in/left-out restriction at A11(T)), drawings inventory (Appendix A: swept-path TRA_003/004/006, visibility splays TRA_005, dwg 210803_Golf_Links_Road_Site_Access_Option_2; RSA brief dated 15.09.21), site observations (dated daylight visit with weather/surface/off-peak traffic notes)
- output_types present: findings_report (sections A–E; Problem D1 slow-moving HGV right-turn conflict), recommendations (gateway signage strategy deferred to Stage 2), audit team statement
- completeness: outputs-only (problem-location plan embedded; drawings listed not appended; no designer response in this annex)
- filename+sha256: uk-sunnica-newmarket-road-stage1-rsa-2021.pdf `2226b4992986e6de8da1e787b57b45909d9973fd50c1bfdba332f9d02349f991`
- notes: Temporary-works audit exercises time-limited scheme reasoning (safety case tied to construction phase and reinstatement) — distinct from permanent-scheme audits; qpdf hint-table warnings benign.

### INT-013 · Northampton Gateway SRFI — Stage 1 RSA Response Report (designer-response artifact, England)

- id: `int-013-uk-northampton-gateway-stage1-response`
- title: Northampton Gateway SRFI Transport Assessment Appendix 31 — Stage 1 Road Safety Audit Response Report (NGW-BWB-GEN-XX-RP-TR-002_RSA1, May 2018)
- source_url: https://nsip-documents.planninginspectorate.gov.uk/published-documents/TR050006-000450-ES%20TR%20App%2012.1%20-%20TA%20App%2031%20-%20RSA1%20Response%20Report.pdf
- publisher: BWB Consulting Ltd (designer side, for Roxhill) — DCO examination record, Planning Inspectorate TR050006
- retrieved_date: 2026-08-24
- country/body: England, UK (strategic rail freight interchange; M1 J15/J15A trunk-road connections + site roads + A508)
- native_stage: Stage 1 response (responding to a March 2018 independent Stage 1 audit by BWB's separate road-safety team)
- input_types present: none (response document embedding the audit text verbatim for cross-reference)
- output_types present: response_report (items raised per location — J15A, M1 J15, site roads, A508, Roade, Knock Rd… — with designer responses in the audit's nomenclature)
- completeness: outputs-only
- filename+sha256: uk-northampton-gateway-stage1-rsa-response-2018.pdf `de89f817d942aa77b0dc1851764cafcddee8c83e0c2fffdaaa8ee7f2aa4b2520`
- notes: England counterpart to the Scottish response reports INT-006/007; multi-junction scale makes it a good fixture source for response-to-multiple-findings threading. Audit text embedded inside gives partial findings visibility.

### INT-014 · Ardee Old Railway Lands, Amenity Lands & Woodland Walk — Combined Stage 1&2 RSA (Irish public-realm regeneration)

- id: `int-014-ie-abp-ardee-stage1-2-rsa`
- title: COMBINED STAGE 1&2 ROAD SAFETY AUDIT — Ardee Old Railway Lands, Amenity Lands and Woodland Walk (Report ref 2067R02, FINAL 12-05-2025; Bruton Consulting Engineers Ltd for Louth County Council; TII GE-STY-01024 Dec 2017) — ABP case 323972 application document 13
- source_url: https://www.pleanala.ie/publicaccess/Case%20Documentation/323972/Applicant%20Documents/Application%20Documents/13%20-%20Ardee%202040%20-%20Stage%201%20&%202%20Road%20Safety%20Audit%20-%20Amenity%20&%20Woodland_0.pdf
- publisher: Bruton Consulting Engineers Ltd (team leader Norman Bruton TII approval NB 168446; member Owen O'Reilly OO1291756) for Louth County Council; released through An Bord Pleanála case documentation (Ardee 2040 Regeneration Project)
- retrieved_date: 2026-08-24
- country/body: Ireland (urban public-realm/community-infrastructure scheme in an N2 market town)
- native_stage: **Stage 1&2 combined** (Irish F/1/2/1&2/3/4 vocabulary; GE-STY-01024 Dec 2017 named as governing standard)
- input_types present: drawings inventory (Appendix B: Louth CoCo drawings 06-DR-2001 Rev D … 06-DR-2402 Rev B + Woodland Walk .dwg), site visits (16 Nov 2023 + 3 Jan 2024, weather/surface noted)
- output_types present: findings_report (Section 3 issues + Section 4 Observation explicitly listing information NOT provided to the audit team: drainage design, cross sections, kerb heights, some road markings, signage, utility diversions, swept paths), recommendations, audit statement/certification, feedback form template (Appendix C)
- completeness: outputs-only (drawings listed not appended; no completed feedback form in this document)
- filename+sha256: ie-abp-ardee-stage1-2-rsa-2024.pdf `fc1f90491a37b72bfc5e7cc3b7746fdc5ee98c3201006b47c5b9caaa3dc0395e`
- notes: VRU-dense public-realm complement to rural int-009. The "not provided to the Audit Team" observation block is direct seed material for input-completeness/intake-gap semantics. Sibling Main Street Ardee Stage 2 RSA exists inside the case's Quality Audit PDF (see gaps).

### INT-015 · Milltown Park, Sandford Road, Dublin 6 — Stage 1 RSA with completed feedback form incl. rejected recommendation

- id: `int-015-ie-abp-milltown-park-stage1-rsa-feedback`
- title: STAGE 1 ROAD SAFETY AUDIT — Proposed Residential Development at Milltown Park, Sandford Road, Dublin 6 (Report ref 0995R01 FINAL March 2021; Bruton Consulting for DBFL Consulting Engineers) incl. completed RSA feedback form signed 07-04-2021 — ABP case 322160 application docs
- source_url: https://www.pleanala.ie/publicaccess/EIAR-NIS/322160/Application%20Docs/DBFL%20Consulting%20Engineers/Reports/995%20DBFL%20Stage%201%20Road%20Safety%20Audit.pdf
- publisher: Bruton Consulting Engineers Ltd (Norman Bruton TL NB 168446; Sayed Ahmad Saeed TM SS 3419515) for DBFL Consulting Engineers; released through An Bord Pleanála (EIAR/NIS documentation)
- retrieved_date: 2026-08-24
- country/body: Ireland (672-unit residential development accesses + proposed toucan crossing of Milltown Road; 50 km/h context)
- native_stage: Stage 1 (GE-STY-01024 Dec 2017)
- input_types present: drawings inventory (190226-DBFL-RD-SP-DR-C-1001 P02 roads layout cited per problem), site visit 22 March 2021
- output_types present: findings_report (problems 3.1–3.5, all VRU-focused: toucan-crossing footway space, shared-use width, narrow footpaths/wide lane speeds, tactile paving at dropped kerbs, crossing siting), recommendations, completed ROAD SAFETY AUDIT FORM — FEEDBACK ON AUDIT REPORT (accept/reject per problem with reasons, alternative measures, three signature blocks dated 07-04-2021)
- completeness: outputs-only + **completed designer-response feedback form** (drawings cited not appended)
- filename+sha256: ie-abp-milltown-park-stage1-rsa-2021.pdf `e26c6ac2763bb6b2be1eb7d14142396a33aeac15ccd347edcefee25b9f2455c8`
- notes: **Only sampled artifact so far documenting rejection of an audit recommendation**: problem 3.2 answered No/No with justification (shared-area width acceptable given 4.8 m shared access; width constrained by trees/existing walls). Direct real-world analogue of candidate rejection-with-reasons semantics; strong fixture candidate alongside int-008's full package.

### INT-016 · Mackays to Peka Peka (Kāpiti Expressway) — RSA Stage 2 Scheme Design decision-tracking form (NZTA)

- id: `int-016-nz-nzta-m2pp-stage2-decision-tracking`
- title: Mackays to Peka Peka Scheme Assessment Report Appendix G — Road Safety Audit: "M2PP Kapiti Coast Expressway RSA stage 2: Scheme Design (11-SD)" recommendations decision-tracking forms PMM 6.5a/6.6a (auditors Jos Vroegop, Steve Reddish, Jon England)
- source_url: live https://www.nzta.govt.nz/assets/projects/mackays-to-peka-peka/docs/scheme-assessment-report/sar-appendix-g.pdf (nzta.govt.nz serves bot-challenge HTML to non-browser clients); retrieved via Wayback capture 20190131083846 of that public-origin URL
- wayback_url: http://web.archive.org/web/20190131083846if_/https://www.nzta.govt.nz/assets/projects/mackays-to-peka-peka/docs/scheme-assessment-report/sar-appendix-g.pdf
- publisher: NZ Transport Agency Waka Kotahi (Wellington Northern Corridor RoNS; M2PP Alliance)
- retrieved_date: 2026-08-24
- country/body: New Zealand (Kāpiti Coast expressway, first NZ sample in collection)
- native_stage: **RSA Stage 2 — Scheme Design** ("11-SD"; NZTA vocabulary Stage 1 scheme/concept → 2 preliminary/scheme design → 3 detailed → 4 pre-opening/post-construction)
- input_types present: none standalone (decision-tracking table references scheme-design recommendations and drawings by item)
- output_types present: response_report-equivalent — recommendation-by-recommendation rows with severity/risk column, designer comments, and decisions (full vs half interchanges at Poplar Ave/Peka Rd, pedestrian-cyclist crossing desire lines, max kerb lip ≤25 mm for truck tracking, etc.)
- completeness: outputs-only (scan; OCR required)
- filename+sha256: nz-nzta-m2pp-stage2-scheme-design-rsa-decision-tracking.pdf `6b86275409e6ed59b06a7ba524344398a7096e8186a2d9b86822c3b90a05eb2f`
- notes: Shows NZTA's formal decision-tracking mechanism (audit recommendation → designer comment → client decision) — structurally closest overseas analogue to promotion/rejection workflow; complements INT-006/007/013 responses. qpdf hint-table warnings benign.

### INT-017 · CAREC Road Safety Engineering Manual 5: Star Ratings for Road Safety Audit (SR4RSA, worked examples)

- id: `int-017-carec-manual5-sr4rsa-adb-2022`
- title: CAREC Road Safety Engineering Manual 5: Star Ratings for Road Safety Audit — Section IX Worked Examples illustrating SR4RSA Levels 1–3 (ADB publication stock no. TIM220272-2, June 2022, 74 pp.)
- source_url: https://www.adb.org/sites/default/files/publication/806631/carec-rse-manual-5-star-ratings-road-safety-audit_0.pdf (publication page: https://www.adb.org/publications/carec-road-safety-engineering-manual-star-ratings)
- publisher: Asian Development Bank / CAREC Secretariat, June 2022
- retrieved_date: 2026-08-24
- country/body: Central Asia Regional Economic Cooperation programme (11 member countries; ADB)
- native_stage: SR4RSA across design stages (Level 1 desk-based screen → Level 2 design-stage coding → Level 3 detailed scoring incl. motorcyclist-level crash-cost example); iRAP design-assessment lineage
- input_types present: scheme_description (worked-example road designs: typical cross sections, intersections), traffic_data (iRAP attribute coding records, flow assumptions in examples)
- output_types present: findings_report-equivalent (star ratings per user group per design iteration), recommendations (countermeasure mapping to star-score deltas), FSI estimates; sample Terms of Reference annex
- completeness: excerpt — manual with embedded worked examples; not a real named scheme (synthetic/example designs)
- filename+sha256: carec-manual5-star-ratings-rsa-adb-2022.pdf `b9e8f54bfe6ab2953366461385e2b25bcecb0194676e8fc35fa19ef57532830f`
- notes: Bridges int-001 (CAREC RSA process) and int-002 (iRAP SR4D) lineages; "situational scrutiny" concept and Level-2 road-design worked example are directly reusable as engine/judge prompt material. Covers Round-2 veins 4+5 in one volume. qpdf hint-table warnings benign.

## Documented gaps / blocked targets (no file)

| target | what it is | why not collected |
|---|---|---|
| PIARC RSM case study "Kazakhstan: Road safety audit of 1062 km of road" | Priority-source full case-study PDF (~103 kB) behind the Ch.10.4 case-study link | Open HTML summary exists on roadsafety.piarc.org; file route `/system/files/media/file/rsm_pi_kazakhstan_roadsafetyaudit.pdf` returns 403 anonymous (login-wrapped, verified 2026-08-23). **No Wayback captures exist** (CDX queried for exact URL, `/system/files/media/file/*`, and `/en/media/*` — zero rows). Remedy: free PIARC registration per docs/references/INT/MANIFEST.md. |
| PIARC RSM case study "Australia: Application of the safe system approach through safe system audit/review" | Main Roads WA zero-deaths project safe-system audit case study (~79 kB PDF) | Same wall: `/system/files/media/file/rsm_pi_australia_applicationofsafesystemaudit.pdf` → 403; no Wayback captures. MRWA's underlying "Policy and Guidelines for Safe System Reviews" is unpublished (cited as such in Austroads AP-R509-16). |
| Austroads worked RSA examples | No standalone published completed RSAs; AGRS06 Part 6 carries templates only | Austroads publishes guidance/frameworks (AGRS06-19, AP-R509-16 SSF with framework-level examples), not filled scheme audits. Skipped to respect download cap; retrievable free if wanted later. |
| NZTA/Waka Kotahi scheme RSAs | Procedures doc (TFM9) includes only sample blank forms | **Partially resolved Round 2** — INT-016 (M2PP Stage 2 decision-tracking) obtained via Wayback. Remaining gap: completed full RSA reports on named schemes are sparse; Te Ara Tupua design safety audits (2017 + detailed-design 2021, 11 MB/7.7 MB) exist on nzta.govt.nz/projects/te-ara-tupua/publications but nzta.govt.nz serves Incapsula bot-challenge HTML to non-browser clients, and the two Wayback captures of the detailed-design file are truncated at ~1 MiB in our fetch environment. Retriable with browser-session tooling. |
| Te Ara Tupua Pito-One to Melling walking/cycling link audits | 2017 Design safety audit + Nov 2021 Detailed design road safety audit (redacted), published by Waka Kotahi | See NZTA row above — bot-walled live; archived copies truncated. High-value future target: VRU-critical-mass design audit. |
| Ardee Main Street Stage 2 RSA (June 2024 + Oct 2024 addendum) | Urban main-street public-realm Stage 2 with TII approval appendix | Present as Appendix B *inside* the case's Quality Audit PDF (19 - Ardee 2040 - Quality Audit (November 2024)_0.pdf, ABP 323972); left un-downloaded this run to respect scope cap — direct candidate for Round 3. |
| SANRAL scheme RSAs | South Africa publishes methods (TRH 29 / SARRAM lineage), not individual audits | Individual SANRAL project RSAs not in open domain. |
| World Bank WE-WC corridor RSA reports | Kazakhstan South West Roads Project safeguards docs exist (Inspection Panel report etc.) | The actual RSA reports were never published; WB document portal holds safeguards/procurement records only. |
| Full multi-file packages (brief + drawings + report + response) | Mission's ideal package shape | Unobtainable publicly at trunk-road scale (client property); closest is INT-008 single-file development-control package. |

## Coverage summary

- Downloads: **17 files** (Round 1: 9; Round 2: 8 — see per-entry sha256). All `%PDF`-verified; qpdf checks pass with benign linearization/hint-table warnings only (no encryption, nothing decrypted).
- full-package: INT-008 (single-file, minor scheme). outputs-only + completed response/feedback artifacts: INT-015 (feedback form incl. one rejection), INT-016 (decision-tracking form), INT-006/007/013 (response reports).
- outputs-only (real named schemes): INT-002, INT-004, INT-005, INT-010, INT-011, INT-012, INT-014.
- excerpt/manual-with-worked-content: INT-001 (CAREC case studies + checklists), INT-003 (AfDB specimen report), INT-017 (CAREC Manual 5 SR4RSA worked examples Levels 1–3).
- Early-stage emphasis after Round 2: 13/17 samples sit at feasibility↔detailed-design equivalents (all four new UK/Irish audit artifacts are Stage 1(/2) or combined Stage 1&2; NZ sample is Stage 2 scheme design; CAREC M5 examples are design-stage).
- Jurisdiction spread after Round 2: ADB/CAREC ×2 (incl. SR4RSA manual), iRAP/India, AfDB/Pan-African, Scotland ×5 (+INT-010 SE Unit), England ×4 (NSIP development-control + SRFI response), Ireland ×3 (ABP/EIAR vein productive), New Zealand ×1. Australia/SANRAL still gap-documented below.
- Response-culture coverage now spans: UK FOI designer responses (Stage 1 + Stage 2), England NSIP response report (multi-junction), Irish completed feedback form **with a rejected recommendation**, and NZTA decision-tracking (designer comment + client decision).

### Round 2 notes (2026-08-24)

- PINS nsip-documents.planninginspectorate.gov.uk and applicant DCO document sets are a rich open vein for England Stage 1 RSAs (search "road safety audit" appendix within EN/TR case records).
- An Bord Pleanála `pleanala.ie/publicaccess` hosts standalone RSA PDFs under both Case Documentation and EIAR-NIS trees — highest-yield Irish route found so far.
- nzta.govt.nz direct asset URLs are bot-walled to plain HTTP clients; Wayback captures of public-origin NZTA assets work but large files truncate (~1 MiB) in this environment.

## Non-goals respected

No US/CA/AE material collected (separate collections exist). GF-9 synthetic INT prelim-design interchange fixture untouched — no duplicate geometry sources fetched. No code, config, or git changes made; scratch extraction text kept outside the repo (temp dir).
