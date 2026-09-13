schema_version: 1.0.0

# Corpus taxonomy & metadata schema (jurisdiction × stage × type × tier)

This document defines the human contract for the corpus taxonomy and the axes used to classify catalog records. It aligns with HARVESTING_PLAN.md anchors and the odd.json canonical stages.

Axes and values (high level)
- jurisdiction: UK, USA, CA, AE, INT, plus CA-province where applicable (see ca_province below).
- ca_province: BC, AB, ON, QC, MB, NB, NL, NS, PE, SK, YT, NT, NU (only meaningful when jurisdiction is CA).
- stage: PRELIMINARY_DESIGN, DETAILED_DESIGN, FEASIBILITY_CONCEPT (values drawn from policies/odd.json canonical_stages).
- doc_type: guide | case-study | complete-RSA | prompt-list | policy | toolkit | presentation | correspondence
- tier: T0, T1, T2, T3, T4 (per HARVESTING_PLAN.md §1) with worked anchors.
- anchors: map of anchor_name -> anchor_value (describes the anchor that ties to tier/stage across archives).

Anchor work and worked examples
- Anchors used in this schema (examples):
  - UNB Route 1000 -> T3 (UNB Route 1000 anchor maps to tier T3)
  - TAC -> T1-aggregated (Tac anchor maps to tier T1-aggregated)
  - BC_guidelines -> methodology_anchor (BC guidelines anchor demonstrates the methodology anchor link)
  - ANCHOR-4 -> anchor-for-extra-context

Worked examples (4 anchors)
- Example A: UK primary record
  jurisdiction: UK
  ca_province: N/A
  stage: PRELIMINARY_DESIGN
  doc_type: guide
  tier: T3
  anchors:
    UNB Route 1000: "T3"

- Example B: USA record with TAC anchor
  jurisdiction: USA
  ca_province: null
  stage: DETAILED_DESIGN
  doc_type: case-study
  tier: T1
  anchors:
    TAC: "T1-aggregated"

- Example C: CA record using province axis and BC guidelines anchor
  jurisdiction: CA
  ca_province: BC
  stage: FEASIBILITY_CONCEPT
  doc_type: policy
  tier: T2
  anchors:
    BC_guidelines: "methodology_anchor"

- Example D: INT with 4th anchor
  jurisdiction: INT
  ca_province: null
  stage: PRELIMINARY_DESIGN
  doc_type: toolkit
  tier: T0
  anchors:
    ANCHOR-4: "anchor-for-extra-context"

Ambiguities and decisions
- Ambiguity: when jurisdiction is CA, ca_province must be provided. Decision: ca_province is required for CA jurisdiction (see examples C). When jurisdiction is not CA, ca_province is optional.
- Ambiguity: exact stage naming in odd.json. Decision: accept the canonical stages PRELIMINARY_DESIGN, DETAILED_DESIGN, FEASIBILITY_CONCEPT as valid values.
- Ambiguity: doc_type allowed list. Decision: fixed 8 values as defined above; add or retire only via this contract.

Notes on imports
- Odd canonical stages are sourced from policies/odd.json (read-only). This document uses those three canonical stages as the valid set here, but can be extended if needed.

Schema version reference
- This file serves as the human contract for the catalog schema. See docs/RSA-Documents/corpus-schema.json for the machine-parseable validator.
