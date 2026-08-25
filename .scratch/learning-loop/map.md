# Wayfinder Map: Learning Loop — Phase 1 Observability & Flywheel

Labels: wayfinder:map · Tracker: local-markdown (.scratch/) · Created: 2026-08-25

## Destination

Every adjudication produces an admissible CandidateOutcome; AI candidates pass
deterministic hallucination/evidence-use validation as registered pipeline nodes;
few-shot exemplars flow through a compiled, owner-gated store; SYSTEM_PROMPT is a
versioned repo artifact hash-stamped into every run; PromotionRate/HallucinationRate
are published metrics feeding the learning-architecture diagram from generated data —
with the Phase-4 fine-tune gate (ADR-0013) standing immutable over all of it.

## Notes

- **Doctrine (do not re-litigate):** the 17 grilling questions are resolved; no
  fine-tuning/RAG/RL/LoRA now; AI OFF by default must keep working; Candidate ≠
  Finding; registry is the knowledge base; ODD is law; ADR-0007 firewall is absolute.
- Governing ADRs: 0008 (candidate generation + fewshot cascade + prompt artifact),
  0009 (outcome logging), 0010 (validation nodes), 0011 (store/curation),
  0012 (prompt versioning), 0013 (loops + Phase-4 gate). All Accepted 2026-08-25.
- UI lane note: owner assigned adjudication-capture UI wiring to this effort; before
  touching src/app/** check for live parallel-session WIP (stash-coordinate).
- Cross-session hygiene + vault-sync rule per AGENTS.md; stage only your lane.
- Thresholds/judge rubric are frozen; prompt edits = trigger-path event (fresh Tier-1).

## Decisions so far

<!-- one line per closed ticket -->

- [ADR-0008..0013 authored](../../docs/adr/): six ADRs ratified by owner grilling
  2026-08-25 — adapter seam/budgets + fewshot cascade + prompt artifact (0008);
  JSONL outcome log, whitelist edits, pseudonyms (0009); two validation nodes,
  flag-and-show (0010); compiled store + auto-pool/owner gate (0011);
  prompts/system-prompt.md + hash stamping (0012); continuous loop, mechanism-first
  triggers, immutable four-part Phase-4 gate (0013).

- [01 CandidateOutcome](issues/01-candidate-outcome-logging.md): PATCH-path capture live; JSONL sink; 8-test suite.
- [02 Validation nodes](issues/02-validation-nodes.md): two registered nodes, flag-and-show, AI-off parity, rate into AuditResult.
- [06 Per-cell table](issues/06-per-cell-data-table.md): generated markdown+JSON for all 16 cells.

- [03 Few-shot manager + prompt artifact](issues/03-fewshot-and-prompt-artifact.md): prompts/system-prompt.md v1 fail-closed, PROMPT_HASH stamped end-to-end; store compiled w/ firewall enforcement.
- [04 Metrics + diagram](issues/04-metrics-and-diagram.md): PromotionRate/HallucinationRate mechanism-first; render-learning-html.ts regenerates KPIs.
- [05 UI capture](issues/05-ui-adjudication-capture.md): consent-gated adjudication capture wired through existing PATCH contract.

## Not yet specified

- Numeric investigation thresholds for PromotionRate/HallucinationRate — deliberately
  unset until ~30 days of real outcome data (ADR-0013 §2); graduates into a ticket
  once the log has volume.
- Ballinluig/int-007 identity conflict (readiness map fog) blocks any exemplar with
  that lineage; graduates a resolution ticket if curation ever wants it.
- Diagram regeneration from readiness-report `learning_layer` section (currently the
  HTML carries reconciled hand-edited numbers; true generated rendering is part of
  ticket 04).

## Out of scope

- Any fine-tuning/LoRA/training work while the ADR-0013 gate stands.
- Judge-side rubric changes (frozen doctrine).
- Vision/drawing→hazard annotation pipeline (Phase-3 prerequisite material only).
