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

**Harvest Lease** — the single cross-instance claim that gates a discovery harvest run, held in KV as `harvest:lock` via `SET NX EX 120` and released only by its holder. Global per deployment, 120 s TTL, holder-guarded non-atomic release (`ponytail:` per-cell locks if throughput matters).
_Avoid_: distributed lock (generic), per-workspace lock, mutex.

**Ledger Entry** — the durable truth of a discovery ledger fact: `discovery:ledger:entry:{seq}` holds one `LedgerEntry` JSON. Exists independent of the index.

**Ledger Index** — the best-effort hint `discovery:ledger:index` listing seqs in order, trimmed to 500. Last-write-wins under concurrent appends; healed on read by orphan prune + KEYS-scan merge. `ponytail:` atomic EVAL if strict ordering proves required.
_Avoid_: ledger table, ledger log (implies total order guarantee).

**Dedupe Index** — the set of URL hashes already acquired, keyed `discovery:dedupe:index` in KV (truth) with `state/dedupe-index.json` as file-seed fallback and best-effort mirror (warn on ROFS). Load KV-first; persist KV-first.
_Avoid_: dedupe table (implies DB), dedupe cache (implies eviction).

**Harvest Health** — the derived `harvestHealth` sub-object in `GET /api/dev/health`: `lastRunAt/lastStatus/lockHolder/lockAcquiredAt:null/indexedCount` from `getLedgerTailKV` + `jobs.listLatest` + `harvest:lock` holder string. Honest nulls when KV unavailable.
_Avoid_: harvest monitor, topology health (broader).

**Job Cancellation** — the idempotent `POST /api/dev/discovery/:jobId/cancel` (x-admin-key) that marks `queued|running → cancelled` via `updateJob`; `executeJob` checks `getJob` before each node and short-circuits with `cancelled` sentinel and `D00-CANCELLED` log. Repeated cancels on terminal jobs are no-op 200s.
_Avoid_: job abort, harvest pause (implies resumable).

**Gap-Targeted Harvest** — a harvest invoked with explicit `cellKey` (e.g. `usa:DETAILED_DESIGN`) that claims to acquire for that ODD cell. Succeeds only when ledger contains `package.assemblies` for *that* `cellKey`; a package for another cell is `Degraded` (HV5).
_Avoid_: targeted harvest (vague), gap harvest (implies gap-aware)

**Gap-Aware Harvest** — a harvest invoked with `cellKey=null` that selects `gaps_ranked.slice(0,3)` themes, runs `D01..D10`, and recomputes `coverage.gaps_ranked` (`generated==ranAtIso`) and `queue[0..2]`. Ledger may gain `0..N`; `0` with recomputed gaps is still `Success` (HV5).
_Avoid_: auto harvest, harvest all (implies unbounded)

**Harvest Success** — job `done`, `D01..D10` complete (22 logs `D00-QUEUED×2→D10`), ledger `+≥1` for intended cell(s) (gap-targeted exact `cellKey`, gap-aware any `0..N`), `coverage` for that cell `have_total`↑ *or* refusal with reason recorded, `dedupe delta == packages` (no double-count), `health.lastRunAt==ranAtIso`. `Degraded` is still `Success` if ledger/refusal correctly recorded.
_Avoid_: harvest passed (implies no nuance)

**Harvest Degraded** — job `done` but a provider was unavailable (`health_degraded:true`, `brave-search 402 Usage limit exceeded`) or seed-only fallback produced a package for a different cell than requested. Ledger is correctly *unmutated* or mutated for another cell, error is surfaced via `gapRunError`/`runError`, not silent. Dry runs must never be `Degraded`.
_Avoid_: harvest failed (implies no ledger), soft fail

**Harvest Skipped (Busy)** — `POST 202` then job `error` `harvest lock held` (`harvest:lock` holder busy), ledger `+0`, no `D01..D10` beyond `D00`, error surfaced as `error` with `lock held` string (HV5). Distinct from `Degraded`.
_Avoid_: harvest skipped (implies intentional), lock error (vague)

**Harvest Dry vs Live** — `Dry` (`live:false`) uses `seed-portals` only, never touches quota, never `health_degraded`. `Live` (`live:true`) may call `brave-search` and may `402`; `Dry` mock (`MemoryStore`) deterministically yields `1` package `usa:PRELIMINARY_DESIGN` for CI oracle.

## System contracts

**Audit Context** — the assembled bundle an audit runs against: project inputs, selected
Jurisdiction/Framework/Native Stage, applicable policy-pack questions, and evidence set.

**Audit Contract** — the declared input/output obligations for an audit run (which inputs
are required/recommended/optional for this framework+stage, what outputs must exist).

**Audit Artifact** — any versioned, attributable output of an audit node (input manifest,
candidate findings, adjudicated findings, reports), carrying producer, version, and
validation status.
