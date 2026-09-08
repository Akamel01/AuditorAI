---
id: HV1
title: Map harvesting backend architecture and seams
type: research
hitl: false
status: closed
assignee: harvest-verifier
blocked_by: []
blocks: [HV3, HV4, HV5]
created: 2026-09-08
resolved: 2026-09-08
---

## Question

What are the exact seams that "Run this gap (Live)" and "Run Live Harvest" travel through, and what backend artifacts must an auto-monitor watch to prove the harvest succeeded vs degraded vs silently dropped?

Trace `src/discovery/harvest.ts` (gap-aware `cellKey=null` vs gap-targeted `cellKey`), `src/app/api/dev/discovery/run/route.ts` (requireAdmin → harvest() → 202 + after(executeJob)), `src/discovery/jobs.ts` (createJob/updateJob/getJob via DataStore KV/file), `src/discovery/ledger.ts` (ledger tail + dedupe), `src/discovery/health-aggregate.ts` + `src/app/api/dev/health` + `src/app/api/dev/discovery` (provider pings, ledger tail, dedupe), `src/lib/persistence/store.ts` (KvRestStore vs MemoryStore fallback), and `state/*.json` truth (discovery-ledger, dedupe-index, odd-coverage, graph-state). Identify which logs D01..D10 are emitted, which files/KV keys flip on success, and which failure modes are silent (locked, duplicate, refused) vs surfaced (UnknownCellKeyError 400, StoreUnavailableError 503).

Deliverable: one `docs/research/harvest-backend-seams.md` with a flow diagram (request → job → D01..D10 → ledger/coverage/dedupe → health) and a table of "what to poll" (endpoint, KV key, file, expected delta) for the monitor.


## Resolution

Research subagent delivered `docs/research/harvest-backend-seams.md:1` (473 lines) tracing gap-aware vs gap-targeted seams, D01..D10 pipeline, job store KV/file, ledger trim 500, health aggregate, and monitor table (12 rows: J1/2, L1/2, C1, Q1, D1, P1, H1-4, LK). No state mutated. Verified via file reads of harvest.ts:373, run/route.ts:11, jobs.ts:133, ledger.ts:10.
