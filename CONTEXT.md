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

**Audit** — the audit effort for one Scheme at one Native Stage within a Project: a
mutable working record (Draft) whose current results are replaced on each Run until
issued. Issuing freezes an immutable, numbered Audit Issue; later Runs never alter
issued issues. (Decision DEC-0005; supersedes the earlier "single execution" wording.)

**Run** — a single execution of the Road Safety Audit process for an Audit. Reruns
replace the Draft's results depth-1; they never modify an issued Audit Issue.

**Audit Issue** — an immutable, numbered snapshot of an Audit's results at the moment
of issuance, retained permanently as the formal record of what was reported.

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

**Candidate** — an AI-proposed finding awaiting auditor review. A species distinct
from Finding: it is never itself a report member and never reaches one by passive
means. Candidates are per-run work items on a draft; a rerun replaces them like any
other unissued result. (Decision 2026-08-23; ADR-0006.)

**Promotion** — the explicit act by which the Auditor turns a Candidate into a
Finding: identity is minted at promotion, provenance is recorded, and the wording
discipline applies exactly as it does to any other finding edit. Rejection drops
the Candidate without minting anything.

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

**Input State** — the status of a Project input relative to its requirement level:
level-derived missing states (`required_missing` etc.) when nothing is recorded,
`provided` only when substantiated by an actual value or attachment, and explicit
`unknown` / `not_available` declarations. A `provided` claim without substance is
invalid at intake and treated as missing wherever encountered. (Decision 2026-08-23.)

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

## System boundary

**Operational Design Domain (ODD)** — the explicitly declared envelope within which the
system's audit capability is designed, proven, and claimed: a capability matrix of Framework
× Canonical Stage cells, each qualified by an Input Floor, Road-User coverage inherited from
this glossary, and the framework's own native scheme applicability. Adapted from
driving-automation standards practice (SAE J3016 lineage); its conditions are documentary and
normative, never sensed physical states. Capability claims hold only inside the domain.
(Decision 2026-08-23; ADR-0005.)

**ODD Cell** — one Framework × Native Stage position in the matrix: IN (accepted mapping +
gate-passing fixture), mapped-unproven (mapping without proof — runs allowed but stamped),
or structurally absent (the framework defines no such audit — no run may claim it).
_Avoid_: supported-jurisdiction list

**Input Floor** — the minimum classes of project material an ODD cell presumes; below it the
capability claim does not apply at all. Distinct from Input State degradation, which governs
valid-but-thinner runs above the floor.

## Sample corpus

**Audit Sample** — a provenance-recorded set of real-world road-safety-audit artifacts:
inputs (scheme description, drawings, traffic data, site photos) and/or outputs (findings
report, checklists, recommendations, designer response). Distinct from synthetic corpus
fixtures, which are authored to a schema rather than harvested.

**Consumer Role** — one of four canonical assignments of an Audit Sample: Engine Few-shot,
Judge Calibration, ODD Proof, Release Test. Roles describe how a sample is *consumed*, not
what it is; one sample may hold several roles over time within the Firewall.

**Engine Few-shot** — samples consumed as exemplars inside engine or judge prompts.

**Judge Calibration** — samples consumed to tune or interrogate judge rubric behaviour.

**ODD Proof** — samples convertible into gate-passing fixtures, the only currency that moves
a mapped-unproven ODD cell to IN. Excerpt-grade material cannot be ODD Proof.

**Release Test** — held-out samples whose judged results gate release, drawn only from
samples never previously consumed by Engine Few-shot or Judge Calibration work.

**Firewall** — the prohibition on one Audit Sample serving Release Test together with Engine
Few-shot or Judge Calibration. Same-programme sample clusters (e.g., successive audits of
one trunk-road scheme) should not straddle it even where individually permitted.
(Decision 2026-08-23; ADR-0007.)

**Reserve Corpus** — Audit Samples outside every current ODD cell (e.g., in-service /
existing-road inspections), held untouched for future domain expansion rather than assigned.

## Discovery & corpus growth

The acquisition pipeline that grows the Sample corpus toward representativeness.
Vocabulary here governs `src/discovery/**` and `state/discovery-ledger.json`; it composes
with §Sample corpus (a Project Package becomes an Audit Sample only at catalog time).

**Discovery Hit** — a single discovered document URL with its source type, provider,
licence hint, and retrieval metadata. A Hit is *not* evidence of scope or quality; those
are later, separate determinations.

**Project Package** — the fundamental acquisition unit: one real scheme's paired inputs
and outputs assembled as a unit (metadata; drawings and supporting documents; RSA report,
checklist, designer response) plus full provenance. Packages establish
*real project inputs → real RSA audit outputs*; isolated reports do not.

**Package Completeness** — the same closed vocabulary as sample completeness
(full-package / outputs-only / inputs-only / excerpt), derived from which package members
were actually acquired. Never inferred beyond what was retrieved.

**ODD Coverage Score** — the representativeness measure over collected packages against
the ODD matrix: per-cell targets weighted by gap and risk (mapped-unproven and fragile
single-fixture cells rank higher; structurally absent cells are excluded by construction).
Yields COVERED / UNDER-COVERED / MISSING / OVER-REPRESENTED labels and drives discovery
priorities. The goal is representative coverage, not raw count.

**Discovery Queue** — the ranked list of next discovery themes produced from the ODD
Coverage Score. Purely derived; recomputed, never hand-edited.

**Tier-1 Licensed Source** — a paywalled or restricted source obtainable only via owner
purchase. Case-by-case approval is required before its material may leave reserve;
approval is recorded, never assumed.

## System contracts

**Audit Context** — the assembled bundle an audit runs against: project inputs, selected
Jurisdiction/Framework/Native Stage, applicable policy-pack questions, and evidence set.

**Audit Contract** — the declared input/output obligations for an audit run (which inputs
are required/recommended/optional for this framework+stage, what outputs must exist).

**Audit Artifact** — any versioned, attributable output of an audit node (input manifest,
candidate findings, adjudicated findings, reports), carrying producer, version, and
validation status.
