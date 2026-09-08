# HV4 Harness Design — One-Command Harnesses for All Harvest Buttons (API + UI)

**Ticket:** `HV4-harness` `workflow/wayfinder/maps/harvest-verification/tickets/HV4-harness.md:1` — prototype HITL, blocked_by HV1 HV2  
**Date:** 2026-09-08  
**Seams:** `scripts/harvest-verify.mjs:1` (HV3 auto-monitor + HV4 driver), `src/app/api/dev/discovery/run/route.ts:11` (202 + after(executeJob)), `src/app/api/dev/harvest-stream/route.ts:18` (201 + poll 2s), `src/app/dev/mission-control/_components/queue-ticker.tsx:158` (`run-gap-*`), `src/app/dev/mission-control/_components/provider-health.tsx:378` (`provider-health-run-live-harvest`), `src/app/dev/mission-control/_components/ai-harvest-control.tsx:139` (`ai-harvest-start`), `state/harvest-verify/`

## Question

How can an engineer (or CI) verify *both* harvesting families — **gap-targeted** `Run this gap (Live)` and **gap-aware** `Run live harvest`, plus the **AI Harvest Stream** `Start` — with one command each, hitting the same backend seam the UI does, and producing a single `state/harvest-verify/` evidence bundle that the HV5 oracle can assert?

## Button → Harness → Seam Map

| # | Button (what operator clicks) | Component & selector | Backend seam (what the wire hits) | Harness driver (thin, reuses HV3 monitor) | Poll cadence & evidence | HV5 invariant asserted |
|---|---|---|---|---|---:|---|
| **A** | **Run this gap (Live)** — per-card live harvest | `queue-ticker.tsx:158` → `page.tsx:120` `handleRunGap` <br> `data-testid="run-gap-{cellKey}"` e.g. `run-gap-usa:DETAILED_DESIGN` <br> `aria-label="Run gap {key} live"` <br> `gap-card-{key}` / `gap-details-{key}` stable | `POST /api/dev/discovery/run {live:true, cellKey}` `run/route.ts:11` → `harvest({live,cellKey})` gap-targeted (`themeFor(cellKey)` single theme) → `createJob` → `202 {jobId}` + `after(executeJob)` `D01..D10` → `persistDiscoveryState` ledger/coverage/dedupe | **API:** `scripts/harvest-verify.mjs --api gap --cellKey <cellKey> --live --monitor` <br> **UI:** `tests/e2e/harvest-buttons.spec.ts` `test('@harvest gap via UI')` — `addInitScript auditorai.admin_key` → `goto /dev/mission-control` → switch `Discovery` → `getByTestId('run-gap-*').first().click()` → `waitForResponse POST /api/dev/discovery/run 202` → assert `cellKey` echoed | 1.5 s poll `GET /api/dev/discovery/jobs/:id` (mirrors `page.tsx:136` + `provider-health.tsx:122`) → `state/harvest-verify/<jobId>.json` + `HV6-latest.json` (ticks J/L/C/D/H/P/Q, HV5 rows) | Gap-targeted: job `done`, ledger `+≥1` for *exact* `cellKey` (`package.assemblies`), `have_total`↑ or refusal, `dedupe==packages`, `health.lastRunAt==ranAtIso` — see `harvest-success-criteria.md:1` |
| **B** | **Run live harvest** — gap-aware batch (top gaps) | `provider-health.tsx:378` `handleRun` <br> `data-testid="provider-health-run-live-harvest"` <br> `aria-label="Run one live harvest batch — POST /api/dev/discovery/run"` <br> persists `localStorage auditorai.discovery.jobId` `provider-health.tsx:57` | Same `POST /api/dev/discovery/run {live:true}` but `cellKey:null` → `harvest.ts:17` `gaps_ranked.slice(0,3)` gap-aware (3 themes) → same job store | **API:** `scripts/harvest-verify.mjs --api harvest --live --monitor` <br> **UI:** `tests/e2e/harvest-buttons.spec.ts` `test('@harvest live harvest via UI')` — same auth → `Discovery` → `getByTestId('provider-health-run-live-harvest').click()` → `waitForResponse POST 202 {jobId,cellKey:null}` → assert `polling 1.5s` + `localStorage auditorai.discovery.jobId === jobId` | 1.5 s poll `GET /api/dev/discovery/jobs/:id` → `state/harvest-verify/<jobId>.json` + `HV7-latest.json` | Gap-aware: job `done`, `coverage.gaps_ranked` recomputed (`generated==ranAtIso`), `queue[0..2]` matches gaps, ledger `0..N`, `target_total` unchanged, dedupe `==packages` |
| **C** | **Start** — AI Harvest Stream (gpt-5-nano web-search, never stops till verified) | `ai-harvest-control.tsx:139` `AiHarvestControl` in `page.tsx:411` `ai-harvest` segment (`Segmented` `ai-harvest`) <br> `data-testid="ai-harvest-start"` <br> `input placeholder="cellKey e.g. uk:PRELIMINARY_DESIGN"` + `checkbox live` (`aria-label "live web search via gpt-5-nano"`) | `POST /api/dev/harvest-stream {live, cellKey}` `harvest-stream/route.ts:18` (`createStream` → `201 {streamId, stream}` status `RUNNING`) → `GET /api/dev/harvest-stream/:id` `harvest-stream/[id]/route.ts:6` auto-ticks when `RUNNING` (1s debounce) — iteration → `VERIFYING` → `DONE|FAILED` | **API:** `scripts/harvest-verify.mjs --api harvest-stream [--cellKey <cellKey>] --live --monitor` <br> # dry seed-only: omit `--live` (→ `live:false`) <br> # gap-aware: omit `--cellKey` (→ `cellKey:null`) <br> **UI:** `tests/e2e/harvest-buttons.spec.ts` `test('@harvest ai harvest stream via UI')` — same auth → `AI Harvest` tab → `getByTestId('ai-harvest-start').click()` → `waitForResponse POST /api/dev/harvest-stream 201` → `GET /api/dev/harvest-stream/:id` poll 2s | 2 s poll `GET /api/dev/harvest-stream/:id` (`ai-harvest-control.tsx:100` ponytail: 2s ceiling) → `state/harvest-verify/stream-<streamId>.json` + `harvest-stream-latest.json` (ticks, `S` seam, HV5-lite) | Stream `DONE` with `packages≥1` unique, `quality_score==1`, coverage present, or `FAILED` after `maxIterations` — ledger/dedupe deltas also snapshotted via J/L/C/D/H seams |
| — | *All* use `x-admin-key` via `adminApi` (`src/lib/client.ts:80` `ADMIN_KEY_ITEM auditorai.admin_key` → header `x-admin-key`) | — | `requireAdmin` 401 / `UnknownCellKeyError` 400 / `StoreUnavailableError` 503 / `harvest lock held` `error` vs 402 `Degraded` vs `busy 202→error` surfaced via `gapRunError`/`runError` | — | — | Dry never degraded; Live 402 → `Degraded` not fail; Busy → `Skipped` |

### Same seam, thin driver difference

`scripts/harvest-verify.mjs` is the single monitor (HV3) — `node + fetch + DataStore` seam, no new deps, 1.5 s for discovery / 2 s for harvest-stream. The **API harness is the driver that creates the job/stream** (`POST` + `ADMIN_KEY` + 202/201 vs 400/401 handling) and hands the returned `jobId`/`streamId` to the **same poll loop** the UI uses. The **UI harness is the same driver exercised through the DOM** (`localStorage` + `Segmented` + `data-testid`) — it asserts that clicking the button produces the same `waitForResponse` payload the API harness would have sent, then leaves the same `state/harvest-verify/*.json` shape for HV6/HV7 to assert against `docs/research/harvest-success-criteria.md:1`.

```
button click ─┐
              ├─► POST /api/dev/discovery/run {live,cellKey?} ─► jobId ─► GET /api/dev/discovery/jobs/:id 1.5s
              │                                              └─► J/L/C/D/H/P/Q HV5 assert → state/harvest-verify/<jobId>.json
              │
              └─► POST /api/dev/harvest-stream {live,cellKey?} ► streamId ► GET /api/dev/harvest-stream/:id 2s
                                                              └─► S seam + snapshots → state/harvest-verify/stream-<id>.json
```

## Selectors (stable, never lint build output `.next` `.vercel`)

| Target | Selector | File:line |
|---|---|---|
| Per-gap card | `[data-testid="gap-card-{cellKey}"]` e.g. `gap-card-canada:PRELIMINARY_DESIGN` | `queue-ticker.tsx:114` |
| Gap details hotspot | `[data-testid="gap-details-{cellKey}"]` | `queue-ticker.tsx:132` |
| **Run this gap (Live)** | `[data-testid="run-gap-{cellKey}"]` `aria-label="Run gap {key} live"` | `queue-ticker.tsx:168` |
| **Run live harvest** | `[data-testid="provider-health-run-live-harvest"]` `aria-label="Run one live harvest batch — POST /api/dev/discovery/run"` | `provider-health.tsx:381` |
| **Start** (AI Harvest) | `[data-testid="ai-harvest-start"]` in `ai-harvest` segment | `ai-harvest-control.tsx:143` |
| AI cellKey input | `input[placeholder="cellKey e.g. uk:PRELIMINARY_DESIGN or empty for gap-aware"]` | `ai-harvest-control.tsx:122` |
| Live checkbox | `input[aria-label="live web search via gpt-5-nano"]` | `ai-harvest-control.tsx:134` |
| Admin gate | `input[placeholder="paste admin key"]` + button `Save & reload` | `page.tsx:241` + `page.tsx:251` |
| Storage | `localStorage auditorai.admin_key` (`client.ts:11`) and `auditorai.discovery.jobId` (`provider-health.tsx:57`) | — |

Add-or-keep: all three `data-testid` values above are present and must stay. New UI for harvest-stream reuses the same `ADMIN_KEY` gate and `auditorai.admin_key` localStorage path.

## One-Liners (copy-paste, ADMIN_KEY via env `auditorai/opencode` Keychain or `security find-generic-password -a "$USER" -s auditorai/opencode -w`)

```bash
# help
node scripts/harvest-verify.mjs --help
node scripts/harvest-verify.mjs --mock

# API — gap-targeted (Live) — mirrors queue-ticker Run this gap
ADMIN_KEY=$(security find-generic-password -a "$USER" -s auditorai/opencode -w) \
  node scripts/harvest-verify.mjs --api gap --cellKey usa:DETAILED_DESIGN --live --monitor
# evidence → state/harvest-verify/<jobId>.json  (also HV6-latest.json)

# API — gap-aware (Live) — mirrors provider-health Run live harvest
ADMIN_KEY=$(security find-generic-password -a "$USER" -s auditorai/opencode -w) \
  node scripts/harvest-verify.mjs --api harvest --live --monitor
# evidence → state/harvest-verify/<jobId>.json  (also HV7-latest.json)

# API — harvest-stream gap-aware (empty cellKey, dry seed-only)
ADMIN_KEY=$(security find-generic-password -a "$USER" -s auditorai/opencode -w) \
  node scripts/harvest-verify.mjs --api harvest-stream --live --monitor
# POST /api/dev/harvest-stream {live:true, cellKey:null} -> streamId, poll 2s GET /api/dev/harvest-stream/:id
# evidence → state/harvest-verify/stream-<streamId>.json  (also harvest-stream-latest.json)

# API — harvest-stream gap-targeted (Live) — mirrors ai-harvest Start with cellKey
ADMIN_KEY=$(security find-generic-password -a "$USER" -s auditorai/opencode -w) \
  node scripts/harvest-verify.mjs --api harvest-stream --cellKey uk:PRELIMINARY_DESIGN --live --monitor
# dry seed-only variant: omit --live (or add --dry)

# API — dry deterministic (no quota, CI gate, HV3)
ADMIN_KEY=test-admin-key-0123456789abcdef node scripts/harvest-verify.mjs --dry --api gap --cellKey usa:PRELIMINARY_DESIGN --monitor

# UI — all three buttons via Playwright (tagged @harvest, admin gate handled)
ADMIN_KEY=$(security find-generic-password -a "$USER" -s auditorai/opencode -w) \
  npx playwright test tests/e2e/harvest-buttons.spec.ts -g "@harvest" --project=chromium
ADMIN_KEY=test-admin-key-0123456789abcdef npx playwright test tests/e2e/harvest-buttons.spec.ts -g "gap via UI"
ADMIN_KEY=test-admin-key-0123456789abcdef npx playwright test tests/e2e/harvest-buttons.spec.ts -g "live harvest via UI"
ADMIN_KEY=test-admin-key-0123456789abcdef npx playwright test tests/e2e/harvest-buttons.spec.ts -g "ai harvest stream via UI"

# Preview/production harnesses (same one-liners, just baseUrl)
HARVEST_BASE_URL=https://<preview>.vercel.app ADMIN_KEY=... node scripts/harvest-verify.mjs --api gap --cellKey uk:FEASIBILITY_CONCEPT --live --monitor
```

### What each one-liner proves

- Discovery `gap`/`harvest` → before/after `ledgerTotal`, `dedupe.sha256Entries`, `coverage.gaps_ranked`, `health.lastRunAt` plus `job.logs D01..D10` (12 seams J/L/C/D/H/P/Q) and HV5 `pass/degraded/skipped` verdict in stdout + `state/harvest-verify/*.json`. Busy → 202 then job `error harvest lock held`, 400 UnknownCellKey not conflated, 401/503 surfaced.
- Harvest-stream → same snapshots plus `S: streamId`, `status RUNNING→VERIFYING→DONE/FAILED`, `packages.length`/`quality`, `logs` 2s cadence, and `ticks[].status` ledger. Local UI `Start` and API `--api harvest-stream` hit identical `POST` seam and produce identical evidence shape, only the driver (`fetch` vs `click` + `localStorage`) differs.
- UI harness reuses the same `x-admin-key` storage (`auditorai.admin_key` → header) and asserts the same invariants via `waitForResponse` payload checks (`{live,cellKey}` round-trip) and visible `polling 1.5s` / `Poll 2s` + disabled `Running…` / `iter N/M` progress — no forked backend.

## Links

- HV3 monitor: `scripts/harvest-verify.mjs:1` (J/L/C/D/H/P/Q 1.5s, S 2s, `--help` lists `harvest-stream`, `--mock` 3 demos)
- HV5 oracle: `docs/research/harvest-success-criteria.md:1` + `CONTEXT.md` canonical terms (Gap-Targeted/Gap-Aware/Harvest Success/Degraded/Skipped/Dry vs Live)
- Seams: `docs/research/harvest-backend-seams.md:1` (12-seam table), `docs/research/harvest-ui-wiring.md:1` (selectors, localStorage survival, dedupe double-count guard)
- Tests: `tests/e2e/harvest-buttons.spec.ts:1` (`@harvest` 3 cases, admin gate, `data-testid` `run-gap-*` / `provider-health-run-live-harvest` / `ai-harvest-start`, segment `discovery` vs `ai-harvest`, 1.5s vs 2s invariants)
- Tickets: `HV1` closed, `HV2` closed, `HV3` closed (`--mock` + `--help` green), `HV5` locked — this `HV4` unblocks `HV6`/`HV7` live-verify
