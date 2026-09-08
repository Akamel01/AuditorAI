# Harvest Success Criteria — HV5 Oracle (locked 2026-09-08 HITL)

Grilled via `workflow/wayfinder/maps/harvest-verification/tickets/HV5-success-criteria.md` with domain-modeling. Defines what counts as *harvesting worked* for the two entry points `Run this gap (Live)` (gap-targeted `cellKey`) and `Run Live Harvest` (gap-aware `cellKey=null`), between `dry` vs `live`, and between `success` vs `degraded` vs `skipped/busy`.

Source seams: `src/discovery/harvest.ts:373` (gap-aware `gaps_ranked.slice(0,3)` vs gap-targeted `UnknownCellKeyError`), `src/discovery/pipeline.ts:83` `D01..D10`, `src/discovery/ledger.ts:10`, `src/discovery/dedupe-persist.ts:79`, `src/discovery/health-aggregate.ts:20`, `src/app/api/dev/discovery/run/route.ts:11`.

All terms canonical in `CONTEXT.md: Gap-Targeted Harvest, Gap-Aware Harvest, Harvest Success/Degraded/Skipped, Harvest Dry vs Live`.

## Pass/Fail Table (monitor asserts this)

| Path | Request | Success | Degraded | Skipped / Busy |
|---|---|---|---|---|
| **Gap-targeted** `Run this gap (Live)` | `POST /api/dev/discovery/run {live, cellKey}` where `cellKey` e.g. `usa:DETAILED_DESIGN` | Job `done`, `D01..D10` includes targeted hint, ledger contains `package.assemblies` **for that exact `cellKey`** (`+≥1` for that cell), `coverage` for that cell either `have_total`↑ **or** refusal with reason string recorded (silent `0` without reason = fail), `dedupe delta == packages` (KV + file converge, no double), `health.lastRunAt == ranAtIso` ( `health_degraded` may be `true` and still success ) | Job `done` but `brave-search 402 Usage limit exceeded` (`health_degraded true`) **or** seed-only fallback produced package for *different* cell than requested — ledger correctly unmutated for requested cell *or* mutated for another cell, error surfaced via `gapRunError`/`runError`, not silent. Dry runs **must never** be `Degraded`. | `POST 202` then job `error` containing `harvest lock held` (`harvest:lock` holder busy), ledger `+0`, `D01..D10` only `D00-QUEUED`, error surfaced as `error` with `lock held` string (HV5) — distinct from `Degraded` — not a hang. `UnknownCellKeyError 400` and `StoreUnavailable 503` also surfaced, ledger `0`. |
| **Gap-aware** `Run Live Harvest` | `POST /api/dev/discovery/run {live, cellKey:null}` | Job `done`, used `gaps_ranked.slice(0,3)` themes, `coverage.gaps_ranked` **recomputed** (`coverage.generated == ranAtIso`) and `job.result.queue[0..2]` matches new `gaps_ranked`, ledger `0..N` allowed (**`0` with recomputed gaps is still success**), `target_total` unchanged, dedupe `delta == packages`, `health.lastRunAt==ranAtIso` | Same 402 handling as above; `0` ledger with correctly refused gaps is `Degraded` not `fail` | Same busy/lock as above |
| **Dry vs Live** | `live:false` vs `live:true` | `Dry` uses `seed-portals` only, never touches quota, never `health_degraded true`, deterministically yields `1` package `usa:PRELIMINARY_DESIGN` via `MemoryStore` mock for CI oracle (no network) | `Live` may call `brave-search` and may `402`; `Live` 402 = `Degraded` not `fail` | — |

## Monitor Deltas to Poll (HV3)

Per `docs/research/harvest-backend-seams.md:369` table: `GET /api/dev/discovery/jobs/:id` (J: logs D01..D10 `22 logs`), `GET /api/dev/discovery` (L: ledgerTotal/Tail, KV `discovery:ledger:entry:*`), `GET /api/dev/coverage` (C: `cells[*].have_total`, `gaps_ranked`, `generated`), `dedupe` (D: `sha256Entries` KV `discovery:dedupe-index`), `GET /api/dev/health` (H: `harvestHealth.lastRunAt`, `health_degraded`, `ledgerAge`), `proof` (P: `ledgerDigest`), `queue` (Q: `result.queue`). Expected deltas as above.

## CI Oracle

- **Dry mock (CI):** `MemoryStore` + `emptyDedupeIndex`, `claimFingerprints` yields `1` package `usa:PRELIMINARY_DESIGN` — always `Success` without network. Assert `HV5` pass/fail table with `ADMIN_KEY=test-admin-key-... node scripts/harvest-verify.mjs --dry --api gap --cellKey usa:PRELIMINARY_DESIGN --monitor`.
- **Live:** `Health` + ledger may `health_degraded true`; live `402` is `Degraded` not `fail`; `busy` is `Skipped` not `fail`.

## Grilling Decisions (HV5)

- Gap-targeted requires *exact* `cellKey` ledger entry — other cell is `Degraded` (not success) — chosen for ODD cell provability.
- `have_total`↑ *or* refusal with reason string both prove — silent `0` is `fail`.
- `dedupe delta == packages` strict — file/KV lag would be a bug, not tolerance.
- `health.lastRunAt==ranAtIso` required for both paths, `health_degraded` allowed to be `true`.
- Gap-aware `0..N` recomputed is `Success` (seed-only fallback may yield 0).
- `Dry` never degraded; `Live` may.
- `Busy` is `Skipped` distinct from `Degraded`, must surface via `gapRunError`/`runError`.
- `Dry` mock deterministically `1 pkg` for CI.

## Evidence

- `HV1` `docs/research/harvest-backend-seams.md` flow + monitor table
- `HV2` `docs/research/harvest-ui-wiring.md` button wiring + selectors
- Live evidences: `state/harvest-verify/HV6-usa-DETAILED_DESIGN-job_mts2z6cn_typy9b.json` (`degraded` — ledger `+10` but `have_total 0→0`) and `state/harvest-verify/HV7-job_mts33fzf_f5ohj6.json` (`pass` — `44→54 +10`, queue matches gaps)
