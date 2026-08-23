# US — Road Safety Audit sample collection (United States)

Collected 2026-08-23 by sample-audit collection agent. Public-access sources only.
US practice uses **project phases, not numbered stages**: FHWA groups RSAs into
pre-construction (planning/feasibility → preliminary design (plans 30–40%) → detailed
design (plans 60–80%)), construction (work-zone / changes-during-construction /
pre-opening), and post-construction (existing-road / "RSA assessment") phases
[FHWA RSA Guidelines FHWA-SA-06-06, ch. 3/5]. Most publicly posted US RSAs are
existing-road audits of in-service locations; genuine design-phase packages are rare.
Mapping used below: planning/feasibility → `FEASIBILITY_CONCEPT`; preliminary design
→ `PRELIMINARY_DESIGN`; detailed/final design (incl. >80% plans) → `DETAILED_DESIGN`;
existing-road RSAs are mapped `n/a` (in-service — outside the three canonical
design stages).

ROSAP direct PDF URLs are Akamai-bot-blocked for curl (403 HTML even with browser
headers); the two ROSAP-hosted samples below were retrieved from Wayback captures of
the exact ROSAP `*_DS1.pdf` artifacts. All other files fetched live from agency hosts.
Every downloaded file verified `%PDF` magic on arrival.

## Downloaded samples

### US-001 · RSA of US 59 @ IA 9 intersection, Osceola County, Iowa (InTrans 11-421)

- id: `us-001-ia-us59-ia9-intersection-rsa`
- title: "Road safety audit for the intersection of US 59 and IA 9 in Osceola County, Iowa" (final report)
- source_url: https://rosap.ntl.bts.gov/view/dot/24242 (PDF artifact dot_24242_DS1.pdf)
- retrieval_url_used: http://web.archive.org/web/20250311024049if_/https://rosap.ntl.bts.gov/view/dot/24242/dot_24242_DS1.pdf (live rosap curl blocked)
- publisher: Iowa State University Institute for Transportation for Iowa DOT (author McDonald, T.)
- retrieved_date: 2026-08-23
- state/agency: Iowa — Iowa DOT / ISU InTrans RSA program
- native phase: existing-road RSA (rural stop-controlled intersection, in-service) → mapping n/a
- input_types present: scheme_description (intersection geometry/background), traffic_data (crash history; unique video-observation conflict analysis), drawings (aerial/geometric figures)
- output_types present: findings_report, recommendations (team mitigation suggestions)
- completeness: full-package (single-document audit; no designer response report — normal for this program)
- filename: ia-us59-ia9-rsa.pdf · sha256: 58e92f75711931d85fdd0adc7009cd9ebb551be3008291ddb7feab59bc717395
- notes: 44 pp. Notable for recorded traffic-conflict methodology alongside daylight/night field reviews — good seed for evidence/inference typing.

### US-002 · RSA of IA 28 corridor, Norwalk → IA 5 interchange, Iowa (InTrans 12-429)

- id: `us-002-ia-ia28-norwalk-corridor-rsa`
- title: "Road safety audit for IA 28 from the south corporate limits of Norwalk in Warren County through the IA 5 interchange in Polk County, Iowa" (final report)
- source_url: https://rosap.ntl.bts.gov/view/dot/25587 (PDF artifact dot_25587_DS1.pdf)
- retrieval_url_used: http://web.archive.org/web/20250311170541if_/https://rosap.ntl.bts.gov/view/dot/25587/dot_25587_DS1.pdf (live rosap curl blocked)
- publisher: Iowa State University InTrans / Iowa DOT (authors McDonald, Vortherms)
- retrieved_date: 2026-08-23
- state/agency: Iowa — Iowa DOT / ISU InTrans RSA program
- native phase: existing-road corridor RSA (urban small-town arterial through interchange) → mapping n/a
- input_types present: scheme_description (corridor limits/segments), traffic_data (crash history, operational issues), drawings (corridor exhibits)
- output_types present: findings_report, recommendations (corridor-wide + location-specific)
- completeness: full-package (136 pp incl. appendices; no response report)
- filename: ia-ia28-norwalk-rsa.pdf · sha256: decb0144a29430bea1b41419b33d13f20b9d0442e5ebec90392bd34c161ff1d3
- notes: Largest single-document sample; signalized + unsignalized intersections mix.

### US-003 · OR 211 Safety Corridor RSA, MP 14.0–24.0, Oregon (ODOT, Nov 2022)

- id: `us-003-or-or211-corridor-rsa`
- title: "OR 211 Road Safety Audit Report, MP 14.0–24.0"
- source_url: https://www.oregon.gov/odot/Projects/Project%20Documents/OR211-RSA.pdf
- publisher: Oregon Department of Transportation (Transportation Safety Office)
- retrieved_date: 2026-08-23
- state/agency: Oregon — ODOT Safety Corridor Program
- native phase: existing-road RSA (safety-corridor designation process; rural two-lane) → mapping n/a
- input_types present: scheme_description (corridor + focus areas), drawings (location figures), crash-data analysis (5-yr corridor crash review; traffic counts not embedded)
- output_types present: findings_report (systemic needs Table 4 + high-crash focus areas), recommendations (countermeasures toolbox + risk-based prioritization Table 5, short/mid-term)
- completeness: full-package (33 pp; stakeholder workshops documented; no response report)
- filename: or-or211-rsa.pdf · sha256: 8f9e73b8947c5cce6e113dade30c1220ef4b28b4a1b1fdaac33654a52878b01c
- notes: Clean example of systemic-vs-spot finding split and prioritization logic (frequency/severity risk × feasibility).

### US-004 · CTfastrak corridor RSA, New Britain–West Hartford–Hartford (CTDOT, Aug 2025)

- id: `us-004-ct-ctfastrak-rsa`
- title: "Community Connectivity Program: CTfastrak Road Safety Audit — Report of Findings and Recommendations"
- source_url: https://portal.ct.gov/dot/-/media/dot/programs/community-connectivity/rsa-reports/ctfastrak-rsa-2025.pdf
- publisher: Connecticut Department of Transportation (FHI Studio reporting)
- retrieved_date: 2026-08-23
- state/agency: Connecticut — CTDOT RSA Program (existing BRT guideway + street crossings)
- native phase: existing-facility RSA (transit corridor operations) → mapping n/a
- input_types present: scheme_description (stations/at-grade crossings), traffic_data (signal ops, bus/volume context), drawings (study-area exhibits/maps)
- output_types present: findings_report (per-station observations), recommendations (three-tier complexity: least/moderately/most complex, each with "Next Step" owner)
- completeness: full-package (124 pp, image-rich; advisory-only framing stated explicitly; no response report)
- filename: ct-ctfastrak-rsa-2025.pdf · sha256: 720fe1f276b052f5296c585850154d8f2e6c0d2bc767db263fd1ca32bd9e974b
- notes: Modern VRU-heavy sample; recommendation-tiering + owner-per-recommendation discipline is directly reusable.

### US-005 · Blair Rd/Cedar Rd/4th St NE intersection RSA, Washington DC (DDOT, 2012)

- id: `us-005-dc-blair-cedar-4th-intersection-rsa`
- title: "Road Safety Audit: Blair Road, Cedar Road and 4th Street Intersection — Final RSA Report"
- source_url: https://ddot.dc.gov/sites/default/files/dc/sites/ddot/page_content/attachments/Blair%20Cedar%204th%20Final%20RSA%20Report.pdf
- publisher: District Department of Transportation (DC)
- retrieved_date: 2026-08-23
- state/agency: District of Columbia — DDOT Safety Team (+FHWA, WMATA, MPD, FEMS)
- native phase: existing-road RSA (skewed multi-leg urban intersection) → mapping n/a
- input_types present: scheme_description, traffic_data (LOS/capacity tables AM+PM, crash frequency), drawings (geometry figures)
- output_types present: findings_report (numbered safety issues #1–#5), recommendations (three geometric/signal alternatives with explicit trade-off reasoning, preferred alternative selected)
- completeness: full-package (29 pp; no response report)
- filename: dc-blaird-cedar-4th-rsa.pdf · sha256: 643281463474033b5575d581f6e8dbf8611154bb1dd90c5c6dcdd92a9f46aac7
- notes: Best US example of alternatives-analysis reasoning inside an RSA (diversion effects, cut-through risk weighed against pedestrian conflicts).

### US-006 · Plymouth Rd operational RSA, Ann Arbor, Michigan (City/WSP, Oct 2025)

- id: `us-006-mi-annarbor-plymouth-rd-rsa`
- title: "Plymouth Road Operational Service Road Safety Audit — Final Report"
- source_url: https://www.a2gov.org/media/udjlan4t/ann-arbor_plymouth-rd-rsa_final-report_20251014.pdf
- publisher: City of Ann Arbor (consultant WSP; project owner MDOT shared jurisdiction)
- retrieved_date: 2026-08-23
- state/agency: Michigan — City of Ann Arbor / MDOT
- native phase: "Audit Stage: Operational" (explicitly labeled on cover block) → mapping n/a (in-service)
- input_types present: scheme_description (corridor limits), traffic_data (AADT, 5-yr Numetric crash data 2020–24, UD-10s, signal timing permits), drawings (road exhibit), site_photos/video
- output_types present: findings_report (five concerns, F–A frequency×severity rating matrix), recommendations (per-issue treatments + HSM Part C predictive analysis with CMFs)
- completeness: full-package (65 pp; materials-provided list documents its own Audit Context — valuable for contract testing)
- filename: mi-annarbor-plymouth-rd-rsa.pdf · sha256: 2b3ead3c9b518791a26739b747ca6964bfa7d182b5295a7246c76eb0686bacf9
- notes: Only sampled US report combining structured issue-rating matrix + HSM quantification; explicit input-manifest section.

### US-007 · I-80 Mercer County MM 0–15 RSA, Pennsylvania (PennDIST 1-0 / McRPC, Nov 2020)

- id: `us-007-pa-i80-mercer-rsa`
- title: "Road Safety Audit — Public Report — I-80 Mercer County, Mile Markers 0 to 15"
- source_url: https://www.mcrpc.com/wp-content/uploads/2022/02/I-80-Road-Safety-Audit-Report.pdf
- publisher: Mercer County Regional Planning Commission for PennDOT District 1-0 (Michael Baker International)
- retrieved_date: 2026-08-23
- state/agency: Pennsylvania — PennDOT / MPO
- native phase: existing-road RSA (interstate mainline segments) → mapping n/a
- input_types present: scheme_description (segment overview), traffic_data (crash comparison vs comparable corridors), site_photos
- output_types present: findings_report (segment-specific WB/EB issues MM 4–11.5), recommendations
- completeness: excerpt (labeled "Public Report" — condensed public version; full working package not published)
- filename: pa-i80-mercer-rsa.pdf · sha256: df78a235371fd059a11e6b08e2a642e54fd7e6d6d0de6258e41c34bda92af21d
- notes: Rare freeway-mainline US sample; useful for limited-access facility phrasing.

### US-008 · Derby St @ Route 3 ramps RSA, Hingham, Massachusetts (MassDOT program, CHA)

- id: `us-008-ma-hingham-derby-st-route3-rsa`
- title: "Road Safety Audit — Derby Street at Route 3 Ramps, Hingham"
- source_url: https://www.hingham-ma.gov/DocumentCenter/View/2818/Derby-Street-Road-Safety-Audit-Derby-Street-at-Route-3-Ramps-PDF
- publisher: Town of Hingham (consultant CHA Consulting; MassDOT HSIP-conditioned audit, MassDOT Project #607309)
- retrieved_date: 2026-08-23
- state/agency: Massachusetts — Town of Hingham / MassDOT
- native phase: **pre-construction design-stage RSA** (intersections "currently under design"; HSIP funding conditioned on RSA + design uptake; plans reviewed before reconstruction) → mapping PRELIMINARY_DESIGN (~25%-design-era MassDOT HSIP practice)
- input_types present: scheme_description (proposed project + existing conditions), traffic_data (crash records, volumes), drawings (intersection exhibits/proposed concepts)
- output_types present: findings_report (numbered safety issues with observations), recommendations (short/mid/long-term enhancement matrix w/ cost + responsible agency), checklists (prompt-list-driven agenda/worksheet)
- completeness: full-package (34 pp; no response report)
- filename: ma-hingham-derby-st-route3-rsa.pdf · sha256: 7cf99d980c89940dd579b8c3eab3cf03da06a40aaaf6272be8a5bdb495619ded
- notes: **Best design-phase candidate in the collection** — shows audit-of-proposed-design reasoning (merge/lane-drop expectancy, guide-sign placement for new geometry).

## Catalog: FHWA RSA Case Studies compilation (NOT re-downloaded)

Reference copy already held at `docs/references/US/fhwa-rsa-case-studies-compilation.pdf`
(FHWA-SA-06-17, Dec 2006, Gibbs/Zein/Nabors/McGee/Eccles; sha256 de87eee1…e3406 per
docs/references/US/MANIFEST.md). Contains **10 distinct case studies**, each with project
background, findings summary, and lessons learned. Catalog entries only — do not duplicate
the file:

| # | scheme | location | owner | native design-stage checkbox | mapping |
|---|---|---|---|---|---|
| CS-01 | Clear Lake Ave & Dirksen Parkway improvements | Springfield, IL | Illinois DOT | preliminary (40–80%) + existing-roads box | PRELIMINARY_DESIGN |
| CS-02 | US Highway 60 improvements | rural OK | Oklahoma DOT | advanced (over 80%) | DETAILED_DESIGN |
| CS-03 | US 97, Modoc Point–Shady Pine Rd | Klamath Co., OR | Oregon DOT | conceptual (0–30%) | FEASIBILITY_CONCEPT |
| CS-04 | Marquette Interchange reconstruction | Milwaukee, WI | Wisconsin DOT | advanced (over 80%) | DETAILED_DESIGN |
| CS-05 | Upper Ward Road improvements | Clark Co., WA | Clark County | advanced (over 80%) | DETAILED_DESIGN |
| CS-06 | Immokalee Road improvements | Collier Co., FL | Collier County | conceptual (0–30%) | FEASIBILITY_CONCEPT |
| CS-07 | Spring Grove Avenue corridor | Cincinnati, OH | City of Cincinnati | conceptual (0–30%) + existing-roads box | FEASIBILITY_CONCEPT |
| CS-08 | Pedestrian crossing improvements | Tucson, AZ | City of Tucson | advanced (over 80%) | DETAILED_DESIGN |
| CS-09 | Reservation roads (tribal system RSA) | Standing Rock Sioux Tribe, ND/SD | Tribe/BIA/NDDOT/SDDOT | existing-roads only | n/a (in-service) |
| CS-10 | "RSA Number 10" — Old Faithful area roads | Yellowstone NP, WY | National Park Service | conceptual (0–30%) + existing-roads box | FEASIBILITY_CONCEPT |

The compilation also carries the FHWA case-study program's standard report skeleton
("Project Design Stage: conceptual/preliminary/advanced" checkboxes + "RSA Stage(s):
design stage / RSA of existing roads") — itself evidence that US-native naming is
phase-percent based, never Stage-N.

## Documented gaps / non-downloadable references

| item | what it is | why not collected |
|---|---|---|
| ROSAP direct PDF endpoints | `rosap.ntl.bts.gov/view/dot/*/…DS1.pdf` | Akamai bot-wall returns 403 HTML to curl even with browser headers (verified twice). Worked around via Wayback captures for US-001/002; live-fetch gap stands. |
| Designer/owner **response reports** (FHWA Step 7) | Formal written responses to RSA findings | Essentially never published standalone by US agencies; captured inside VDOT manual as template only (below). Structural gap of US practice vs UK DMRB response-report culture. |
| VDOT RSA Manual (Sept 2025 rev.) | Virginia HSIP RSA program manual w/ Appendix C field checklist, D report template, E sample response chart | Program manual, not a worked audit; held out of sample set (would be a references-class doc, already covered conceptually by ITD manual in docs/references/US). URL logged: vdot.virginia.gov/media/vdotvirginiagov/doing-business/technical-guidance-and-support/traffic-operations/vhsip/FINAL_VDOT_RSA_Manual_acc09252025_RM.pdf |
| Maryland SHA RSA procedures (2006) | Stage 1 Feasibility → Stage 2 Preliminary → Stage 3 Final → Stage 4 Pre-opening → Stage 5 Operations structure w/ checklists | Procedures/checklists only, no worked example attached; aii.transportation.org PDF noted for future framework work. |
| MassDOT GIS-hosted RSA attachment library | Dozens of full MA municipal RSAs (Orleans/Eastham Rotary 2019, Somerville McGrath Hwy 2016, Stoughton Rt138/Central 2016, etc.) at `gis.massdot.state.ma.us/arcgis/rest/services/Roads/RoadSafetyAudits/MapServer` attachments | Download cap reached (8). Richest known expansion vein for future runs — all existing-road phase, similar shape to US-008. |
| NYSDOT / Caltrans / WSDOT / MnDOT / FDOT worked RSAs | Named-project full RSA reports | No complete worked RSA report located on open agency trees during this run (program manuals and screening lists dominate their public footprints). MassDOT/CTDOT/OODT/local-hosted route proved far more productive. |
| highways.dot.gov / safety.fhwa.dot.gov direct PDFs | Canonical FHWA RSA web docs | Akamai-blocked (consistent with prior run's finding in docs/references/US/MANIFEST.md). |

## Coverage summary vs. target package shape

- Downloads: **8/8 succeeded**, all `%PDF`-verified, all sha256-recorded above.
- full-package: US-001, US-002, US-003, US-004, US-005, US-006, US-008 (single-document audits embedding scheme/data context + findings + recommendations; none include a designer response — see gaps).
- excerpt: US-007.
- Phase coverage: existing-road/in-service dominant (US-001…007) — honest reflection of US public corpus; exactly one pre-construction design-stage package (US-008, preliminary-design mapping). Design-phase depth comes from the FHWA compilation catalog (CS-02/04/05/08 = detailed-design equivalents).
- Best full-package candidates for fixture building: **US-008** (design-stage), **US-006** (input manifest + rating matrix + HSM), **US-005** (alternatives reasoning), **US-004** (tiered recommendations w/ owners).
