---
id: R1
title: Cross-instance harvest lock via Vercel KV atomic SET NX
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
**Summary:** Replace the in-process harvest lock with a Vercel KV distributed lock so concurrent serverless instances cannot both produce ledger entries for the same harvest run.

**Current behavior:** The harvest module guards invocations with a process-local boolean flag initialized at module load. Because Vercel can spin up a second lambda for a second concurrent request, two instances can both produce entries and the KV index/seq allocator collides. The busier instance has no signal the other is harvesting. The current ceiling is documented in source as a known limitation.

**Desired behavior:** `executeJob` competes for a single lock per workspace, held in KV under a deterministic key with a TTL. If the lock is held, mark the dispatched job as terminal error using the existing job store and surface a clean message; do not throw unhandled rejections. The lock must be released on success and on failure (via `finally`). Local development still uses the in-process lock when KV env is absent. The behavior of the route handler on a busy lock remains: log, do not propagate to the client beyond the existing error log line.

**Key interfaces:**
- `DataStore`: existing `put/get`; the lock implementation needs a single SET-with-conditional put. KV REST supports `["SET", key, "1", "NX", "EX", 3600]`. Add a small `setIfAbsent(key, value, ttlSeconds)` helper to `KvRestStore`.
- `MemoryStore`: must implement `setIfAbsent` to match the contract for local tests.
- `harvest` orchestrator: returns the existing terminal error; callers see the same wrong-state shape.
- New module `src/discovery/harvest-lock.ts` exposing `acquireHarvestLock(workspaceKey, ttlSeconds, store?)` returning `{acquired: boolean, holder?: string, release(store?): Promise<void>}`.

**Acceptance criteria:**
- [ ] Adding a focused test that simulates two concurrent `acquireHarvestLock` calls against `MemoryStore` returns exactly one `acquired: true` and one `acquired: false`.
- [ ] After `release()` on the holder, a third call succeeds.
- [ ] When `KvRestStore` is unavailable the lock falls back to the original process-local flag and emits a single warning log line.
- [ ] TTL default is 3600s, configurable per call.
- [ ] `executeJob` does not throw when busy; existing `setJobError` is called for the disputed job before returning.

**Out of scope:**
- Leader election beyond a single workspace key.
- Replacing the KV index strategy (tracked separately).
- Storage strategy for ledger seq allocation (CAS-on-INCR).

