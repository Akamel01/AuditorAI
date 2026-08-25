# ADR-0008: AI candidate generation architecture — single AI node, adapter seam, versioned prompt & few-shot inputs

- Status: Accepted
- Date: 2026-08-25
- Deciders: owner (live grilling, learning-architecture wave), ORCH
- Context artifacts: `src/lib/ai.ts`, `src/lib/inference.ts`,
  `src/domain/pipeline/nodes/ai-candidates.ts`, `src/domain/pipeline/registry.ts`,
  ADR-0005/0006/0007, learning-architecture handoff §2/§11

## Context

The pipeline has exactly one AI-bounded node (AG-AI-CANDIDATES) producing
`CandidateFinding[]` for human adjudication (ADR-0006). The grilling resolved that no
fine-tuning/RAG/RL is warranted at current data reality; refinement happens through the
deterministic knowledge layer. What was never pinned down: how few-shot exemplars are
selected and versioned, and how SYSTEM_PROMPT is stored so every improvement is
traceable.

## Decision

1. **Single AI touchpoint stays.** AG-AI-CANDIDATES remains the only node invoking an
   `AiAdapter`; OFF by default (`AI_ADAPTER=off`), deterministic path fully functional.
2. **Adapter seam unchanged.** `ADAPTER_FACTORIES` in `src/lib/ai.ts` is the sole
   registration point; future fine-tuned adapters register there and deploy via env var.
   Phase-4 prerequisites live in ADR-0013 — this ADR does not open that door.
3. **Few-shot selection is a deterministic cascade** (absorbs former ADR-0011):
   native_stage_id exact → canonical_stage → jurisdiction → global generic; k ≤ 3
   exemplars per call; sources must hold the engine-fewshot role (ADR-0007 R2);
   same-programme clusters deduped; release-test/reserve roles excluded absolutely.
   Selection is implemented in `src/lib/fewshot.ts` over the compiled few-shot store,
   and the chosen exemplar ids are stamped into run artifacts.
4. **SYSTEM_PROMPT is a repo artifact** (absorbs former ADR-0012): canonical text at
   `prompts/system-prompt.md` with a version header + change log; loaded at runtime;
   content hash stamped into every scorecard, outcome row, and AI-run log. Prompt edits
   are an eval-gates §2 trigger event requiring a fresh Tier-1 archive.
5. **Budgets ratify as-is:** MAX_IMAGES_PER_CALL=4, ≤3 adapter calls per run,
   circuit-breaker with deterministic fallback (`inference.ts`) — now doctrine, not
   incidental constants.

## Consequences

- Every candidate is reproducible from (pack versions, registry version, ODD version,
  prompt hash, exemplar ids) recorded at run time.
- Improvement actions reduce to: edit pack/registry/ODD (existing gates), edit prompt
  (trigger event), curate exemplars (ADR-0011 flow). Nothing else moves quality.
