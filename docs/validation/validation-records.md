# Validation Records — technical + domain (§38)

## VAL-TECH-001 · 2026-08-22 · ORCH

- **Scope:** Determinism (§31)
- **Method:** Byte-equality of `runAudit` outputs across all five golden fixtures; CI
  evidence-registry determinism gate (`compile → git diff --exit-code`).
- **Result:** PASS — identical inputs produce byte-identical results modulo injected clock.

## VAL-TECH-002 · 2026-08-22 · ORCH

- **Scope:** Full CI chain
- **Method:** `npm run ci` (lint → typecheck → vitest 43/43 → next build) locally AND on
  GitHub Actions runners.
- **Result:** PASS both.

## VAL-DOMAIN-001 · 2026-08-22 · ORCH

- **Scope:** Stage semantics behave per jurisdiction (§38 domain list)
- **Method:** Engine tests + golden fixtures:
  - UK: no Stage 0 selectable; Stage F explicitly foreign [EV-UK-004/022] ✅
  - USA: named phases, interpreted mapping confidence, never "US Stage N" ✅
  - Canada: TAC planning→FEASIBILITY_CONCEPT authoritative via Alberta table ✅
  - UAE: combined S1/2 spans two canonical points (jurisdiction-flagged) ✅
  - INT: qualified-baseline wording enforced; no compliance-with-a-standard claims ✅
- **Result:** PASS.

## VAL-DOMAIN-002 · 2026-08-22 · ORCH

- **Scope:** Compliance ≠ safety
- **Method:** Structural assertion across every fixture: deterministic engine emits zero
  `safety_concern` findings. Safety concerns can only enter through human review or
  labelled AI candidates.
- **Result:** PASS.

## VAL-DOMAIN-003 · 2026-08-22 · ORCH

- **Scope:** Missing / conflicting / insufficient data paths
- **Method:** Fixtures exercise provided / unknown / not_applicable / not_available states;
  missing required inputs surface as MissingInformationQuestion with cited evidence;
  process gaps become draft compliance questions requiring human adjudication.
- **Result:** PASS.

## VAL-DOMAIN-004 · 2026-08-22 · ORCH

- **Scope:** Report generation
- **Method:** Markdown renderer output asserted to contain metadata, reviewed-information
  states, findings w/ provenance, missing information, questions, limitations and the
  professional-responsibility disclaimer. JSON export is the schema-shaped AuditResult.
- **Result:** PASS.
