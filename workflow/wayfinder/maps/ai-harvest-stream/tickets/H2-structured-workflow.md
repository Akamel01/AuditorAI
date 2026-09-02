---
id: H2
title: Structured workflow for AI harvesting (state machine + loop)
type: task
hitl: false
status: open
assignee:
blocked_by: [H1]
blocks: [H3, H5]
created: 2026-09-02
resolved:
---

## Question

What is the minimal structured workflow that makes AI harvesting continuous and verifiable, never stopping until coverage/quality gates pass?

## Context

Current `src/discovery/pipeline.ts:334` is a one-shot `runDiscoveryPipeline` (D01..D10) called from `src/discovery/harvest.ts:105` `executeJob`. For continuous AI harvesting we need a `HarvestStream` state machine that loops `D01..D10` until verification passes, with explicit states and persistence.

## Agent Brief

**Category:** enhancement
**Summary:** Implement `src/discovery/harvest-stream.ts` state machine `IDLE → RUNNING → PAUSED → VERIFYING → DONE|FAILED` that loops the pipeline via `runDiscoveryPipeline` until `computeCoverage` + `checkDuplicate` + `quality_score` gates are met.

**Key interfaces:**
- `HarvestStream { id, status, cellKey, live, iteration, coverage, quality, dedupeIndex, ledger }`
- `DataStore` seam `src/lib/persistence/store.ts` `KvRestStore.call`
- Existing `src/discovery/pipeline.ts:334` `runDiscoveryPipeline`, `src/discovery/coverage.ts`, `src/discovery/dedupe.ts`

**Acceptance:**
- [ ] `HarvestStream` persists via `DataStore` (`harvest:stream:{id}`), survives lambda restarts
- [ ] `IDLE → start() → RUNNING → (D01..D10) → VERIFYING → if gates fail → RUNNING` loop, max 10 iterations or until owner `stop()`
- [ ] `PAUSED` via `pause()` holds `withHostBudget` queue, `resume()` continues
- [ ] Verification uses `computeCoverage(packaged, ranAtIso)` target_total per `policies/odd.json` + `quality_score==1` for all `package` + `provenance` valid
- [ ] Ponytail: reuse `DataStore`, no new deps, `ponytail:` ceiling for global poll

**Out of scope:** Per-jurisdiction prompt tuning, cost budget.
