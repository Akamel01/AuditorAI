# ADR-0010: Hallucination & evidence-use validation — registered deterministic nodes, flag-and-show semantics

- Status: Accepted
- Date: 2026-08-25
- Deciders: owner (live grilling, learning-architecture wave), ORCH
- Context artifacts: `src/domain/pipeline/registry.ts`,
  `src/domain/pipeline/nodes/ai-candidates.ts`, `state/evidence-registry.json`,
  `contracts/schemas/finding.schema.json`, ADR-0006/0008

## Context

AI candidates can cite evidence that does not exist, misquote what exists, or use
vocabulary outside the pack. Deterministic checks catch all three without a model in
the loop — but only if they are first-class pipeline citizens rather than hidden
assertions inside the adapter call.

## Decision

1. **Two registered nodes after AG-AI-CANDIDATES:** `AG-HALLUCINATION-CHECK`
   (evidence_id existence in the compiled registry; quote match under the standard
   whitespace normalization; candidate vocabulary membership) and
   `AG-EVIDENCE-USE-AUDIT` (every normative claim carries ≥1 citation; producer field
   enforcement; citation-use consistency vs the claimed support direction). Both read
   the run's knowledge-layer versions from graph state.
2. **Flag-and-show, never drop:** a failing candidate is annotated
   (`validation: {status: "auto-flagged", reasons[]}`) and remains visible to the
   auditor with reasons rendered. The human gate stays sovereign (ADR-0006); silent
   removal would hide system failure modes from the people liable for the output.
3. **Deterministic-only:** checks consult registry + packs + vocab — no model calls,
   no thresholds subject to judge drift. They run identically on engine findings when
   AI is OFF, making baseline audits auditable by the same rules.
4. **Metrics feed-forward:** per-run hallucination rate (flagged candidates /
   candidates) is stamped into run artifacts and feeds the ADR-0013 mechanism.

## Consequences

- Validation logic is unit-testable against fixtures independent of the adapter.
- Flag reasons double as free rejection-reason labels for Phase-2 analysis.
