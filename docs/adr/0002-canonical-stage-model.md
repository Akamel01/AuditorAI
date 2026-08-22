# ADR-0002: Canonical stage model is a three-point internal key with namespaced native stages and first-class exceptions

- **Status:** Accepted
- **Date:** 2026-08-22
- **Decided in:** Wayfinder ticket [G2-canonical-stage-model](../../workflow/wayfinder/maps/mvp/tickets/G2-canonical-stage-model.md)
- **Evidence:** `docs/research/stage-normalization.md` (cited throughout)

## Context

"Stage N" has no cross-jurisdiction meaning (Alberta Stage 3 = detailed design vs UK
Stage 3 = post-construction [EV-CA-006]); the UK has no feasibility audit at all
[EV-UK-004]; US practice uses named phases with one phase-independent process [EV-US-006];
Abu Dhabi natively includes Stage 0 and permits combined Stage 1/2 audits [EV-AE-004,
EV-AE-012]. The product needs to organize work across jurisdictions without silently
harmonizing them.

## Decision

1. Canonical internal stages: `FEASIBILITY_CONCEPT`, `PRELIMINARY_DESIGN`,
   `DETAILED_DESIGN` — an internal comparison key only, always shown alongside the Native
   Stage name and mapping confidence; enum extensible toward later stages.
2. Native stage identifiers are **jurisdiction-namespaced strings** (`uk:S1`,
   `us-fhwa:planning`, `ae-ad:S1_2`) — bare integers are forbidden in data.
3. Mapping confidence uses exactly three labels: `authoritative | interpreted | inferred`.
4. Exceptions are data, not code paths: combined audits (`covers_canonical` arrays),
   `NO_NATIVE_EQUIVALENT` statuses with named alternatives (UK × feasibility → interim RSA),
   per-framework availability flags (Dubai = Unknown).

## Consequences

- UI can never present Stage 0 as a neutral default (the UK proves it isn't).
- Cross-jurisdiction comparisons are explicit, labelled, and traceable to evidence ids.
- Adding a jurisdiction = adding policy-pack data, not changing engine logic.
