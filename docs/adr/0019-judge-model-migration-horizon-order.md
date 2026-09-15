# ADR-0019: Judge-model migration to deepseek-v4-flash-free + horizon parallel lanes

Grilled v6-horizon (owner) on 2026-09-15. `x-preview-f-free` is dead (401s); Zen 500s on muse-spark free tier. F1 cannot close without a pinned judge, and score comparability with the 09-08 archive must be decided, not drifted into.

## Decision

- **Successor:** `deepseek-v4-flash-free` via existing Zen gateway + `AI_MODEL` env (no code change to transport; `run-eval.ts:56` default updated to the new pin).
- **Comparability:** parallel-calibration run — one full Tier-1 under the new judge side-by-side with archived 09-08 means recorded, delta published in the run report; cutover only if delta is explained (rubric drift) or negligible. No silent clean break.
- **Horizon order:** two parallel lanes — Lane A: H1 DIRECT C8/C9 integration (pairs PROPOSED until ratified); Lane B: H2 counts-drift fix → H3 growth in two ~8-9 batches. H4 follows H7 cutover; H5 direction is loading-UX (skeleton/streaming completeness) with numeric targets still owed by owner; H6 follows H4 + schema.

## Considered Options

- **Wait for muse-spark recovery:** zero-cost but unbounded; F1/F4 stay blocked indefinitely. Rejected as sole plan (retry continues in background).
- **Clean break (re-baseline from zero):** discards 09-08 comparability; rejected — calibration is one run.
- **H1 before H2/H3 strictly:** delays release-test awakening; rejected — lanes are disjoint (corpus files vs counts script).
- **Single 17-batch or 4-5 micro-batches:** review overload vs round-trip drag; rejected — two rounds balance.

## Consequences

- `scripts/run-eval.ts` default model changes; judge stamp in scorecards records the new model; validator must cite the calibration delta.
- H1 pairs stay PROPOSED (unratified pairs NEVER enter training splits).
- H5 cannot execute until owner states numeric loading-UX targets; lane_gate holds.

## Status

Accepted 2026-09-15 (owner grill). Implements as v6 H1–H7.
