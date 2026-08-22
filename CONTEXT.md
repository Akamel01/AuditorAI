# CONTEXT.md — canonical domain glossary

Implementation-free. If code or docs use a term differently than defined here, one of them
is wrong — resolve explicitly. Terms are sharpened through Wayfinder grilling tickets; each
definition cites the evidence that shaped it where applicable.

## Core nouns

**Project** — the umbrella record for one auditing effort: metadata, selected Jurisdiction,
Framework, and Stage, plus all inputs and resulting Audits.

**Scheme** — the physical road intervention being audited (a proposed change, new road, or
modification). A Project audits exactly one Scheme. (UK GG 119 uses "highway scheme";
US practice speaks of "the project or existing road" [EV-US-001] — same concept, native
vocabularies preserved per jurisdiction.)

**Audit** — a single execution of the Road Safety Audit process for a Project at a chosen
Stage, producing Findings and a report.

**Road Safety Audit** — a formal, independent examination of a road scheme's safety
performance by qualified people who did not design it, evaluating collision risk for all
road users and recommending mitigations. Not a compliance inspection [EV-US-001, EV-CA-003].

## Jurisdictional structure

**Jurisdiction** — the legal/practice territory whose rules govern an Audit: International
(qualified baseline), United Kingdom, United States, Canada, United Arab Emirates.

**Framework** — the named authoritative body of practice within a Jurisdiction whose rules
apply (e.g., UK: DMRB GG 119; USA: FHWA RSA guidance; Canada: TAC CRSAG + provincial
instruments; UAE Abu Dhabi: DMT Road Safety Audit Manual / QCC TR-540; International:
qualified PIARC-derived baseline).

**Stage** — the lifecycle point at which an Audit occurs. Always presented as **Native
Stage** in jurisdiction terms; "Stage N" bare numbers have NO cross-jurisdiction meaning
[EV-CA-006: Alberta Stage 3 = detailed design ≠ UK Stage 3 = post-construction].

**Native Stage** — a stage as actually defined by its Framework (e.g., UK Stage 1 =
completion of preliminary design [EV-UK-002]; US has no numbered stages, only named project
phases [EV-US-006]; Abu Dhabi Stage 0 = feasibility/conceptual with permitted combined
Stage 1/2 audits for smaller schemes [EV-AE-004, EV-AE-012]).

**Canonical Stage** — AuditorAI's internal normalized lifecycle point used to compare and
organize work across jurisdictions:
`FEASIBILITY_CONCEPT` → `PRELIMINARY_DESIGN` → `DETAILED_DESIGN`.
A mapping convenience only — never shown as universal RSA semantics, always alongside its
Native Stage and mapping confidence.

## Audit content

**Finding** — a typed, reviewable statement produced by an Audit: a safety concern or
compliance question about the Scheme, with location, affected road users, evidence,
risk characterization, recommendation, and reviewer status.

**Hazard** — a condition of the Scheme or its environment with potential to contribute to
harmful outcome for road users.

**Safety Concern** — a potential road-safety problem identified through reasoning about
hazards, road users, and scenarios. The substance of a safety Finding.

**Compliance** — consistency with an applicable normative requirement of the selected
Framework. A compliance finding records a possible inconsistency; it is categorically
distinct from a Safety Concern, and passing checks never implies safety.

**Evidence** — recorded information supporting a claim: cited standards clauses, project
data, research literature, or site observations. Every normative claim carries registry
provenance.

**Inference** — reasoning derived from evidence (e.g., "sight lines restricted by furniture
obscuring conflicting movements"). Labelled as derived; distinguishable from quoted evidence.

**Recommendation** — a proportionate, viable suggested mitigation attached to a Finding.
UK practice forbids vague wording ("consider") in recommendations [EV-UK-015]; the product
enforces equivalent discipline canonically.

## Risk language

**Risk** — the combination of likelihood/severity associated with a hazard–user–scenario.
Scales are Framework-specific where frameworks define them; the canonical model stores
structured components rather than a single universal score.

**Exposure** — the degree to which road users encounter the hazard scenario (frequency/
volume dimension of risk).

**Severity** — the plausible harm level if the scenario occurs (framework-specific scale;
GG 119 itself assigns none [EV-UK-024]; US practice uses optional frequency×severity
matrices [EV-US-016]).

**Confidence** — the system's explicit uncertainty label on mappings, evidence, and
findings (e.g., authoritative / interpreted / inferred). Never hidden from the user.

## People & roles

**Auditor** — the qualified professional performing/concluding the Audit. Software assists;
final professional responsibility remains with the auditor and the Authority.

**Designer** — the party responsible for the Scheme's design, who responds to audit
Findings (UK: response report with accept / accept-with-alternative / disagree + decision
log [EV-UK-016]).

**Authority** — the organization commissioning/governing the Scheme and audit process
(UK Overseeing Organisation; US project owner; provincial ministry; road authority).

**Road User** — any person using the transport environment: drivers, motorcyclists,
cyclists, pedestrians, horse riders, passengers.

**Vulnerable Road User (VRU)** — road users disproportionately exposed to harm:
pedestrians, cyclists, motorcyclists, and similar.

## System contracts

**Audit Context** — the assembled bundle an audit runs against: project inputs, selected
Jurisdiction/Framework/Native Stage, applicable policy-pack questions, and evidence set.

**Audit Contract** — the declared input/output obligations for an audit run (which inputs
are required/recommended/optional for this framework+stage, what outputs must exist).

**Audit Artifact** — any versioned, attributable output of an audit node (input manifest,
candidate findings, adjudicated findings, reports), carrying producer, version, and
validation status.
