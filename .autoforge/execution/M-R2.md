Execution: M-R2 — Ledger KV ordering + orphan-key recovery

- Implemented per-entry NX writes for ledger entries and maintained a 500-entry index tail.
- Added orphan-key recovery: during tail fetch, missing entries trigger pruning of INDEX_KEY to remove orphan seqs.
- Wrapped all index/entry writes in withPersistenceSingleWriter to ensure a single writer at runtime.
- Kept existing DataStore usage and typing; minimal changes to leverage existing KV patterns.

Key evidence (source citations):
- src/discovery/ledger.ts: appendLedgerKV now uses NX write checks and updates INDEX_KEY (per-entry + slice-500) [lines ~11-29].
- src/discovery/ledger.ts: getLedgerTailKV performs lazy orphan prune and rewrites INDEX_KEY when needed [lines ~31-60].

Notes: build should pass with vault-sync --check as part of CI gates.
