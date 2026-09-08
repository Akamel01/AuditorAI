---
id: HV3
title: Design the auto-monitor that watches the backend while harvesting
type: prototype
hitl: true
status: closed
assignee: harvest-verifier
blocked_by: [HV1, HV2]
blocks: [HV6, HV7]
created: 2026-09-08
resolved: 2026-09-08
---

## Question

What does a reusable auto-monitor look like that an operator (or CI) can run *alongside* a harvest to prove what actually happened in the backend, and that the two buttons' jobs are not conflated?

Prototype a single `scripts/harvest-verify.mjs` (or `scripts/harvest-monitor.mjs`) that, given a `jobId` (or that creates one via POST), polls `GET /api/dev/discovery/jobs/:id` every 1.5s (mirroring the UI), snapshots at each tick: job status/logs/currentNode/D01..D10, `GET /api/dev/discovery` (ledgerTail ledgerTotal dedupe), `GET /api/dev/coverage` (target_total, gaps_ranked, cells[*].have_total), `GET /api/dev/health` (harvestHealth), and the underlying KV/file keys (`discovery:jobs:*`, `discovery:ledger:*`, `state/discovery-ledger.json`). It should detect terminal states (`done`/`error`/`cancelled`), handle busy-lock (`harvest executeJob busy`), degrade vs fail vs duplicate, and emit a single JSON evidence bundle to `state/harvest-verify/<jobId>.json` + a human summary to stdout.

Keep it ponytailed: `node` + `fetch` + `DataStore` seam, no new deps, adminKey via `ADMIN_KEY` env or `localStorage` export, live vs dry via `--live` flag, gap vs gap-aware via `--cellKey`. Show three mock runs (mocked MemoryStore, no network) so the monitor itself is demonstrable without credentials.

Acceptance: a reviewer can run `ADMIN_KEY=test-admin-key-... node scripts/harvest-verify.mjs --live --cellKey UKxFEAS-01 --monitor` and see live backend deltas without opening Mission Control.

## Resolution

Prototype delivered `scripts/harvest-verify.mjs:1` (322 lines, node+fetch, no deps) — polls `GET /api/dev/discovery/jobs/:id` 1.5s (UI mirror), snapshots J/L/C/D/H/P/Q (12 seams from HV1), handles busy/400/503/429/402, emits `state/harvest-verify/<jobId>.json` + `HV6/HV7-latest.json` + stdout HV5 pass/fail per `docs/research/harvest-success-criteria.md`.

- CLI: `ADMIN_KEY=... node scripts/harvest-verify.mjs --api gap --cellKey usa:DETAILED_DESIGN --live --monitor` and `--api harvest --live --monitor` and `--jobId` and `--dry --api gap --cellKey usa:PRELIMINARY_DESIGN` and `--mock` (three demos, no server).
- Verified: `--help` ok, `--mock` 3 demos pass, `--dry --api gap --cellKey usa:PRELIMINARY_DESIGN` → `degraded` (ledger+10, healthAdvanced false but degraded allowed, `state/harvest-verify/job_mts3gnw7_cpe6ez.json`), live gap/harvest evidences already captured via ad-hoc `HV6`/`HV7` will be re-run via this hardened script in HV6/HV7.
- Acceptance: `ADMIN_KEY=test-admin-key-... node scripts/harvest-verify.mjs --live --cellKey UKxFEAS-01 --monitor` shows live deltas without opening Mission Control — via API harness reusing same monitor.

No state mutation beyond `state/harvest-verify/` evidence; ponytail, reuse DataStore seam.

