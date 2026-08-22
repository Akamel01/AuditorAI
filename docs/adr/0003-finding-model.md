# ADR-0003: Finding model — two categorically distinct kinds; null-safe framework-relative risk; enforced recommendation discipline

- **Status:** Accepted
- **Date:** 2026-08-22
- **Decided in:** Wayfinder ticket [G4-finding-risk-model](../../workflow/wayfinder/maps/mvp/tickets/G4-finding-risk-model.md)
- **Evidence:** `docs/research/*.md` (esp. EV-UK-015/016/024, EV-US-016/017, EV-CA-021)

## Context

Jurisdictions diverge on risk scoring (UK assigns none in GG 119 [EV-UK-024]; US uses an
optional frequency×severity matrix [EV-US-016]; Ontario municipal guidance has its own
[EV-CA-021]), and RSA is categorically not a compliance check. The §28 seed Finding shape
needed sharpening before implementation.

## Decision

1. Two distinct finding kinds: `safety_concern` and `compliance_question`. They never
   merge; passing compliance checks never implies safety.
2. Risk components (`severity`, `likelihood`, `exposure`) are **structured labels that may
   be null**, each tagged with the framework scale id when present. UK mode renders nulls
   as "not scored under this framework" — the system never invents scores.
3. Recommendation discipline is canonical: recommendations must state a specific,
   proportionate, viable measure; the banned-vague-word rule UK practice applies
   ("consider", "must" [EV-UK-015]) is enforced by validation for all jurisdictions.
4. Reviewer workflow statuses: `draft → accepted | accepted_with_edits | rejected`
   (+ `escalated`), mirroring designer-response reality [EV-UK-016].
5. Missing information is a separate artifact type (`MissingInformationQuestion`), feeding
   input states — it is not a finding.
6. AI nodes may emit only bounded candidate artifacts; only adjudication + human review
   produce final findings.

## Consequences

- Cross-jurisdiction report comparison stays honest (scores are comparable only within a
  declared scale).
- Deterministic validation can enforce recommendation wording without jurisdictional
  special-casing.
