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

- [ ] APPROVE / [ ] STRIKE — G6-1 (ANALOG, prelim-design timing):
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
As illustrated in Exhibit 1, conducting RSAs earlier in a road project's lifecycle (e.g. during preliminary design), results in less implementation cost than later in the process, such as during detailed design or construction.
```
Proposed acceptance: supports Stage-1 (preliminary design) audit timing claims. File: docs/RSA-Documents/fhwa-case-studies/FHWA-SA-06-006_RSA_Guidelines_2005.pdf (CLEAR, USA).

- [ ] APPROVE / [ ] STRIKE — G6-2 (ANALOG, all-users scope):
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
The RSA team considers the safety of all road users, qualitatively estimates and reports on road safety issues and opportunities for safety improvement.
```
Proposed acceptance: supports all-user scope claims at Stage 1. Same file.

- [ ] APPROVE / [ ] STRIKE — G6-3 (ANALOG, scheme-scale audit precedent):
```quote src=FHWA-SA-06-17_RSA_Case_Studies_10_RSA.txt
The RSA team reviewed the detailed design for an $800 million interchange reconstruction project.
```
Proposed acceptance: supports major-scheme audit precedent claims. File: docs/RSA-Documents/fhwa-case-studies/FHWA-SA-06-17_RSA_Case_Studies_10_RSA.pdf (CLEAR, USA).

## GF-7 — US preliminary-design fixture (practice-DIRECT)

- [ ] APPROVE / [ ] STRIKE — G7-1: same text as G6-1 (prelim timing):
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
As illustrated in Exhibit 1, conducting RSAs earlier in a road project's lifecycle (e.g. during preliminary design), results in less implementation cost than later in the process, such as during detailed design or construction.
```
Proposed acceptance: US prelim-design timing baseline.

- [ ] APPROVE / [ ] STRIKE — G7-2 (stage coverage):
```quote src=FHWA-SA-06-17_RSA_Case_Studies_10_RSA.txt
The aim of these case studies was to demonstrate the usefulness and effectiveness of RSAs for a variety of projects and project stages, and in a variety of agencies throughout the United States.
```
Proposed acceptance: cross-stage applicability baseline. Same 06-17 file.

- [ ] APPROVE / [ ] STRIKE — G7-3 (all-users scope, bicycle program):
```quote src=FHWA-SA-12-018_Bicycle_RSA_Guidelines_Prompt_Lists.txt
RSAs enhance safety by identifying potential safety issues affecting all road users under all conditions and suggesting measures for consideration by the design team or responsible agency.
```
Proposed acceptance: all-users scope baseline. File: docs/RSA-Documents/fhwa-case-studies/FHWA-SA-12-018_Bicycle_RSA_Guidelines_Prompt_Lists.pdf (CLEAR, USA).

## GF-8 — US final/detailed-design fixture (practice-DIRECT)

- [ ] APPROVE / [ ] STRIKE — G8-1: same text as G6-3 (detailed-design precedent):
```quote src=FHWA-SA-06-17_RSA_Case_Studies_10_RSA.txt
The RSA team reviewed the detailed design for an $800 million interchange reconstruction project.
```
Proposed acceptance: detailed-design audit precedent baseline.

- [ ] APPROVE / [ ] STRIKE — G8-2 (construction-stage RSA):
```quote src=MnDOT_Twin_Ports_Work_Zone_Safety_Audit.txt
This RSA is performed during the construction process.
```
Proposed acceptance: construction-stage audit baseline. File: docs/RSA-Documents/state-dots/MnDOT_Twin_Ports_Work_Zone_Safety_Audit.pdf (CLEAR, USA).

- [ ] APPROVE / [ ] STRIKE — G8-3 (structural-deficiency finding style):
```quote src=MnDOT_Twin_Ports_Work_Zone_Safety_Audit.txt
The existing roadway and bridges are aging and structurally obsolete.
```
Proposed acceptance: finding-statement style baseline. Same file.

## GF-9 — INT interchange prelim (pivotal; US-practice ANALOGs + gaps)

Pivotal claim (a) — weave adequacy at recorded volumes:

- [ ] APPROVE / [ ] STRIKE — G9-1:
```quote src=MnDOT_Hwy55_RSA_2021.txt
The most significant weaving location is at the Highway 55 entrance given it has the highest entering volume and traffic is often traveling at full speed as they merge onto Highway 52/55.
```
Proposed acceptance: weave-at-volume finding pattern. File: docs/RSA-Documents/state-dots/MnDOT_Hwy55_RSA_2021.pdf (CLEAR, USA).

- [ ] APPROVE / [ ] STRIKE — G9-2:
```quote src=MnDOT_Hwy55_RSA_2021.txt
This exit causes weaving because vehicles must get into the left lane, where high speed traffic is typically located, to exit.
```
Proposed acceptance: weave-mechanism finding pattern. Same file.

- [ ] APPROVE / [ ] STRIKE — G9-3:
```quote src=MnDOT_Hwy55_RSA_2021.txt
Weaving may be reduced at these three locations by modifying the entry ramp design to allow for additional acceleration, resulting in safety benefits.
```
Proposed acceptance: weave-mitigation recommendation pattern. Same file.

Pivotal claim (b) — uncontrolled shared-use-path crossings at free-flow ramp terminals:

- [ ] APPROVE / [ ] STRIKE — G9-4:
```quote src=FHWA-SA-12-018_Bicycle_RSA_Guidelines_Prompt_Lists.txt
Shared use paths may also be used by pedestrians, skaters, wheelchair users, joggers, and other non-motorized users.
```
Proposed acceptance: shared-use-path user-mix definition. Same 12-018 file.

- [ ] APPROVE / [ ] STRIKE — G9-5:
```quote src=FHWA-SA-12-018_Bicycle_RSA_Guidelines_Prompt_Lists.txt
Most pathways are shared between bicyclists and other uses (See Shared Use Path).
```
Proposed acceptance: shared-facility conflict premise. Same file.

- [ ] APPROVE / [ ] STRIKE — G9-6:
```quote src=FHWA-SA-07-007_Pedestrian_RSA_Guidelines_Prompt_Lists.txt
Are corners and curb ramps appropriately planned and designed at each approach to the crossing?
```
Proposed acceptance: crossing-design prompt pattern. File: docs/RSA-Documents/fhwa-case-studies/FHWA-SA-07-007_Pedestrian_RSA_Guidelines_Prompt_Lists.pdf (CLEAR, USA; canonical KEEP per C5 — identical SA-16-026 bytes NOT used).

Interchange-RSA process analogs:

- [ ] APPROVE / [ ] STRIKE — G9-7 (mid-sentence extract, noted):
```quote src=FHWA-SA-06-17_RSA_Case_Studies_10_RSA.txt
in December 2003 the Federal Highway Administration (FHWA) Office of Safety sponsored a RSA of the Marquette Interchange in Milwaukee, WI.
```
Proposed acceptance: interchange-RSA precedent. Same 06-17 file.

- [ ] APPROVE / [ ] STRIKE — G9-8:
```quote src=Fairfax_Blake_Lane_Ped_RSA_2024.txt
RSAs seek to enhance safety by identifying potential safety issues affecting all road users under a variety of conditions and suggest treatments to improve safety.
```
Proposed acceptance: all-users interchange/VRU scope (tightened GF-9-002 direction). File: docs/RSA-Documents/local-mpo/Fairfax_Blake_Lane_Ped_RSA_2024.pdf (CLEAR, USA).

GAP (honest): no CLEAR INT interchange-weaving source in corpus; PIARC 2023/2011/LMIC files
(piarc-irf/, RESTRICTED) are the natural GF-9-DIRECT follow-up once owner clears that batch.

## GF-10 — CA planning fixture (all ANALOG — canadian/* RESTRICTED)

- [ ] APPROVE / [ ] STRIKE — G10-1:
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
Planning projects, by their nature, have little information about the details of the design.
```
Proposed acceptance: planning-stage information-poor premise. Same 06-006 file.

- [ ] APPROVE / [ ] STRIKE — G10-2 (scope breadth at planning):
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
Broad enough to consider the safety of all road users and road facilities.
```
Proposed acceptance: planning-stage scope baseline. Same file.

- [ ] APPROVE / [ ] STRIKE — G10-3 (field review at any stage):
```quote src=FHWA-SA-06-006_RSA_Guidelines_2005.txt
The field review is a key task that the RSA team should undertake in all audits.
```
Proposed acceptance: field-review universality baseline. Same file.

## Ratification

Owner: check one box per line above, then sign: `RATIFIED-BY: ________ DATE: ________`
Counts: GF-6: 3, GF-7: 3, GF-8: 3, GF-9: 8, GF-10: 3 (20 candidates, 7 distinct source files, all CLEAR).
