# Canada (CA) — Road Safety Audit sample collection

Collected 2026-08-23 by sample-audit collection agent. Public-access sources only.
Every file verified `%PDF` magic on arrival; SHA-256 recorded below.

**Native stage vocabularies observed** (recorded verbatim per source):
- **TAC CRSAG lineage** (Alberta/BC/NB guidance): Planning (Feasibility) → Preliminary
  Design → Detailed Design → Pre-Opening → Post-Opening. Bare numbers are NOT used by
  TAC itself; provincial docs attach their own numbering (Alberta Stage 3 = Detailed
  Design ≠ UK Stage 3 — see docs/references/CA MANIFEST notes, EV-CA-006).
- **In-service reviews**: TAC *Canadian Guide to In-service Road Safety Reviews* (2004)
  vocabulary — "in-service road safety review" (ISRSR/ISSR) — used by Manitoba,
  Niagara, Kamloops, Toronto. Distinct process from design-stage RSA.
- Mapping to Canonical Stage (`FEASIBILITY_CONCEPT`/`PRELIMINARY_DESIGN`/
  `DETAILED_DESIGN`) shown per sample with confidence; pre-opening/post-opening map
  `n/a` (outside the three canonical design stages).

Downloads: **7 live fetches** (+1 local page-extraction from an already-held reference;
no duplication of `docs/references/CA/`). GF-10 synthetic planning-stage express-collector
fixture not duplicated.

## Downloaded samples

### CA-001 · North East Edmonton Ring Road (Anthony Henday Dr NE) — PLANNING STAGE RSA (Alberta Transportation, 2009)

- id: `ca-001-ab-neahd-planning-stage-rsa`
- title: "Report on Planning Stage Road Safety Audit — North East Edmonton Ring Road, Stage 1 – 2041 (1.6 million regional population)"
- source_url: https://open.alberta.ca/dataset/4f6fb605-f342-46ea-b531-d018fd81d70f/resource/2f0b905f-2c5c-4257-a91b-8272cb605242/download/neahdappendixc.pdf (Appendix C of NEAHD Functional Planning Study final report R-1084)
- publisher: Alberta Transportation / ISL Engineering (auditors: Canadian Highways Institute Ltd. + GCS Technology — Morrall & Smith)
- retrieved_date: 2026-08-23
- province/body: AB — Alberta Transportation (provincial freeway functional plan)
- native stage: **Planning Stage** (audit "focused exclusively on safety issues related to the functional plan"; per TAC CRSAG 2001 + Alberta 2004 guidelines) → mapping FEASIBILITY_CONCEPT (authoritative — self-labelled planning stage)
- input_types present: scheme_description (functional plan + design criteria listed as provided), drawings (2041 Stage 1 plan & profile, 4 sheets @1:10,000 — listed in Basis of Audit, not embedded), traffic_data (planning-horizon volumes implied by 1.6M population staging)
- output_types present: findings_report (general comments + specific observations incl. interchange spacing/weaving/ramp-speed findings), recommendations (correct-before-forward-development framing)
- completeness: full-package (10 pp single-document audit letter-report; drawings cited but not attached)
- filename: ab-neahd-planning-stage-rsa-2009.pdf · sha256: 0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95
- notes: **Earliest-stage genuine provincial RSA found in Canada's public corpus.** Named-project freeway audit with interchange-by-interchange issue tables (Tables 1–2). Explicit trade-off disclaimer language (safety vs land-use/environment/ROW/cost) — good seed for recommendation-viability reasoning.

### CA-002 · Glenmore Trail: 100 St SE – Rainbow Rd interchange Functional Plan RSA — REPORT (City of Calgary / McElhanney, Aug 2017)

- id: `ca-002-ab-calgary-glenmore-functional-plan-rsa`
- title: "Glenmore Trail East Interchanges Functional Planning Study, Appendix H — Glenmore Trail: 100 Street SE to Rainbow Road Interchange Functional Plan Road Safety Audit"
- source_url: https://www.calgary.ca/content/dam/www/transportation/tp/documents/projects/current-planning-projects/glenmore-trail-100st/glenmore-tr-e-functional-study-appendix-h-1-road-safety-audit-report.pdf
- publisher: City of Calgary Transportation (consultant McElhanney Consulting Services Ltd.; authors Krishan/Wilson, P.Eng.)
- retrieved_date: 2026-08-23
- province/body: AB — City of Calgary (municipal expressway interchange, Stoney Trail corridor)
- native stage: **functional planning study** stage (DDI concept selected at functional-plan level) → mapping PRELIMINARY_DESIGN (interpreted — sits at planning→preliminary boundary; risk-assessment section included)
- input_types present: scheme_description (diverging-diamond interchange concept), drawings (companion artifacts held: see CA-003/CA-004)
- output_types present: findings_report (risk assessment + summary of potential safety issues + issue-by-issue findings), recommendations (safety benefits per issue)
- completeness: full-package (33 pp report; combined with CA-003/004 forms a complete input→output municipal package)
- filename: ab-calgary-glenmore-functional-plan-rsa-2017.pdf · sha256: bb9850fe4780789ffe20b17c0a3d3182906b3e4010942d768abab4e920af343d
- notes: Rare public Canadian **design-stage** municipal RSA; novel-treatment audit target (DDI) exercises non-standard-geometry reasoning.

### CA-003 · Companion of CA-002 — typical cross-sections (City of Calgary, 2017)

- id: `ca-003-ab-calgary-glenmore-typical-sections`
- title: Glenmore Trail functional study Appendix H.2 — proposed typical sections (Sections A/B)
- source_url: https://www.calgary.ca/content/dam/www/transportation/tp/documents/projects/current-planning-projects/glenmore-trail-100st/glenmore-tr-e-functional-study-appendix-h-2-road-safety-audit-report.pdf
- publisher: City of Calgary Transportation
- retrieved_date: 2026-08-23
- province/body: AB — City of Calgary
- native stage: same engagement as CA-002 → PRELIMINARY_DESIGN (interpreted)
- input_types present: drawings (typical sections: lanes/shoulders/medians/ditches/R/W dimensions)
- output_types present: none (pure engineering input)
- completeness: inputs-only (companion artifact of CA-002)
- filename: ab-calgary-glenmore-typical-sections-2017.pdf · sha256: f4a9786f479115b87254c6552172b792c40fe8b070ddbb018c995d5f517c7704
- notes: 9 pp CAD export; demonstrates what "provided inputs" look like for a functional-plan audit.

### CA-004 · Companion of CA-002 — annotated plan & profile sheets (City of Calgary, 2017)

- id: `ca-004-ab-calgary-glenmore-annotated-plan-profiles`
- title: Glenmore Trail functional study Appendix H.4 — RSA-issued plan/profile + interchange drawing set (STS 001+400–006+500)
- source_url: https://www.calgary.ca/content/dam/www/transportation/tp/documents/projects/current-planning-projects/glenmore-trail-100st/glenmore-tr-e-functional-study-appendix-h-4-road-safety-audit-report.pdf
- publisher: City of Calgary Transportation
- retrieved_date: 2026-08-23
- province/body: AB — City of Calgary
- native stage: same engagement as CA-002 → PRELIMINARY_DESIGN (interpreted)
- input_types present: drawings (rainbow/interchange profiles, ramp gore detail, ROW/legal overlays)
- output_types present: checklists n/a; sheets carry the audit's location-referenced callouts tying issues to chainages (drawing-anchored findings)
- completeness: inputs-only (annotated working drawings accompanying CA-002)
- filename: ab-calgary-glenmore-annotated-plan-profiles-2017.pdf · sha256: dab3275e738b63b0c8ea7f7a076f5a3e58e703643f9682c96031acdbc3cfd8c1
- notes: 4 pp. Sibling Appendix H.3 (same shape, STS 005+200–001+400) fetched + verified but not retained (redundant exemplar); URL recorded here for future runs.

### CA-005 · PTH 1 @ PTH 5 intersection In-Service Road Safety Review — executive summary (Manitoba MTI / WSP, Dec 2023)

- id: `ca-005-mb-pth1-pth5-in-service-review`
- title: "In-Service Road Safety Review – PTH 1 and PTH 5 Intersection, Executive Summary Report" (Project No. 211-12345-00)
- source_url: https://gov.mb.ca/mti/projects_management/pdf/pth1-pth5-in-service-road-safety-review-exec-summary.pdf
- publisher: Manitoba Transportation and Infrastructure (consultant WSP Canada Inc.)
- retrieved_date: 2026-08-23
- province/body: MB — Manitoba Transportation and Infrastructure (rural two-way-stop divided-highway intersection near Carberry)
- native stage: **in-service road safety review** (per TAC Canadian Guide to In-service Road Safety Reviews) → mapping n/a (in-service)
- input_types present: scheme_description (intersection layout figure), traffic_data (collision history; HSM SPF + CMF quantification incl. NCHRP 888 roundabout SPFs)
- output_types present: findings_report (lines-of-evidence, risk-based prioritized issues), recommendations (short/medium/long-term countermeasures + maintenance "watch list")
- completeness: excerpt (executive summary only — 27 pp; full WSP review not posted)
- filename: mb-pth1-pth5-in-service-review-exec-2023.pdf · sha256: 6b67c5ed28662f6ccca46ce2ac233311a4c8459918357cd0a701b3c47a62be8c
- notes: Only Manitoba sample obtainable; exemplary CMF-backed countermeasure comparison (multilane roundabout: −44% total / −82% FI collisions) — strong fixture material for quantified recommendation reasoning.

### CA-006 · OC Transpo Transitway Station Design Safety Study — Independent Road Safety Study (City of Ottawa, Sept 2021)

- id: `ca-006-on-ottawa-octranspo-transitway-rsa`
- title: "OC Transpo Transitway Station Design Safety Study — Independent Road Safety Study, Final" (post-Westboro-collision study; stations: Pleasant Park, Hurdman, Westboro, Fallowfield, Longfields)
- source_url: https://documents.ottawa.ca/sites/default/files/OC%20Transpo%20Transitway%20Road%20Safety%20Audit.pdf
- publisher: City of Ottawa / OC Transpo (RSA per TAC CRSAG 2001 + TAC In-Service Guide 2004 + TAC Human Factors Guide 2013)
- retrieved_date: 2026-08-23
- province/body: ON — City of Ottawa (transit infrastructure; commissioned after 2019 Westboro double-decker bus collision)
- native stage: existing-facility RSA across station generations (start-up meeting, day+night site visits Feb 2020, post-audit meeting documented) → mapping n/a (in-service)
- input_types present: scheme_description (station designs + guidelines reviewed), traffic_data (incident spreadsheets per station, bus fleet/workstation data), drawings (station plans, aerial images)
- output_types present: findings_report (findings & mitigation suggestions per station), recommendations (design-guideline amendments; Winnipeg/Calgary benchmarking), response-report requirement explicitly stated as next step (not included)
- completeness: full-package (96 pp incl. start-up/post-audit meeting minutes as appendices)
- filename: on-ottawa-octranspo-transitway-safety-study-2021.pdf · sha256: b28c45bf100bb713a419a1d234e256e671e969e44ac01e4e80a0228fc3d4959c
- notes: Best Canadian sample showing the full TAC process skeleton (meetings → inspections → report → response-report handoff) and cross-city guideline benchmarking inside findings.

### CA-007 · UNB Transportation Group "Exemplary Audits" — Appendix C extraction (New Brunswick, 1999)

- id: `ca-007-nb-unb-exemplary-audits`
- title: Appendix C "Exemplary Audits" from UNB Transportation Group Road Safety Audit Guidelines: Route 1000 post-opening/existing-road audit; Fredericton-South municipal-network audit; Detailed Design example; Pre-Opening audit
- source_url: pages extracted locally from already-held reference `docs/references/CA/unb-transportation-group-rsa-guidelines.pdf` (pp. 102–162 of 168; original: https://www.unb.ca/research/transportation-group/_assets/documents/rsa-guidelines.pdf) — no re-download
- publisher: University of New Brunswick Transportation Group (Hildebrand & Wilson; sponsored by Maritime Road Development Corporation / NRC IRAP)
- retrieved_date: 2026-08-23
- province/body: NB — academic synthesis embedding real NB audits (incl. MRDC Fredericton–Moncton programme practice)
- native stage: mixed, per sub-audit: Route 1000 = Stage 5 existing/post-opening → n/a; Fredericton-South = municipal network (existing) → n/a; Detailed Design example → DETAILED_DESIGN (authoritative label); Pre-Opening audit → n/a (pre-opening outside canonical three)
- input_types present: scheme_description, drawings (plan exhibits in examples)
- output_types present: findings_report, recommendations, checklists (checklist-driven), proto-response content — pre-opening findings table carries explicit CLIENT RESPONSE Agree(yes/no)+COMMENTS columns
- completeness: full-package (61 pp; four complete worked audits)
- filename: nb-unb-exemplary-audits-appendix-c-1999.pdf · sha256: 6c38a1a99caaa666611eb6397d1672926b2b270cf793fc9fff9f448caeba5a9d
- notes: **Only public Canadian detailed-design + pre-opening worked examples located.** Client-response columns make it a bridge specimen toward designer-response testing. Do not confuse with the parent guidelines doc already in references.

### CA-008 · "Road safety audit for a regional corridor" — Ryerson thesis, Region of Waterloo corridor

- id: `ca-008-on-ryerson-waterloo-corridor-rsa-thesis`
- title: "Road safety audit for a regional corridor" (graduate thesis; Region of Waterloo high-risk corridor RSA: 5-year collision analysis, site examinations, mitigation recommendations)
- source_url: https://doi.org/10.32920/ryerson.14652633 (file Sudani_Dhara.pdf via https://ndownloader.figshare.com/files/28134414)
- publisher: Ryerson University (now Toronto Metropolitan University) repository; author Dhara Sudani
- retrieved_date: 2026-08-23
- province/body: ON — academic (Waterloo Region roads)
- native stage: in-service regional-corridor audit (TAC definition quoted in abstract) → mapping n/a (in-service)
- input_types present: scheme_description (corridor + intersections), traffic_data (5-year collision analysis), site observation narrative
- output_types present: findings_report, recommendations (signage, driveway consolidation, lighting, red-light cameras, geometric study)
- completeness: full-package (203 pp thesis; **scanned images, no text layer** — OCR needed before machine use)
- filename: on-ryerson-waterloo-corridor-rsa-thesis.pdf · sha256: 21a60cfcb38b486f3b4324109946eff05575f1acf6af34430e3b45034fcd576b
- notes: Academic tier; repository item dated 2021-06-08 (thesis itself early-2000s). Useful as end-to-end student-scale worked audit once OCR'd.

## Documented gaps / not collected

| item | what it is | why not collected |
|---|---|---|
| BC MoTI completed project RSAs | Ministry-mandated RSA + response reports (TC T-02/04 §5.6) | Response reports go to project file; copies to Ministry contact only — no named-project RSA reports on the open gov.bc.ca tree. Structural gap of BC practice. |
| Québec MTQ completed «audits de sécurité routière» | Worked audit reports under the 2012 guide | None located publicly (bv.transports.gouv.qc.ca hosts the guide, not executed audits). French-native stage vocab remains available from the guide in references. |
| Toronto Vision Zero RSAs (~30 locations/yr program since 2017) | Auditor reports for 14 priority KSI locations (e.g., Yonge St) | Published only as council staff-report summaries (toronto.ca/legdocs), never standalone auditor findings; e.g., "Corridor Safety Review – Queen Street East" (2022), yongeTOmorrow ISSR+RSA mentioned but not attached. |
| City of Vancouver RSAs | Municipal corridor/intersection audits | No standalone RSA report PDFs located on vancouver.ca this run. |
| Kamloops five-intersection in-service safety review | Named ISRSR flagged "publicly available" in BC Community Road Safety Toolkit Module 3 | Direct URL not surfaced this run; candidate for a targeted Wayback dig. |
| ICBC Municipal Road Safety Audit Program reports | Free municipal RSAs (14 audits for 13 authorities in 2014 alone) | Not centrally published; per-municipality dispersal unknown. |
| Fredericton–Moncton F-MH stage RSA reports | Canada's first full-lifecycle P3 RSA programme (planning→post-opening) | Actual stage reports not public; only secondary descriptions (Hildebrand & Wilson TAC 2002; CCPPP case study; UNB P3 paper). |
| Chief Peguis Trail Extension RSAs (Winnipeg) | P3 arterial with RSA by GCS Technology | TAC 2012 construction paper describes programme; RSA report itself unpublished. |
| Dufferin County Dufferin Rd 17/19 RSA (Sept 2025) | Recent Ontario county RSA w/ sightline findings vs TAC minimums | Reported secondhand in press/staff report; audit document itself not posted. |

## Coverage summary vs. target package shape

- Files: **8** in this directory (7 live downloads + 1 local extraction), all `%PDF`-verified, all sha256-recorded.
- Early-stage emphasis achieved: CA-001 (**Planning**, authoritative self-label), CA-002/003/004 (functional-plan package), CA-007 includes the only public **Detailed Design** + **Pre-Opening** worked examples found anywhere in Canada's open corpus.
- full-package: CA-001, CA-002 (+companions CA-003/004), CA-006, CA-007, CA-008. excerpt: CA-005. inputs-only: CA-003, CA-004.
- Response-report culture: no standalone designer response report published anywhere sampled; closest structural evidence = CA-007 client-response columns and CA-006's mandated response step.
- Best candidates for fixture building: **CA-001** (earliest-stage provincial), **CA-002+CA-003+CA-004** (only complete municipal input→output package), **CA-007** (multi-stage worked examples w/ response columns), **CA-005** (CMF-quantified recommendations), **CA-006** (process-formality + VRU/transit users).
