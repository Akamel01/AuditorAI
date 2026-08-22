---
id: G2
title: Canonical stage model + normalization semantics
type: grilling
hitl: true
status: closed
assignee: orchestrator (delegated authority — owner directed continuous execution)
blocked_by: [R1, R2, R3, R4, R5]
blocks: [G4]
created: 2026-08-22
resolved: 2026-08-22
---

## Question

Given research evidence: define the canonical internal stage model (approximately
0=FEASIBILITY/CONCEPT, 1=PRELIMINARY DESIGN, 2=DETAILED DESIGN), the native→canonical
mapping rules per jurisdiction/framework, the confidence vocabulary (e.g.
authoritative/interpreted/inferred), and how exceptions are represented (UK having no
Stage 0; UAE Stage 1/2 combination for smaller schemes). Never presented as universal.

## Resolution

Resolved by ORCH under delegated authority (owner instructed continuous execution,
2026-08-22), grounded in evidence:

1. Canonical stages: `FEASIBILITY_CONCEPT` / `PRELIMINARY_DESIGN` / `DETAILED_DESIGN`;
   internal key only, always displayed with Native Stage + confidence.
2. Native stage ids jurisdiction-namespaced (`uk:S1`, `us-fhwa:planning`, `ae-ad:S1_2`);
   bare integers forbidden [EV-CA-006 collision proof].
3. Confidence: `authoritative | interpreted | inferred`.
4. Exceptions as first-class data: UK × FEASIBILITY_CONCEPT = NO_NATIVE_EQUIVALENT with
   interim-RSA alternative [EV-UK-004/005]; UAE combined Stage 1/2 covers two canonical
   points [EV-AE-012]; Dubai framework Unknown.

Full mapping tables: `docs/research/stage-normalization.md`. Decision: ADR-0002.
