---
id: H8
title: Continuous stream loop till Stop (no self-DONE)
type: task
hitl: false
status: open
assignee: harvest-verifier
blocked_by: [H7, H2]
blocks: [H9]
created: 2026-09-09
resolved:
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
