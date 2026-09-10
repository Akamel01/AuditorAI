# H10 Work Plan — Verify continuous reach-out (monitor + prod baseURL + live procedures)

Source (verbatim): `.autoforge/architecture/H10.md` (99 lines, §§1–9) + ticket `workflow/wayfinder/maps/ai-harvest-stream/tickets/H10-verify-continuous.md`.
Route shapes confirmed read-only: `src/app/api/dev/harvest-stream/route.ts`, `[id]/route.ts`, `[id]/stop/route.ts`, `[id]/pause/route.ts`, `[id]/resume/route.ts` — worker uses these exactly, no new route.
Live prod: `https://auditorai-gamma.vercel.app`. `ADMIN_KEY` runtime-only via keychain/CI secret, NEVER in files/logs/evidence.
Budget: **2 live streams total, sequential, off-peak. No reruns on quota refusal** (402/quota = degraded evidence, not retry).

## Modules

### M1 — Monitor extension (`harvest-stream` branch, in place)
- **Objective:** extend branch (`scripts/harvest-verify.mjs` ll.182–268) with `--maxTicks N` (default 6), `--stop`, `--continuous=true|false` (default true); P1 stop-path exits 0; `--mock` byte-identical.
- **Inputs:** H10 §3; current branch code (POST body `{live,cellKey}` l.194, 2s poll l.218, terminal-break l.237, bundle ll.245–261).
- **Outputs:** same command shape + flags; `state/harvest-verify/HV10-stream_<id>.json` (+ existing `stream-<id>.json` alias); exit `0`=asserted path / `1`=assert/transport fail / `2`=argv misuse.
- **Touches:** `["scripts/harvest-verify.mjs"]`
- **Behavior (exact):**
  - POST `continuous` from flag: `body = { live, continuous, ...(cellKey?{cellKey}:{}) }`.
  - Poll 2s; **break on `--maxTicks` RUNNING/VERIFYING ticks BEFORE the 180s arm** (180s stays as backstop only — current hang-to-timeout is the bug).
  - Per-tick asserts (P1): `status ∈ {RUNNING, VERIFYING}` (RUNNING dominant; VERIFYING = mid-tick race, H10 §2); `iteration` strictly ↑; `packages.length` non-decreasing; every new-package `url` matches `^https?://`; joined `logs` contain Exa/Jina trace substrings (worker quotes exact live substrings) + `continuous next` markers.
  - `--stop` path: `POST /api/dev/harvest-stream/:id/stop` → one confirming GET → assert `status==FAILED` + `error~/stopped by operator/` → exit 0. Any other terminal (DONE, pre-stop FAILED, timeout) → exit 1.
  - `--continuous=false`: no `--stop`; poll to terminal; assert `FAILED` + `error~/max iterations/i` → exit 0 (P2).
  - P3 folded: before `--stop`, `POST …/:id/pause` → assert `PAUSED`, `POST …/:id/resume` → assert `RUNNING` (retry one poll on mid-tick race before failing). Only split to own stream if racy (see M6 fallback).
  - Bundle `meta` records `baseUrl`, never key. Help text +3 lines.
- **NO:** `src/discovery/harvest-stream.ts`, thresholds, daemon/cron, `--mock` path, CI wiring.
- **Tests:** `node scripts/harvest-verify.mjs --mock` still 3-pass (byte-behaviour); `npm run test` (H7 provider + H8 stream suites) green.
- **Acceptance:** `arch §3 P1/P2/P3 + exit codes; §8 row 1 (small, one branch)`.
- **Agent role:** builder. **Reviewer:** diff must show branch-only edit, `--mock` untouched.

### M2 — Playwright prod baseURL seam
- **Objective:** ~3-line seam in `playwright.config.ts:9` + conditional webServer.
- **Touches:** `["playwright.config.ts"]`
- **Exact edit:**
  ```ts
  baseURL: process.env.PLAYWRIGHT_BASE_URL || process.env.HARVEST_BASE_URL || "http://localhost:3000",
  webServer: process.env.PLAYWRIGHT_BASE_URL || process.env.HARVEST_BASE_URL ? undefined : { …current… },
  ```
  Default unchanged: bare `npx playwright test` → localhost + local server.
- **Acceptance:** arch §4; local run behavior identical; prod run boots no local server.

### M3 — E2E ai-harvest block extension
- **Objective:** extend block `tests/e2e/harvest-buttons.spec.ts` ll.101–158 only: Start-continuous → 2× GET `RUNNING` → Stop click → `FAILED`/`stopped` assert; tighten POST assert to **request** `postDataJSON().continuous === true` (current ll.137–144 falls back to response echo — keep response as fallback, request primary); assert POST body `continuous:true` recorded in test evidence.
- **Touches:** `["tests/e2e/harvest-buttons.spec.ts"]`
- **Acceptance:** arch §5 e2e sequence; no new spec file.

### M4 — LIVE P1 continuous-stop (+ P3 folded) — prod stream #1
- **Depends on:** M1, M2, M3 (code first). **Touches:** `["state/harvest-verify/HV10-*.json", "state/harvest-verify/stream-*.json"]` + prod KV (shared mutable → sequential, never parallel).
- **Pre-flight (copy-paste):**
  ```sh
  test -n "$(security find-generic-password -a "$USER" -s auditorai/opencode -w 2>/dev/null)" && echo KEYCHAIN_OK || echo KEYCHAIN_MISSING
  ```
  (Checks presence only — never prints the value.)
- **Live command (copy-paste, secret-hygienic — value never echoed, never logged):**
  ```sh
  ADMIN_KEY="$(security find-generic-password -a "$USER" -s auditorai/opencode -w)" \
  HARVEST_BASE_URL=https://auditorai-gamma.vercel.app \
  node scripts/harvest-verify.mjs --api harvest-stream --live --monitor --maxTicks 6 --stop --continuous=true
  ```
- **Verdict P1 (all must hold):** N=6 ticks all `RUNNING`/`VERIFYING` (RUNNING dominant); `iteration` strictly ↑ each tick; `packages` non-decreasing; all new `url`s `^https?://`; logs show Exa/Jina trace + `continuous next` (quote substrings into run notes); `--stop` → GET `FAILED` + `error~/stopped by operator/`; exit 0; bundle `state/harvest-verify/HV10-stream_<id>.json` written, `meta` has `baseUrl` prod, no key.
- **Verdict P3 (same stream, before stop):** pause → `PAUSED`; resume → `RUNNING` (one-poll retry allowed). If racy mid-tick → record, skip, M6 fallback decides (no extra stream without explicit note).
- **On quota refusal (402 etc.):** stop, keep evidence, report DEGRADED — no rerun.

### M5 — LIVE P2 FAILED-at-cap (H8 carry) — prod stream #2
- **Depends on:** M4 (sequential — shared prod KV). **Touches:** `["state/harvest-verify/HV10-*.json"]` + prod KV.
- **Live command (copy-paste):**
  ```sh
  ADMIN_KEY="$(security find-generic-password -a "$USER" -s auditorai/opencode -w)" \
  HARVEST_BASE_URL=https://auditorai-gamma.vercel.app \
  node scripts/harvest-verify.mjs --api harvest-stream --live --monitor --continuous=false
  ```
  Gap-aware (no `--cellKey`) unless a 0-yield cell is naturally known; do NOT hunt cells with extra streams (budget is 2).
- **Verdict P2:** poll reaches terminal `FAILED` + `error~/max iterations/i`; exit 0; evidence bundle written. (Unit covers DONE-fallback per H8-final §6b; live closes only the FAILED side.)

### M6 — LIVE prod e2e + regression + evidence close-out
- **Depends on:** M4, M5 (runs last). **Touches:** `["workflow/wayfinder/maps/ai-harvest-stream/tickets/H10-verify-continuous.md"]` (resolution only) + reads evidence.
- **Live e2e (copy-paste):**
  ```sh
  PLAYWRIGHT_BASE_URL=https://auditorai-gamma.vercel.app \
  ADMIN_KEY="$(security find-generic-password -a "$USER" -s auditorai/opencode -w)" \
  npx playwright test -g "ai harvest stream"
  ```
- **Verdict e2e:** Start-continuous → 2 polls `RUNNING` → Stop → `FAILED`/`stopped`; request `continuous:true` asserted.
- **Regression (local, no quota):**
  ```sh
  node scripts/harvest-verify.mjs --mock
  npm run test
  ```
  Expect `--mock` 3-pass; H7+H8 suites green.
- **Close-out:** confirm `state/harvest-verify/HV10-stream_*.json` (P1, P2) exist, contain no key; check all 5 ticket boxes; resolve ticket. P3 fallback: only if M4 pause/resume skipped-as-racy → one extra stream permitted (document why); otherwise P3 verdict stands on M4 evidence.

## Execution Work Order (DAG — sequential, shared-state guard)

```
M1 (monitor) ─┐
M2 (baseURL) ─┼─→ M4 LIVE P1+P3 (stream #1) ─→ M5 LIVE P2 (stream #2) ─→ M6 e2e+regression+close
M3 (e2e blk) ─┘        (prod KV shared mutable: M4↔M5 never parallel)
```
- Parallelizable: M1 ∥ M2 ∥ M3 (disjoint touches). Everything else sequential.
- Intersecting touches: M4/M5 share prod KV + `state/harvest-verify/` → strictly sequential. M6 reads evidence M4/M5 wrote → last.

## Rollback
- Code: `git checkout -- scripts/harvest-verify.mjs playwright.config.ts tests/e2e/harvest-buttons.spec.ts` (worker: revert only, no add/commit/push per constraints).
- Live: any still-`RUNNING` prod stream → `POST https://auditorai-gamma.vercel.app/api/dev/harvest-stream/<id>/stop` with keychain `ADMIN_KEY` (same secret pattern, stop promptly so continuous loops don't accumulate in prod KV).
- Evidence: KEEP `state/harvest-verify/HV10-*.json` (degraded/partial bundles are findings, not trash).

## Hygiene (AGENTS.md)
- Explicit `git add` only by later commit session; worker does **no add/commit/push**. Never write literal skip-ci token. Never paste key values; redact in logs.

## Arch-line → module traceability (acceptance completeness)
| Arch | Maps to |
|---|---|
| §1 table (Monitor/e2e/core seams) | M1 / M2+M3 / read-only (no touch) |
| §2 tick semantics + VERIFYING race | M1 asserts, M4 verdict |
| §3 argv + P1/P2/P3 + exit codes | M1 (+ M4/M5/M6 verdicts) |
| §4 baseURL seam + secrets | M2, secret pattern in M4/M5/M6 |
| §5 order/budget (2 streams seq, maxTicks 6, 2-poll e2e) + prod e2e cmd | M4→M5→M6 |
| §6 Alt A chosen / B+C rejected | M1 in-place (no fork, no new file) |
| §7 risks (quota/KV/races/hang/stop-shape/secrets) | M1 (maxTicks-before-timeout), M4/M5 (seq, no-retry, prompt stop), M6 (regression) |
| §8 touches table + NO-touch row | M1/M2/M3/M4-evidence; stream core/thresholds/daemon/`--mock`/CI untouched |
| §9 ticket-line mapping (5 boxes + H8/H3 carries) | M4 (box 1), M6-e2e (box 2), M6-regression (box 3), M4+M5 bundles (box 4), M5 (H8 carry), M4-folded (H3 carry) |
| Ticket out-of-scope (thresholds, daemon/cron) | untouched |
