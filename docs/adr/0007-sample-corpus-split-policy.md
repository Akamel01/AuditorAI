# ADR-0007: Sample corpus split policy — per-consumer roles, sample-level firewall, synthetic-only release test

- Status: Accepted
- Date: 2026-08-23
- Deciders: owner (live grilling T3.3), ORCH
- Context artifacts: `policies/odd.json` (ADR-0005), `tests/fixtures/samples/README.md`,
  `CONTEXT.md` §Sample corpus, eval-gates §2/§3

## Context

The Phase-2 collection campaign produced a real-sample audit corpus (37 cataloged,
27 PDFs) intended for "training and calibration and validation and testing" of the
readiness framework. Those four words are ML vocabulary; AuditorAI is deterministic-first
with no gradient training. The corpus also skews ~60% in-service/existing-road material,
which sits outside every ODD cell. Assigning samples without fixed semantics risked silent
leakage (samples consumed by prompt or rubric work later gating their own release) and
accidental capability claims beyond the ODD.

## Decision

1. **Roles are per-consumer, not per-artifact.** Four canonical consumers exist:
   Engine Few-shot, Judge Calibration, ODD Proof, Release Test. One sample may hold
   several roles over time.
2. **Firewall (sample-level).** No sample may serve Release Test together with Engine
   Few-shot or Judge Calibration. Same-programme clusters (the Transport Scotland A9
   slice, INT-004..007) carry a soft co-assignment caution even where individually legal.
3. **In-service material is Reserve Corpus.** Held untouched for a future in-service
   inspection domain; never assigned to the four roles while outside all ODD cells.
4. **Release-test stays synthetic this phase.** GF-6..10 remain the only release-gating
   fixtures until the corpus reaches the owner's 100+ target; real samples flow to
   engine/judge/ODD-proof roles meanwhile.
5. **Assignment is rule-based auto + owner-arbitrated exceptions**, encoded in
   `state/sample-corpus.json`; every assignment cites its rule id.
6. **UAE mapped_unproven cells stay unproven** pending authentic worked-example material
   (ADG-18 annexes); excerpt-grade samples cannot be ODD Proof.

## Auto-assignment rules (v1)

- R1 reserve: completeness = excerpt/outputs-only AND native stage outside all ODD cells → Reserve Corpus.
- R2 engine-fewshot: full-package AND native stage inside an ODD IN cell.
- R3 judge-calibration: outputs-only/excerpt inside an IN or target cell of an active proof effort.
- R4 unassigned: manuals/reference-grade documents already mined into the evidence registry.
Ties and edge cases → exception queue with owner arbitration.

## Consequences

- Judge scores on synthetic GF fixtures cannot be inflated by prompt-consumed real samples;
  when a real-sample test tier exists it will draw from firewall-virgin stock only.
- The A9 slice must be treated as one leakage unit despite five sample ids.
- UAE proof work now has a concrete unblock: obtain ADG-18 annexes (owner action), convert
  to fixture, pass Tier-1 — quotes alone (EV-AE-029..036) deliberately do not suffice.
- Growth toward 100+ must log provenance at harvest time so rule-based assignment stays
  deterministic and auditable.
