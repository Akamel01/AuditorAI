# GF-6..10 Quote Pack (C7) — CANDIDATE, owner ratifies

Status: PROPOSED 2026-09-12. Ratification (owner checks approve/strike per line, signs bottom) OPENS
v2 F1 `OWNER_GF_SOURCE_AND_ACCEPTANCE`. Unratified lines NEVER enter scorecards/journals.
Pipeline: source PDF → `scripts/extract-corpus.sh` → /tmp/c7c8-text (ephemeral) → quote (word-sequence
exact substring of the .txt UNDER WHITESPACE FOLDING — pdftotext wraps lines mid-sentence; punctuation/case
exact; `scripts/verify-quotes.py` states and enforces this rule). `scripts/verify-quotes.py` parses the fenced blocks below and proves
`fold(quote) ⊂ fold(source txt)`. DIRECT = scheme/jurisdiction match; ANALOG = practice-level support, flagged.

Corpus license boundary (C10): pack mines CLEAR batches only (fhwa-case-studies, state-dots,
local-mpo). Consequence, stated honestly: NO UK source exists in the corpus (GF-6 all-ANALOG);
NO CLEAR CA source (GF-10 all-ANALOG, canadian/* is RESTRICTED); NO CLEAR INT interchange source
(GF-9 pivotal quotes are US-practice ANALOGs; PIARC corpus files are RESTRICTED — natural
follow-up once owner clears them).

## GF-6 — M5 Junction 10, UK Stage 1 (all ANALOG — no UK source in corpus)

- [x] APPROVE / [ ] STRIKE — G6-1 (ANALOG, prelim-design timing):
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
As illustrated in Exhibit 1, conducting RSAs earlier in a road project's lifecycle (e.g. during preliminary design), results in less implementation cost than later in the process, such as during detailed design or construction.
```
Proposed acceptance: supports Stage-1 (preliminary design) audit timing claims. File: docs/RSA-Documents/usa/fhwa-case-studies/FHWA-SA-06-006_RSA_Guidelines_2005.pdf (CLEAR, USA).

- [x] APPROVE / [ ] STRIKE — G6-2 (ANALOG, all-users scope):
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
The RSA team considers the safety of all road users, qualitatively estimates and reports on road safety issues and opportunities for safety improvement.
```
Proposed acceptance: supports all-user scope claims at Stage 1. Same file.

- [x] APPROVE / [ ] STRIKE — G6-3 (ANALOG, scheme-scale audit precedent):
```quote src=FHWA-SA-06-17_RSA_Case_Studies_10_RSA.txt
The RSA team reviewed the detailed design for an $800 million interchange reconstruction project.
```
Proposed acceptance: supports major-scheme audit precedent claims. File: docs/RSA-Documents/usa/fhwa-case-studies/FHWA-SA-06-17_RSA_Case_Studies_10_RSA.pdf (CLEAR, USA).

## GF-7 — US preliminary-design fixture (practice-DIRECT)

- [x] APPROVE / [ ] STRIKE — G7-1: same text as G6-1 (prelim timing):
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
As illustrated in Exhibit 1, conducting RSAs earlier in a road project's lifecycle (e.g. during preliminary design), results in less implementation cost than later in the process, such as during detailed design or construction.
```
Proposed acceptance: US prelim-design timing baseline.

- [x] APPROVE / [ ] STRIKE — G7-2 (stage coverage):
```quote src=FHWA-SA-06-17_RSA_Case_Studies_10_RSA.txt
The aim of these case studies was to demonstrate the usefulness and effectiveness of RSAs for a variety of projects and project stages, and in a variety of agencies throughout the United States.
```
Proposed acceptance: cross-stage applicability baseline. Same 06-17 file.

- [x] APPROVE / [ ] STRIKE — G7-3 (all-users scope, bicycle program):
```quote src=FHWA-SA-12-018_Bicycle_RSA_Guidelines_Prompt_Lists.txt
RSAs enhance safety by identifying potential safety issues affecting all road users under all conditions and suggesting measures for consideration by the design team or responsible agency.
```
Proposed acceptance: all-users scope baseline. File: docs/RSA-Documents/usa/fhwa-case-studies/FHWA-SA-12-018_Bicycle_RSA_Guidelines_Prompt_Lists.pdf (CLEAR, USA).

## GF-8 — US final/detailed-design fixture (practice-DIRECT)

- [x] APPROVE / [ ] STRIKE — G8-1: same text as G6-3 (detailed-design precedent):
```quote src=FHWA-SA-06-17_RSA_Case_Studies_10_RSA.txt
The RSA team reviewed the detailed design for an $800 million interchange reconstruction project.
```
Proposed acceptance: detailed-design audit precedent baseline.

- [x] APPROVE / [ ] STRIKE — G8-2 (construction-stage RSA):
```quote src=MnDOT_Twin_Ports_Work_Zone_Safety_Audit.txt
This RSA is performed during the construction process.
```
Proposed acceptance: construction-stage audit baseline. File: docs/RSA-Documents/usa/state-dots/MnDOT_Twin_Ports_Work_Zone_Safety_Audit.pdf (CLEAR, USA).

- [x] APPROVE / [ ] STRIKE — G8-3 (structural-deficiency finding style):
```quote src=MnDOT_Twin_Ports_Work_Zone_Safety_Audit.txt
The existing roadway and bridges are aging and structurally obsolete.
```
Proposed acceptance: finding-statement style baseline. Same file.

## GF-9 — INT interchange prelim (pivotal; US-practice ANALOGs + gaps)

Pivotal claim (a) — weave adequacy at recorded volumes:

- [x] APPROVE / [ ] STRIKE — G9-1:
```quote src=MnDOT_Hwy55_RSA_2021.txt
The most significant weaving location is at the Highway 55 entrance given it has the highest entering volume and traffic is often traveling at full speed as they merge onto Highway 52/55.
```
Proposed acceptance: weave-at-volume finding pattern. File: docs/RSA-Documents/usa/state-dots/MnDOT_Hwy55_RSA_2021.pdf (CLEAR, USA).

- [x] APPROVE / [ ] STRIKE — G9-2:
```quote src=MnDOT_Hwy55_RSA_2021.txt
This exit causes weaving because vehicles must get into the left lane, where high speed traffic is typically located, to exit.
```
Proposed acceptance: weave-mechanism finding pattern. Same file.

- [x] APPROVE / [ ] STRIKE — G9-3:
```quote src=MnDOT_Hwy55_RSA_2021.txt
Weaving may be reduced at these three locations by modifying the entry ramp design to allow for additional acceleration, resulting in safety benefits.
```
Proposed acceptance: weave-mitigation recommendation pattern. Same file.

Pivotal claim (b) — uncontrolled shared-use-path crossings at free-flow ramp terminals:

- [x] APPROVE / [ ] STRIKE — G9-4:
```quote src=FHWA-SA-12-018_Bicycle_RSA_Guidelines_Prompt_Lists.txt
Shared use paths may also be used by pedestrians, skaters, wheelchair users, joggers, and other non-motorized users.
```
Proposed acceptance: shared-use-path user-mix definition. Same 12-018 file.

- [x] APPROVE / [ ] STRIKE — G9-5:
```quote src=FHWA-SA-12-018_Bicycle_RSA_Guidelines_Prompt_Lists.txt
Most pathways are shared between bicyclists and other uses (See Shared Use Path).
```
Proposed acceptance: shared-facility conflict premise. Same file.

- [x] APPROVE / [ ] STRIKE — G9-6:
```quote src=FHWA-SA-07-007_Pedestrian_RSA_Guidelines_Prompt_Lists.txt
Are corners and curb ramps appropriately planned and designed at each approach to the crossing?
```
Proposed acceptance: crossing-design prompt pattern. File: docs/RSA-Documents/usa/fhwa-case-studies/FHWA-SA-07-007_Pedestrian_RSA_Guidelines_Prompt_Lists.pdf (CLEAR, USA; canonical KEEP per C5 — identical SA-16-026 bytes NOT used).

Interchange-RSA process analogs:

- [x] APPROVE / [ ] STRIKE — G9-7 (mid-sentence extract, noted):
```quote src=FHWA-SA-06-17_RSA_Case_Studies_10_RSA.txt
in December 2003 the Federal Highway Administration (FHWA) Office of Safety sponsored a RSA of the Marquette Interchange in Milwaukee, WI.
```
Proposed acceptance: interchange-RSA precedent. Same 06-17 file.

- [x] APPROVE / [ ] STRIKE — G9-8:
```quote src=Fairfax_Blake_Lane_Ped_RSA_2024.txt
RSAs seek to enhance safety by identifying potential safety issues affecting all road users under a variety of conditions and suggest treatments to improve safety.
```
Proposed acceptance: all-users interchange/VRU scope (tightened GF-9-002 direction). File: docs/RSA-Documents/usa/local-mpo/Fairfax_Blake_Lane_Ped_RSA_2024.pdf (CLEAR, USA).

GF-9-DIRECT (PIARC, RATIFIED 2026-09-15 — owner APPROVED all 6, 0 struck; scoped-mining exception 2026-09-14, use cleared for GF-9):

- [x] APPROVE / [ ] STRIKE — G9-D1 (DIRECT, prelim-design weave prompt):
```quote src=Karnataka_RSA_Field_Guide_with_Case_Study.txt
Will all merge, diverge and weaving areas be “safe”?
```
Proposed acceptance: pivotal claim (a) weave adequacy at recorded volumes. File: docs/RSA-Documents/intl/piarc-irf/Karnataka_RSA_Field_Guide_with_Case_Study.pdf (RESTRICTED, INT; GF-9-DIRECT scoped mining per LICENSE-REGISTER.md exception 2026-09-14; use cleared 2026-09-15) Checklist p.38, Preliminary design stage.

- [x] APPROVE / [ ] STRIKE — G9-D2 (DIRECT, prelim-design interchange/intersection alignment):
```quote src=Karnataka_RSA_Field_Guide_with_Case_Study.txt
Will horizontal and vertical alignments be safe and consistent, especially at interchanges and intersections?
```
Proposed acceptance: interchange/intersection geometric-consistency prompt at prelim design. File: docs/RSA-Documents/intl/piarc-irf/Karnataka_RSA_Field_Guide_with_Case_Study.pdf (RESTRICTED, INT; GF-9-DIRECT scoped mining per LICENSE-REGISTER.md exception 2026-09-14; use cleared 2026-09-15) Checklist p.38, Preliminary design stage.

- [x] APPROVE / [ ] STRIKE — G9-D3 (DIRECT, prelim-design interchange features):
```quote src=Karnataka_RSA_Field_Guide_with_Case_Study.txt
Are all features of the interchange design “safe”?
```
Proposed acceptance: interchange-design completeness prompt at prelim design. File: docs/RSA-Documents/intl/piarc-irf/Karnataka_RSA_Field_Guide_with_Case_Study.pdf (RESTRICTED, INT; GF-9-DIRECT scoped mining per LICENSE-REGISTER.md exception 2026-09-14; use cleared 2026-09-15) Checklist p.39, Preliminary design stage (cont.).

- [x] APPROVE / [ ] STRIKE — G9-D4 (DIRECT, planning-stage interchange type):
```quote src=Karnataka_RSA_Field_Guide_with_Case_Study.txt
Will the type of interchange be understood by drivers?
```
Proposed acceptance: interchange-type comprehensibility prompt at planning stage. File: docs/RSA-Documents/intl/piarc-irf/Karnataka_RSA_Field_Guide_with_Case_Study.pdf (RESTRICTED, INT; GF-9-DIRECT scoped mining per LICENSE-REGISTER.md exception 2026-09-14; use cleared 2026-09-15) Checklist p.37, Planning stage.

- [x] APPROVE / [ ] STRIKE — G9-D5 (DIRECT, prelim-design VRU crossing):
```quote src=Karnataka_RSA_Field_Guide_with_Case_Study.txt
Are pedestrian needs safely considered? (To cross the road, and to walk along the road?) (Refer to Part C of this field guide).
```
Proposed acceptance: pivotal claim (b) uncontrolled VRU crossings at ramp terminals. File: docs/RSA-Documents/intl/piarc-irf/Karnataka_RSA_Field_Guide_with_Case_Study.pdf (RESTRICTED, INT; GF-9-DIRECT scoped mining per LICENSE-REGISTER.md exception 2026-09-14; use cleared 2026-09-15) Checklist p.39, Preliminary design stage (cont.).

- [x] APPROVE / [ ] STRIKE — G9-D6 (DIRECT, all-users scope principle):
```quote src=Karnataka_RSA_Field_Guide_with_Case_Study.txt
consider the needs of all road users (including pedestrians especially children, cyclists, and motor-cyclists) in all weathers and lighting conditions
```
Proposed acceptance: all-users scope baseline, INT source. File: docs/RSA-Documents/intl/piarc-irf/Karnataka_RSA_Field_Guide_with_Case_Study.pdf (RESTRICTED, INT; GF-9-DIRECT scoped mining per LICENSE-REGISTER.md exception 2026-09-14; use cleared 2026-09-15) Audit principles p.2.
Cleared 2026-09-15: owner cleared piarc-irf/ for GF-9-DIRECT; G9-D1..D6 above RATIFIED (all 6 APPROVED, 0 struck).
T5 follow-up 2026-09-14: scoped mining cleared for GF-9-DIRECT candidates only; verdict stays RESTRICTED, use cleared for GF-9-DIRECT only.

## GF-10 — CA planning fixture (all ANALOG — canadian/* RESTRICTED)

- [x] APPROVE / [ ] STRIKE — G10-1:
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
Planning projects, by their nature, have little information about the details of the design.
```
Proposed acceptance: planning-stage information-poor premise. Same 06-006 file.

- [x] APPROVE / [ ] STRIKE — G10-2 (scope breadth at planning):
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
Broad enough to consider the safety of all road users and road facilities.
```
Proposed acceptance: planning-stage scope baseline. Same file.

- [x] APPROVE / [ ] STRIKE — G10-3 (field review at any stage):
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
The field review is a key task that the RSA team should undertake in all audits.
```
Proposed acceptance: field-review universality baseline. Same file.

## Ratification

Owner: check one box per line above, then sign: `RATIFIED-BY: owner via chat 2026-09-13 — all 20 APPROVED, 0 struck`
`RATIFIED-BY: owner via chat 2026-09-15 — GF-9-DIRECT G9-D1..D6 all 6 APPROVED, 0 struck`
`RATIFIED-BY: owner via chat 2026-09-15 — H3b1 13 APPROVED, 0 struck`
Counts: GF-6: 3, GF-7: 3, GF-8: 3, GF-9: 14 (8 CLEAR ANALOGs + 6 RATIFIED PIARC DIRECTs), GF-10: 3 (26 candidates, 8 distinct source files; PIARC source RESTRICTED, GF-9-DIRECT use cleared). H3b1: 13 RATIFIED (GF-6:+1, GF-7:+3, GF-8:+5, GF-9:+3, GF-10:+1; 9 distinct CLEAR usa/ source files; total 39 candidates, 39 APPROVED, 0 struck).
Note: File: paths updated post-C4-migration (2026-09-13) from harvest layout to usa/ shelves; quote texts unchanged from approved version; resolve via corpus-catalog.json basename lookup.

## H3b1 — loop-5 mining batch-1 (PROPOSED 2026-09-15, owner ratifies)

Mined from 10 loop-5 PDFs (CTDOT C-0295/C-0296/C-0297/C-0300/C-0301, ODOT C-0316,
FDOT C-0302, MnDOT C-0305/C-0306, MRMPO C-0286 — all CLEAR usa/, zero quarantine;
extracted via scripts/extract-corpus.sh to /tmp/c7c8-text only). Page refs are PDF
pages per pdftotext page breaks (prefixed ~). Unratified lines NEVER enter
scorecards/journals. IDs continue per-GF numbering.

- [x] APPROVE / [ ] STRIKE — G6-4 (ANALOG, staged-process precedent):
```quote src=MRMPO_Lead_Coal_Avenues_RSA_2022.txt
Perform Field Reviews: June 8-June 9, 2022 5. Analyze and Report on Findings: June 9 (analysis) and August 30, 2022 (report) 6. Present Findings to Owner: June 10 (verbally) and report presented on August 30, 2022 7. Prepare Formal Response: to be determined (by owner) 8. Incorporate Findings: to be determined (by owner)
```
Proposed acceptance: 8-step audit-to-response process precedent at scheme scale. File: docs/RSA-Documents/usa/local-mpo/MRMPO_Lead_Coal_Avenues_RSA_2022.pdf (CLEAR, USA) p.~15.

- [x] APPROVE / [ ] STRIKE — G7-4 (practice-DIRECT, independent-team scope):
```quote src=CTDOT_Bristol_Route72_RSA_2017.txt
It is a qualitative review by an independent team experienced in traffic, pedestrian, and bicycle operations and design that considers the safety of all road users and proactively assesses mitigation measures to improve the safe operation of the facility by reducing the potential crash risk frequency or severity.
```
Proposed acceptance: independence + all-users + proactive-mitigation baseline. File: docs/RSA-Documents/usa/state-dots/CTDOT_Bristol_Route72_RSA_2017.pdf (CLEAR, USA) p.~5.

- [x] APPROVE / [ ] STRIKE — G7-5 (practice-DIRECT, VRU-focused review):
```quote src=CTDOT_Salisbury_US44_CT41_RSA_2025.txt
An RSA is a quick and high-level safety review, mainly focusing on vulnerable road user safety, intended to decrease the number and severity of roadway crashes by recommending the implementation of safety countermeasures.
```
Proposed acceptance: VRU-focused high-level review baseline. File: docs/RSA-Documents/usa/state-dots/CTDOT_Salisbury_US44_CT41_RSA_2025.pdf (CLEAR, USA) p.~3.

- [x] APPROVE / [ ] STRIKE — G7-6 (practice-DIRECT, independent-team composition):
```quote src=MnDOT_TH14_NewUlm_NorthMankato_RSAR_2012.txt
CH2M HILL assembled an independent team of safety experts representing MnDOT, the Federal Highway Administration, the Minnesota State Patrol and the private sector.
```
Proposed acceptance: multi-agency independent-team composition precedent. File: docs/RSA-Documents/usa/state-dots/MnDOT_TH14_NewUlm_NorthMankato_RSAR_2012.pdf (CLEAR, USA) p.~3.

- [x] APPROVE / [ ] STRIKE — G8-4 (practice-DIRECT, evidence factors):
```quote src=CTDOT_Haddam_Route154_RSA_2023.txt
These factors include traffic volumes and speeds, topography, roadway geometrics, crash data, roadway inventory (i.e. signage, curbs, bicycle/pedestrian facilities, amenities, safety components), and sidewalks.
```
Proposed acceptance: finding-evidence factor checklist baseline. File: docs/RSA-Documents/usa/state-dots/CTDOT_Haddam_Route154_RSA_2023.pdf (CLEAR, USA) p.~3.

- [x] APPROVE / [ ] STRIKE — G8-5 (practice-DIRECT, crash-history analysis):
```quote src=ODOT_OR211_RSA_2022.txt
The selected team assesses the existing crash history of the defned study corridor and suggests potential safety improvement options to reduce the number and severity of crashes.
```
Proposed acceptance: crash-history-to-improvement finding pattern (sic "defned" in source). File: docs/RSA-Documents/usa/state-dots/ODOT_OR211_RSA_2022.pdf (CLEAR, USA) p.~7.

- [x] APPROVE / [ ] STRIKE — G8-6 (practice-DIRECT, written owner response):
```quote src=MnDOT_TH3_Farmington_RSA.txt
Mn/DOT is encouraged to consider the report’s recommendations and respond in writing with its plans for implementation of the report’s findings.
```
Proposed acceptance: formal written-response obligation baseline. File: docs/RSA-Documents/usa/state-dots/MnDOT_TH3_Farmington_RSA.pdf (CLEAR, USA) p.~2.

- [x] APPROVE / [ ] STRIKE — G8-7 (practice-DIRECT, recommendation value):
```quote src=FDOT_SR60_Barber_Bridge_RSA_2015.txt
The goal of an RSA is to develop recommendations that enhance safety, while minimizing impact, if any, on traffic flow.
```
Proposed acceptance: safety-first recommendation-goal baseline. File: docs/RSA-Documents/usa/state-dots/FDOT_SR60_Barber_Bridge_RSA_2015.pdf (CLEAR, USA) p.~4.

- [x] APPROVE / [ ] STRIKE — G8-8 (practice-DIRECT, findings handoff step):
```quote src=FDOT_SR60_Barber_Bridge_RSA_2015.txt
Present audit findings to Project Owner/Design Team
```
Proposed acceptance: 8-step process handoff step (Step 6). Same file, p.~6.

- [x] APPROVE / [ ] STRIKE — G9-9 (ANALOG, all-users field scope):
```quote src=MRMPO_Lead_Coal_Avenues_RSA_2022.txt
An RSA team looks at existing conditions at various times of day, considers all road users, and accounts for human factors and road user capabilities.
```
Proposed acceptance: all-users + human-factors field-scope pattern. File: docs/RSA-Documents/usa/local-mpo/MRMPO_Lead_Coal_Avenues_RSA_2022.pdf (CLEAR, USA) p.~4.

- [x] APPROVE / [ ] STRIKE — G9-10 (ANALOG, frequency-severity ranking):
```quote src=MRMPO_Lead_Coal_Avenues_RSA_2022.txt
RSA teams assess potential safety issues based on the likely frequency of occurrence and severity of outcome and provide the road agency-owner suggestions on mitigating for each issue identified in the audit.
```
Proposed acceptance: risk-rank + per-issue mitigation pattern. Same file, p.~4.

- [x] APPROVE / [ ] STRIKE — G9-11 (ANALOG, proven-countermeasure status):
```quote src=MRMPO_Lead_Coal_Avenues_RSA_2022.txt
RSAs are considered a proven safety countermeasure by the Federal Highway Administration (FHWA), meaning their effectiveness at improving safety has been confirmed through research.
```
Proposed acceptance: RSA-effectiveness status baseline. Same file, p.~4.

- [x] APPROVE / [ ] STRIKE — G10-4 (ANALOG, pre-visit desktop evidence):
```quote src=CTDOT_Madison_US1_RSA_2024.txt
Prior to the site visit, area topography, land use characteristics, intersection sight distance concerns, sidewalk locations, parking, and bicycle facilities are examined using available mapping and imagery.
```
Proposed acceptance: planning-stage information-gathering premise (desktop before field). File: docs/RSA-Documents/usa/state-dots/CTDOT_Madison_US1_RSA_2024.pdf (CLEAR, USA) p.~3.

H3b1 counts: 13 candidates (GF-6: 1, GF-7: 3, GF-8: 5, GF-9: 3, GF-10: 1) across 9 distinct source files; all CLEAR usa/.

## H3b2 — loop-5 mining batch-2 (PROPOSED 2026-09-16, owner ratifies)

Mined from 8 loop-5 PDFs (FHWA C-0259/C-0269, VDOT C-0318, BrowardMPO C-0282,
MORPC C-0285, Tacoma C-0293, MnDOT-US12 C-0310, SEMCOG C-0290 — all CLEAR usa/,
zero quarantine; extracted via scripts/extract-corpus.sh to /tmp/c7c8-text only;
none mined in batch-1). Page refs are PDF pages per pdftotext page breaks
(prefixed ~). Unratified lines NEVER enter scorecards/journals. IDs continue
per-GF numbering (G6-5, G7-7/8, G8-9..12, G9-12/13, G10-5/6).

- [ ] APPROVE / [ ] STRIKE — G6-5 (ANALOG, early-influence timing):
```quote src=FHWA-SA-10-005_Focusing_RSA_on_Intersections.txt
RSAs applied early in the planning and preliminary (functional) design of intersections offer the greatest opportunities for beneficial influence.
```
Proposed acceptance: early (planning/prelim) audit-timing premise at intersection scale. File: docs/RSA-Documents/usa/fhwa-case-studies/FHWA-SA-10-005_Focusing_RSA_on_Intersections.pdf (CLEAR, USA) p.~3.

- [ ] APPROVE / [ ] STRIKE — G7-7 (practice-DIRECT, any-phase prelim coverage):
```quote src=FHWA-SA-10-005_Focusing_RSA_on_Intersections.txt
RSAs can be used in any phase of project development—from planning and preliminary engineering to design and construction—or as a tool within an overall asset management program.
```
Proposed acceptance: prelim-engineering stage-coverage baseline. Same file, p.~1.

- [ ] APPROVE / [ ] STRIKE — G7-8 (practice-DIRECT, independent-team composition):
```quote src=FHWA-SA-14-xxx_Model_RSA_Policy.txt
An RSA is conducted by an independent team of qualified professionals who have not previously been directly involved in the project.
```
Proposed acceptance: independence-from-design-team baseline. File: docs/RSA-Documents/usa/fhwa-case-studies/FHWA-SA-14-xxx_Model_RSA_Policy.pdf (CLEAR, USA) p.~2.

- [ ] APPROVE / [ ] STRIKE — G8-9 (practice-DIRECT, detailed-design cost-of-change):
```quote src=FHWA-SA-10-005_Focusing_RSA_on_Intersections.txt
As a design progresses into detailed design and construction, changes that may improve safety performance typically become more difficult, costly, and time consuming to implement.
```
Proposed acceptance: late-stage change-cost premise for final-design audit timing. Same 10-005 file, p.~3.

- [ ] APPROVE / [ ] STRIKE — G8-10 (practice-DIRECT, written owner response):
```quote src=VDOT_RSA_Manual.txt
Step 7: Prepare Formal Response Once the owner and/or design team have reviewed the RSA report, they should prepare a written response to its findings.
```
Proposed acceptance: formal written-response obligation baseline. File: docs/RSA-Documents/usa/state-dots/VDOT_RSA_Manual.pdf (CLEAR, USA) p.~7.

- [ ] APPROVE / [ ] STRIKE — G8-11 (practice-DIRECT, crash-data evidence window):
```quote src=BrowardMPO_OffSystem_RSA_Framework_2023.txt
At least three to five years of crash data should be used under consistent site conditions in safety analysis.
```
Proposed acceptance: crash-history evidence-window baseline. File: docs/RSA-Documents/usa/local-mpo/BrowardMPO_OffSystem_RSA_Framework_2023.pdf (CLEAR, USA) p.~11.

- [ ] APPROVE / [ ] STRIKE — G8-12 (practice-DIRECT, formal response content):
```quote src=MORPC_Ohio_RSA_Guide.txt
Following the RSA findings presentation, the project owner and stakeholders should prepare a formal response to outline how they intend to address the safety concerns prioritized in the report.
```
Proposed acceptance: prioritized-findings response-content baseline. File: docs/RSA-Documents/usa/local-mpo/MORPC_Ohio_RSA_Guide.pdf (CLEAR, USA) p.~32.

- [ ] APPROVE / [ ] STRIKE — G9-12 (ANALOG, prelim-design implementation):
```quote src=Tacoma_S_Tacoma_Way_RSA_2024.txt
The S 60th St Improvement Plan related to the Sound Transit station upgrade is currently in preliminary design and can implement additional safety improvements identified through this RSA.
```
Proposed acceptance: prelim-design uptake pattern (transit-adjacent corridor). File: docs/RSA-Documents/usa/local-mpo/Tacoma_S_Tacoma_Way_RSA_2024.pdf (CLEAR, USA) p.~5.

- [ ] APPROVE / [ ] STRIKE — G9-13 (ANALOG, merge-conflict spacing):
```quote src=MnDOT_US12_RSA_Technical_Report.txt
Spacing of access points should also be considered so that drivers have sufficient space to make turns and merges with minimal conflict.
```
Proposed acceptance: merge/conflict-spacing finding pattern. File: docs/RSA-Documents/usa/state-dots/MnDOT_US12_RSA_Technical_Report.pdf (CLEAR, USA) p.~33.

- [ ] APPROVE / [ ] STRIKE — G10-5 (ANALOG, any-phase planning coverage):
```quote src=SEMCOG_RSA_Overview_2023.txt
Road safety audits can be used in any phase of project development from planning and preliminary engineering, to design, to construction.
```
Proposed acceptance: planning-stage applicability premise (MPO source). File: docs/RSA-Documents/usa/local-mpo/SEMCOG_RSA_Overview_2023.pdf (CLEAR, USA) p.~1.

- [ ] APPROVE / [ ] STRIKE — G10-6 (ANALOG, planning-to-construction pipeline):
```quote src=BrowardMPO_OffSystem_RSA_Framework_2023.txt
Once an off-system RSA is complete, the concept plan can be used to advance the project through planning, preliminary engineering, final design, and construction.
```
Proposed acceptance: RSA-concept-into-delivery pipeline premise. Same BrowardMPO file, p.~27.

H3b2 counts: 11 candidates (GF-6: 1, GF-7: 2, GF-8: 4, GF-9: 2, GF-10: 2) across 8 distinct source files; all CLEAR usa/.
