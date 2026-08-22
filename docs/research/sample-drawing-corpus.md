---
title: Public-domain sample drawing corpus (E2)
date: 2026-08-22
agent: researcher-corpus
status: complete
---

# Public-domain sample drawing corpus (E2)

Research into REAL road / intersection / highway drawings and plan sets with clean
licensing (government / public-domain ONLY) for use as sample Road Safety Audit inputs.
Every source records: URL, what the artifact actually is, license, download format,
and a **VERIFIED** (page/artifact/license confirmed by direct fetch or API on 2026-08-22)
vs **INFERENCE** label per repo evidence discipline.

Licensing baseline used:
- US federal works (FHWA, BTS/ROSA-P, govinfo) are public domain by statute (17 USC §105).
- US state/local works are generally not copyrightable but rarely carry an explicit statement → flagged INFERENCE where no explicit license text exists.
- UK Crown/National Highways publications are typically OGL v3; Planning Inspectorate NSIP library states OGL v3.0 explicitly in its site footer.
- Wikimedia files were verified via the Commons API `extmetadata` (LicenseShortName) — only PD/CC0 accepted; CC BY / CC BY-SA candidates were rejected and are listed for the record.

---

## 1. FHWA Road Safety Audit case studies / example materials

| # | URL | Artifact | License | Format | Status |
|---|-----|----------|---------|--------|--------|
| 1.1 | https://highways.dot.gov/sites/fhwa.dot.gov/files/2022-06/fhwasa06017.pdf | *Road Safety Audits: Case Studies* (FHWA-SA-06-017, Dec 2006). Ten full RSAs (Illinois, Oklahoma, Oregon, Wisconsin DOTs; Clark County WA; Collier County FL; Cincinnati OH; Tucson AZ; Standing Rock Sioux Tribe; Yellowstone NP) across planning→detailed-design→existing-road stages. Contains project description exhibits, frequency/severity rating tables, process figures, site photographs. Distribution statement: "No restrictions… Reproduction of completed page authorized." | US Gov work — public domain | PDF (64 pp) | VERIFIED |
| 1.2 | https://highways.fhwa.dot.gov/sites/fhwa.dot.gov/files/2022-07/rsa-casestudiesflh.pdf | *Federal and Tribal Lands Road Safety Audits: Case Studies* — same series for Federal Lands Highway projects. | US Gov work — public domain | PDF | VERIFIED |
| 1.3 | https://highways.dot.gov/sites/fhwa.dot.gov/files/2022-08/FHWA_SA_06_06.pdf | *FHWA Road Safety Audit Guidelines* (FHWA-SA-06-06). The canonical US RSA method doc: eight-step process diagrams, worked examples, seven prompt lists (planning/preliminary design/final design/work zone/pre-opening/existing road/land development). Mirrored at ROSA-P https://rosap.ntl.bts.gov/view/dot/49213 (direct PDF: https://rosap.ntl.bts.gov/view/dot/49213/dot_49213_DS1.pdf). | US Gov work — public domain | PDF (2.17 MB) | VERIFIED |
| 1.4 | https://rosap.ntl.bts.gov/view/dot/42592 | ROSA-P record for *Road Safety Audits: Case Studies* (same report as 1.1) carrying an explicit machine-readable rights field **"Right Statement: Public Domain"**; direct PDF https://rosap.ntl.bts.gov/view/dot/42592/dot_42592_DS1.pdf | Public Domain (explicit metadata) | PDF | VERIFIED |
| 1.5 | https://rosap.ntl.bts.gov/view/dot/76961 | *Field Evaluation of At-Grade Alternative Intersection Designs* (FHWA-HRT-24-126, 2024). Contains plan-view layout diagrams of RCUT / MUT / conventional at-grade alternatives — modern intersection geometry exhibits. Explicit **"Right Statement: Public Domain"**. Direct PDF: https://rosap.ntl.bts.gov/view/dot/76961/dot_76961_DS1.pdf | Public Domain (explicit metadata) | PDF (8.44 MB) | VERIFIED |
| 1.6 | https://highways.dot.gov/federal-lands/design/plan-prep/cfl/sample | FHWA Central Federal Lands **Sample Plan Sheets** hub — real-format construction-plan sheets: title sheets, plan & profile (mainline, bridge, approach roads), typical sections, parking-lot geometric layouts, box culvert/cross sections, signing & pavement markings, temporary traffic control/detour signing. Sub-pages each link a downloadable sheet set. | US Gov work — public domain | PDF (per sheet/set) | VERIFIED |

Answer to Q1: **Yes.** FHWA publishes RSA case-study reports containing usable exhibits and
site plans (public domain), plus a full library of sample construction-plan sheets (CFL).
These are the closest thing to "audited schemes with drawings" available under PD terms.

## 2. US State DOT open-data / plan-set repositories (3+ concrete)

| # | URL | Artifact | License | Format | Status |
|---|-----|----------|---------|--------|--------|
| 2.1 | https://highways.dot.gov/federal-lands/std-drawings/state | FHWA's master index of **state standard drawings** — links for 40+ states to standard-drawing libraries (PDF/DGN/DWG/TIF), incl. Caltrans Standard Plans (https://dot.ca.gov/programs/design/ccs-standard-plans-and-standard-specifications — PDF, DGN, DWG) and Iowa Standard Road Plans (https://iowadot.gov/design/standard-road-plans — PDF, DGN). Links last checked Jan 2026. | Per-state; all US state-gov works | PDF/DGN/DWG/TIF | VERIFIED (hub); individual state pages VERIFIED as linked |
| 2.2 | https://dot.alaska.gov/stwddes/dcsprecon/standardplans.shtml | Alaska DOT&PF **Standard Plans Manual** — entire manual as one PDF (https://dot.alaska.gov/stwddes/dcsprecon/assets/pdf/stddwgs/standard_plans.pdf) plus individual category PDFs. Category **"I – Intersections, Approaches & Pavement"** is directly useful for intersection-layout samples. | State-gov work; no explicit license statement on page → public domain by operation of law | PDF (individual + full manual); DWG restricted to internal SharePoint | VERIFIED (page+PDFs); license INFERENCE |
| 2.3 | https://www.txdot.gov/business/plans-online-bid-lettings.html | TxDOT **Plans Online** — downloadable engineering plans, informational proposals, addenda and **contract plan sets** for every highway letting ("this is a free service"). Full multi-sheet construction plan sets incl. intersections/interchanges. | Free public download; site carries a license-agreement link (exact reuse terms not inspected) | PDF | VERIFIED (service + free-download statement); license detail INFERENCE |
| 2.4 | https://dotd.la.gov/about/office-of-project-delivery/engineering/publications-and-downloads/specifications-and-standards/standard-plans-and-special-details/ | Louisiana DOTD **Standard Plans & Special Details** — hundreds of individual one-click PDFs (e.g., "Rumble Strips – Plan And Section Views", intersection/approach details, bridge special details). | State-gov work; no explicit license statement → public domain by operation of law | PDF | VERIFIED (page + sample PDFs); license INFERENCE |

## 3. Wikimedia Commons — verified PD/CC0 junction & interchange diagrams

Category hubs (VERIFIED):
- https://commons.wikimedia.org/wiki/Category:SVG_diagrams_of_road_junctions (87 SVG files)
- Parent categories worth mining: `Diagrams of road junctions`, `Diagrams of interchanges`, `Diagrams of roundabouts`, `Road cross sections`.

Files below were individually verified through the Commons API `extmetadata`
(`LicenseShortName`) on 2026-08-22. Exact file-page URLs:

| # | File page | What it shows | License | Format | Status |
|---|-----------|---------------|---------|--------|--------|
| 3.1 | https://commons.wikimedia.org/wiki/File:Cloverleaf_(PSF).svg | Line-art cloverleaf interchange (clean geometry, from Pearson Scott Foresman collection) | Public domain (PD-author / PD-ScottForesman; attribution not required) | SVG (+PNG renders) | VERIFIED |
| 3.2 | https://commons.wikimedia.org/wiki/File:Superstreet.svg | Superstreet / restricted-crossing median layout with signal phasing arrows | Public domain (PD-user) | SVG | VERIFIED |
| 3.3 | https://commons.wikimedia.org/wiki/File:Jughandle_Type_A.svg | Jughandle Type A intersection diagram (turn-routing arrows) | CC0 (public-domain dedication) | SVG | VERIFIED |
| 3.4 | https://commons.wikimedia.org/wiki/File:Parclo-AB3.svg | Partial cloverleaf interchange type AB3 | Public domain (PD-self) | SVG | VERIFIED |
| 3.5 | https://commons.wikimedia.org/wiki/File:Texas_turnaround.svg | Texas U-turn / frontage-road turnaround geometry | Public domain (PD-self) | SVG | VERIFIED |
| 3.6 | https://commons.wikimedia.org/wiki/File:The_Basketweave.svg | Toronto Highway 401 express-collector basketweave (multi-level weaving geometry; Canadian flavor) | Public domain (PD-self) | SVG | VERIFIED |
| 3.7 | https://en.wikipedia.org/wiki/File:Wfm_sample_interchange.svg | Sample motorway interchange (stack/directional mix) | Public domain (author release) | SVG | VERIFIED |
| 3.8 | https://commons.wikimedia.org/wiki/File:Jughandle_Type_B.svg (also `_B2`, `_C`) | Jughandle variants B / B2 / C — same uploader style as 3.3 | CC0 expected (same author pattern) | SVG | INFERENCE (not API-checked) |

Rejected during verification (good drawings, wrong license — do NOT use without review):
`Swindon Magic Roundabout.svg` (CC BY-SA 3.0), `Two-lane roundabout intersection diagram.svg`
(CC BY-SA 4.0 — collision-diagram content would have been ideal), `Michigan Left.svg`
(CC BY-SA 3.0), `Spui-schematic.svg` (CC BY-SA/GFDL), `Diverging diamond redone.svg`
(CC BY 3.0), `Magicroundabout hemel.svg` (CC BY 2.0), `Klaverblad.svg` (CC BY-SA 3.0),
`Roundabout-de.svg` (CC BY-SA 3.0), `Throughabout.svg` (CC BY-SA 3.0),
`Comparison of four legged interchanges.svg` (CC BY-SA 4.0).

Note: Commons has no strong UK magic-roundabout diagram under PD/CC0 — the UK visual gap is
better filled by the NSIP RSA documents in §4.

## 4. UK DMRB / National Highways / local authority under OGL

| # | URL | Artifact | License | Format | Status |
|---|-----|----------|---------|--------|--------|
| 4.1 | https://www.standardsforhighways.co.uk/tses/attachments/69517ebd-ed8d-4558-b101-c1e80611000a | DMRB **GG 119 Road safety audit v2.0.1** (published 30 Apr 2025) — direct PDF download. Includes Figure 1.3 RSA process overview, Stage 1–4 audit report templates, problem-location-plan requirement, exemption file-note template, response-report template, checklists. This is both reference material and a generator of realistic audit-report structure. | © Crown copyright / National Highways; DMRB is published under Open Government Licence (OGL statement appears in GG 101 publishing-info framework rather than this PDF itself) | PDF (~60 pp) | VERIFIED (download + contents); OGL application INFERENCE |
| 4.2 | https://national-infrastructure-consenting.planninginspectorate.gov.uk/ | Planning Inspectorate **NSIP document library** portal. Site footer states verbatim: *"All content is available under the Open Government Licence v3.0, except where otherwise stated."* Hosts thousands of real DCO submission documents including Stage 1/2 RSAs, designer responses and scheme drawings for major road schemes. | Open Government Licence v3.0 (explicit) | HTML/PDF | VERIFIED |
| 4.3 | https://nsip-documents.planninginspectorate.gov.uk/published-documents/TR050006-000449-ES%20TR%20App%2012.1%20-%20TA%20App%2030%20-%20RSA1.pdf | **Real Stage 1 Road Safety Audit** — Northampton Strategic Rail Freight Interchange at M1 J15 (TR050006). Complete GG 119-conformant audit report. | OGL v3.0 (per 4.2 footer) | PDF | VERIFIED |
| 4.4 | https://nsip-documents.planninginspectorate.gov.uk/published-documents/TR010063-000866-TR010063_9.54_road_safety_audit1_response_report.pdf | **M5 Junction 10 Improvements Scheme — Stage 1 RSA Response Report** (TR010063 APP 9.54, Jul 2024, Atkins for Gloucestershire CC). Contains the full RSA **decision log** (problem / recommendation / designer response / overseeing-organisation action), swept-path analysis figures for car/refuse vehicle/7.5t van, and link-road long-section drawings — an end-to-end real UK audit artifact pair. | OGL v3.0 (per 4.2 footer) | PDF (34 pp) | VERIFIED |
| 4.5 | https://www.worcestershire.gov.uk/sites/default/files/2025-08/appendix_j_-_road_safety_audit_templates.pdf | Worcestershire County Council **Appendix J — Road Safety Audit templates** (local-highway-authority adaptation of GG 119 process). | County-council publication; council sites publish under OGL as standard practice — no explicit statement sighted | PDF | VERIFIED (existence); license INFERENCE |

Search tip (INFERENCE): further real UK RSAs are findable as
`site:nsip-documents.planninginspectorate.gov.uk "road safety audit"` — every highways DCO
application must attach Stage 1/2 audits and responses, so this is a deep, OGL-clean seam.

## 5. Municipal open-data portals with intersection geometry / corridor plans

| # | URL | Artifact | License | Format | Status |
|---|-----|----------|---------|--------|--------|
| 5.1 | https://data.seattle.gov/Transportation/SDOT-GIS-Datasets/jyjy-n3ap | Seattle SDOT GIS catalogue — 60+ transport datasets incl. **Intersections**, **Marked Crosswalks**, **Traffic Circles**, **Channelization**, and (see 5.2) concept-plan locations. Dataset metadata states License: **"Public Domain"** with source link to ODDL/PDDL (https://opendatacommons.org/licenses/pddl/). | Public Domain / PDDL (explicit) | CSV/GeoJSON/SHP/KML/API | VERIFIED |
| 5.2 | https://www.seattle.gov/transportation/projects-and-programs/programs/urban-design-program/street-design-concept-plans | SDOT **Street Design Concept Plans** program page — ~18 adopted + draft **corridor streetscape concept-plan PDFs** (Pike/Pine, South Lake Union, Roosevelt, Queen Anne Ave N, Denny Way, Ballard, Westlake etc.) showing cross-sections, intersection treatments, curb ramps, bike facilities. Direct examples: Pike/Pine `...StreetConceptPlans/Pike-Pine-Streetscape-Concept-Plan.pdf`; South Lake Union `...StreetConceptPlans/South-Lake-Union-Street-Concept-Plans.pdf`; Roosevelt `...StreetConceptPlans/Roosevelt-Neighborhood-Streetscape-Concept-Plan.pdf`. | City publication; portal-level PDDL/Public Domain applies to SDOT open data | PDF (plan-style documents) | VERIFIED (page + direct PDF links); license INFERENCE for the individual plan PDFs (portal statement covers datasets) |
| 5.3 | https://data-seattlecitygis.opendata.arcgis.com/datasets/SeattleCityGIS::street-design-concept-plans/about | GIS index of the above concept plans (location + link to each plan PDF) — machine-discoverable route to the corpus. | PDDL/Public Domain (portal) | GeoJSON/API + linked PDFs | VERIFIED |
| 5.4 | https://www.nycstreetdesign.info/ | NYC DOT **Street Design Manual** (4th ed.) — chapters on Designing Intersections (enhanced crossings, daylighting, turning lanes, turn calming), Designing for People/Micromobility, with dimensioned street-detail drawings throughout; includes Spec & Detail finder. Companion raw asset: **Typical Pavement Markings Drawings** https://www.nyc.gov/html/dot/downloads/pdf/nycdot_highwaydesign_typicalmarkings.pdf (intersection marking layouts). NYC open-data terms: https://opendata.cityofnewyork.us/ (free use w/ attribution conditions). | NYC municipal publication; free public access (open-data ToU) | HTML + PDF | VERIFIED (manual + markings PDF referenced live) |
| 5.5 | https://open.toronto.ca/open-data-licence/ | City of Toronto **Open Government Licence – Toronto** (v1.0, explicit full text) governing https://open.toronto.ca/. Portal is strong on GIS centreline/signal data but publishes few scanned drawing artifacts — best used for Canadian-jurisdiction geometric context (paired with Commons Basketweave 3.6). | Open Government Licence – Toronto (explicit) | CSV/GeoJSON/API | VERIFIED (licence text); drawing scarcity noted |

## 6. Consolidated per-source record

Covered inline in §1–§5 tables (URL / artifact type / license / format / status).

---

## Ranked shortlist

Top downloadable artifacts ranked for suitability as RSA audit inputs
(legibility > jurisdiction variety > geometric complexity):

1. **FHWA RSA Case Studies (FHWA-SA-06-017)** — PDF, public domain.
   https://highways.dot.gov/sites/fhwa.dot.gov/files/2022-06/fhwasa06017.pdf
   Ten real audits across stages/agency types with exhibits + ratings tables; pairs scheme imagery with findings language — ideal golden-sample input/output pairing for AuditorAI (UK GG 119 analog: FHWA guidance [EV-US-001]).
2. **DMRB GG 119 v2.0.1 (current)** — PDF, Crown/OGL-typical.
   https://www.standardsforhighways.co.uk/tses/attachments/69517ebd-ed8d-4558-b101-c1e80611000a
   The UK framework itself: stage definitions, report/response templates, checklists — anchors Native-Stage semantics ([EV-UK-002]) and gives structured-output targets.
3. **M5 J10 Stage 1 RSA Response Report (TR010063 App 9.54)** — PDF, OGL v3.0.
   https://nsip-documents.planninginspectorate.gov.uk/published-documents/TR010063-000866-TR010063_9.54_road_safety_audit1_response_report.pdf
   A complete, recent, real UK Stage 1 audit artifact: decision log + swept-path figures + long sections. Best single UK training/demo input.
4. **Stage 1 RSA — Northampton SRFI, M1 J15 (TR050006)** — PDF, OGL v3.0.
   https://nsip-documents.planninginspectorate.gov.uk/published-documents/TR050006-000449-ES%20TR%20App%2012.1%20-%20TA%20App%2030%20-%20RSA1.pdf
   Second real UK audit report for variety (rail-freight interchange access works).
5. **FHWA CFL Sample Plan Sheets** — PDF sets, public domain.
   https://highways.dot.gov/federal-lands/design/plan-prep/cfl/sample
   Authentic construction-plan-sheet formats: plan & profile, typical sections, signing/markings, cross sections — closest match to what an auditor receives at design stage.
6. **Seattle Street Design Concept Plans** — ~18 corridor plan PDFs, city-published.
   https://www.seattle.gov/transportation/projects-and-programs/programs/urban-design-program/street-design-concept-plans
   Urban, VRU-rich (pedestrian/bike/transit) corridor plans — exercises Finding types that UK trunk-road corpora don't cover.
7. **Alaska DOT&PF Standard Plans Manual (full)** — single PDF, state-gov.
   https://dot.alaska.gov/stwddes/dcsprecon/assets/pdf/stddwgs/standard_plans.pdf
   I-series intersections/approaches details; one-file corpus with many discrete drawable units.
8. **Field Evaluation of At-Grade Alternative Intersection Designs (FHWA-HRT-24-126)** — PDF, public domain.
   https://rosap.ntl.bts.gov/view/dot/76961/dot_76961_DS1.pdf
   Modern RCUT/MUT vs conventional plan diagrams — good for hazard-scenario reasoning about conflict points.
9. **NYC Typical Pavement Markings Drawings** — PDF, NYC DOT.
   https://www.nyc.gov/html/dot/downloads/pdf/nycdot_highwaydesign_typicalmarkings.pdf
   Dense urban intersection-marking layouts (crosswalks, boxes, turn pockets).
10. **Commons: Cloverleaf (PSF).svg** — SVG, public domain.
    https://commons.wikimedia.org/wiki/File:Cloverleaf_(PSF).svg
    Clean vector interchange geometry; trivially renderable to PNG for vision pipelines.
11. **Commons: The Basketweave.svg** — SVG, public domain.
    https://commons.wikimedia.org/wiki/File:The_Basketweave.svg
    Complex multi-level weaving geometry (Toronto 401) adds Canadian-flavor difficulty gradient.
12. **TxDOT Plans Online letting plan sets** — PDF contract plan sets, free download.
    https://www.txdot.gov/business/plans-online-bid-lettings.html
    Unlimited supply of full-scale, messy, realistic plan sets when simple curated samples are exhausted (pick any letting → download contract plans).

### Coverage check against jurisdictions
- UK: items 2–4 (GG 119 + two real OGL audits) ✔
- USA: items 1, 5, 7, 8, 9, 12 (federal + state + municipal) ✔
- Canada: item 11 (Basketweave/Toronto context) + Toronto licence path (§5.5) — thin but present ⚠
- UAE: none found under government/public-domain-only terms in this pass — Abu Dhabi DMT/QCC materials exist but licensing was not confirmed clean; follow-up ticket recommended ❌

### Caveats
- License labels marked INFERENCE should be re-checked before redistribution inside a shipped product; safest corpus today = federal US (PD-explicit) + NSIP (OGL-explicit).
- Wikimedia picks exclude several visually ideal diagrams solely on license grounds (CC BY-SA list in §3) — keep them out unless policy changes.
