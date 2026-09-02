# Architecture Report — 28-entry Frontier (R1–R19, T2, M1–M8) — Corrected Grilling 2026-09-01

Date: 2026-09-01
Scope: `workflow/wayfinder/**`, `.autoforge/discovery/**`, `.autoforge/requirements/grilling.md` (513+ lines patched), `src/discovery/**`, `src/lib/persistence/**`, `src/app/api/**`, `src/wayfinder/**`, `scripts/**`, `.github/workflows/**`, `state/**`, `stages/**`. Inputs: `.autoforge/discovery/tracker-index.md` (28 entries verbatim), `.autoforge/requirements/grilling.md` (R1–R19+T2+M1–M8, MAP 41-59 fixes, locks plan 399-404, M gates 66-196), `.autoforge/plans/plan.md` (443 lines, prior wave for reference), `workflow/wayfinder/maps/ops-residual/MAP.md:41-59` (R1–R19 definitions), prior architecture report/decisions.
Status: design-only — no implementation. Ponytail ladder enforced, vault determinism & evidence byte-identity preserved as hard constraints. Model budget 80k tok inherit muse-spark-1.2 1M*0.30.
Skills invoked: `codebase-design` (selectively; `improve-codebase-architecture` not warranted — deepening already captured in prior report §8).

## 1. Hard constraints (non-negotiable)

| Constraint | Enforcement | Cite |
|---|---|---|
| **Vault determinism** | `state/vault-notes.json` compiled from HEAD worktree only. Never `vault-import/export` bare before commit. Use `node scripts/vault-sync.mjs` (write) / `--check` (CI/read). Worktree owns `node_modules` symlink seam. | `scripts/vault-sync.mjs:16-44` `AGENTS.md:15-17` `architecture/report.md:145-148` |
| **Evidence byte-identity** | `.autoforge/validation/ops-loop-evidence.json` ↔ `stages/07_validate/output/ops-loop-evidence.json` must `cmp -s` identical (056b75f anchored, historicalProbe 61c7475, HEAD a715ee8). Regen overwrites both atomically (R17). | `plan.md:55-56` `grilling.md:309` `scripts/vault-sync.mjs:22` |
| **Staging hygiene** | Explicit `git add <paths>` only; never `git add -A` (AGENTS.md). | `AGENTS.md` staging hygiene |
| **Ponytail ladder** | Reuse `DataStore`/`KvRestStore.call()` seam, stdlib, smallest diff. No new deps, no generic facade/ORM/cache/framework. One-line where one line holds. `ponytail:` comment for deliberate ceilings. | `src/lib/persistence/store.ts:68-96` `plan.md:58` |
| **Single-writer locks** | `vault-state-single-writer`, `persistence-single-writer`, `page-workspace-single-writer`, `eval-canonical-report` (plan.md:399-404). Scheduler serializes; `blocked_by` stays semantic only (`M1→M4`). | `plan.md:399-404` `grilling.md:14-15` |
| **Frozen doctrine** | Thresholds, judge prompts, E5, ODD, `need-human.md` frozen (`docs/validation/eval-gates.md`). Speculative M1–M8/R1/R4 gated — no dispatch before owner/HITL. | `docs/validation/eval-gates.md:8-12` `grilling.md:237` |
| **External gates** | 5 R HITL + 8 M owner gates (`OWNER_GF_SOURCE_AND_ACCEPTANCE`, `BLOB_LIMIT_TRIGGER`, `VAULT_CONFLICT_TRIGGER_AND_OWNER`, `FLAG_1/2`, `PHASE_3_KEY_SCHEME_AND_POSTGRES_AUTHORITY`, `HITL_PRODUCTION_DAEMON_PROOF`, `FOG_BRAVE_QUOTA_REPLENISHMENT_HITL`) — held = not dispatched. | `plan.md:66-196` `grilling.md:372-503` |
| **Tests** | Existing `npm run test` (`vitest`) + `typecheck` + `lint` + `build`. No new harness. | `plan.md:62` |

Model-policy note: architect inherits orchestrator `muse-spark-1.2 1M → 80k cap`; inputs sized to fit (tracker-index 140 lines + grilling 519 lines + plan 443 lines verbatim tracked).

## 2. Seam inventory (reuse, don't invent)

- `DataStore` (`src/lib/persistence/store.ts:16-26`): `MemoryStore` + `KvRestStore` (Upstash REST `call(["SET",…])` at line 68), `getDataStore()` singleton with Memory fallback (`createFallbackStore:130-181`). `keys(prefix)` sorted, `null` on miss vs `StoreUnavailableError` on transport. **Only** persistence seam — all R/M persistence variation goes here. `setDataStoreForTests` at line 192 for hermetic tests.
- `harvest.ts:98-104` process-local `HARVEST_LOCK` boolean — accepted ceiling documented as cross-instance insufficient (MAP Notes line 17-18). Upgrade path is KV SET NX.
- `ledger.ts:8-39` (`appendLedgerKV`/`getLedgerTailKV`): index `discovery:ledger:index` (sorted, trimmed 500 at line 25) + per-entry `discovery:ledger:entry:{seq}`. Current race: read-sort-write loses concurrent appends; orphan keys return null.
- `jobs.ts:41-368` (`PREFIX discovery:job:`, `INDEX_KEY discovery:job:index` cap 20 at line 159, `indexOf(cursor)` pagination at line 234, file fallback `state/discovery-jobs.json` when `!isKv()` at line 112).
- `dedupe-persist.ts:12-72` + `keys.ts:50` `DISCOVERY_DEDUPE_INDEX_KEY`: file `state/dedupe-index.json` is read source, KV mirror best-effort — fork under ROFS.
- `providers/brave-search.ts:58-83`: 402 `USAGE_LIMIT_EXCEEDED` early-return `[]` at line 61 but no refusal/observable metric; `withHostBudget`/`retryAfterMs` already present at line 45.
- `provider-health.tsx:135-154` (`lastOnRunJobId` dedup gate at 138-144 + `JOB_STORAGE_KEY auditorai.discovery.jobId` at 57 + 1.5s poll at 153). Refresh path at line 478 intentionally bypasses dedup (comment at 379-387).
- `scripts/vault-sync.mjs:6-44`: HEAD worktree compiler — the vault seam. No auto-merge. `--check` at line 27 compares `git show HEAD:state/vault-notes.json` to compiled.
- `src/wayfinder/tickets.ts + ticket-types.ts` + `workflow/wayfinder/TRACKER.md:15-18` + `workflow/wayfinder/maps/ops-residual/tickets/R19-wayfinder-plumbing-traceability.md`: Wayfinder plumbing — markdown tickets compile via `tickets.ts:parseTicketFrontMatter` + `classifyTickets` into `TicketIndex` for Mission Control (`/dev/mission-control` → Tickets) and `npm run tickets`. Markdown remains canonical; claim/resolve edits front-matter.
- `scripts/discovery-doctor.ts:17-53` `--json` branch already present (JSON contract `{providers:[{id,enabled,hostsOk,sampleHits}], totals}`).
- `src/app/api/dev/health/route.ts:11-138` provider pings + ledger age + topology drift — seam for harvestHealth aggregate.
- Deletion test: one adapter = hypothetical; two = real. All recommendations below either reuse the seam or wait for second concrete implementation.

## 3. Frontier-by-frontier design (28 entries)

### R1 — Cross-instance harvest lock via KV SET NX (BLOCKED)

**Problem:** `HARVEST_LOCK` boolean at `harvest.ts:103` prevents only intra-process concurrency; Vercel may run 2 lambdas → seq/index collision.

**Alternatives:**
- A) **Chosen (ponytail):** Add `DataStore.setIfAbsent(key,value,ttlSeconds):Promise<boolean>` → `KvRestStore` issues `["SET",k,v,"NX","EX",ttl]` via existing `call()` at `store.ts:68`, returns true on OK else false; `MemoryStore` does atomic `!has→set` on its `Map`. New `src/discovery/harvest-lock.ts` `acquireHarvestLock(workspaceHash, ttl=3600, store?) → {acquired, release}` using deterministic key `discovery:harvest:lock:{workspaceHash}`. `executeJob` at `harvest.ts:98-219` replaces boolean check with `await acquire`; on `!acquired` calls `setJobError(busy)` and returns; `finally` calls `release`. Local dev without KV env falls back to process flag + single `WARN` log. No new dep, one REST command. `ponytail: 3600s TTL covers maxDuration 60s; global lock ceiling, per-cell locks deferred to Not yet specified`.
- B) Redlock lib / Upstash SDK — new dep, larger surface, rejected per ladder rung 5 (reuse installed dep beats new dep).
- C) KV pipeline helper / Lua script — speculative, not needed for single SET; deferred.

**Tradeoff:** A gives cross-instance safety with 1 method + 1 file, testable via MemoryStore; B/C add deps/complexity without measurable trigger. Chosen maximizes leverage (all callers route through `acquireHarvestLock`) and locality (TTL/key policy in one place).

**Seam:** `DataStore.setIfAbsent` (transport atomicity), `harvest-lock.ts` (key/TTL), `harvest.ts` (busy→setJobError without throw + finally release).

**Touches:** `[src/lib/persistence/store.ts, src/discovery/harvest-lock.ts, src/discovery/harvest.ts]` **Hazard:** `[src/lib/persistence/**]` **Lock:** `persistence-single-writer` (plan 399-404, grilling R1 lock).

**Verification:** concurrent `acquire` vs MemoryStore → 1 true/1 false; `release` → third succeeds; KV unavailable → WARN fallback; TTL default 3600 configurable; `executeJob` busy → `setJobError(busy)` no throw.

### R2 — Ledger KV ordering + orphan-key recovery (BLOCKED)

**Problem:** read-sort-trim-write races; `getLedgerTailKV` returns null orphans (`ledger.ts:33-39`).

**Alternatives:**
- A) **Chosen:** Keep signatures but harden: `appendLedgerKV` deduplicates `index.includes(seq)` before push at line 22, sorts at 24, trims 500 at 25; `getLedgerTailKV` does `getMany→filter(null)→sort(seq)` (already at 37) plus **self-heal** pass that drops orphan seqs from index (write back trimmed without orphans best-effort). Under concurrent 50-entry test eventually all 50 seqs present, no duplicates. Minimal diff, no Lua. `ponytail: 500-trim bound is accepted ceiling for KEYS latency`.
- B) KV Lua/CAS allocator (`INCR` seq) — real but needs Upstash script support, second ticket. Defer until contention measurable.
- C) Per-shard index keys — speculative sharding, violates Not yet specified.

**Tradeoff:** A is smallest correct hardening, preserves file:line locality; B reduces races further but adds operational surface before evidence warrants.

**Touches:** `[src/discovery/ledger.ts]` **Hazard:** `[src/lib/persistence/**]` **Lock:** `persistence-single-writer`.

### R3 — Regression tests for lock + dedup (BLOCKED)

**No seam change.** Add 3 focused tests on existing in-memory seams: (1) concurrent `executeJob` → one `done` one busy-error without throw (stubs `store`), (2) `lastOnRunJobId` dedup mock `fetchJobById` at `provider-health.tsx:138` → `onRun` once per terminal id, (3) spy order `appendLedgerKV` before `setJobDone` at `harvest.ts:188-211`. Runner is existing `npm run test` (`vitest`), no new harness. **HOLD** until R1/R2 seams land — serialize by hazard, not DAG.

**Alternatives:** standalone MemoryStore synthetic suite vs integrated live-KV suite — chosen is MemoryStore first (fast, deterministic), live-KV as HITL follow-on.

**Touches:** `[tests/discovery/regression-lock-dedup.test.ts]` **Lock:** none (read-only seam, persistence hazard if touching live store).

### R4 — Production harvest proof bundle (BLOCKED, HITL)

**No code seam.** Pure evidence capture: transcript + JSON bundle from `https://auditorai-gamma.vercel.app/api/dev/discovery` after 24h window → `.autoforge/validation/ops-loop-evidence-live.json` mirrored to `stages/07_validate/output/ops-loop-evidence-live.json`, schema-compatible with validator. Must show `ledgerGrowth.verified true` (before/after counts), `productionDeploymentVerified true` (deploy id `33295…`), `daemonVerified true` (`launchctl print` active + log tail), validator re-run GO. Remains `HITL_PRODUCTION_DAEMON_PROOF` gated; architecture preserves schema compatibility and `cmp -s` byte-identity for canonical evidence (live bundle is additive, not divergent).

**Alternatives:** local synthetic bundle vs live Vercel daemon proof — chosen is live (only proof that satisfies validator `false→true`); synthetic is prep only.

**Touches:** `[.autoforge/validation/ops-loop-evidence-live.json, stages/07_validate/output/ops-loop-evidence-live.json, .autoforge/validation/report.md]` **Lock:** `vault-state-single-writer` if touching `state/**` evidence mirrors.

### R5 — Stop/Cancel server endpoint (OPEN) ✅

**Problem:** `provider-health.tsx:163-168 handleStop` only stops polling client-side; job continues server-side.

**Alternatives:**
- A) **Chosen (minimal honest):** Extend `DiscoveryJobStatus` at `jobs.ts:10` with `"cancelled"` (or explicit sentinel) — prefer explicit `cancelled` to keep status enum honest vs overloading `error`. New route `src/app/api/dev/discovery/jobs/[jobId]/cancel/route.ts` POST `requireAdmin` → `updateJob(id,{status:"cancelled"})` via `jobs.ts:276`. `executeJob` at `harvest.ts:146` loop checks `await getJob(jobId,store)` before each `DISCOVERY_NODE_IDS` iteration; if `cancelled` → `appendLog(cancelled)` + `setJobError("cancelled by user")` + return (no mid-node abort signal). Front: `provider-health.tsx:163` `handleStop` calls cancel then keeps polling until terminal, label `cancelling…` → `paused · cancelled`. Admin-key header reused via `src/lib/api:requireAdmin`. `ponytail: per-iteration poll, not per-node abort signal`.
- B) AbortController per node — heavier, needs pipeline refactor; deferred.
- C) Client-only Stop kept — rejected; inconsistent across nodes without KV truth chain.

**Tradeoff:** A is 1 route + 1 status + loop guard, no concurrency primitive; B adds cancellation token plumbing without multi-lambda benefit.

**Touches:** `[src/app/api/dev/discovery/jobs/[jobId]/cancel/route.ts, src/discovery/jobs.ts, src/discovery/harvest.ts, src/app/dev/mission-control/_components/provider-health.tsx]` **Hazard:** `[src/lib/persistence/**]` + `page-workspace` **Locks:** `persistence-single-writer` + `page-workspace-single-writer`.

### R6 — Pagination cursor stability (OPEN) ✅

**Problem:** `jobs.ts:233-235 index.indexOf(cursor)` trimming to 20 losing stale cursor.

**Alternatives:**
- A) **Chosen:** When cursor missing/trimmed return latest page `slice(0,limit)` with `nextCursor=lastId` and correct `total`; when present paginate from cursor+1. Cap `[1,20]` default 10 unchanged. No storage change. `ponytail: 20-index cap is accepted ceiling; cursor stability via latest-page fallback`.
- B) Opaque cursor (base64 seq) — robust but new encoding contract, over-engineered for 20-cap index.
- C) Preserve full index file — unbounded growth, rejected.

**Tradeoff:** A fixes staleness with one branch, keeps existing index semantics.

**Touches:** `[src/discovery/jobs.ts, src/app/api/dev/discovery/jobs/route.ts]` **Lock:** `persistence-single-writer`.

### R7 — Refresh parity tooltip (OPEN) ✅

**Alternatives:**
- A) **Chosen:** `provider-health.tsx:478` Refresh button add `title="Refresh bypasses onRun dedup — deliberate manual inspection, no scheduling side-effect"` (R7). No scheduling side-effects; tests focus on DOM attributes; keep dependency-free.
- B) Remove Refresh entirely relying on auto-poll — less discoverable; rejected.

**Touches:** `[src/app/dev/mission-control/_components/provider-health.tsx]` **Lock:** `page-workspace-single-writer` (hazard).

### R8 — Health route harvestHealth sub-object (OPEN) ✅

**Alternatives:**
- A) **Chosen:** New pure `src/discovery/health-aggregate.ts` `harvestHealthSummary(store?) → {lastRunAt,lastRunStatus,lockHolder,lockAcquiredAt,indexedEntriesCount}` from `getLedgerTailKV` at `ledger.ts:28` + `listJobs(1)` at `jobs.ts:223`. Route `src/app/api/dev/health/route.ts:11` merges additive `harvestHealth` while preserving `providers/ledger/topology` at lines 132-138. Graceful nulls when KV unavailable. Test under MemoryStore with one done job. `ponytail: pure fn, KV reads best-effort`.
- B) Inline health logic directly in route — shallower, less testable; rejected (depth via pure fn gives leverage).
- C) New health service class — speculative abstraction, rejected.

**Touches:** `[src/discovery/health-aggregate.ts, src/app/api/dev/health/route.ts]` **Hazard:** `[src/lib/persistence/**]` **Lock:** `persistence-single-writer` (reads hazard).

### R9 — Discovery doctor JSON contract (OPEN) ✅

**Alternatives:**
- A) **Chosen:** `scripts/discovery-doctor.ts:17-53` add `--json` branch: single JSON `{providers:[{id,enabled,hostsOk,sampleHits}], totals:{totalProviders,totalEnabled,totalSampleHits}}` to stdout, exit codes unchanged. Evidence validator parses deterministically. Already present at lines 17-53; stabilize as contract (freeze shape, add test against CI ingest parser).
- B) Separate `doctor-json.ts` script — duplicate seam; rejected.
- C) No JSON (human-only) — blocks CI automation; rejected.

**Touches:** `[scripts/discovery-doctor.ts]` **Lock:** none.

### R10 — state/dedupe-index.json write authority (OPEN) ✅

**Problem:** file `state/dedupe-index.json` vs KV `discovery:dedupe-index` fork under ROFS.

**Alternatives:**
- A) **Chosen (KV-truth):** `src/discovery/dedupe-persist.ts:16-72` load KV-first (`s.get(DISCOVERY_DEDUPE_INDEX_KEY)` at keys.ts:50 else file seed on null at `loadDedupeIndex:16`), persist KV-first (`s.put` at 70) + file best-effort (`catch EROFS → WARN dedupe: FS mirror skipped (ROFS)`). Local dev without KV writes both deterministically. Vault determinism `vault-sync --check` invariant cited at `grilling.md:184`.
- B) File-truth with KV mirror — fork persists under ROFS; rejected.
- C) Dual-write with conflict merge — complexity without trigger; rejected.

**Tradeoff:** A breaks fork, preserves ROFS operability via WARN token.

**Touches:** `[src/discovery/dedupe-persist.ts, src/lib/persistence/keys.ts]` **Hazard:** `[src/lib/persistence/**, state/**]` **Locks:** `persistence-single-writer` + `vault-state-single-writer`.

### R11 — Drop speculative source comments (OPEN) ✅

**Alternatives:** A) Delete stale `getGitHead()`/global hook chatter at `harvest.ts:98-102` comments; keep only ceiling/contract comments. No behavior. B) Keep comments — rejected (drift per grilling R11).

**Touches:** `[src/discovery/harvest.ts]` **Lock:** none.

### R12 — AutoForge staging: exclude .autoforge/ from committed tree (OPEN) ✅

**Alternatives:**
- A) **Chosen (curated commit):** Commit ` .autoforge/state.json`, `decisions/**`, completed `plans/reviews`, `need-human.md`; ephemeral `validation/stages/**` mirrors ignored or byte-identical. Document in `.autoforge/AGENTS.md` Storage policy + `.gitignore`. Matches `.autoforge/AGENTS.md` already present (Storage policy section) and `plan.md:204-211`.
- B) Blanket `.gitignore .autoforge/` — hides review trail, rejected.
- C) Commit everything — poisons vault determinism; rejected.

**Touches:** `[.gitignore, .autoforge/AGENTS.md]` **Hazard:** `[vault/**, state/**, state/vault-notes.json]` **Lock:** `vault-state-single-writer`.

### R13 — Eval gate §2 freshness automation: timestamp check (OPEN HITL) ✅

**Alternatives:**
- A) **Chosen:** New `scripts/check-eval-gate-freshness.mjs` reads `state/eval-scorecards/` mtime, threshold sourced from `docs/validation/eval-gates.md:14-25` (not hardcoded); CI job `gate-freshness` fails >7d with `run tier1 --topup` message. Doctrine `HITL_EVAL_DOCTRINE_FROZEN` read-only at grilling R13.
- B) Hardcode 7d in script — drift risk; rejected.
- C) No check — gate silent; rejected.

**Touches:** `[scripts/check-eval-gate-freshness.mjs, .github/workflows/ci.yml]` **Hazard:** `[state/**, state/eval-scorecards/**]` **Lock:** `eval-canonical-report` + `vault-state-single-writer`.

### R14 — Tier-1 archive: keep helper script, de-skill its drift (OPEN) ✅

**Alternatives:** A) Header comment hygiene — keep `--topup <runId>` next to `--rebase` at `scripts/tier1-archive.mjs`, reference doctrine by path. No behavior. B) Rewrite helper — rejected.

**Touches:** `[scripts/tier1-archive.mjs]` **Lock:** `eval-canonical-report`.

### R15 — README + CONTRIBUTING: refresh Production deploy section (OPEN) ✅

**Alternatives:** A) Text-only sync: main is production, Vercel auto-deploys on push, `discovery-harvest.yml` schedule refreshes state, reference `AGENTS.md` Eval gates. Sync `docs/ops/deploy.md` if present. B) No docs change — drift persists; rejected.

**Touches:** `[README.md, CONTRIBUTING.md, docs/ops/deploy.md]` **Lock:** none.

### R19 — Wayfinder plumbing traceability — ticket index + Mission Control board (OPEN) ✅ NEW

**Problem:** Wayfinder local-markdown tracker must be traceable to Mission Control without grepping; R19 triaged 2026-09-01 at MAP:58-59, tracker-index 93-95.

**Alternatives:**
- A) **Chosen (ponytail, compile don't duplicate):** Keep `workflow/wayfinder/maps/*/tickets/*.md` as canonical (TRACKER.md:15). `src/wayfinder/tickets.ts:parseTicketFrontMatter` + `classifyTickets` + `ticketFromFields` compiles every ticket into `TicketIndex` for Mission Control (`/dev/mission-control` → Tickets tab) and `npm run tickets` CLI. Add/refresh `workflow/wayfinder/maps/ops-residual/tickets/R19-wayfinder-plumbing-traceability.md` with `blocked_by`/`blocks` front-matter; Mission Control board reads via `tickets.ts` `readdirSync` + `WAYFINDER_MAPS_DIR`. Ticket index compilation stays pure (no `state/**` writes), board polling reuses existing `fetchHealth`/`adminApi` seam. Traceability is `MAP.md Decisions so far` one-line per resolution + `tracker-index.md` compiled verbatim from `tickets.ts` output. `ponytail: markdown canonical, compilation is pure fn, no new store`.
- B) Duplicate tracker into KV/DB with sync job — second source of truth, drift risk; rejected.
- C) GitHub Issues only (drop local markdown) — breaks offline `workflow/wayfinder/TRACKER.md` local-markdown guarantee; rejected.

**Tradeoff:** A preserves single source of truth, leverages existing `tickets.ts` deep module (large behaviour — parse/classify/index — behind small `TicketIndex` interface), locality for maintainers (one place to fix plumbing).

**Seam:** `src/wayfinder/tickets.ts` (`parseTicketFrontMatter:30-42`, `classifyTickets`, `WAYFINDER_MAPS_DIR`) + `workflow/wayfinder/TRACKER.md` conventions + `workflow/wayfinder/maps/ops-residual/tickets/R19-*.md` + Mission Control board `src/app/dev/mission-control/page.tsx` (existing `/dev/mission-control` route).

**Touches:** `[workflow/wayfinder/maps/ops-residual/tickets/R19-wayfinder-plumbing-traceability.md, workflow/wayfinder/maps/ops-residual/MAP.md:58-59, src/wayfinder/tickets.ts, src/wayfinder/ticket-types.ts, src/app/dev/mission-control/page.tsx]` **Hazard:** none (read-only compile) **Lock:** none (but board poll shares `page-workspace` hazard if editing tickets — serialize).

**Verification:** `npm run tickets` prints R19 with status OPEN; Mission Control Tickets tab lists R19 with `blocked_by`/`blocks`; `tracker-index.md:93-95` matches MAP:58-59; `src/wayfinder/tickets.ts` unit test asserts `parseTicketFrontMatter` + `classifyTickets` frontier detection.

### R16 — Brave quota 402 graceful degradation + monitoring (FOG) ⚠️

**Current:** `brave-search.ts:61-83` already returns `[]` on 402 (70a519c) so harvest no longer hard-fails (degraded 0 hits).

**Alternatives:**
- A) **Chosen (smallest observable):** On 402 append `refusals` entry `brave:USAGE_LIMIT_EXCEEDED` via `runDiscoveryNode` aggregation at `pipeline.ts:92` into ledger/evidence; structured log `WARN brave quota 402` searchable; assert pipeline ordering Google CSE before seeds (not short-circuited via `harvest.ts:327` provider ordering); monitor `health` `providers.brave.degraded` when last 2 runs 0 Brave hits (or `harvestHealth` refusal count) at `health/route.ts`. No key rotation/plan upgrade in code (HITL per `plan.md:260` `FOG_BRAVE_QUOTA_REPLENISHMENT_HITL`). `ponytail: 500-trim bound is accepted ceiling for degraded runs`.
- B) Retry with backoff on 402 — quota is terminal; rejected.
- C) Auto-rotate keys in code — violates HITL; rejected.

**Tradeoff:** A surfaces degradation without changing fetch semantics; B/C either waste quota or breach ownership.

**Touches:** `[src/discovery/providers/brave-search.ts, src/discovery/pipeline.ts, src/app/api/dev/health/route.ts]` **Hazard:** `[src/lib/persistence/**]` (health reads) **Lock:** none (but health read hazard under `persistence-single-writer` if competing).

**Verification:** mock 402 → `[]` no throw + refusal propagated, `WARN` token searchable, next scheduled harvest green via seeds while quota exceeded, health degraded flag flips after 2 zero-hit runs.

### R17 — Evidence bundle reconciliation + HEAD anchoring automation (FOG) ⚠️

**Alternatives:**
- A) **Chosen:** New `scripts/check-evidence-head.mjs` asserts `commit == $(git rev-parse HEAD)` and `generatedAt` within 24h of HEAD author date; exits 1 `evidence stale: commit 61c7475 != HEAD 70a519c — run: gh workflow run discovery-harvest` otherwise. CI job `evidence-head-check` after `vault determinism` at `.github/workflows/ci.yml`. Regen `workflow_dispatch regen-evidence=true` overwrites both `.autoforge/validation/ops-loop-evidence.json` and `stages/07_validate/output/ops-loop-evidence.json` atomically, preserving `cmp -s` byte-identity at plan 55-56. `ponytail: read-only check, no new dep`.
- B) Auto-regen on every push — noisy, hides staleness; rejected.
- C) Single evidence file — breaks `.autoforge ↔ stages` ICM invariant; rejected.

**Touches:** `[scripts/check-evidence-head.mjs, .github/workflows/ci.yml]` **Hazard:** `[state/**, .autoforge/validation/**, stages/**]` **Lock:** `vault-state-single-writer`.

### R18 — Bento components merge verification — safety/conflicts/functional (FOG) ⚠️

**Verify-only, no code.** Alternatives: A) Full verify-and-stop matrix (chosen): `git ls-files --others --exclude-standard | grep -E "\.jsx|\.js$"` 0 shadowing under `src/app/_components/ui/*` (13 `.tsx` + `reset-key.tsx`/`stage-label.tsx` at 056b75f, `.jsx` duplicates cleaned 2026-08-31); `npm run build` (`/dev/mission-control` 13.9kB) + `npm run lint` 0 errors; visual segmented tabs / odd-matrix 16-cell / kpi-strip with tokens, no console errors; `git diff main...feat/mission-control -- src/app/_components/ui/` empty; `flow.spec.ts` pass/skip with reason; `stages/` vs `.autoforge/stages/` divergence tracked separately. B) Code change — rejected (duplicates already cleaned).

**Touches:** [] (verification-only; no writable) **Lock:** none.

### T2 — Ops-seamless-verify (CLOSED)

Verified closed 2026-08-30 under Loop-2 close-out (`dce8f08` durable harvest + UI debouncing). No new module. Residual gaps (ledgerGrowth/production/daemon `false`) are captured by R4/R17, not by reopening T2. `tracker-index.md:98-101` CLOSED, `plan.md:24-25` + `decisions.md AD-09` authoritative. Touches: [] **Lock:** none.

### M1–M8 — Loop-3 frontiers (all BLOCKED, HOLD — no dispatch)

All eight remain **HOLD** pending owner/data/HITL gates per `plans/plan.md:66-196` and grilling M gates. Architecture reaffirms Loop-3 seams but marks no implementation. Ponytail ladder defers all.

| M | Gate / trigger | HOLD token | Seam | Touches | Invariant |
|---|---|---|---|---|---|
| **M1** Quote-bearing GF-6..10 baseline upgrade | `OWNER_GF_SOURCE_AND_ACCEPTANCE` + all-five `passes_corpus_mark` + fresh Tier-1 | HOLD | `FindingEvidence.quote` + evidence registry | `state/eval-scorecards/**`, `vault/journal/**` | zero-drop, quote provenance, E5 frozen, fresh Tier-1 |
| **M2** Conditional blob-storage escape hatch | `BLOB_LIMIT_TRIGGER` + security/rollback owner | HOLD | `Attachment`/`ProjectStore`/`Repository` + new Blob adapter only if real 2nd impl | `src/domain/types.ts`, `src/lib/persistence/project-store.ts`, `src/lib/persistence/attachments/**` | URL issuance/deletion/ownership stay out of routes/UI |
| **M3** Vault sync-conflict UX | `VAULT_CONFLICT_TRIGGER_AND_OWNER` (qualifying divergence) | HOLD | `scripts/vault-sync.mjs`/`vault-import.mjs` | `scripts/vault-sync.mjs`, `scripts/vault-import.mjs`, `tests/vault/**` | append-only journals, fail-closed to human, never auto-merge |
| **M4** Report/recommendation drafting assists | `M1 → M4` + `OWNER_ASSIST_SCHEMA_AND_QUALITY_INTERPRETATION` + fresh Tier-1 | HOLD | `AiAdapter`/`inference.ts`, `candidate-review.ts` | `src/lib/ai.ts`, `src/lib/inference.ts`, `src/domain/candidate-review.ts`, `src/app/projects/.../page.tsx` | deterministic `AuditResult`/Markdown canonical, OFF default, typed provenance/budget/refusal/degraded, no `renderReportMarkdown` mutation |
| **M5** Candidate-findings review UX | `FLAG_2_PRODUCT_COMMITMENT` + live bottleneck | HOLD | `candidate-review.ts` + `audit-workspace.ts` | `src/app/projects/*/audits/*/page.tsx`, `src/domain/audit-workspace.ts` | validation/whitelist/consent/provenance/index/issuance stripping preserved, no auto-accept |
| **M6** Audit-history retention policy | `FLAG_1_RETENTION_AUTHORITY` | HOLD | `issue-ledger.ts`/`artifact-trail.ts`/`outcomes.ts` | `src/lib/persistence/issue-ledger.ts`, `src/lib/persistence/artifact-trail.ts`, `src/domain/outcomes.ts` | ADR-0004 binding: issued issues never modified/deleted, drafts depth-1, no generic framework |
| **M7** RSC initial Repository snapshot (fog) | `RSC_MEASURABLE_TARGET_AND_RISK_ACCEPTANCE` (SEO/TTFB target) | HOLD | existing Repository read path | `src/app/projects/*/page.tsx` | retain `WorkspaceApiAdapter` + API mutations, no second Repository/cache |
| **M8** Postgres third DataStore adapter | `PHASE_3_KEY_SCHEME_AND_POSTGRES_AUTHORITY` | HOLD | `DataStore` operations, `kind` typing | `src/lib/persistence/store.ts:16-26`, `src/lib/persistence/keys.ts` | null-on-miss vs `StoreUnavailableError`, sorted prefixes, workspace isolation, no ORM; resolve silent KV→Memory fallback |

No generic facade/ORM/framework. `M1→M4` semantic edge preserved; other overlaps are resource hazards, not `blocked_by`.

## 4. Boundaries, locks & concurrent-safe execution

**Resource locks (from plan.md:399-404, extended to 28-entry):**

| Lock | Members | Policy |
|---|---|---|
| `vault-state-single-writer` | M1, M3, R12 (curated commit), R13/R17 writers, R4 evidence regen, any `vault/**`/`state/vault-notes.json` compiler | sequential; no concurrent journal/state compile; `vault-sync --check` before handoff; `vault-sync` itself is verification, not concurrency control |
| `persistence-single-writer` | M2, M6, M8, **R1, R2, R5, R6, R8, R10** (+ R16 health read hazard) | sequential in whichever gate opens first; no semantic ordering; hazard is `src/lib/persistence/**` + `state/**` overlap |
| `page-workspace-single-writer` | M5, M7, **R5(UI half), R7, R19(board polling)** | sequential; disjoint other modules may run around it |
| `eval-canonical-report` | M1, M4, **R13, R14** | M4 semantic dependency on M1; canonical report read-only gate |

**Scheduling rule:** OPEN = dispatchable (R5-R15, R19). FOG/OPEN need hazard-aware serialization. After gates open, pick first ready per lock; e.g. R1 and R2 share `persistence-single-writer` and must not parallel; R7 and M5 share `page-workspace`; M2/M6/M8 mutually exclusive despite no `blocked_by` edge. `state/**` hazard flag applies to any `touches` containing `state/**`; that writer must not run concurrently with any other `vault-state` or `persistence` writer. Disjoint unlocked Rs (e.g. R9 scripts + R11 harvest comment + R15 docs + R14 header) may run in parallel if their `touches`/`hazard_touches`/lock sets are disjoint.

**Waves (dispatchable now — OPEN):**

- **Wave A (parallel safe, disjoint touches/locks):** `R9` (scripts), `R11` (harvest comment), `R15` (docs), `R14` (header) — none share locks/touches. May run concurrently if scheduler respects file-level disjointness.
- **Wave B (serialize on `persistence-single-writer`):** `R5`, `R6`, `R8`, `R10` — pick first ready, one at a time. `R8` and `R10` also touch `persistence` hazard. `R19` plumbing read does not need this lock but board writes serialize under page-workspace.
- **Wave C (serialize on `page-workspace`):** `R7` + `R19` board polling (and later M5/M7 when gated). `R5` is in both B and C — it must acquire both locks if dispatched.
- **Wave D (`vault-state`):** `R12`, `R13` — sequential, never concurrent with each other or with any other `state/**` writer (e.g., R10's `state/**` hazard, R17 regen).
- **Wave E (HOLD until trigger):** `R1,R2,R3,R4,R16,R17,R18,M1-M8` — held (BLOCKED/FOG/HITL). First ready per lock when gate opens (e.g., R1 and R2 share lock → one at a time).
- **Wave F (verify-only):** `R18` verify can run anytime (no writes); `R16/R17` monitors can be pulled early as low-risk observability (R17's stale check is already actionable).

**Parallelization guard:** `R9 + R11 + R15 + R19-tickets` can run in parallel today (disjoint touches, no shared lock). `R12` cannot parallel with `R13` (`vault-state` shared) and neither can run with `R10`'s `state/**` hazard. `R5` cannot parallel with any `persistence` or `page-workspace` holder.

**Explicit touches/hazard_touches for R (supplement to plan.md M table):**

- R1: `touches [src/lib/persistence/store.ts, src/discovery/harvest-lock.ts, src/discovery/harvest.ts]` `hazard_touches [src/lib/persistence/**]`
- R2: `touches [src/discovery/ledger.ts]` `hazard_touches [src/lib/persistence/**]`
- R5: `touches [src/app/api/dev/discovery/jobs/[jobId]/cancel/route.ts, src/discovery/jobs.ts, src/discovery/harvest.ts, src/app/dev/mission-control/_components/provider-health.tsx]` `hazard_touches [src/lib/persistence/**]` + `page-workspace`
- R6: `touches [src/discovery/jobs.ts, src/app/api/dev/discovery/jobs/route.ts]`
- R8: `touches [src/discovery/health-aggregate.ts, src/app/api/dev/health/route.ts]` `hazard [src/lib/persistence/**]`
- R10: `touches [src/discovery/dedupe-persist.ts, src/lib/persistence/keys.ts]` `hazard [src/lib/persistence/**, state/**]`
- R16: `touches [src/discovery/providers/brave-search.ts, src/discovery/pipeline.ts, src/app/api/dev/health/route.ts]`
- R17: `touches [scripts/check-evidence-head.mjs, .github/workflows/ci.yml]` `hazard [state/**, .autoforge/validation/**, stages/**]`
- R19: `touches [workflow/wayfinder/maps/ops-residual/tickets/R19-*.md, src/wayfinder/tickets.ts, src/wayfinder/ticket-types.ts]` `hazard []`
- R9/R11/R14/R15: docs/scripts/comments only, no lock.

## 5. Vault determinism & evidence byte-identity as architectural constraints

- Vault: `scripts/vault-sync.mjs:16-22` compiles from detached HEAD worktree with `node_modules` symlink; CI `vault determinism (V2)` does bare `vault-export`+`vault-import` + `git diff --exit-code -- vault/views state/vault-notes.json`. Workers must never bare-compile before commit; use `vault-sync --check` as pre-push gate. This is not a lock but a correctness invariant — any module writing `vault/**` or `state/vault-notes.json` must be serialized under `vault-state-single-writer`.
- Evidence: `ops-loop-evidence.json` schema stable (`commit`, `generatedAt`, `historicalProbe`, `vaultCheck`, `typecheck`, `build`, `ledgerGrowth`, `productionDeploymentVerified`, `daemonVerified` + T1/T2). Both copies byte-identical by construction (`cmp -s`); regen must atomically overwrite both (R17). Staleness check ties `commit` to `HEAD` and `generatedAt` to HEAD author date ±24h.

## 6. Tradeoffs & alternatives rejected

- **Generic `DistLockService` facade** — rejected. Ponytail: one method `setIfAbsent` on existing `DataStore` is smaller than new service, testable via `MemoryStore`, no dep.
- **ORM for Postgres (M8)** — rejected. Interface is key/value + prefix scan (`put/get/getMany/keys/del/delByPrefix` at `store.ts:16-26`); ORM adds mapping without value and hides null vs unavailable semantics.
- **KV pipeline helper for ledger index** — deferred. If post-R2 contention remains, add explicit CAS helper later; premature now.
- **Auto-merge for vault** — rejected. Trigger is real divergence; diagnostics + human resolution preserves chartered ownership.
- **Broad cache/RSC provider** — deferred to measurable TTFB/SEO target (M7); current `WorkspaceApiAdapter` is testable seam.
- **New AI framework/cache/auto-merge/history framework** — globally rejected (plan Global guardrails §2).
- **Duplicate tracker DB (R19 alt B)** — rejected; single markdown canonical via `tickets.ts` compile is cheaper and drift-free.
- **Bento code change (R18 alt)** — rejected; verification-only suffices after duplicate cleanup.

## 7. Risks & mitigations

- **Coupling via `getDataStore()` singleton at `store.ts:183`:** KV env absence silently falls back to Memory per-route, creating split-brain across lambdas. R1/R2/R10 still isolate via `store?` injection param; M8 must resolve `createFallbackStore` silent fallback before production cutover (follow-on to ADR-0001).
- **TTL vs `maxDuration 60s` drift:** `acquireHarvestLock` default 3600s is safe; per-call override if future jobs lengthen. `ponytail: 3600s global lock ceiling`.
- **Index orphan accumulation:** R2 heal pass prevents tail divergence but may mask KV `KEYS` star-expansion latency at large prefixes — 500-entry trim at `ledger.ts:25` bounds it.
- **Health surface growth:** R8/R16 add fields to `GET /health` at `route.ts:132`; keep shape additive, never remove `providers/ledger/topology`, document degraded flag as nullable boolean.
- **Staging hygiene regression:** R12 decision must land before any `.autoforge` migration; otherwise parallel lanes re-introduce `git add -A` poison (AGENTS.md). CI could enforce `git status --porcelain` check for stray `.autoforge` staging.
- **Brave quota silent degrade:** without R16 refusal propagation, ops has no signal; next Actions run green with 0 hits masks gap coverage loss. Mitigated by `refusals` + `WARN` token + health degraded flag.
- **Ticket index drift (R19):** `tracker-index.md` compiled verbatim from `tickets.ts` + `MAP.md:58-59`; if Wayfinder tickets edited without recompiling, frontier stale. Mitigate by `npm run tickets` CI check and `tracker-index.md` as curated commit (R12 policy).
- **Evidence staleness:** `commit != HEAD` already present (61c7475 vs 056b75f vs a715ee8); R17 check makes it CI-visible.

## 8. Deepening opportunities (codebase-design lens)

- **Shallow module:** `store.ts:130-181 createFallbackStore` catches all KV failures and silently falls back to Memory — violates honest `StoreUnavailableError` semantics. Deepen by making fallback opt-in per call or removing it for production (M8 unblocks this). `ponytail: global fallback is ceiling until M8`.
- **Repetition:** `jobs.ts:94-180 loadIndex/saveIndex/createJob/updateJob/appendLog` all triplicate `if(store) else if(isKv()) else file` branch. Extract `resolveStore(store?)` once; R6 fix is chance to consolidate. `ponytail: triplicated store branch, extract resolveStore if fourth caller appears`.
- **Interface vs parameter:** `DedupeIndex` file vs KV fork hidden behind global env check (`isKv()` at `jobs.ts:53`). R10 makes choice explicit at seam (KV-first) — stricter boundary.
- **Design cohesion:** `harvest.ts:146-161` loop + `provider-health.tsx:119-237` visibility logic + poll + storage key interleaved — candidate for extraction after R5 ships (view model only after second consumer).
- **Wayfinder plumbing depth:** `tickets.ts` already deep (large behaviour — front-matter parse + classify + index — behind small `TicketIndex` interface); R19 leverages this — no new deepening needed, just traceability wiring.

## 9. Verification (no new infra)

- R1: MemoryStore concurrent acquire + `vitest` in-process lock regression.
- R2: 50-entry concurrent append + orphan-drop; `tests/domain/discovery-harvest.test.ts` green without new mocks.
- R3: three regression tests.
- R5: cancel flips `running→cancelled`; next iteration bails with `setJobError`.
- R6: stale cursor (present/missing/trimmed-past) tests.
- R7: DOM `title` contains `bypasses.*dedup` and `no scheduling side-effect`.
- R8: `harvestHealth` shape under MemoryStore with one done job.
- R9: `--live --json` valid JSON nothing else; validator parses deterministically.
- R10: ROFS fake-FS throw → KV succeeds + WARN; local dev writes both.
- R16: 402 mock empty no throw + refusal log token; 429 still retries.
- R17: `node scripts/check-evidence-head.mjs` exit 0 when `commit==HEAD`, fail with actionable msg otherwise; `cmp -s` twin.
- R18: `git ls-files --others --exclude-standard` 0 jsx/js shadow; `npm run typecheck && lint && build` green; `flow.spec.ts` pass/skip.
- R19: `npm run tickets` + Mission Control Tickets tab list R19; `tracker-index.md:93-95` matches MAP:58-59.
- Vault: `node scripts/vault-sync.mjs --check` pre-handoff; CI `vault determinism (V2)` green.
- Evidence: `cmp -s .autoforge/validation/ops-loop-evidence.json stages/07_validate/output/ops-loop-evidence.json` green.

---
No new dependencies. No generic facades. All Rs/Ms reuse existing seams or wait for explicit trigger/HITL. Smallest correct change per frontier; multi-frontier bundling (Postgres+Blob) rejected. Ponytail ceilings tagged per module.
