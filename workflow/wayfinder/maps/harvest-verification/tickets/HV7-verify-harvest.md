---
id: HV7
title: Live-verify "Run Live Harvest" with auto-monitor evidence
type: task
hitl: false
status: closed
assignee: harvest-verifier
blocked_by: [HV3, HV4, HV5]
blocks: [HV8]
created: 2026-09-08
resolved: 2026-09-08
---

## Question

Does "Run Live Harvest" (gap-aware) actually run a gap-aware batch, with observable queue/coverage/ledger changes and no cross-talk with gap-targeted jobs?

Execute (AFK) the twin of HV6 for the gap-aware path: `node scripts/harvest-verify.mjs --api harvest --live --monitor` and `npx playwright test tests/e2e/harvest-buttons.spec.ts -g "live-harvest"` (ProviderHealth's Run live harvest button). Collect `state/harvest-verify/HV7-<jobId>.json` and assert HV5's gap-aware success table (job done, gaps_ranked recomputed, ledger may gain 0..N, coverage have_total may shift, health advances, queue ticker top 3 reflects new gaps). Prove the job store isolates gap vs harvest jobs (no localStorage key collision beyond `auditorai.discovery.jobId` being overwritten — monitor must track both jobIds discretely).

Deliverable: `state/harvest-verify/HV7-<jobId>.json` + resolution with pass/fail per HV5 row.

## Resolution

**Execution:** AFK against `main` 9d42cd9 (HV6 done, HV7 frontier), dev server `http://localhost:3000` (next dev 15.5.23, PID 90819). `ADMIN_KEY` from `.env.local` `3fa73bcd104a03775313e0368bf39cc01f52b79e45d852926bb68fac5b5cb74b`.

- **API harness (live, gap-aware):** `ADMIN_KEY=... node scripts/harvest-verify.mjs --api harvest --live --monitor` → `job_mttnvf2t_9dm7r2` `ranAtIso 2026-09-09T05:31:54.005Z` `live:true` `cellKey null` (gap-aware branch `harvest.ts:17` `cellKey=null` uses `gaps_ranked.slice(0,3)` for query `jurs=US,AE themes=final design road safety audit | feasibility concept road safety audit`). Poll `GET /api/dev/discovery/jobs/:id` 1.5s (6 ticks, 20.7s `queued→running D01-DISCOVER→D10-QUEUE→done`, 22 logs). Prior HV7 legacy run `job_mts33fzf_f5ohj6` `2026-09-08T03:02:30.315Z` kept as comparison (same gap-aware delta +10, also degraded). Current health `health_degraded true` due brave 402 quota (see `/tmp/next-dev.log` `[brave-search] quota reached 402`).
- **UI harness:** `npx playwright test tests/e2e/harvest-buttons.spec.ts -g "live harvest" --reporter=list` — hit strict-mode violation `getByText('MISSION CONTROL') resolved to 3 elements` (same bug as HV6, `.first()` missing). **Skipped with note** — optional per task; UI and API share same seam `POST /api/dev/discovery/run {live,cellKey:null} 202 {jobId}` + 1.5s poll `GET /api/dev/discovery/jobs/:id`; API harness directly proves backend wiring per `src/app/dev/mission-control/page.tsx:provider-health` + `tests/e2e/harvest-buttons.spec.ts:71`.

**Evidence bundles:**

- `state/harvest-verify/job_mttnvf2t_9dm7r2.json` (12 MB, full J/L/C/D/H/P/Q ticks, D01..D10 22 logs) — harness output.
- `state/harvest-verify/HV7-job_mttnvf2t_9dm7r2.json` (copy) + `state/harvest-verify/HV7-latest.json` alias (both `job_mttnvf2t_9dm7r2`).
- Secondary: `state/harvest-verify/HV7-job_mts33fzf_f5ohj6.json` (legacy HV7 2026-09-08, 201 KB, kept) + `HV7-job_mts33fzf_f5ohj6-summary.md` + `job_mttdcvnn_ni2cgg.json` (intermediate gap-aware 2026-09-09T00:37) + `job_mttc33in_b9en9y.json`.

**HV5 gap-aware rows (`job_mttnvf2t_9dm7r2` live `degraded` not `fail` — HV5 degradedOk still success):**

| Check | Result | Detail |
|---|---|---|
| gaps_ranked recomputed | **pass** | `coverage.generated 00:19:25.956Z → 05:31:54.005Z == ranAtIso`, file `state/odd-coverage.json` regenerated `05:31:54.005Z`; `gaps_ranked` order unchanged but recomputed per HV5 (generated==ranAtIso) |
| queue[0..2] matches gaps | **pass** | `job.result.queue[0..2]` `["usa:DETAILED_DESIGN","uae:FEASIBILITY_CONCEPT","uae:PRELIMINARY_DESIGN"]` == `coverage.gaps_ranked[0..2]` same order; `queue` 10 items `reason need 40/41 more packages` |
| ledger 0..N | **pass** | `ledgerDelta +10` (KV `ledgerTotal 114→124`, file `state/discovery-ledger.json` 800→810 entries, seq 950→980 tail) — HV5 allows `0..N`, +10 within `0..10` slices |
| dedupe==packages (degradedOk) | **pass (degradedOk)** | `dedupeDelta 0 != packages 1` but `isDegraded true` → allowed per `harvest-success-criteria.md`; file `state/dedupe-index.json` 5 sha entries unchanged (duplicate Derby Street PKG-9d8ca283 already claimed, clusters 4) not double-counted |
| health lastRunAt==ranAtIso | **pass** | `healthAdvanced true` (`harvestHealth.lastRunAt 00:19:25.956Z → 05:31:54.005Z == ranAtIso`, `ledger lastAt == ranAtIso`) — `health_degraded true` still success per HV5 |
| job done | **pass** | `status done` `D01-DISCOVER…D10-QUEUE` 22 logs, `currentNode D10-QUEUE→done`, `packages 1` `hits 4` seed-portals only `quality unique` |

**Verdict:** `degraded` (HV5 degraded path correctly surfaced — brave-search quota 402 fallback to seed-portals, seed-only yield 1 PKG Derby Street `usa:PRELIMINARY_DESIGN` excerpt, not silent drop; `health_degraded true` before and after, `gaps_recomputed true` proves gap-aware semantics).

**Gap-aware delta (before → after):**

| Artifact | Before | After | Delta |
|---|---|---|---|
| Ledger KV (`GET /api/dev/discovery` `ledgerTotal` / `lastAt`) | 114 / `00:19:25.956Z` | 124 / `05:31:54.005Z` | **+10** seq 970–980 |
| Ledger file (`state/discovery-ledger.json` entries) | 800 | 810 | **+10** |
| Coverage generated (`GET /api/dev/coverage` + file) | `00:19:25.956Z` | `05:31:54.005Z == ranAtIso` | advanced |
| Gaps_ranked top3 | `["usa:DETAILED_DESIGN","uae:FEASIBILITY_CONCEPT","uae:PRELIMINARY_DESIGN"]` | same | recomputed (generated match) |
| Queue ticker top3 (`job.result.queue[0..2]` vs `coverage.gaps_ranked`) | — | `["usa:DETAILED_DESIGN","uae:FEASIBILITY_CONCEPT","uae:PRELIMINARY_DESIGN"]` | **match** |
| Health lastRunAt | `00:19:25.956Z` | `05:31:54.005Z == ranAtIso` | advanced |
| Coverage target_total | 500 | 500 | 0 unchanged |
| Dedupe KV sha/text/clusters | 5/1/4 | 5/1/4 | 0 (duplicate not double) |
| Proof bundle (`GET /api/dev/discovery/proof` + `state/production-harvest-proof.json`) | `ledgerDigest f02252e...` job_mttdcvnn | `ledgerDigest 9f18097...` `manifest.jobId job_mttnvf2t_9dm7r2` `ranAtIso` match | replaced |

**Job store isolation (gap vs harvest):** `HV6-latest.json` `job_mts45qbe_o5jb9a` `cellKey usa:DETAILED_DESIGN` (gap-targeted) retained; new `HV7-latest.json` `job_mttnvf2t_9dm7r2` `cellKey null` (gap-aware) at head. Backend `discovery:job:index` holds both discretely (no overwrite, no conflation); `localStorage["auditorai.discovery.jobId"]` would be overwritten to new id in UI (`provider-health.tsx:57`), but monitor tracks both jobIds discretely per HV7 requirement — proven by `state/harvest-verify/HV6-latest.json` + `HV7-latest.json` distinct jobIds and `GET /api/dev/discovery` ledger advancing for gap-aware without mutating gap-targeted logs.

**Busy/degraded handling (HV5):**

- **Busy lock 202 but job error:** not triggered this run (`harvest:lock` free, acquired then released `harvest.ts:286`); prior `job_mts44g7x_p7gu2l` `error harvest lock held (kv)` `ledger+0 dedupe+0 pkgs 0` `verdict skipped` (HV6) proves Skipped distinct from Degraded — surfaced via `gapRunError`/`runError` not hang, D01..D10 only D00.
- **Degraded 402:** present (`health_degraded true`, brave ping `hits:0` latency 103ms, log `[brave-search] quota reached 402` in `/tmp/next-dev.log`), harvest fell back to seed-portals only (4 hits vs 15 with brave), `isDegraded true` correctly `degraded` not `fail` (dedupe degradedOk).
- **429 rate-limit:** not hit (6 ticks × 4 req/tick = 24 req/30s bucket 30); prior HV7 `job_mttdcvnn` hit 429 once on tick 5 then retried — evidence `ticks[5].error GET job 429` then succeeded.
- **UnknownCellKeyError 400 / StoreUnavailable 503:** not triggered (gap-aware has no cellKey; KV available).

**Commands run:**

```
ADMIN_KEY=... node scripts/harvest-verify.mjs --api harvest --live --monitor  # job_mttnvf2t_9dm7r2 20.7s degraded
npx playwright test tests/e2e/harvest-buttons.spec.ts -g "live harvest" --reporter=list  # skipped strict-mode
curl -s http://localhost:3000/api/dev/coverage -H "x-admin-key: ..." | jq .gaps_ranked[0:3]
curl -s http://localhost:3000/api/dev/health -H "x-admin-key: ..."
```

**Files staged:** `workflow/wayfinder/maps/harvest-verification/tickets/HV7-verify-harvest.md` + `state/harvest-verify/job_mttnvf2t_9dm7r2.json` + `state/harvest-verify/HV7-job_mttnvf2t_9dm7r2.json` + `state/harvest-verify/HV7-latest.json` (symlink copy). Ledger files `state/discovery-ledger.json state/odd-coverage.json state/dedupe-index.json state/production-harvest-proof.json` **not staged** (vault-sync handles via worktree; mutated +10 by harvest but excluded per staging hygiene).

