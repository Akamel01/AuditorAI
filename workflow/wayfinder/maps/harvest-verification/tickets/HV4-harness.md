---
id: HV4
title: Build one-command harnesses for both buttons (API + UI)
type: prototype
hitl: true
status: closed
assignee: harvest-harness
blocked_by: [HV1, HV2]
blocks: [HV6, HV7]
created: 2026-09-08
resolved: 2026-09-08
---

## Question

How can an engineer (or CI) verify *both* harvesting entry points with one command each, and know which button was exercised?

Prototype two harnesses that hit the same backend seam but are traceably distinct:

- **API harness**: `scripts/harvest-verify.mjs --api gap  --cellKey <key> [--live]` and `--api harvest [--live]` — POST /api/dev/discovery/run with the same payloads the UI uses, then hand the jobId to the HV3 monitor. Must set `x-admin-key` and handle 202 vs 400 (UnknownCellKey) vs 401. Extend to also cover AI Harvest Stream Start button at /dev/mission-control ai-harvest tab (POST /api/dev/harvest-stream {live,cellKey} -> streamId, poll 2s GET /api/dev/harvest-stream/:id).

- **UI harness**: `tests/e2e/harvest-buttons.spec.ts` (Playwright) — visits `/dev/mission-control`, pastes admin key into the `auditorai.admin_key` gate, clicks `Run this gap (Live)` on a known gap card (`data-testid=run-gap-*`) and separately clicks `Run live harvest` in ProviderHealth and `Start` in ai-harvest-control.tsx (`data-testid=ai-harvest-start` on al-harvest tab), asserting the same backend invariants as the API harness but via the UI's localStorage + polling path.

Both should reuse the HV3 monitor for backend evidence so API vs UI is a thin driver difference, not a fork. Keep selectors stable (`data-testid=gap-card-*`, `data-testid=run-gap-*`, `data-testid=provider-health-run-live-harvest`, `data-testid=ai-harvest-start`) — add them if missing.

Deliverable: two runnable harnesses + a `docs/research/harness-design.md` that maps button → harness → backend seam and shows the one-liner to run each.

## Resolution

Closed 2026-09-08 — one-command harnesses for all harvesting buttons (API + UI) reuse HV3 monitor so API vs UI is a thin driver, not a fork.

**API harness** — extended `scripts/harvest-verify.mjs:1` to support `--api harvest-stream [--cellKey] [--live]` alongside existing `POST /api/dev/discovery/run` gap/harvest (keep 1.5s poll). Harvest-stream: `POST /api/dev/harvest-stream {live,cellKey}` → `streamId` (201), then poll `2s GET /api/dev/harvest-stream/:id` until `DONE|FAILED` (auto-tick via `tickStream` 1s debounce). Handles `--dry` → `live:false`, optional `cellKey` (null = gap-aware), `x-admin-key` via `ADMIN_KEY`, 400/401/503, emits `state/harvest-verify/stream-<streamId>.json` + `harvest-stream-latest.json` (separate from `HV6/HV7-latest.json`). Discovery `gap`/`harvest` still 1.5s via `GET /api/dev/discovery/jobs/:id`, emits `<jobId>.json`. `--help` now lists `harvest-stream` + `S` seam, `--mock` 3 demos pass.

**UI harness** — `tests/e2e/harvest-buttons.spec.ts:1` Playwright `@harvest` 3 specs visiting `/dev/mission-control`, handling admin gate via `addInitScript auditorai.admin_key` + gate fallback (`input[placeholder="paste admin key"]` → `Save & reload`), then:
- `gap via UI` (`Discovery` → `[data-testid^="run-gap-"]` first, assert `gap-card-*`/`gap-details-*` stable, click → `waitForResponse POST /api/dev/discovery/run {live:true,cellKey}` 202 + `jobId` echoed, assert `polling 1.5s` + disabled `Running…`);
- `live harvest via UI` (`Discovery` → `[data-testid="provider-health-run-live-harvest"]` `aria-label` check, click → POST `{live:true,cellKey:null}` 202, assert `polling 1.5s` + `localStorage auditorai.discovery.jobId`);
- `ai harvest stream via UI` (`AI Harvest` → `[data-testid="ai-harvest-start"]` + `cellKey` input + `live` checkbox, click → POST `/api/dev/harvest-stream {live,cellKey}` 201 `streamId`, poll 2s `GET /:id`, assert `Poll 2s` footer + `stream` badge).

**Data-testids (verified/added):** `queue-ticker.tsx:168` `run-gap-{cellKey}`, `queue-ticker.tsx:114` `gap-card-{key}`, `queue-ticker.tsx:132` `gap-details-{key}`, `provider-health.tsx:381` `provider-health-run-live-harvest`, `ai-harvest-control.tsx:143` `ai-harvest-start` — all present, no lint drift.

**Doc:** `docs/research/harness-design.md:1` maps button → harness → backend seam (discovery `POST /api/dev/discovery/run` 202 1.5s vs harvest-stream `POST /api/dev/harvest-stream` 201 2s) + selector table + one-liners for `ADMIN_KEY=... node scripts/harvest-verify.mjs --api gap/harvest/harvest-stream --live --monitor` and `npx playwright test -g "@harvest"` (gap/harvest/stream), plus dry/preview variants. Reuses `docs/research/harvest-backend-seams.md:1` + `harvest-ui-wiring.md:1` seams, asserts HV5 oracle `harvest-success-criteria.md:1`.

**Verification:** `npm run lint` 0, `npm run typecheck` 0, `node scripts/harvest-verify.mjs --help` shows `harvest-stream`, `node scripts/harvest-verify.mjs --mock` 3 pass, `npx playwright test tests/e2e/harvest-buttons.spec.ts --list` shows 3 `@harvest` tests. No ledger state files mutated beyond `state/harvest-verify/` evidence dir.

**Next:** blocks `HV6`/`HV7` now unblocked for live-verify with auto-monitor evidence.
