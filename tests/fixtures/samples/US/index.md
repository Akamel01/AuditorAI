# US — Road Safety Audit sample collection (United States)

Collected 2026-08-23 by sample-audit collection agent. Public-access sources only.
**Round 2 (2026-08-24): US-009…US-020 added** — MnDOT edocs vein opened (see gaps),
FHWA design-stage + federal/tribal batches secured, MA municipal siblings added.
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

**Round 3 (2026-08-25): US-120…US-125 added** — NCHRP/TRB free-PDF vein opened
(Synthesis 336 via onlinepubs.trb.org; FHWA-SA-16-120 via Wayback of safety.fhwa.dot.gov)
plus municipal/MPO corridor batch (Boston, Worcester, Northborough MPO-authored,
Greenville SC). Renumbered us-028..033 after collision-free merge with parallel collection run.

**Round 3 (2026-08-25): US-021…US-027 added** — the deferred MnDOT edocs batch
downloaded in full (5 RSAR technical reports + the US 12 post-audit presentation)
plus the Hwy 7 report recovered from a city-council packet co-publication. See gaps
for what remains of that vein (nothing curl-fetchable).

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

### US-009 · US 169 corridor RSA, Sherburne County, Minnesota (MnDOT, June 2025)

- id: `us-009-mn-us169-sherburne-rsa`
- title: "US Route 169 – Road Safety Audit, Sherburne County, Minnesota" (final report)
- source_url: https://edocs-public.dot.state.mn.us/edocs_public/DMResultSet/download?docId=38907558
- publisher: Minnesota Department of Transportation District 3 (authors Raza, Stuart, Kundur)
- retrieved_date: 2026-08-24
- state/agency: Minnesota — MnDOT (Let's Talk Transportation public-involvement track)
- native phase: existing-road corridor RSA (CR 33 Elk River → CR 29 Princeton; >100 crashes/yr) → mapping n/a
- input_types present: scheme_description (corridor segments/interchanges), traffic_data (crash analysis, public-comment map feed), drawings (corridor exhibits/aerials)
- output_types present: findings_report, recommendations (short/mid/long-term strategies)
- completeness: full-package (70 pp; appendix version "on request" only — public copy excludes appendices)
- filename: mn-us169-sherburne-rsa.pdf · sha256: 125ff5440c91cfed2a1dae85fb178bb62411900c299fed33abe960d6841f8eac
- notes: Freshest state-DOT corridor sample in the set; documents survey/public-input as explicit RSA inputs.

### US-010 · US 12 Road Safety Audit Briefing Book — pure INPUT artifact (MnDOT, 2015)

- id: `us-010-mn-us12-briefing-book`
- title: "US 12 Road Safety Audit Briefing Book"
- source_url: https://edocs-public.dot.state.mn.us/edocs_public/DMResultSet/download?docId=26401602
- publisher: Minnesota Department of Transportation (pre-audit packet for the Sept 2015 US 12 audit)
- retrieved_date: 2026-08-24
- state/agency: Minnesota — MnDOT District 3
- native phase: pre-audit input packet for an existing-corridor RSA → mapping n/a (input-side specimen)
- input_types present: scheme_description, traffic_data (crash maps/volumes), drawings (aerials + segment exhibits); the document IS assembled Audit Context material
- output_types present: none by design (inputs-only)
- completeness: inputs-only (~150 scanned pages, 94 MB graphics-heavy)
- filename: mn-us12-briefing-book.pdf · sha256: e1e13dd0284081dc6e131ee6aa6e13678e466959667598a32336215951d0eff0
- notes: **Only pure-input specimen in either round** — direct fixture material for Audit Context / Audit Contract intake testing. Pairs with US-011.

### US-011 · US 12 RSA Technical Report, Wright County, Minnesota (MnDOT, Sept 2015)

- id: `us-011-mn-us12-tech-report`
- title: "US 12 Road Safety Audit Technical Report" (western Wright County limit eastward)
- source_url: https://edocs-public.dot.state.mn.us/edocs_public/DMResultSet/download?docId=26401595
- publisher: Minnesota Department of Transportation
- retrieved_date: 2026-08-24
- state/agency: Minnesota — MnDOT
- native phase: existing-road corridor RSA (rural US 12) → mapping n/a
- input_types present: scheme_description, traffic_data (MnCMAT crash data), drawings (corridor exhibits)
- output_types present: findings_report, recommendations
- completeness: full-package (99 pp technical-report format)
- filename: mn-us12-tech-report.pdf · sha256: 7f332844e6b03c3a672374e1c724d3de495dafd5ce5cff480d6535b5786ac46b
- notes: With US-010 forms the rare complete **input-packet → report** pair from one program.

### US-012 · Twin Ports Interchange Work Zone RSA, Duluth, Minnesota (MnDOT, Sept 2021)

- id: `us-012-mn-twinports-interchange-workzone-rsa`
- title: "Road Safety Audit: Twin Ports Interchange Work Zone"
- source_url: https://edocs-public.dot.state.mn.us/edocs_public/DMResultSet/download?docId=26401727
- publisher: Minnesota Department of Transportation District 1
- retrieved_date: 2026-08-24
- state/agency: Minnesota — MnDOT (I-35/I-535/US 53 rebuild, Duluth)
- native phase: **construction-stage work-zone RSA** (year-1 mainline I-35 reduced to single lanes; 4-year project) → mapping n/a (construction phase — outside canonical design stages)
- input_types present: scheme_description (staging/detour plans), traffic_data (post-change volumes), drawings (project aerials/staging figures)
- output_types present: findings_report, recommendations (work-zone configuration mitigations)
- completeness: full-package (30 pp)
- filename: mn-twinports-interchange-workzone-rsa.pdf · sha256: f287b0c6dd16a4e171dbee1736f22eb1814f997015f3befa52029332bd498755
- notes: Only **work-zone/construction-phase** sample in the corpus — exercises the FHWA construction-RSA category no other entry covers.

### US-013 · Highway 55 RSA, St Louis Park → Hollywood Township, Minnesota (MnDOT, Mar 2021)

- id: `us-013-mn-hwy55-stlouispark-rsa`
- title: "Highway 55 Road Safety Audit Report" (Hwy 100 in St Louis Park to Carver Co Rd 33)
- source_url: https://edocs-public.dot.state.mn.us/edocs_public/DMResultSet/download?docId=26401587
- publisher: Minnesota Department of Transportation (Kimley-Horn)
- retrieved_date: 2026-08-24
- state/agency: Minnesota — MnDOT metro district
- native phase: existing-road corridor RSA (urban/suburban/rural mix) → mapping n/a
- input_types present: scheme_description (study area), traffic_data, drawings (exhibits)
- output_types present: findings_report, recommendations
- completeness: full-package (47 pp)
- filename: mn-hwy55-stlouispark-rsa.pdf · sha256: 9cfdec81d71eda343c7b18b333ccb0961414ea8faf718b55411081668a8865b9
- notes: Advisory-team/review-team split documented (Section 1.3–1.4) — useful for role modeling.

### US-014 · FHWA-SA-14-003 RSA Case Studies: 3-D Design Visualization (FHWA, Jul 2013)

- id: `us-014-fhwa-sa-14-003-3dviz-rsa-casestudies`
- title: "Road Safety Audit Case Studies: Using Three-Dimensional Design Visualization in the Road Safety Audit Process"
- source_url: https://rosap.ntl.bts.gov/view/dot/42793 (PDF artifact dot_42793_DS1.pdf)
- retrieval_url_used: web.archive.org capture of https://rosap.ntl.bts.gov/view/dot/42793/dot_42793_DS1.pdf (live rosap curl blocked)
- publisher: FHWA Office of Safety (Nabors/Soika, VHB)
- retrieved_date: 2026-08-24
- state/agency: Multi-state FHWA-sponsored design-stage batch
- native phase: **design-stage RSAs**: RI Burma Rd connector "Preliminary Concept (0–1%)" w/ RIDOT+Aquidneck Island+US Navy [FEASIBILITY_CONCEPT]; MT I-90/Belgrade interchange-area design w/ 2040 AM volumes [PRELIMINARY_DESIGN]; VA Purcell Rd (Rt 643), Prince William Co., planned improvements [pre-construction]
- input_types present: drawings (**3-D renders of proposed designs**, plan sheets, existing-vs-proposed views), traffic_data (2040 forecast volumes)
- output_types present: findings_report, recommendations per RSA (case-study compilation depth)
- completeness: compilation (worked RSAs summarized w/ visualization artifacts; not raw full packages)
- filename: us-fhwa-sa-14-003-3dviz-rsa-casestudies.pdf · sha256: 0776914f61d3ced2831553f3585523aac57f64205496d142b46ca405812dec19
- notes: **Best feasibility/concept-stage material found to date** (RI 0–1% concept); demonstrates design-artifact-based auditing beyond 2D plans.

### US-015 · Federal and Tribal Lands RSAs: Case Studies, 8 audits 2007–09 (FHWA-FLH-10-05)

- id: `us-015-fhwa-flh-10-05-federal-tribal-rsa-casestudies`
- title: "Federal and Tribal Lands Road Safety Audits: Case Studies"
- source_url: https://www.govinfo.gov/content/pkg/GOVPUB-TD2-PURL-gpo16074/pdf/GOVPUB-TD2-PURL-gpo16074.pdf
- publisher: FHWA Federal Lands Highway (Dec 2009)
- retrieved_date: 2026-08-24
- state/agency: Federal/tribal — FLHMA refuges (Pinckney Island+Savannah SC, Patuxent MD), Red Cliff Band Chippewa WI, Navajo Nation UT, Siskiyou NF Bear Camp Route OR, Eastern Band Cherokee NC, Cumberland Gap NHP TN, Gifford Pinchot NF WA (+BIA, state DOTs)
- native phase: predominantly existing-road RSAs (2007–09 program batch) → mapping n/a
- input_types present: scheme_description per site, site_photos, drawings (location figures)
- output_types present: findings_report, recommendations per case study; before/after fatal+injury crash tracking across assessed vs non-assessed sites
- completeness: compilation (76 pp case-study depth)
- filename: us-fhwa-flh-10-05-federal-tribal-rsa-casestudies.pdf · sha256: ca45e0acac230fdd74a6e3f92ae76d9ecf002215af241b95302b30054ae1ec83
- notes: Tribal vein coverage beyond CS-09 (Standing Rock): Navajo Nation and two tribal nations with full worked summaries; govinfo host sidesteps the highways.dot.gov Akamai block.

### US-016 · Tahoe City Pedestrian & Bicycle RSA, Placer County, California (FHWA RC, Oct 2015)

- id: `us-016-ca-tahoecity-pedbike-rsa`
- title: "Tahoe City, Placer County, California Pedestrian & Bicycle Road Safety Audit" (final report)
- source_url: https://www.placer.ca.gov/DocumentCenter/View/1459/Pedestrian-and-Bicycle-Road-Safety-Audit-PDF
- publisher: Placer County with FHWA Resource Center team (audit Apr 27–29, 2015)
- retrieved_date: 2026-08-24
- state/agency: California — Placer County / Caltrans / TRPA-TMPO / Tahoe City PUD
- native phase: existing-facility ped/bike RSA of downtown core, conducted amid contested mobility-plan projects (Wye intersection capacity concerns) → mapping n/a
- input_types present: scheme_description, traffic_data (ped volumes/capacity context), drawings (figures/aerials)
- output_types present: findings_report, recommendations
- completeness: full-package (47 pp)
- filename: ca-tahoecity-pedbike-rsa.pdf · sha256: ccf988f2634519dc523d5beb817b713205ef60c85907b14672f5d4ba19c33e3b
- notes: First California sample; VRU-mode-specific audit (ped/bike lens) distinct from whole-user audits.

### US-017 · McGrath Hwy (Rt 28) @ Mystic Ave & Broadway RSA, Somerville, Massachusetts (MassDOT/HNTB, 2016)

- id: `us-017-somerville-mcgrath-hwy-rsa`
- title: "Road Safety Audit — McGrath Highway (Route 28)/Mystic Avenue (Route 38) and McGrath Highway (Route 28)/Broadway"
- source_url: https://d3n8a8pro7vhmx.cloudfront.net/repmikeconnolly/pages/344/attachments/original/1620369336/Road_Safety_Audit_Somerville_McGrathHwy_Rte28_at_MysticAve_and_Broadway_RSA.pdf?1620369336 (public co-publication; MassDOT GIS holds internal-path metadata only)
- publisher: MassDOT Highway Division Safety Section (HNTB Corporation)
- retrieved_date: 2026-08-24
- state/agency: Massachusetts — MassDOT / City of Somerville OSPCD
- native phase: **pre-construction design-context RSA** — MassDOT program performs RSAs "prior to or as part of the preliminary design for any MassDOT project that includes a high crash location"; this audit fed the McGrath corridor redesign → mapping PRELIMINARY_DESIGN (program-stated linkage)
- input_types present: scheme_description (existing conditions + redesign context), traffic_data (2012–15 crashes), drawings (intersection exhibits)
- output_types present: findings_report, recommendations (short/long-term), checklists (agenda/worksheet appendices)
- completeness: full-package (56 pp incl. appendices; no response report)
- filename: ma-somerville-mcgrath-hwy-rsa.pdf · sha256: c3cdfb2b112434ece24614d9198514e0f83a2fc5e6b486d88540f92dc3499b15
- notes: Second design-phase candidate alongside US-008; urban-multimodal arterial with buffered bike lanes and pedestrian refuges already present — audits *retrofit* design reasoning.

### US-018 · Elm Square RSA, Andover, Massachusetts (TEC/MassDOT, Aug 2023)

- id: `us-018-ma-andover-elm-square-rsa`
- title: "Road Safety Audit — Elm Square, Town of Andover"
- source_url: https://andoverma.gov/DocumentCenter/View/13215/T126503_Andover_Elm-Sq_Road-Safety-Audit-FINAL
- publisher: Town of Andover with MassDOT cooperation (TEC, Inc.)
- retrieved_date: 2026-08-24
- state/agency: Massachusetts — Town of Andover DPW / MassDOT District 4 / MVPC
- native phase: existing-road RSA (signalized Elm Square cluster), triggered by fatal pedestrian crash May 9 2023; one of town planning-and-design response measures → mapping n/a
- input_types present: scheme_description (geometry/parking/sidewalk detail), traffic_data (detailed crash appendix), drawings (figures)
- output_types present: findings_report, recommendations, checklists (agenda/team-contact appendices)
- completeness: full-package (186 pp incl. appendices A–E — largest MA package collected)
- filename: ma-andover-elm-square-rsa.pdf · sha256: 6255d431112aeae6a3eb4aa1f08a4330088f168a3113dc7c3d1cbe47657f2b90
- notes: VRU-fatality-triggered audit; 30+ member audit team roster (police/fire/transit/advocacy/MPO/state police) — rich role-modeling fixture.

### US-019 · Milestone Road corridor RSA, Nantucket, Massachusetts (Toole/MassDOT, May 2017)

- id: `us-019-ma-nantucket-milestone-road-rsa`
- title: "Road Safety Audit — Milestone Road, Nantucket, MA"
- source_url: https://www.nantucket-ma.gov/DocumentCenter/View/18368/Milestone-Road---Road-Safety-Audit-PDF
- publisher: Town of Nantucket for MassDOT (Toole Design Group)
- retrieved_date: 2026-08-24
- state/agency: Massachusetts — Town of Nantucket / MassDOT District 5
- native phase: existing-road corridor RSA (~6 mi Old South Rd → Ocean Ave), conducted as prerequisite for FHWA Local & Rural Road Safety Program funding criteria → mapping n/a
- input_types present: scheme_description (segment-by-segment), traffic_data (per-intersection crash listings w/ exhibit-sheet cross-refs "See Sheet 6…9"), drawings (crash location sheets), seasonal bus ops context
- output_types present: findings_report (corridor + intersection-by-intersection), recommendations
- completeness: full-package (68 pp incl. per-crash appendix tables)
- filename: ma-nantucket-milestone-road-rsa.pdf · sha256: 827864108ed6965895a7e616fdd3fd4aab15b801d4f9764982fb58aa549f9bc6
- notes: Strongest seasonal-VRU dynamics sample (summer pedestrian/bike surges, rotary yield/stop inconsistency, deer crashes).

### US-020 · Route 20 @ Old Connecticut Path & Plain Road RSA, Wayland, Massachusetts (Vanasse/MassDOT, Apr 2020)

- id: `us-020-ma-wayland-route20-oldconnpath-plainrd-rsa`
- title: "Road Safety Audit — Route 20 at Old Connecticut Path, Route 20 at Plain Road, Town of Wayland"
- source_url: https://www.westonma.gov/DocumentCenter/View/22858/Final-Road-Safety-Audit---Wayland---MassDOT-Check---April-29-PDF (hosted by neighboring Town of Weston)
- publisher: MassDOT (consultant Vanasse & Associates; Toole Design reporting)
- retrieved_date: 2026-08-24
- state/agency: Massachusetts — Towns of Wayland/Weston / MassDOT
- native phase: existing-road intersection RSA (delta-island redundant-movement geometry, stop-controlled minor legs) → mapping n/a
- input_types present: scheme_description (redundant movements analysis), traffic_data (collision diagrams day/night, 2015–17 WPD records), drawings (geometry figures)
- output_types present: findings_report, recommendations (short/mid/long countermeasures)
- completeness: full-package (34 pp)
- filename: ma-wayland-route20-oldconnpath-plainrd-rsa.pdf · sha256: 7449f4bbdc4c3a0853299c993c9f3b49d100bd4fb1412af6506cec17a7a96d5b
- notes: Cleanest example of geometry-induced crash-cluster reasoning (redundant delta-island movements → rear-end concentration). Sister report for Weston Rt 20 located (see gaps).

### US-120 · NCHRP Synthesis 336: Road Safety Audits — with Appendix C Sample Audit Reports (TRB, 2004)

- id: `us-028-nchrp-synthesis-336-road-safety-audits`
- title: "Road Safety Audits — A Synthesis of Highway Practice" (NCHRP Synthesis 336)
- source_url: https://onlinepubs.trb.org/onlinepubs/nchrp/nchrp_syn_336.pdf (catalog: nap.nationalacademies.org/catalog/23343; free PDF served live by TRB onlinepubs — no NAP login needed)
- publisher: Transportation Research Board, NCHRP (authors E.M. Wilson & M.E. Lipinski), 2004, 136 pp.; ISBN 0-309-07015-5
- retrieved_date: 2026-08-25
- state/agency: Multi-state survey of practice — 38 state DOTs + 6 Canadian provinces responded (2003 survey)
- native phase: synthesis of RSA/RSAR state of practice incl. program design-stage vocabulary; specimen audit reports annexed → mapping n/a (reference+specimen class)
- input_types present: scheme_description (inside embedded sample reports: Route 60 MP 8.7–10.4 widening preliminary-design RSA; Route 51 @ Slade St, "Town of Layton" intersection preliminary-design RSA; Route 197 Stanford design RSA)
- output_types present: findings_report specimens (Appendix C ≈ print pp.41–82: course-derived sample RSA plus three worked example reports, one referencing a Stage 1 report + designer responses), checklists (**Appendix D**: FHWA 1997 international scanning-tour RSA checklist set — intersections, geometric, signage/lighting, general issues)
- completeness: compilation/specimen depth (no real-scheme raw packages)
- filename: nchrp-synthesis-336-road-safety-audits-2004.pdf · sha256: a01a34190ea3c25c40f1052a6538d8c1a5b4bb3d0e4d4058285185483a035b69
- notes: Licence verbatim from title page: "© 2004 Transportation Research Board". Primary TRB/NCHRP item for vein (a); its "conceptual/preliminary/advanced design stage" survey vocabulary reinforces the phase-not-Stage-N reading. Pairs with US-014/US-015 as the third FHWA/TRB case-study-class artifact.

### US-121 · Improving Access to Transit Using Road Safety Audits: Four Case Studies (FHWA-SA-16-120, Oct 2016)

- id: `us-029-fhwa-sa-16-120-transit-rsa-casestudies`
- title: "Improving Access to Transit Using Road Safety Audits: Four Case Studies"
- source_url: https://safety.fhwa.dot.gov/rsa/resources/docs/fhwasa16120.pdf
- retrieval_url_used: http://web.archive.org/web/20250201034130if_/https://safety.fhwa.dot.gov/rsa/resources/docs/fhwasa16120.pdf (live safety.fhwa.dot.gov bot-walled per gaps row; full 14 MB capture intact)
- publisher: FHWA Office of Safety (VHB; authors Goughnour, Revilla, Pitts), October 2016, 59 pp.
- retrieved_date: 2026-08-25
- state/agency: Multi-agency transit-access batch — Asheville NC (NCDOT/City), Orange County FL (LYNX/Central FL RTA/MetroPlan Orlando/FDOT), Springfield OR (City), Tucson AZ (Sun Tran/City)
- native phase: existing-road RSAs focused on bus stop/transit-corridor access and VRU crossings → mapping n/a
- input_types present: scheme_description per site, traffic_data (crash histories), site_photos, drawings (location figures/bus-stop diagrams)
- output_types present: findings_report + recommendations per case study; eight-step RSA process walkthrough; benefit/cost framing w/ USDOT crash-cost values
- completeness: compilation (case-study depth, not raw packages)
- filename: us-fhwa-sa-16-120-transit-rsa-casestudies.pdf · sha256: c4b56f8ff508abd361aceb0fa2dcf47a27ba994b81f884e689f5799b54bf1480
- notes: Distribution statement verbatim: "No restrictions. This document is available to the public through the National Technical Information Service, Springfield, Virginia 22161." Adds the **transit-access RSA lens** (bus stop siting, crossing-to-stop desire lines) absent from the corpus; Tucson site is distinct from CS-08 (2006 program).

### US-122 · Cambridge Street corridor RSA, Allston, Boston (McMahon for MassDOT/City, Dec 2014)

- id: `us-030-ma-boston-cambridge-st-allston-rsa`
- title: "Road Safety Audit — Cambridge Street, Allston, City of Boston" (DRAFT)
- source_url: https://www.cityofboston.gov/ons/pdfs/report.pdf (hosted under Mayor's Office of Neighborhood Services public path)
- publisher: McMahon Associates, Inc. for MassDOT / City of Boston (December 2014, 40 pp.)
- retrieved_date: 2026-08-25
- state/agency: Massachusetts — City of Boston (BTD/BPWD/BPD/BEMS) + MassDOT + Boston MPO/CTPS
- native phase: existing-road corridor RSA (Soldiers Field Rd/MassPike off-ramps → Harvard Ave segment) → mapping n/a
- input_types present: scheme_description, traffic_data (crash context), drawings (locus figures)
- output_types present: findings_report, recommendations (short/long-term enhancement tables)
- completeness: full-package body (public copy carries DRAFT watermark; no response report)
- filename: ma-boston-cambridge-st-allston-rsa.pdf · sha256: e47169868952e0f77df52ac4ee0387fea228304c2276f3b9ba1eb4a5a57cc811
- notes: Municipal self-hosted corridor RSA adjacent to the Allston I-90 multimodal project area; large city-agency audit team roster documented.

### US-123 · Chandler Street (Route 122) corridor RSA, Worcester (VHB for MassDOT/City, Aug 2020)

- id: `us-031-ma-worcester-chandler-st-corridor-rsa`
- title: "Road Safety Audit — Chandler Street Corridor, City of Worcester"
- source_url: https://www.worcesterma.gov/chandler-street-may-street-improvements/chandler-street-road-safety-audit.pdf
- publisher: VHB for MassDOT / City of Worcester (August 4, 2020, 59 pp.)
- retrieved_date: 2026-08-25
- state/agency: Massachusetts — City of Worcester DPW&P / MassDOT District 3 / CMRPC
- native phase: existing-road corridor RSA (Hadwen Rd → Chandler Magnet Elementary School; HSIP high-crash cluster at May St) → mapping n/a
- input_types present: scheme_description, traffic_data (2016–2018 crash diagrams/tables from WPD+MassDOT), drawings (locus/figures), **360° corridor video footage** reviewed by team
- output_types present: findings_report (numbered safety issues incl. markings/parking, ped-bike accommodations, geometry), recommendations (per-location enhancement tables w/ time frame/cost/jurisdiction), checklists (agenda appendix)
- completeness: full-package (teleconference RSA during COVID — remote-format process evidence; emergency-responder comments solicited post-meeting)
- filename: ma-worcester-chandler-st-corridor-rsa.pdf · sha256: c5eb7c113c2e6fe146d464bfe9a67446a84f25ab53c726953e5a3369b4fb330f
- notes: First sample documenting a **fully remote audit format** (Zoom + 360 video instead of field visit) — useful fixture material for input-modality variance (site observations vs recorded media).

### US-124 · Bartlett Street corridor RSA, Northborough (CMRPC — MPO-authored, Oct 2021)

- id: `us-032-ma-northborough-bartlett-st-rsa`
- title: "Road Safety Audit — Bartlett Street, Town of Northborough"
- source_url: https://cmrpc.org/wp-content/uploads/2024/05/2021-Bartlett-Street-Road-Safety-Audit.pdf
- publisher: Central Massachusetts Regional Planning Commission (CMRPC) for the Town of Northborough (October 28, 2021, 45 pp.)
- retrieved_date: 2026-08-25
- state/agency: Massachusetts — Town of Northborough / CMRPC (MPO as author, not just participant)
- native phase: existing-road corridor RSA (Main St/MA-20 HSIP cluster → Cedar Hill Rd; warehouse-freight growth context) → mapping n/a
- input_types present: scheme_description (land-use/zoning split along corridor), traffic_data (**three turning-movement counts self-performed by CMRPC** incl. truck classifications; speed runs), drawings (corridor/potential-enhancement figures)
- output_types present: findings_report (intersection-by-intersection west→east), recommendations (incl. temporary/interim ped-bike layout reasoning), checklists (agenda/contacts/crash appendices)
- completeness: full-package
- filename: ma-northborough-bartlett-st-rsa.pdf · sha256: 1657b23847bc42252ef23f33e1eab0b285b36faad3a5431c1eb8c4af154c84f1
- notes: Distinct producer class: an **MPO-authored** RSA that generated its own counts rather than consuming agency data — exercises Audit Context assembly by the auditor side.

### US-125 · Green Avenue (S-5) Road Safety Assessment, Greenville, South Carolina (AECOM for City, Oct 2024)

- id: `us-033-sc-greenville-green-ave-road-safety-assessment`
- title: "Road Safety Assessment — Green Avenue (S-5) from Bagwell Circle to S Markley Street" (Rev 1, October 2024)
- source_url: https://www.greenvillesc.gov/DocumentCenter/View/29848/Green-Avenue-Road-Safety-Assessment-PDF
- retrieval_url_used: http://web.archive.org/web/20250318025340if_/https://www.greenvillesc.gov/DocumentCenter/View/29848/Green-Avenue-Road-Safety-Assessment-PDF (greenvillesc.gov CivicPlus serves HTML challenge to curl; full archived copy of same public file)
- publisher: AECOM (Poplin/Nelson/Eckenrode) for City of Greenville Engineering; partners SCDOT, Greenville County, Greenville County Schools
- retrieved_date: 2026-08-25
- state/agency: South Carolina — City of Greenville / SCDOT / Greenville County (first SC sample)
- native phase: existing-road corridor assessment ("Road Safety Assessment" — FHWA's newer naming alongside RSA) → mapping n/a; draft presented at Oct 22, 2024 project-preview meeting with public comment window to Nov 30, 2024
- input_types present: scheme_description (corridor + school-zone context), traffic_data (AADT 3,900–7,400 vpd 2022; 85th-percentile speeds 5–9 mph over limit), drawings (concept figures incl. Dunbar St roundabout/signalization options)
- output_types present: findings_report, recommendations (sidewalk repairs, high-visibility crosswalks, ped signals, road-diet option flagged for further analysis)
- completeness: full-package (single-document assessment; revision history table on file)
- filename: sc-greenville-green-ave-road-safety-assessment.pdf · sha256: e53501b2db6047f05a102b4448af67a6be381913509c95cd5c0e42dbc697bdfc
- notes: Copyright line verbatim on cover: "Copyright © 2024 by AECOM All rights reserved." Documents the **RSA-as-public-engagement-input** pattern (budgeting feeder); sibling Dunbar Street assessment announced but not located publicly (see gaps).

### US-021 · US 8 (TH 8) I-35 to MN/WI border corridor RSA, Minnesota (MnDOT, Feb 2014)

- id: `us-021-mn-us8-i35-wi-border-rsa`
- title: "U.S. Trunk Highway 8: I-35 to MN/WI Border — Road Safety Audit: Technical Report"
- source_url: https://edocs-public.dot.state.mn.us/edocs_public/DMResultSet/download?docId=26401740
- publisher: Minnesota Department of Transportation (MnCMAT crash data 2008–2012)
- retrieved_date: 2026-08-25
- state/agency: Minnesota — MnDOT / Chisago County cities (Chisago City, Lindstrom, Shafer, Center City, Taylors Falls)
- native phase: existing-road corridor RSA (rural/urban mix to Wisconsin border) → mapping n/a
- input_types present: scheme_description (corridor improvement history), traffic_data (MnCMAT 2008–2012 crashes), drawings (segment exhibits)
- output_types present: findings_report, recommendations (short/medium/long-term structure)
- completeness: full-package (39 pp technical-report format)
- filename: mn-us8-i35-wi-border-rsa.pdf · sha256: c0b26740959f7ca3b2e9a831eaaa636f4022dd52f264b197a6822b410a64d943
- notes: First of the round-3 deferred-MnDOT batch; documents the "road safety investigation" framing (is crash pattern unusual given prior improvements?).

### US-022 · TH 3 Farmington/Empire Township RSA, Minnesota (MnDOT, Dec 2006)

- id: `us-022-mn-th3-farmington-empire-rsa`
- title: "TH 3 from CSAH 46 (160th Street W.) to CSAH 50 (Elm Street) in the City of Farmington and Empire Township — Road Safety Audit" (final report, December 2006)
- source_url: https://edocs-public.dot.state.mn.us/edocs_public/DMResultSet/download?docId=26401813
- publisher: Minnesota Department of Transportation (independent multi-disciplinary RSA team; stakeholders meeting at Lakeville Water Treatment Facility documented)
- retrieved_date: 2026-08-25
- state/agency: Minnesota — MnDOT / Cities of Farmington & Lakeville, Empire Township
- native phase: existing-corridor safety audit (pre-improvement investigation) → mapping n/a
- input_types present: scheme_description (segment location map), stakeholders-meeting record, drawings (segment figures)
- output_types present: findings_report, recommendations
- completeness: full-package (21 pp; oldest dated artifact in the collection)
- filename: mn-th3-farmington-empire-rsa.pdf · sha256: bfeac26e635ef985504981930220aef2cfff91620769cef8029aa32577318ebf
- notes: Extends MnDOT vein back to 2006 — useful for longitudinal phrasing-drift comparison against US-009…US-013 (2015–2025) and US-021…US-026.

### US-023 · MNTH 5 Jamaca Ave–Manning Ave/CSAH 15 (Lake Elmo) RSAR Technical Report, Minnesota (MnDOT, Feb 2013)

- id: `us-023-mn-hwy5-lake-elmo-rsar`
- title: "MnDOT Trunk Highway 5: Jamaca Avenue to Manning Avenue/CSAH 15 — Road Safety Audit Review Technical Report" (February 13, 2013)
- source_url: https://edocs-public.dot.state.mn.us/edocs_public/DMResultSet/download?docId=26401776
- publisher: Minnesota Department of Transportation (RSAR team roster incl. Brad Estochen State Safety Engineer, Derek Leuer Safety Engineer)
- retrieved_date: 2026-08-25
- state/agency: Minnesota — MnDOT Metro District (Lake Elmo/Woodbury area)
- native phase: existing-road corridor RSA review (RSAR) → mapping n/a
- input_types present: scheme_description (corridor history), traffic_data (crash analysis), drawings (exhibits)
- output_types present: findings_report, recommendations
- completeness: full-package (30 pp)
- filename: mn-hwy5-lake-elmo-rsar.pdf · sha256: 675b70c4bac5ee78ea7f816b2f75370c369c4942e81be862589d78deb9c9008d
- notes: Named "Road Safety Audit Review" — MnDOT's corridor-RSA variant label; team-roster table format is clean role-modeling material.

### US-024 · US 14 Owatonna–Dodge Center RSAR Technical Report, Minnesota (MnDOT, Sep 2013)

- id: `us-024-mn-us14-owatonna-dodge-center-rsar`
- title: "US Highway 14: Owatonna to Dodge Center — Road Safety Audit Review Technical Report" (September 26, 2013)
- source_url: https://edocs-public.dot.state.mn.us/edocs_public/DMResultSet/download?docId=26401805
- publisher: Minnesota Department of Transportation
- retrieved_date: 2026-08-25
- state/agency: Minnesota — MnDOT District 6 coordination documented (meeting with District)
- native phase: existing-road rural corridor RSA review → mapping n/a
- input_types present: scheme_description (corridor limits), traffic_data (crash data), drawings (exhibits), district future-plans meeting record
- output_types present: findings_report, recommendations
- completeness: full-package (29 pp)
- filename: mn-us14-owatonna-dodge-center-rsar.pdf · sha256: be6d0a33ecd201b321ec0e6fa08329157c4ab37494d584621f64d8d4a1181766
- notes: Documents district future-plans as an explicit RSA input (§1.3 Meeting With MnDOT District 6) — Audit Context assembly evidence.

### US-025 · US 14 Mankato–New Ulm RSAR Technical Report, Minnesota (MnDOT, Apr 2012)

- id: `us-025-mn-us14-mankato-new-ulm-rsar`
- title: "U.S. Highway 14: Mankato to New Ulm — Road Safety Audit Review Technical Report" (April 17, 2012)
- source_url: https://edocs-public.dot.state.mn.us/edocs_public/DMResultSet/download?docId=26401810
- publisher: Minnesota Department of Transportation
- retrieved_date: 2026-08-25
- state/agency: Minnesota — MnDOT District 7 (USTH 14 Partnership meeting documented)
- native phase: existing-road rural corridor RSA review → mapping n/a
- input_types present: scheme_description, traffic_data (crash data), drawings (exhibits), partnership/district meeting records
- output_types present: findings_report, recommendations
- completeness: full-package (42 pp)
- filename: mn-us14-mankato-new-ulm-rsar.pdf · sha256: 2c62f8c88c0f93f1f338fb0cfcae03d599e64aef148c8ea7f1fd1e2d74155faa
- notes: Completes the two US 14 siblings — same-programme pair enabling cross-sample comparison like the UK VRS pair (INT-004/005).

### US-026 · US 12 RSA Post-Audit Presentation, Minnesota (MnDOT/HDR, Aug 2015)

- id: `us-026-mn-us12-post-audit-presentation`
- title: "US 12 Road Safety Audit — Post-Audit Presentation" (August 6, 2015; © 2015 HDR, Inc.)
- source_url: https://edocs-public.dot.state.mn.us/edocs_public/DMResultSet/download?docId=26401632
- publisher: Minnesota Department of Transportation (consultant HDR Engineering)
- retrieved_date: 2026-08-25
- state/agency: Minnesota — MnDOT District 3
- native phase: post-audit stakeholder briefing for the Sept 2015 US 12 RSA → mapping n/a (third lifecycle artifact)
- input_types present: none standalone (recaps briefing-book inputs and findings)
- output_types present: presentation deck (52 slides) summarizing findings/recommendations for public/stakeholder delivery
- completeness: outputs-only (companion to US-010 briefing book + US-011 technical report)
- filename: mn-us12-post-audit-presentation.pdf · sha256: 0606260f82e20517d096374e031d16e3c4544c50abad13b684bac8eaa1ffc52d
- notes: **Only post-audit communication artifact in either jurisdiction collection** — completes the rare MnDOT triple (input packet → report → post-audit presentation) on one programme. Gaps-row guess that docId 26401632 was a Twin Ports presentation was wrong: MnDOT's RSA page confirms it is the US 12 deck, and no Twin Ports presentation is published.

### US-027 · Hwy 7 St Louis Park–Hollywood Township RSA Report + comment letters, Minnesota (MnDOT, Jul 2022)

- id: `us-027-mn-hwy7-slp-hollywoodtownship-rsa-report`
- title: "Highway 7 Road Safety Audit Report" (July 2022; 32-mi corridor, Hwy 100 St Louis Park → Carver Co Rd 33 Hollywood Township) incl. Appendix A comment letters — extracted from City of Minnetonka City Council Agenda Item 6B packet (Nov 14, 2022)
- source_url: https://d3n9y02raazwpg.cloudfront.net/eminnetonka/e778741a-9874-4638-9dfe-93875c4264f2-a135b2d3-3a47-466a-9381-c77c650143d3-1696000219.pdf (parent: City of Minnetonka council agenda packet, Agenda Item 6B "State Highway 7 MnDOT Safety Audit Report"; MnDOT project page dot.state.mn.us/metro/projects/hwy7slp-hollywood offers the full report only "on contact")
- publisher: Minnesota Department of Transportation (audit conducted Nov 2021–Jun 2022; FHWA Community Planner + Kimley-Horn on review team) — publicly co-published as a City of Minnetonka council-packet attachment; Excelsior DocumentCenter holds only the 1-page overview
- retrieved_date: 2026-08-25
- state/agency: Minnesota — MnDOT Metro District / cities St Louis Park, Hopkins, Minnetonka, Deephaven, Excelsior, Chanhassen, Shorewood, Victoria, Minnetrista, St Bonifacius + Laketown/Watertown/Hollywood Townships
- native phase: existing-road corridor RSA (rural/suburban/urban segments; Feb 2022 field review during COVID protocols) → mapping n/a
- input_types present: scheme_description (three-segment split w/ characteristics), traffic_data (2016–2020 crash analysis, critical-index intersection ranking #1–69, speed-zone evaluation, survey demographics), drawings (improvement-summary maps per segment)
- output_types present: findings_report, recommendations (short/medium/long-term tables Tables 11–13), **Appendix A stakeholder comment letters** (St Louis Park engineering memo; City of Greenwood letter) responding to draft findings
- completeness: full-package extracted (pp. 29–88 of parent packet, 60 pp; parent packet pages excluded)
- filename: mn-hwy7-slp-hollywoodtownship-rsa-report.pdf · sha256: 6dc1649216241128e7a11f59d7db565f37a3025cf7d975bf6d2e7723cfc463be
- notes: Closest US analogue to an input→findings→response loop found so far: formal agency comment letters answering draft findings (UK response-report culture equivalent is thinner — letters, not a decision log). Critical-index crash-ranking method is reusable systemic-screening logic. Licence: no statement on host hosts; MnDOT public-report content republished in council packet (public record).

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
| ROSAP direct PDF endpoints | `rosap.ntl.bts.gov/view/dot/*/…DS1.pdf` | Akamai bot-wall returns 403 HTML to curl even with browser headers (verified twice). Worked around via Wayback captures (US-001/002 round 1; US-014 round 2); live-fetch gap stands. |
| Designer/owner **response reports** (FHWA Step 7) | Formal written responses to RSA findings | Essentially never published standalone by US agencies; captured inside VDOT manual as template only (below). Structural gap of US practice vs UK DMRB response-report culture. SA-14-003 (US-014) confirms response letters are only "encouraged", not archived. |
| VDOT RSA Manual (Sept 2025 rev.) | Virginia HSIP RSA program manual w/ Appendix C field checklist, D report template, E sample response chart | Program manual, not a worked audit; held out of sample set (would be a references-class doc, already covered conceptually by ITD manual in docs/references/US). URL logged: vdot.virginia.gov/media/vdotvirginiagov/doing-business/technical-guidance-and-support/traffic-operations/vhsip/FINAL_VDOT_RSA_Manual_acc09252025_RM.pdf |
| Maryland SHA RSA procedures (2006) | Stage 1 Feasibility → Stage 2 Preliminary → Stage 3 Final → Stage 4 Pre-opening → Stage 5 Operations structure w/ checklists | Procedures/checklists only, no worked example attached; aii.transportation.org PDF noted for future framework work. |
| MassDOT GIS RSA service — **resolved as metadata-only** (round-2 probe) | ArcGIS REST 11.3: layer 0 (898 rows, 6 districts) + table "Road Safety Audits Attachments" at `gis.massdot.state.ma.us/arcgis/rest/services/Roads/RoadSafetyAudits/MapServer` | `Report_Link` field holds **internal Windows paths** (`S:\HQ\Planning\SafetyAudit/DistrictN/…pdf`) — no binary attachments, no public document proxy (hub app is an Experience Builder shell; direct-path probe 404). The 898-row inventory itself is a useful corpus map: individual reports must be hunted on town DocumentCenters / mass.gov / consultant or legislator co-publications (as done for US-017). |
| Caltrans / WSDOT / NYSDOT / FDOT worked RSAs | Named-project full RSA reports | Still no worked project-RSA on their open trees — Caltrans footprint is HSIP training decks (RSA process slides, not audits). **MnDOT is the counter-example**: its edocs-public `DMResultSet/download?docId=` endpoints serve full RSA PDFs to plain curl (see US-009…013). |
| MnDOT deferred siblings (located, curl-fetchable) | US 8 I-35→WI border (docId 26401740), TH 3 Farmington (26401813), Hwy 5 Lake Elmo (26401776), US 14 Owatonna–Dodge Ctr (26401805), US 14 N Mankato–New Ulm (26401810), Twin Ports + US 12 post-audit presentations (26401632…) | **Resolved Round 3** — all five RSAR technical reports + the post-audit presentation downloaded as US-021…US-026. Corrections: docId 26401632 is the *US 12* Post-Audit Presentation (US-026), and **no Twin Ports presentation exists** on the MnDOT RSA page (dot.state.mn.us/trafficeng/safety/rsa) — only the work-zone report (already US-012). The page's remaining items are all already cataloged or non-audit: "Minnesota County Roadway Safety Plans Final Report" (docId 26401549) is a guidance document, held out of the sample set; Hwy 7 full report is "contact us"-gated on MnDOT but was recovered via co-publication (US-027). Vein exhausted for curl-fetchable artifacts. |
| MA trio near-duplicates (Stow Rt117/Hudson Rd 2022; Weston Rt20 @ Highland St+Love Ln 2020) | Same Vanasse/Toole "MassDOT-check" family as US-020 | Located + staged during round 2 but cataloged only one member (US-020) to preserve sample diversity; URLs in this row are the record. Stow: stow-ma.gov/DocumentCenter/View/1489/MassDOT---Road-Safety-Audit-PDF · Weston: westonma.gov/DocumentCenter/View/22857/Final-Road-Safety-Audit---Weston---MassDOT-Check---April-29-PDF |
| highways.dot.gov / safety.fhwa.dot.gov direct PDFs | Canonical FHWA RSA web docs | Akamai-blocked (consistent across rounds). govinfo.gov PURLs work for GPO-deposited FHWA reports (used for US-015); safety.fhwa.dot.gov PDF worked via Wayback full capture (US-121, 14 MB intact — route proven for FHWA-SA series not on govinfo). |
| INDOT Road Safety Audit Guidelines (updated Mar 2026) | State procedures manual with **Attachment 1 Example RSA Report** (Smith Pike Rd @ Forrest Park Dr, Monroe County — anonymized), Attachment 2 Example Response Letter, Attachment 3 Prompt List; in.gov/indot/files/B7-Road-Safety-Audit-Procedures.pdf | Reference-class program manual — same hold-out rule as VDOT manual row above. Example attachments are teaching artifacts, not real audits; noted here because example response letters are otherwise unsampled anywhere (response-report gap below). |
| Indy DPW Shelby St @ Raymond St RSA (Nov 2025) | City DPW intersection RSA (102 crashes Jun 2022–Jun 2025; 11 near-term + 5 long-term countermeasures quoted verbatim by WTHR) | No public PDF located on indy.gov this round — news coverage only; candidate for public-records request. Six RSAs/year claimed by DPW — potential recurring city vein if published. |
| Greenville Dunbar Street assessment | Sibling corridor assessment by City Engineering + AECOM announced Oct 2024 alongside US-125 (roundabout/signal options at S Calhoun St) | Not located on greenvillesc.gov DocumentCenter this round (CivicPlus bot-walls curl; Wayback prefix query returned only the Green Ave file). Retriable via browser-session tooling. |

## Round 3 notes (2026-08-25)

- onlinepubs.trb.org serves NCHRP Synthesis-era PDFs free to plain curl (no Akamai wall) — richest untapped TRB vein for pre-2010 synthesis/report back-catalog.
- safety.fhwa.dot.gov legacy `/rsa/resources/docs/*` PDFs are fully captured by Wayback (digest-stable captures since 2016) — use CDX first, govinfo second.
- CivicPlus DocumentCenter hosts (greenvillesc.gov class) serve HTML challenges to curl but their files are archived whole — check `web.archive.org/cdx` for `/DocumentCenter/View/<id>/*` before giving up.

## Coverage summary vs. target package shape

- Downloads: **round 1: 8/8; round 2: 12/12; round 3: 7/7**, all `%PDF`-verified, all sha256-recorded above.
- full-package: US-001…US-006, US-008, US-009, US-011, US-012, US-013, US-016…US-020 (single-document audits embedding scheme/data context + findings + recommendations; none include a designer response — see gaps).
- inputs-only: US-010 (briefing book). compilation/case-study depth: US-007 (excerpt), US-014, US-015.
- Phase coverage after round 2: existing-road/in-service still dominant, now plus **construction/work-zone** (US-012), **feasibility/concept design-stage** (US-014 RI Burma Rd 0–1% concept; MT I-90 design w/ forecast volumes), **preliminary-design-context** (US-008, US-017), **pure input artifact** (US-010), tribal/federal batch (US-015).
- Inputs-bearing (drawings/plans/exhibits embedded): 9 of round-2 entries (US-009, 010, 011, 012, 013, 014, 017, 018, 019) — design-artifact depth strongest in US-014's proposed-design renders.
- Best full-package candidates for fixture building: **US-008 + US-017** (design-stage), **US-010 + US-011** (input-packet → report pair), **US-006** (rating matrix + HSM), **US-005** (alternatives reasoning), **US-004** (tiered recommendations), **US-012** (work-zone phase), **US-018** (VRU-triggered + large-team roster).
- Round 3 additions: **US-120** (TRB synthesis w/ specimen audit reports + FHWA scanning-tour checklists), **US-121** (transit-access lens), **US-122…124** (city/MPO corridor batch incl. remote-format US-123 and MPO-authored US-124), **US-125** (SC; assessment-as-engagement pattern). Downloads round 3: 6/6 succeeded, all `%PDF`-verified, sha256 recorded above. Producer-class spread after round 3: state DOT / MassDOT program / city DPW+consultant / MPO-authored / FHWA compilation / TRB-NCHRP synthesis.

### Round 3 notes (2026-08-25)

- MnDOT edocs `DMResultSet/download?docId=` endpoints remain plain-curl friendly; the round-3 batch (US-021…US-026) took the program's public RSA inventory to full coverage. The vein is now exhausted: every listed artifact is cataloged or documented non-audit/gated.
- US-027 demonstrates the council-packet co-publication route for "contact us"-gated state DOT reports (same pattern as US-017's legislator co-publication). The Hwy 7 packet also carries Appendix A comment letters — the nearest US practice gets to a response report.
- US-026 gives the corpus its third lifecycle artifact class on one programme (US-010 inputs → US-011 report → US-026 post-audit deck): direct fixture material for Run/issued-artifact replacement semantics.
