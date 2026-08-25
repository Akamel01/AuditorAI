# ADR-0013: Continuous improvement loops & the immutable Phase-4 fine-tune gate

- Status: Accepted
- Date: 2026-08-25
- Deciders: owner (live grilling, learning-architecture wave), ORCH
- Context artifacts: ADR-0008..0012, `scripts/readiness-report.ts`,
  learning-architecture handoff §4/§10, eval-gates §2

## Context

With outcome logging, validation nodes, few-shot curation, and prompt versioning in
place, refinement becomes an operational loop rather than a project. Two things needed
pinning: how the loop runs day-to-day, and how hard the door to actual model training
stays shut while evidence is thin.

## Decision

1. **Loop cadence:** AFK sessions surface improvement candidates (exemplar promotions
   per ADR-0011, prompt/pack/registry edits per their gates) continuously; every action
   lands through its owner gate; metrics reviewed monthly.
2. **Action triggers are mechanism-first:** PromotionRate and HallucinationRate are
   computed and published from day one; numeric investigation thresholds stay
   **unset** until ~30 days of real CandidateOutcome data exists — numbers set without
   evidence would be fiction. Setting them later is a normal owner decision recorded
   here by amendment.
3. **The Phase-4 fine-tune gate is immutable law:** model training (LoRA or otherwise)
   is permitted only when ALL of the following hold, with no waiver path:
   (a) ≥500 admissible CandidateOutcomes for the target jurisdiction×stage;
   (b) demonstrated promotion plateau across ≥2 prompt/store versions;
   (c) documented latency/cost OR offline-capability need that prompting cannot meet;
   (d) explicit owner sign-off recorded as an ADR amendment.
   Until then, fine-tuning work items are out of scope everywhere and any proposal is
   rejected at triage.
4. **If the gate ever opens:** deployment path is exclusively a new `AiAdapter`
   registration (ADR-0008 §2) evaluated A/B against the prompting baseline through
   unchanged eval-gates; rollback is an env-var flip. No pipeline/schema/adjudication
   changes are authorized as part of any Phase-4 work.

## Consequences

- Improvement work is always small, gated, and attributable; "retrain the model" is
  not a standing temptation but a law-gated last resort.
