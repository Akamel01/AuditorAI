M-A1: ledger run-persist seam
- Implement appendLedgerRun(slices, ranAtIso, store?) → LedgerEntry[] in src/discovery/ledger.ts. This function owns per-entry sequencing and file mirror writes; KV updates remain via existing appendLedgerKV seam.
- harvest.ts becomes a single call to appendLedgerRun; remove explicit nextSeq/INDEX_KEY arithmetic from harvest.ts; keep coverage-mirror writes in harvest.ts as a separate block to satisfy the constraint that ledger does not own coverage files.
- New test: tests/domain/discovery-ledger-run.test.ts validates two concurrent appendLedgerRun invocations against MemoryStore produce disjoint sequences and that a file mirror is written.
- Guard: VITEST/NODE_ENV gate restored around the harvest persist block (slices + appendLedgerRun + KV/coverage mirrors), exactly as HEAD gated persistDiscoveryState; plus defense-in-depth: appendLedgerRun skips its FS mirror under VITEST unless AUDITORAI_LEDGER_MIRROR is set.
- Incident 2026-09-14: first test version's beforeEach rm deleted the live 7.8MB state/discovery-ledger.json during a worker test run; orchestrator restored origin/main 1050-entry version byte-identical (Sep 13→14 live rows unrecoverable, disclosed to owner). Killer beforeEach removed; live-mtime assertion strict.
- Notes: this is a minimal, focused patch that preserves existing storage behavior while moving run-persist behind the ledger seam.
- Added environment override AUDITORAI_LEDGER_MIRROR to confine mirror writes to a temporary path during tests; ensures the real discovery-ledger.json is not mutated by test runs.
