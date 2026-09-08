# ADR-0015: Ledger index is a hint healed by orphan prune + KEYS scan

Grilled R2 (ops-residual) on 2026-09-04. `src/discovery/ledger.ts:10-63` already implements per-entry keys `discovery:ledger:entry:{seq}` as truth and `discovery:ledger:index` as a 500-trimmed hint. We ratify the ponytail ceiling and sharpen the healing contract.

## Decision

- **Write path stays best-effort:** `appendLedgerKV` runs inside `withPersistenceSingleWriter` (process-local) + `GET`-before-`PUT` NX hint + `index.sort+slice(-500)+PUT`. Last-write-wins across instances is accepted; per-entry puts are durable.
- **Read path heals:** `getLedgerTailKV` does tail-only orphan prune now, and will be extended to **full-scan prune + KEYS-scan merge**: read `INDEX_KEY`, `GET` all indexed entries to find missing (orphan) seqs, `KEYS discovery:ledger:entry:*` to find seqs present on disk but absent from index, merge missing seqs, sort, slice(-500), and rewrite `INDEX_KEY` under `withPersistenceSingleWriter`. This makes the strict 50-concurrent-appends criterion eventually pass without an atomic `EVAL` on the write path — the next `getLedgerTailKV` call reconstructs the lost seqs.
- **Cost:** one `KEYS` + up to 500 `GET`s on each tail call that detects divergence; normal path (no divergence) stays at 1 `GET` for index + ≤20 `GET`s for tail. Acceptable because harvest tail is called once per run (≈30-60 s interval) and ledger is ≤500.

## Considered Options

- **Atomic EVAL on append:** `EVAL "redis.call('set',entry,ARGV) ; redis.call('lpush'/'zadd',index)"` would make 50/50 pass without healing, but adds Lua to the DataStore seam, needs `EVAL` plumbing in `KvRestStore` + fallback for `MemoryStore`, and couples the seam to Redis semantics beyond `SET NX EX`. Rejected for now — ceiling is smaller.
- **Full scan prune without KEYS merge:** heals orphans but never recovers lost seqs — strict test still flakes.
- **Drop index entirely, scan KEYS every time:** correct but `KEYS` on every tail is heavier than hint + heal.

## Consequences

- `appendLedgerKV` remains trivial and testable with `MemoryStore`; strictness is enforced by the reader, not the writer, so concurrent-append tests must call `getLedgerTailKV` after appends to observe healing.
- If a future workload proves the heal too expensive (500 GETs per harvest at scale), replace the heal with an atomic `EVAL` on write and keep the read path lean.
- `state/discovery-ledger.json` file mirror stays best-effort and out-of-scope for this decision.

## Status

Accepted 2026-09-04. Code for tail-only prune exists; KEYS-merge extension is the next implementation slice for R2.
