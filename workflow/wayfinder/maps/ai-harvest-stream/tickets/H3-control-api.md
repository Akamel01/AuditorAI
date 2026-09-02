---
id: H3
title: Control API start pause resume stop for harvest stream
type: task
hitl: false
status: open
assignee:
blocked_by: [H2]
blocks: [H4]
created: 2026-09-02
resolved:
---

## Question

How do we expose start, pause, resume, stop for the AI harvest stream via a minimal API that reuses existing admin and persistence seams?

## Agent Brief

**Category:** enhancement
**Summary:** Implement `src/app/api/dev/harvest-stream/route.ts` and `[id]/{pause,resume,stop}` routes that control `HarvestStream` via `DataStore`, guarded by `requireAdmin`.

**Key interfaces:**
- `POST /api/dev/harvest-stream {live, cellKey}` → `{streamId}`
- `POST /api/dev/harvest-stream/[id]/pause` → `{paused:true}`
- `POST /api/dev/harvest-stream/[id]/resume` → `{running:true}`
- `POST /api/dev/harvest-stream/[id]/stop` → `{stopped:true}`
- `GET /api/dev/harvest-stream/[id]` → `HarvestStream` (status, iteration, coverage, logs)
- `src/lib/api.ts` `requireAdmin`, `src/discovery/harvest-stream.ts`

**Acceptance:**
- [ ] `POST /api/dev/harvest-stream` creates stream `IDLE → RUNNING`, returns `streamId`, persists via `DataStore`
- [ ] `pause` sets `PAUSED`, holds `withHostBudget` queue; `resume` → `RUNNING`; `stop` → `FAILED` with `currentNode: null`
- [ ] All routes `requireAdmin` fail-closed, timing-safe, 30/min bucket (like `D1`)
- [ ] Idempotent: `pause` twice → 200, `stop` on done → 404 or 200 with no-op
- [ ] Tests with `MemoryStore` prove lifecycle

**Out of scope:** UI, verification loop internals.
