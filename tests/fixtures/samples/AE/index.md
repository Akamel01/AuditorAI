# AE — Road Safety Audit sample collection (UAE / Abu Dhabi)

Collected 2026-08-23 by sample-audit collection agent. Public-access sources only;
Wayback retrieval used for public-origin documents. Expectation set honestly: complete
published UAE RSA packages (scheme inputs + audit report + response) do not exist in the
public domain. What exists publicly is (a) conference/journal papers reporting real UAE
audit outcomes, and (b) practice bulletins from UAE road-safety specialists. Both are
collected below; the rest is gap-documented.

Native stage naming: Abu Dhabi uses Stage 0 (feasibility/conceptual), Stage 1
(preliminary design), Stage 2 (detailed design), Stage 3 (pre-opening/completion),
Stage 4a/4b (12/36-month monitoring). Combined Stage 1/2 audits are permitted for smaller
schemes per TR-540 [EV-AE-004, EV-AE-012 lineage]. Older ADM-era documents use the same
numbering (ADM RSA Procedures 2009/2016; Emirate of Abu Dhabi Road Safety Audit Manual
2012/ADG-18 2018; TR-540 current).

## Downloaded samples

### AE-001 · ARRB/PIL existing-facility RSAs, Abu Dhabi internal road network (SATC 2012)

- id: `ae-001-arrb-abudhabi-internal-roads-rsa`
- title: "Road safety assessments and road safety audits on the existing Abu Dhabi Internal road network"
- source_url: https://repository.up.ac.za/bitstreams/22ba7607-6a52-44b0-926e-1880f99cb12b/download (resolver: http://hdl.handle.net/2263/20226)
- wayback_url: n/a (live retrieval)
- publisher: 31st Southern African Transport Conference (SATC 2012) proceedings; authors Grosskopf, Kazemi, Hughes, Bani Hashim (ARRB Group / Parsons International Ltd)
- retrieved_date: 2026-08-23
- emirate/body: Abu Dhabi — Municipality of Abu Dhabi City (ADM), Traffic Services / Road Safety Unit
- native_stage: existing-facility RSA (Stage 3/4-equivalent appraisal of operational roads; pre-dates TR-540 stage vocabulary, uses "existing facilities road safety audit")
- input_types present: scheme_description (network sections audited: Maqta & Musaffah Bridge interchanges, IP145 roundabout interchange on Airport Rd, Corniche Rd, Airport Rd, Hamdan St, Al Falah St, Baniyas St, Zayed St, East Rd); traffic_data referenced at programme level only (no counts in paper)
- output_types present: findings_report (general problems + site-specific findings with GPS-referenced inventory), recommendations (per problem + standardized remedial measures + AED cost estimates), GIS problem-location mapping extract
- completeness: excerpt — real findings/recommendations for named Abu Dhabi roads; no drawings, no response report
- sha256: 23ba188e4251ae9ca147c76bd2986f9297daf67a9dcf8f09fd311ab172ae7ef5
- filename: arrb-pil-abudhabi-internal-roads-rsa-paper-2012.pdf
- notes: 162 specific findings @ Maqta/Musaffah interchanges (signage/markings 62%, roadside hazards 13%, geometric 13%); 70 findings @ IP145; 2,338 arterial-road findings across the wider programme. Good seed material for candidate-finding phrasing on UAE urban arterials.

### AE-002 · CIHT Dubai seminar bulletin — Planning, Executing & Responding to RSAs in the UAE

- id: `ae-002-ciht-dubai-rsa-practice-bulletin`
- title: "CIHT Dubai Evening Seminar — Planning, Executing and Responding to Road Safety Audits" (bulletin)
- source_url: https://www.ciht.org.uk/media/13643/4-ciht-dubai-road-safety-audit-bulletin-070720.pdf
- wayback_url: https://web.archive.org/web/20220121171833/https://www.ciht.org.uk/media/13643/4-ciht-dubai-road-safety-audit-bulletin-070720.pdf (fetched live; Wayback fallback verified)
- publisher: CIHT Dubai (7 July 2020 seminar); speakers: David George (Road Safety Specialist, Al Ain City Municipality), Nandeesh Kestur (Road Safety Specialist, Abu Dhabi Municipality)
- retrieved_date: 2026-08-23
- emirate/body: UAE-wide (Dubai group event; Abu Dhabi/Al Ain municipality practice; references TR-540 and Dubai Road Safety Audit Manual)
- native_stage: describes Stage 0 planning/concept → Stage 1 preliminary → Stage 2 detailed → Stage 3 completion → Stage 4 monitoring (12/36 months)
- input_types present: none (practice narrative)
- output_types present: process/checklist context — commissioning, audit team composition, Design Team Response (DTR), Decision Tracking Form discussion, exception/conflict handling
- completeness: excerpt — authoritative UAE practice context incl. stage naming and response workflow; contains zero worked audit content
- sha256: cd87fb56cd26f8eda8459636cfe63314a0412e5667d0a8887b3f308270012345
- filename: ciht-dubai-rsa-seminar-bulletin-2020.pdf
- notes: confirms UAE-native stage list (incl. Stage 0), combined-stage usage, VRS per TR-158 of Abu Dhabi Roadside Design Guide (TR-518), and that ignoring RSA recommendations carries no direct legal consequence in UAE (authority approval lever instead).

## Documented gaps / non-downloadable references (no file)

| ref | what it is | why not collected |
|---|---|---|
| ADG 18 (2018) "Emirate of Abu Dhabi Road Safety Audit Manual" (En+Ar) | The closest thing to a template-with-worked-content package: Annex A RSA Request Form, **Annex C Example Road Safety Audit Report** (Stage 1 and Stage 2 variants listed), Annex D Exception Report Template | Only public copy is a Scribd upload (account wall, no legitimate direct download). Not on qcc.gov.ae public tree (probed `/Abu-Dhabi-Guideline/ADG-18*` patterns → `sitecore/service/notfound.aspx`), not in any Wayback capture of adm/dot/dmt domains. Highest-value single acquisition target if access can be arranged. |
| jawdah.qcc.abudhabi.ae ISGL-LIST captures (~30 codes via CDX) | Full inventory extracted from ISGL master list PDF (TR-501…544, DP-, PR-, ROW-, WA-, EN- codes): every captured item is a normative planning/design manual (master plans, MUTCD, geometric/structures/pavement design manuals, roadside guide, work-zone manual, water/electricity codes). **Zero** RSA report templates, worked checklists, or auditor-accreditation schemes among captures. TR-514 §2.13 merely mandates RSAs per TR-540 and names "Road Safety Audit Report" as a deliverable. | Nothing to collect beyond the already-held TR-540 manual itself. Gap documented precisely: QCC's unified-standards library = normative only. |
| Hughes, Al Asady, Jois, Lenton — "Outcomes from a large scale road safety audit of the existing Dubai road network" (RS4C 2010, Abu Dhabi) | Dubai RTA-commissioned audit of 1,906 centreline-km / 6,518 lane-km per Dubai RSA Manual (2008): 4,125+ findings, severity classes Intolerable→Low, GPS-photo documentation; roadside hazards ≈90% of freeway/expressway/arterial findings | Full text never openly published; TRID record 968748 abstract only. Press coverage exists (The National, 2010-03-28). No archived PDF located. |
| Hughes, McTiernan, Kazemi — "Risk based prioritisation of remedial works identified through road safety audit" (25th ARRB Conf., Perth 2012) | Abu Dhabi City: 2,000 cw-km screened, 308 cw-km manually audited, 6,844 site-specific deficiencies, RSRM risk-reduction-cost-ratio prioritisation over 364 standard treatments | TRID record 1224050 abstract only; ARRB knowledge base paywalled. Companion to AE-001. |
| RTA Dubai 2019 RSA of ~1,000 km existing roads | Systematic RSA w/ site-specific + general problems and recommendations; tied to 2014–2018 injury-crash data | Described only on roadsafetyawards.com winner page; study report never published. |
| Named proprietary Abu Dhabi RSAs (from approved-auditor CVs) | Maryah Island Bridges 3 & 4 Stage 3 (per "Emirate of Abu Dhabi Road Safety Audit Manual 2012"); E10 development entries Stage 1&2; Al Maqam junction→interchange Stage 1&2; Al Shuwaib access Stage 1&2; Al Salamat/Al Sad walkways Stage 1&2; Al Daoon Rd dualization Stage 0+1&2; Saadiyat Lagoons Stage 1&2; Lu'luat Al Raha Phase 2 combined Stage 1&2 (six signalised + four priority junctions onto an 80 km/h boulevard — Trublu Consulting case page) | All reports are consultant/client property; evidence is CV/case-page descriptions only (LinkedIn profiles, trublutc.com). Demonstrates real combined-Stage 1/2 and Stage 3 practice but yields no documents. |
| Dubai RTA "Road Safety Audit Manual" (2003, rev. 2008) | Dubai's native RSA framework, cited in CIHT bulletin and RTA Geometric Design Manual bibliography | Not publicly hosted; RTA publishes standards via e-services portal. |
| ADM "Road Safety Audits Procedures for Abu Dhabi City Roads" (2009/2016) | Predecessor of ADG-18/TR-540 with ADM-specific procedures | No public copy found (adm.gov.ae Wayback PDF captures contain nothing RSA-related). |
| dot.abudhabi.ae / upc.gov.ae / dmt.gov.ae archived project docs with RSA annexes | Hypothesised RSA annexes in project/consultation docs | CDX mining (≈5k collapsed URLs, PDFs filtered) found transit maps/schedules/laws only — no RSA annexes ever captured. |

## Coverage summary vs. target package shape

- full-package (scheme_description + drawings + traffic_data + findings_report + response_report): **none obtainable publicly** — this is the honest headline.
- outputs-only/excerpt with real UAE findings: AE-001 (Abu Dhabi).
- process/stage/response-workflow context (no findings): AE-002.
- Best future acquisitions: Scribd ADG-18 copy (Annex C example reports), any leaked/published TR-540 annex pack, or a UAEU/Khalifa thesis embedding a full anonymized RSA (searched 2026-08-23; scholarworks hits are crash-data studies, none conduct an actual RSA).
