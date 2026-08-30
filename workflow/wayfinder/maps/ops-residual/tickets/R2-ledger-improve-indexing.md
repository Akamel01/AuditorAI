---
id: R2
title: Ledger KV ordering + orphan-key recovery
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

**Category:** bug
**Summary:** Fix the `discovery:ledger:index` ordering race and add a recovery sweep for orphan per-entry keys.

**Current behavior:** The current implementation reads the KV index, sorts and trims to 500, and writes it back. Concurrent writers can race on the index update and lose newly written entries. Additionally, when an index entry exists but the corresponding per-entry key is missing (KV TTL or a partial delete), `getLedgerTailKV` returns a stale empty entry, producing a tail that does not match the file mirror.

**Desired behavior:** Use KV's atomic options (or write each index entry under a unique key) so concurrent appends do not lose entries. Add a self-healing pass that drops index rows whose per-entry keys are gone, keeping the tail consistent with the data.

**Key interfaces:**
- Existing `appendLedgerKV(entries, store?)` and `getLedgerTailKV(limit, store?)` keep their signatures but now produce no duplicates and skip orphans in `getLedgerTailKV`.
- `KvRestStore` gains an optional pipeline helper that lets the orchestrator atomically write per-entry + index hint together.

**Acceptance criteria:**
- [ ] Under simulated concurrent appends of 50 entries, the KV tail eventually includes all 50 unique seq values, no duplicates.
- [ ] `getLedgerTailKV` drops index rows whose per-entry keys return null.
- [ ] Existing tests in `tests/domain/discovery-harvest.test.ts` continue to pass with no new mocks when KV env is absent.

**Out of scope:**
- Changing the 500-entry trim window (separate ticket if needed).
- Migrating to a CAS allocator (separate cross-instance CAS ticket).

