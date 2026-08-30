---
id: R3
title: Regression tests for in-process lock + callback dedup
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
**Summary:** Add focused regression tests for the busy-harvest path, the parent-reload dedup, and the persist-before-done ordering.

**Current behavior:** No tests cover the in-process harvest lock, the `lastOnRunJobId` dedup in the React component, or the ordering of `appendLedgerKV`/`persistDedupeFromResult` before `setJobDone`. Validator and investigator flagged missing coverage; future refactors risk regressing these guarantees.

**Desired behavior:** Add three focused tests using the existing in-memory seam. The first calls `executeJob` twice concurrently and asserts the second call resolves with a terminal-error job state without throwing. The second uses a minimal React testing harness or `node:test` mock for `fetchJobById` and asserts `onRun` is invoked exactly once per terminal job. The third asserts the order of `appendLedgerKV` and `setJobDone` slots by spying on the existing jobs seam.

**Key interfaces:**
- `executeJob(jobId, ctx, providerIds, ranAtIso, deps?)`: existing
- `setJobError(jobId, message, store?)`: existing
- `provider-health.tsx`: parent `onRun` callback; ensure test mirrors the existing component contract without inventing new hooks.

**Acceptance criteria:**
- [ ] One test proves concurrent `executeJob` resolves one success and one terminal-busy out of two callers.
- [ ] One test proves `onRun` is invoked exactly once under repeated terminal fetches for the same job id.
- [ ] One test proves `appendLedgerKV` is awaited before `setJobDone` (e.g., by recording timestamps against stubs).
- [ ] All tests are repeatable in this repo's standard test runner and need no new dependencies.

**Out of scope:**
- Distributed cross-instance lock (separate ticket).
- UI harness rewrites.

