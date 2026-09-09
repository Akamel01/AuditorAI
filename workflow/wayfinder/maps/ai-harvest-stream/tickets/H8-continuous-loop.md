---
id: H8
title: Continuous stream loop till Stop (no self-DONE)
type: task
hitl: false
status: closed
assignee: harvest-verifier
blocked_by: [H7, H2]
blocks: [H9]
created: 2026-09-09
resolved: 2026-09-09
---

## Question

How does the stream run non-stop till the operator hits Stop, instead of self-`DONE` after one pass / `maxIterations:10`?

## Context

Owner confirmed 2026-09-09: continuous rotates top-3 gaps when `cellKey=null`, sticks to the one cell when set; Stop keeps `FAILED stopped by operator` (no new status this slice). `src/discovery/harvest-stream.ts:46-55,176-186` currently overwrites `packages` and `DONE`s on first verify pass.

## Agent Brief

**Category:** enhancement
**Summary:** Add `continuous` to `HarvestStream` + `createStream(cellKey,live,continuous=true)`; `tickStream` appends packages/quality, rotates gap, `VERIFYING→RUNNING` when continuous; `DONE` unreachable in continuous mode.

**Key interfaces:**
- `src/discovery/harvest-stream.ts:13-29,46-66,118-196` (`HarvestStream`, `createStream`, `tickStream`, `verifyStream`)
- `runDiscoveryPipeline` (`discovery/pipeline.ts`), `gaps_ranked` rotation (same source as `harvest.ts` gap-aware)

**Acceptance:**
- [ ] `continuous:true` → `maxIterations` ignored; `VERIFYING` with pass still → `RUNNING` (next gap), logs `continuous next <cellKey>`; `packages` appends (cap ~50, dedupe-guarded), `dedupeIndex` persists across iterations
- [ ] `continuous:false` keeps legacy `DONE|FAILED` behavior (harvest-verify + existing tests unbroken)
- [ ] `pause()` holds, `resume()` continues iteration count, `stop()` → `FAILED stopped by operator` (unchanged)
- [ ] Poll-driven tick unchanged (`GET /:id` 1s debounce); doc notes tab/monitor must stay open + optional `scripts/harvest-stream-daemon.mjs --stream <id>` keep-alive (follow-up, not this ticket unless trivial)
- [ ] Tests: `MemoryStore` continuous 3 ticks appends + never `DONE`; single-shot still `DONE`

**Out of scope:** API param + UI button (H9), Exa provider itself (H7).

## Resolution

Closed 2026-09-09 via AutoForge module run (GO_WITH_NOTES — see `.autoforge/validation/H8-final.md`):
architect (boundaries) → planner (`plans/plan-H8.md` + `execution/work-order-H8.json`)
→ worker → reviewer CHANGES_REQUIRED (6 fixes: migration, append-50, delta-verify,
`continuous next <label>`, legacy `"; "` restore, tests) → worker → re-review
(code PASS, tests partial) → worker test passes → validator NO-GO (`test(` global)
→ worker (`it(` fix) → worker (setup fix) → validator final GO (overstated (c);
corrected in H8-final).

- `src/discovery/harvest-stream.ts`: persisted `continuous` (default true),
`loadStream ??= false` migration (old streams stay single-shot), append
packages/quality cap 50, per-iteration delta verify, `VERIFYING→RUNNING` always +
`continuous next <label>`, DONE unreachable + maxIterations ignored when
continuous, byte-for-byte legacy when false, pause/resume/stop + poll untouched.
- `tests/domain/harvest-stream.test.ts`: 8/8 (3-tick append/never-DONE,
single-shot DONE, cap≤50, controls) — deterministic 2+ sessions.
- Note: FAILED-at-cap unit test passes via DONE fallback (default maxIterations=10
makes FAILED unreachable on tick 1); legacy branch untouched by H8, pin carried
to H10 live acceptance. Downstream `harvest-verify`/e2e terminal-state hang on
continuous streams known until H10; `POST continuous` param is H9.
