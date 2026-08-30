---
id: R8
title: Health route exposes harvest-health sub-object
type: task
hitl: false
status: open
assignee:
blocked_by: []
blocks: []
created: 2026-08-30
resolved:
---

## Agent Brief

**Category:** enhancement
**Summary:** Add a `harvestHealth` sub-object to the existing `/api/dev/health` response so a topology dashboard can show last-run age, last-result status, and lock availability at a glance.

**Current behavior:** The health endpoint returns `{ providers, ledger, topology }`. Operator dashboards have to piece together harvest freshness from the ledger endpoint, which is fine but not central.

**Desired behavior:** Add `harvestHealth` with fields: `lastRunAt` (ISO or null), `lastRunStatus` (queued/running/done/error/cancelled/null), `lockHolder` (string|null), `lockAcquiredAt` (ISO|null), `indexedEntriesCount`. Use the existing DataStore + jobs seam.

**Key interfaces:**
- Existing `getLedgerTailKV`, `getDataStore`, and `jobs.listLatest` (one job returned) are the only inputs needed.
- New module `src/discovery/health-aggregate.ts` with `harvestHealthSummary(store?)` exposing pure derivation.

**Acceptance criteria:**
- [ ] `GET /api/dev/health` returns the existing fields plus `harvestHealth` with documented shape, even when KV is unavailable.
- [ ] A focused test asserts the shape under MemoryStore with one completed job.

**Out of scope:**
- Real-time alerting or external health pings.

