---
map: harvest-verification
label: wayfinder:map
created: 2026-09-08
---

## Destination

Automated, evidence-backed verification that harvesting works end-to-end via **Run this gap (Live)** (gap-targeted) and **Run Live Harvest** (gap-aware) — with a reusable **auto-monitor** that watches the backend (job store, ledger, dedupe, coverage, health, KV) while harvesting, and a **repeatable test harness** (API + UI) that future sessions can run to prove `main` is green.

Done = both buttons have a one-command local verification and a CI-counterpart, the monitor captures job logs D01..D10, ledger tail, coverage flip, dedupe, and health, and the plan's ticks define what "success" means for gap-targeted vs gap-aware harvests.

## Notes

- Skills to consult: `wayfinder`, `research`, `prototype`, `grilling`, `domain-modeling`, `diagnosing-bugs`, `verify-and-stop`, `tdd`, `playwright` (e2e), `apple-design` for any UI feedback tweaks surfaced during testing.
- Seams: `src/discovery/harvest.ts` (gap-aware vs cellKey), `src/discovery/jobs.ts` (KV/file job store), `src/discovery/ledger.ts`, `src/discovery/dedupe-persist.ts`, `src/discovery/health-aggregate.ts`, `src/app/api/dev/discovery/run/route.ts` (POST 202 + after(executeJob)), `src/app/dev/mission-control/_components/provider-health.tsx` (Run live harvest), `src/app/dev/mission-control/_components/queue-ticker.tsx` (Run this gap), `src/lib/persistence/store.ts` (DataStore), `workflow/wayfinder/TRACKER.md` (local-markdown tracker).
- Ponytail: reuse DataStore seam, no new deps, smallest harness that proves the backend; prefer `adminApi` + `node` script over Playwright where it reaches the same seam.
- Staging hygiene: explicit `git add <paths>`; never bare vault-import/export; use `node scripts/vault-sync.mjs` for vault state.
- Frequency gate: harvesting is occasional (operator triggered), so 200-500ms feedback is budget-legal; do not animate high-frequency toggles.

## Decisions so far

- [Option A Crisp Chainage shipped](tmp/apple-mockups/option-a-crisp.html): Segmented pill 180ms drawer, gap-detail scale .97 220ms anchored at pointer, confirm blur+scale, button scale .97 120ms, empty stagger 60ms — all transform+opacity only.
- [Map harvesting backend architecture and seams](workflow/wayfinder/maps/harvest-verification/tickets/HV1-backend-architecture.md): gap-aware (cellKey null → gaps_ranked[0..3]) vs gap-targeted (cellKey → single theme, 400 on unknown), job KV/file  queued→running→done/error, D01..D10 WRITES budget, ledger index trim 500, dedupe KV/file, health degraded; monitor polls 12 seams.
- [Trace UI wiring for both harvesting buttons](workflow/wayfinder/maps/harvest-verification/tickets/HV2-ui-wiring.md): ProviderHealth handleRun vs QueueTicker onRunCell→handleRunGap both POST 202 + 1.5s poll, localStorage survival, gapRun UX vs JOB_STORAGE_KEY, dedupe double-count guard.
- [Define success for gap-targeted vs gap-aware harvests](workflow/wayfinder/maps/harvest-verification/tickets/HV5-success-criteria.md): Gap-targeted exact cellKey ledger `+≥1`, have_total↑ or refusal, dedupe strict, health advance; Gap-aware `0..N` + recomputed gaps; Dry never degraded, Live may 402→Degraded, Busy→Skipped distinct; CI dry mock 1 pkg — locked `docs/research/harvest-success-criteria.md:1` + `CONTEXT.md` terms.
- [HV3-auto-monitor](workflow/wayfinder/maps/harvest-verification/tickets/HV3-auto-monitor.md): `scripts/harvest-verify.mjs:1` polls J/L/C/D/H/P/Q 1.5s, handles busy/400/503/429/402, emits `state/harvest-verify/<jobId>.json` + HV5 verdict — ` --mock` demos pass, live/dry via API.
- [Build one-command harnesses for both buttons (API + UI)](workflow/wayfinder/maps/harvest-verification/tickets/HV4-harness.md): `scripts/harvest-verify.mjs:1` now `--api harvest-stream [--cellKey] [--live]` POST `/api/dev/harvest-stream {live,cellKey}` → `streamId` poll `2s GET /api/dev/harvest-stream/:id` (keeps `gap`/`harvest` 1.5s `POST /api/dev/discovery/run`), `tests/e2e/harvest-buttons.spec.ts:1` 3× `@harvest` visiting `/dev/mission-control` via `admin gate` + `localStorage auditorai.admin_key`, clicking `run-gap-*` (queue-ticker.tsx:168) / `provider-health-run-live-harvest` (provider-health.tsx:381) / `ai-harvest-start` (ai-harvest-control.tsx:143) asserting `waitForResponse` 202/201 + `polling 1.5s/2s` + `jobId/streamId` invariants, `docs/research/harness-design.md:1` button→harness→seam map + one-liners — lint `--help` + `--mock` green; HV6/HV7 now unblocked.
- [Live-verify AI Harvest Stream Start](workflow/wayfinder/maps/harvest-verification/tickets/HV9-ai-stream-verify.md): AFK `main` 9d42cd9 `ADMIN_KEY=... node scripts/harvest-verify.mjs --api harvest-stream --live --monitor` → `stream_mttoblq1_sk6342` gap-aware DONE 1 4pkgs + `stream_mttoewhy_01e5v9` gap-targeted `usa:PRELIMINARY_DESIGN` DONE 1pkg + dry twins `stream_mttoeet9_674qqb`/`stream_mttocoy9_4y1n4x`, all `IDLE→RUNNING→VERIFYING→DONE` `verifyStream` unique 1, isolated `harvest:stream:*` vs `discovery:jobs:*` (`ledgerTotal 124→124`), pause `PAUSED`/`RUNNING`/`FAILED stopped` proven; UI `ai harvest stream` skipped strict-mode `getByText('MISSION CONTROL')` 3 elements (same as HV6/HV7) — API seam proves `ai-harvest-control.tsx:143` wiring. Evidence `state/harvest-verify/HV9-stream_*.json` ×4 + `harvest-stream-latest.json`. 

## Not yet specified

- Which provider fixtures to use for deterministic off-network verification (seed-portals vs mocked brave-search) and how to gate live vs dry runs in CI.
- Whether the auto-monitor should also watch Vercel KV directly (REST) or just the file fallback ledger for local runs.
- Long-term placement of the harness: `scripts/` vs `tests/e2e/` vs new `scripts/harvest-verify.mjs`, and retention policy for captured evidence snapshots.
- Flake handling for brave-search quota 402 during live runs (degrade vs hard fail) and how to surface it in the monitor.

## Out of scope

- Changing ODD semantics, eval-gate thresholds, or marketplace firewall (ADR-0007).
- Rewriting harvest pipeline semantics beyond instrumentation (no new providers, no ODD flips).
