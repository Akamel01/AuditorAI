---
title: Candidate review UX — promotion model (ADR-0006 / DEC-0007)
type: journal
date: 2026-08-23
owner: agent
---

Grilled Flag #2 with the owner, then implemented the decided semantics on
feat/candidate-review. Decisions: distinct species (never a shared status);
acceptance promotes into an F-AI-* Finding with minted identity and recorded
provenance; rejection drops; wording gate applies to edited recommendations
with full parity to deterministic findings; candidates are per-run work items
(reruns replace them, retention comes from issuing per ADR-0004); issuance
over unreviewed candidates succeeds loudly via a limitation line in the frozen
snapshot only.

Shape: zero pipeline changes — production review already happens post-pipeline
on the stored draft, so promotion rides the existing PATCH surface. New pure
module domain/candidate-review.ts (table-tested: id minting, gate parity,
index-stable batches, purity); AuditResult gained optional candidate_findings
(deterministic results never set it → goldens byte-stable); live path attaches
the validated slice to the returned result; audit page renders candidate cards
mirroring the findings cards; issues route strips pending candidates from the
snapshot and names their count under limitations.

Surprises worth keeping:

1. The owner committed their ODD formalization (ADR-0005 / DEC-0006) onto the
   same feature branch mid-session — deliberate number claim, so candidate
   promotion was renumbered ADR-0006 / DEC-0007 and their fresh glossary
   citations were corrected accordingly. Registry order is authoritative for
   ADR numbering.
2. The old merge-table lesson repeated: two existing byte-equality tests
   constrained the design (zero-candidate live path must stay identical),
   which forced conditional field attachment instead of always-present keys.
3. Batch promotions apply highest-index-first so callers can reference the
   pending list exactly as rendered — splice shifting would otherwise corrupt
   multi-select review.
