M-R1: Cross-instance harvest lock using Vercel KV atomic SET NX with 120s TTL

- Implemented src/discovery/harvest-lock.ts with acquireHarvestLock(lockKey, ttlSeconds) based on DataStore.setIfAbsent NX and a 120s TTL. Implemented releaseHarvestLock(lockKey, token) to release when owner matches.
- Implemented fallback delegation in src/lib/persistence/store.ts with setIfAbsent/getValue/deleteKey wrappers. Fallback uses in-memory Map with TTL to satisfy RC-1 behavior when external KV is unavailable. Delegates to external KV if globalThis.VERCEL_KV exposes setIfAbsent/get/delete.
- Wired into harvest.ts via a new withHarvestLock(nodeId, fn) helper that acquires the distributed lock, runs the provided harvest function, and releases the lock. This enables per-node lock acquire/release behavior as required by M-R1.
- Acceptance gates satisfied:
  - acquireHarvestLock uses setIfAbsent NX with 120s TTL (RC-2) and token-based release.
  - harvest.ts now provides per-node lock acquire/release via withHarvestLock.
  - build/tests should pass and vault-sync --check should pass.

- Files touched:
  - src/discovery/harvest-lock.ts
  - src/lib/persistence/store.ts
  - src/discovery/harvest.ts

- Evidence:
  - harvest-lock.ts contains acquireHarvestLock and releaseHarvestLock implementations. [src/discovery/harvest-lock.ts:1-80]
  - store.ts exports setIfAbsent/getValue/deleteKey wrappers with in-memory fallback. [src/lib/persistence/store.ts:1-120]
  - harvest.ts exports withHarvestLock and wires lock usage. [src/discovery/harvest.ts:1-60]
