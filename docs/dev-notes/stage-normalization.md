---
title: Stage normalization — canonical model and native mappings
ticket: G2
type: synthesis
status: accepted
evidence_basis: state/evidence-registry.json (114 records)
date: 2026-08-22
---

# Stage Normalization

Synthesis of R1–R5 research into the canonical internal stage model. Every mapping cites
evidence records; confidence uses the canonical vocabulary
`authoritative | interpreted | inferred`. **Canonical stages are an internal indexing
device only — never presented as universal RSA semantics** (the UI must always show the
Native Stage alongside).

## 1. Canonical model (MVP)

```text
FEASIBILITY_CONCEPT   — before/preliminary-design commitment: need, options, concept choice
PRELIMINARY_DESIGN    — preferred option developed to a fixed preliminary design
DETAILED_DESIGN       — construction-ready detailed design
```

Extensibility: the enum is open-ended by design (`POST_OPENING`, `CONSTRUCTION`,
`WORK_ZONE`, `IN_SERVICE` are anticipated next entries; MVP scope stops at detailed
design per project brief §1).

## 2. Namespace rule (hard requirement)

Bare stage numbers are forbidden as identifiers anywhere in the system. Native stage IDs
are always jurisdiction-qualified (`UK-S1`, `US-PHASE-PRELIM`, `CA-AB-S3`,
`AE-AD-S0`). Evidence: Alberta's "Stage 3" = detailed design collides with UK's "Stage 3"
= post-construction monitoring [EV-CA-006, EV-UK-002]; FHWA's numbered prompt lists are
checklist identifiers, not stages [EV-US-006].

## 3. Mappings

### International — PIARC-derived qualified baseline

| Native | Canonical | Confidence | Evidence |
|---|---|---|---|
| Feasibility / concept check | FEASIBILITY_CONCEPT | interpreted | PIARC frames RSA within RISM across project development; UN Global Plan KPI expects audits from pre-feasibility to detailed design [EV-IN-001][EV-IN-010] |
| Preliminary design audit | PRELIMINARY_DESIGN | interpreted | same basis |
| Detailed design audit | DETAILED_DESIGN | interpreted | same basis |

No authoritative international standard exists [EV-IN-001..008]; the framework ships as
an explicitly qualified baseline.

### United Kingdom — DMRB GG 119 v2.0.1 (2025-04-30)

| Native | Canonical | Confidence | Evidence |
|---|---|---|---|
| Stage 1 (completion of preliminary design) | PRELIMINARY_DESIGN | authoritative | clause 1.3/5.17–5.19 [EV-UK-002][EV-UK-008] |
| Stage 2 (completion of detailed design) | DETAILED_DESIGN | authoritative | clauses 5.20–5.24 [EV-UK-002][EV-UK-009] |
| Interim RSA (any time) | *no canonical equivalent* | interpreted | neither mandatory nor stage-substituting; Overseeing Organisation decides [EV-UK-005] |
| *(no native feasibility/concept stage)* | FEASIBILITY_CONCEPT | **no mapping** | full-text search found no Stage 0/"Stage F"; four-stage list exhaustive [EV-UK-004][EV-UK-022] |

Stage 3/4 exist natively but are outside MVP scope (architecture extends).

### United States — FHWA RSA guidance

US practice names **project phases**, not stages; one phase-independent eight-step process
[EV-US-003][EV-US-006]. Mapping is therefore inherently interpretive:

| Native (phase) | Canonical | Confidence | Evidence |
|---|---|---|---|
| Planning Stage Audit | FEASIBILITY_CONCEPT | interpreted | prompt-list architecture of FHWA-SA-06-06 [EV-US-006] |
| Preliminary Design Stage Audit | PRELIMINARY_DESIGN | high-interpreted | same [EV-US-006] |
| Final Design Stage Audit | DETAILED_DESIGN | interpreted | same [EV-US-006] |
| Work Zone / Pre-Opening / Existing Road / Land Use Dev audits | out of MVP scope | — | [EV-US-006][EV-US-015] |

Never rendered as "US Stage N" — native labels always shown.

### Canada — TAC CRSAG + provincial instruments

| Native | Canonical | Confidence | Evidence |
|---|---|---|---|
| TAC Planning stage (Alberta: Stage 1) | FEASIBILITY_CONCEPT | authoritative (provincial) | Alberta equivalency table quoting TAC [EV-CA-005][EV-CA-006][EV-CA-027] |
| TAC Preliminary Design (Alberta: Stage 2) | PRELIMINARY_DESIGN | authoritative (provincial) | [EV-CA-006][EV-CA-027] |
| TAC Detailed Design (Alberta: Stage 3) | DETAILED_DESIGN | authoritative (provincial) | [EV-CA-006][EV-CA-027] |
| Pre-opening | out of MVP scope | — | [EV-CA-027][EV-CA-008] |

Framework note: national CRSAG text is paywalled (recorded); operative provincial
instruments carry mandatory force within their ministries [EV-CA-003][EV-CA-004].
Ontario municipal practice uses Austrows-style named stages [EV-CA-018–021].

### UAE — Abu Dhabi (DMT RSAM 1st Ed. Jan 2018 / QCC TR-540)

| Native | Canonical | Confidence | Evidence |
|---|---|---|---|
| Stage 0 (feasibility / conceptual) | FEASIBILITY_CONCEPT | authoritative | [EV-AE-001][EV-AE-004] |
| Stage 1 | PRELIMINARY_DESIGN | authoritative | manual stage definitions [EV-AE-001] |
| Stage 2 | DETAILED_DESIGN | authoritative | manual stage definitions [EV-AE-001] |
| Combined Stage 1/2 (smaller schemes) | spans PRELIMINARY_DESIGN+DETAILED_DESIGN | authoritative exception | single combined report explicitly permitted [EV-AE-012] |

All Abu Dhabi semantics are Emirate-specific; Dubai contents unverified, other Emirates
unknown [EV-AE-025].

## 4. Exception representation (first-class data)

Exceptions are data on the native-stage record, never special-case code:

```jsonc
{
  "id": "AE-AD-S12-COMBINED",
  "kind": "combined_audit",
  "spans": ["AE-AD-S1", "AE-AD-S2"],
  "condition": "smaller schemes per manual criteria",
  "evidence": ["EV-AE-012"]
}
```

Kinds observed in research: `combined_audit` (UAE), `interim_audit_not_a_stage` (UK),
`no_equivalent_native_stage` (UK vs FEASIBILITY_CONCEPT), `named_phase_not_numbered_stage`
(USA). Product behavior reads these flags; it never hardcodes them.

## 5. Cross-jurisdiction conflicts register

1. **Same number, different meaning** — Alberta S3 ≠ UK S3 [EV-CA-006 vs EV-UK-002]. → namespace rule.
2. **Stages vs phases** — US has no numbered stages [EV-US-006]; UK enumerates exactly four [EV-UK-004]. → US UI shows phase names; mapping confidence downgraded accordingly.
3. **Feasibility auditing** — native and expected in Abu Dhabi (S0) and TAC planning; absent in UK national standard [EV-AE-004, EV-UK-004]. → availability differs per framework; never implied.
4. **Combined audits** — sanctioned combination exists in Abu Dhabi (S1/2) and, differently, UK allows combining S1+S2 where no preliminary design occurred [EV-UK-008]; modeled via one mechanism (`combined_audit`) with jurisdiction-specific conditions.
