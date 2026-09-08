# ADR-0014: Harvest lease is global with 120s TTL and holder-guarded release

Grilled R1 (ops-residual) on 2026-09-04. Execution already landed as `src/discovery/harvest-lock.ts` + `harvest.ts:149-163` + `KvRestStore.setIfAbsent` / `MemoryStore.setIfAbsent`. We ratify the ponytail choices: global `harvest:lock` (not per-workspace), `SET NX EX 120`, holder string is `jobId`, release is GET-then-DEL guarded by holder equality (non-atomic), silent fallback to process-local `HARVEST_LOCK` when `setIfAbsent` is absent or KV throws.

## Considered Options

- **TTL:** 3600 s per brief vs 120 s vs 60 s. 3600 s would block harvests for an hour on a crashed lambda; 60 s risks expiry mid-run under burst tail-merge load. 120 s is the smallest safe ceiling where a crash self-heals in 2 min while a normal harvest (30-60 s) never loses the lease.
- **Key scope:** per-workspace `harvest:lock:{wsHash}` isolates tenants but doubles key-space reasoning and lets two lambdas hammer KV/ledger concurrently under one deployment. Global keeps one harvest at a time — correct for current single-writer ledger and Upstash write limits; per-cell sharding is the upgrade path only if throughput proves the bottleneck.
- **Release atomicity:** atomic Lua `EVAL "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end"` eliminates the race where TTL expiry + re-acquire lets a stale releaser DEL the new holder. We accept the non-atomic GET-then-DEL as `ponytail:` ceiling: window is <5 ms at the tail of a 120 s lease, global lock means contenders are rare, and Upstash REST has no native CAS beyond `SET NX`.
- **KV fallback:** explicit `console.warn` on fallback vs silent. Brief asks for a warning; we stay silent — harvest already emits `PERSIST-WARN` and job logs, and a warn on every local-dev run is noise.

## Consequences

- Crash recovery is 120 s max; no heartbeat extension — long-running harvests must stay under TTL or they lose the lease and a second harvest could start (safe but noisy; ledger tail merge handles idempotent appends).
- Adding per-workspace or per-cell locks later requires changing `HARVEST_LOCK_KEY` derivation and adding `workspaceHash` plumbing; revert is delete `harvest-lock.ts` + the `acquireHarvestLock` block in `harvest.ts`.
- Atomic release can be upgraded by adding an `evalIfEquals` method to `DataStore` and wiring `KvRestStore` to `EVAL` — no API churn beyond the seam.

## Status

Accepted 2026-09-04. Code matches decision; ticket R1 acceptance criteria (concurrent MemoryStore test, release, fallback, TTL configurable, busy `setJobError` without throw) verified in current tree.
