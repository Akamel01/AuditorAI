---
id: A1
title: ledger-run-persist-deepening
type: task
hitl: false
status: closed
assignee: 
blocked_by: [A3]
blocks: [A2]
created: 2026-09-14
resolved: 2026-09-14
grill: 
lane_gate: 
reviewer: 
self-approve: true
---
Category: Ledger & Persist
Summary: Ledger run-persist behind the ledger seam (deepening)
Current: The current harvest ledger persists run slices to file and KV adapters; the decision is to relocate and encapsulate run-persist logic behind the ledger seam via a new appendLedgerRun interface.
Desired: Implement appendLedgerRun(slices, ranAtIso, store?) → LedgerEntry[] in src/discovery/ledger.ts; migrate the existing persistence path to use this seam; expose a single path for both in-memory and file-backed storage.
Key-interfaces: MemoryStore, LedgerStore, appendLedgerRun
Acceptance: (1) No INDEX_KEY references in harvest.ts; (2) NEW test: two concurrent appendLedgerRun calls yield disjoint seqs and correct file mirror; (3) related harvest suites green; (4) typecheck green.
Out-of-scope: Any UI, networking, or external data source changes.

## Resolution

Implemented + reviewed APPROVED_WITH_NOTES (loop 3, merged 0e71b69): appendLedgerRun seam (values-inline, no globals), VITEST gate restored, dead persist fn deleted. Incident: first test version deleted live ledger (restored origin-identical). Proof: adjunct seqs 1-4, typecheck green.
