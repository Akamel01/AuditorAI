# Architecture Report — Remaining Frontier R5–R15, R19 (ops-residual)

Date: 2026-09-02
Scope: `workflow/wayfinder/maps/ops-residual/MAP.md:39-59`, `workflow/wayfinder/maps/ops-residual/tickets/R5-server-cancel.md` through `R15-docs-production-deploy-refresh.md`, `R19-wayfinder-plumbing-traceability.md:29-48`, `.autoforge/requirements/grilling-remaining.md:1-122`, `.autoforge/discovery/tracker-index.md:22-96` (R5-R15,R19 OPEN, R16-R18 FOG), `src/discovery/jobs.ts:1-369`, `src/lib/persistence/store.ts:1-200`, `src/discovery/harvest.ts:1-420`, `src/discovery/ledger.ts:1-40`, `src/discovery/dedupe-persist.ts:1-107`, `src/discovery/health-aggregate.ts:1-61`, `src/app/api/dev/health/route.ts:1-170`, `src/app/api/dev/discovery/jobs/[id]/cancel/route.ts:1-21`, `src/app/api/dev/discovery/jobs/route.ts:1-19`, `src/app/dev/mission-control/_components/provider-health.tsx:1-512`, `src/wayfinder/tickets.ts:1-193`, `src/wayfinder/ticket-types.ts:1-51`, `src/app/api/dev/tickets/route.ts:1-18`, `src/app/dev/mission-control/_components/ticket-board.tsx:1-100`, `scripts/discovery-doctor.ts:1-112`, `scripts/check-eval-gate-freshness.mjs:1-36`, `workflow/wayfinder/TRACKER.md:1-106`, `AGENTS.md:7-23`, `docs/validation/eval-gates.md:15-38`, `README.md:85-91`
Status: design-only — no implementation. Ponytail ladder enforced, vault determinism as hard constraint where state/*.json is touched. Model budget 80k tok (inherit `opencode/muse-spark-1.2-contributor-free` 1M*0.30 capped).
Blocked_by: discovery + grilling-remaining. Inputs sized to fit: grilling-remaining verbatim (122 lines), tracker-index R5-R15 lines verbatim (22-96), MAP.md:39-59 plus prior architecture vault report summarized.
Skills invoked: `codebase-design` (module/interface/seam/depth, leverage/locality vocabulary throughout), `improve-codebase-architecture` (selectively — deepening candidates §8).

## 1. Findings — boundaries as they exist

**Map ownership:** `ops-residual` is local-markdown only per `workflow/wayfinder/TRACKER.md:14` and `MAP.md:9,39-59`. No GitHub sync for R5-R15,R19. `v2-agentic-platform` alone is GitHub-canonical on issue #20 (`TRACKER.md:10-11`). This is the hard boundary for R19: the ticket index that powers Mission Control and CLI stays markdown-canonical; claim/resolve is front-matter edits (`status`,`assignee`) at `TRACKER.md:60-62`.

**Seam inventory before the frontier (reuse before inventing, ponytail rung 2):**

| Seam | File:line | Interface (what callers must know) | Depth |
|---|---|---|---|
| **DataStore** | `src/lib/persistence/store.ts:16-26` `MemoryStore:28-57` `KvRestStore:60-126` `getDataStore:183-188` | `kind:"memory"|"kv"`, `put/get/getMany/keys/del/delByPrefix`, `StoreUnavailableError:9-14` distinguishes transport failure from absent key (`null`), `setDataStoreForTests:192-194` | Deep: hides REST `["SET",key,JSON]→fetch` at `:68-95`, 5s abort at `:70-71`, `KEYS prefix*` at `:112-114`, fallback `Kv→Memory` wrapper at `:130-181`. Leverage: every harvest/ledger/dedupe/jobs path routes through it. Locality: fix quoting/auth once. |
| **Job store** | `src/discovery/jobs.ts:41-42` `PREFIX/INDEX_KEY` `createJob:133-197` `getJob:199-215` `listJobs:223-274` `updateJob:276-318` `appendLog:320-357` | `DiscoveryJob{status:"queued"|"running"|"done"|"error"|"cancelled",live,cellKey,providers,logs,currentNode}` at `:10-39`, `listJobs(limit,cursor,store?)→{jobs,nextCursor,total}` cursor contract at `:217-223`, `isKv():53-60` branch, `jobsFilePath:64-66` file mirror for dev | Deep: large behaviour (KV vs file vs injected store, index trim `slice(0,20)` at `:159,189`, log trim `200` at `:325,340`) behind small async interface. |
| **Discovery doctor** | `scripts/discovery-doctor.ts:14-53` | `LIVE` flag at `:14`, `JSON_MODE` at `:15`, `--json` branch prints `{"providers":[{id,enabled,hostsOk,sampleHits}],totals}` at `:44-50` | Deep: hides provider resolve + `discover({limit:3})` per provider behind one flag branch. |
| **Health-aggregate** | `src/discovery/health-aggregate.ts:20-61` `aggregateHarvestHealth(entries)` | Pure `LedgerEntry[]→HarvestHealth{lastRunAt,lastSuccessAt,lastHits,degraded}` at `:7-12`, null-safe derivation at `:21-60` | Deep: hides timestamp `Date.parse` max, `payload_kind==="discovery_hits"` filter behind one function. Second adapter (file ledger vs KV tail) would prove seam. |
| **Health route** | `src/app/api/dev/health/route.ts:15-169` | `GET /api/dev/health` admin-gated at `:16-17`, returns `{providers:[{id,enabled,ping:{ok,latencyMs,hits,error}}],ledger,topology,harvestHealth,health_degraded}` at `:158-166` | Today `harvestHealth` derived via `withPersistenceSingleWriter(()=>readFileSync ledger)` at `:143-152` delegating to `aggregateHarvestHealth` — already deep but diverges from R8 brief (`jobs.listLatest`). |
| **Wayfinder index** | `src/wayfinder/tickets.ts:34-193` `ticket-types.ts:2-51` `src/app/api/dev/tickets/route.ts:6-17` `ticket-board.tsx:28-33` | `indexWayfinderTickets(root)→TicketIndex{schema_version:"1.0.0",source,maps,tickets,counts{total,open,claimed,blocked,closed,frontier,ready_without_owner,hitl_frontier}}` at `tickets.ts:169-189`, `classifyTickets` frontier rule `status==="open" && unassigned && depsClosed` at `:119-134`, `FRONT_MATTER_RE` at `:34` | Deep: hides `FRONT_MATTER_RE` parse, `parseHitl/parseList/parseScalar` at `:60-88`, `MAPS_DIR` scan at `:136-142`, sorted emit. Locality: fix blocked_by logic once. |
| **Dedupe persist** | `src/discovery/dedupe-persist.ts:12-107` `src/lib/persistence/keys.ts:50-55` | `loadDedupeIndex(cwd):DedupeIndexDoc` at `:28-47`, `loadDedupeIndexAsync(store?,cwd?)` KV-first at `:51-58`, `saveDedupeIndex` with EROFS warn at `:60-75`, `persistDedupeFromResult(packages,bundles,qualities,store?)` at `:77-107`, `DISCOVERY_DEDUPE_INDEX_KEY="discovery:dedupe-index"` at `keys.ts:50` | Medium-deep: hides KV-first vs file-seed fallback. The `__KV_DEDUPE_INDEX__` global at `:19-26` is shallow synthetic adapter — candidate to delete. |
| **Ledger** | `src/discovery/ledger.ts:4-40` | `appendLedgerKV(entries,store?)` per-entry `put(entryKey(seq))` then index dedup `!index.includes(seq)` + sort + `slice(-500)` at `:8-26`, `getLedgerTailKV(limit,store?)→{entries,total}` via `getMany` at `:28-39` | Medium: index ordering + orphan handling is the R2 frontier; today `getLedgerTailKV` does **not** heal orphans (filters nulls but leaves index dirty). |
| **Harvest orchestrator** | `src/discovery/harvest.ts:106-247` `HIP: HARVEST_LOCK:104` `executeJob:106-247` | `executeJob(jobId,ctx,providerIds,ranAtIso,deps?)` with `HarvestDeps{store,readFileSync,cwd,listProviderIds,providerEnabled,resolveProvider}` at `:62-71`, cancellation poll at `:118-130` + per-node poll at `:166-173`, lock `HARVEST_LOCK` at `:104` + `finally` reset at `:244` | Shallow today (lock is process-local bool). Depth earns keep once `harvest-lock.ts` adapter is added (R1). |

**Current frontier implementation state (gap check):**

| Ticket | Brief source | Status in code | Delta to close |
|---|---|---|---|
| R5 Stop/Cancel | `R5-server-cancel.md:22-27` | Already wired: `cancel/route.ts:6-17` marks `cancelled`, `harvest.ts:116-130,166-173` bails + `appendLog D00-CANCELLED`, `provider-health.tsx:163-171` fire-and-forget POST | Need test + label `cancelling…→paused · cancelled` (ticket AC 3) |
| R6 Pagination | `R6-pagination-trim.md:20-21` | Already fixed: `jobs.ts:223-274` stale cursor→latest page, `nextCursor:=last pageId`, page cap `[1,20]` at `jobs/route.ts:13` | Add trim doc comment, tests cursor trimmed past |
| R7 Refresh parity | `R7-refresh-parity.md:20-24` | Done: `provider-health.tsx:383-391` comment + `482 title="Refresh bypasses …"` | No delta (keep title, no new abstraction) |
| R8 Harvest health | `R8-harvest-health-route.md:22-25` | Partial: `health/route.ts:135-155` returns `harvestHealth` but shape is `{lastRunAt,lastSuccessAt,lastHits,degraded}` not ticket's `{lastRunAt,lastRunStatus,lockHolder,lockAcquiredAt,indexedEntriesCount}`; derives from file ledger not `jobs.listLatest`/`getLedgerTailKV` | Align shape or document delta as intentional ceiling |
| R9 Doctor JSON | `R9-discovery-doctor-json.md:20-23` | Done: `discovery-doctor.ts:17-53` prints `providers[]+totals` | None (keep both `--live --json` valid) |
| R10 Dedupe KV-truth | `R10-dedupe-write-authority.md:20-22` | Half: `dedupe-persist.ts:51-75` KV-first async + EROFS warn exists, but `persistDedupeFromResult:85` still `loadDedupeIndex(cwd)` sync not `loadDedupeIndexAsync(store)` | Switch to KV-first load in persist path |
| R11 Drop stale comments | `R11-drop-stale-comments.md:17-22` | Remaining speculative comments are intentional ceilings (`harvest.ts:99-103` lock upgrade path); `getGitHead()` style already pruned | Prune only if any removed-helper reference remains |
| R12 Storage policy | `R12-autoforge-storage-policy.md:20-22` | Untracked `?? .autoforge/` per `tracker-index.md:22-96`, no `.autoforge/AGENTS.md`, no `.gitignore` line for `.autoforge/` | Pick (a) commit subset or (b) ignore + document |
| R13 Freshness gate | `R13-eval-gate-freshness.md:22-25` | Half: `check-eval-gate-freshness.mjs:11-28` reads `eval-gates.md:15-38` §§2/3, checks `state/eval-scorecards` age, but `console.warn` not `process.exit(1)` at `:25` → CI never fails | Make gate fail with actionable msg, wire GH Action step |
| R14 Tier1 housekeeping | `R14-tier1-housekeeping.md:20-22` | No `scripts/tier1-archive.mjs` present (`glob scripts/*` shows 18 files, no tier1). Header drift refers to `--topup <runId>` vs `--rebase` | Identify canonical file (`run-eval.ts` or `check-eval-gate-freshness.mjs`) or create tier1 header |
| R15 Docs deploy | `R15-docs-production-deploy-refresh.md:20-21` | `README.md:85-91` still `docs/deployment.md` A/B Vercel options, `docs/deployment.md:6-23` auto-deploy from `main`, but README CONTRIBUTING production section not yet `main is prod + harvest schedule` as ticket says | Text-only edit, reference `AGENTS.md: Eval gates` freshness |
| R19 Plumbing | `R19-wayfinder-plumbing-traceability.md:38-48` | Already deep: `tickets.ts` + `ticket-types.ts` + `tickets/route.ts:6-17` + `ticket-board.tsx:11-99` + `TRACKER.md:15-17` index line. Missing: `scripts/wayfinder-tickets.ts` CLI + `package.json:8-21` lacks `tickets` script | Add thin CLI reusing seam |

## 2. Boundaries per R ticket (module / seam / who owns)

**R5 — Stop/Cancel endpoint**
- Module: `DiscoveryJob` store behind `src/discovery/jobs.ts:updateJob` seam; adapter is `DataStore` (KV vs MemoryStore vs file). Interface: `POST /api/dev/discovery/jobs/:id/cancel` admin-gated at `cancel/route.ts:7-8` (same `requireAdmin` as `jobs/route.ts:7`, `health/route.ts:16`). Behaviour hidden: `updateJob(jobId,{status:"cancelled"},store?)` + `harvest.ts:118-130` early bail and `166-173` per-node guard + `appendLog D00-CANCELLED`.
- Who writes: route + `executeJob` only. No new dep. Ponytail: one `updateJob` call is the smallest diff.

**R6 — Pagination cursor stability**
- Module: `listJobs` at `jobs.ts:223-274` behind `loadIndex(store?)→string[]` seam at `:94-113`. Index is the interface: `INDEX_KEY="discovery:job:index"` at `:42`, trimmed `slice(0,20)` at `:159,189`. Cursor contract is the test surface: present→`slice(idx+1)`, missing/trimmed→`slice(0,limit)`, empty window→fallback. Depth already earns keep: callers learn `nextCursor` without learning trim internals.
- Who writes: `createJob` maintains index. R6 is pure read-path fix, no schema change (`{jobs,nextCursor,total}` at `jobs/route.ts:14-15` stays).

**R7 — Refresh parity tooltip**
- Module: `provider-health.tsx` client component. Seam is HTML `title` attribute at `474-485` (already present). No new module. Interface is the tooltip string itself: `title="Refresh bypasses onRun dedup — deliberate manual inspection…"`. Depth is intentionally shallow — one attribute hides design intent from future readers.

**R8 — Harvest-health sub-object**
- Module: `src/discovery/health-aggregate.ts:aggregateHarvestHealth` (pure) + `GET /api/dev/health` route seam at `health/route.ts:15`. Current derivation is `withPersistenceSingleWriter(()=>readFileSync ledger)` at `:143-152` — file ledger is the adapter today. Desired per ticket: `getLedgerTailKV` + `getDataStore` + `jobs.listLatest` as adapters. Boundary is that route must not invent alerting (`R8 Out of scope`); it only surfaces what seams already know. Least-privilege: route reuses `DataStore` read-only, no write.

**R9 — Doctor JSON contract**
- Module: `scripts/discovery-doctor.ts:17-53` behind CLI flag seam `--json` at `:15`. Interface is single JSON object `{providers:[{id,enabled,hostsOk,sampleHits}],totals:{totalProviders,totalEnabled,totalSampleHits}}` at `:44-50` — stable for CI at `R9 Acceptance:27`. Exit codes unchanged. No view/state write.

**R10 — Dedupe KV-truth**
- Module: `src/discovery/dedupe-persist.ts` behind `DataStore` + `DISCOVERY_DEDUPE_INDEX_KEY` at `keys.ts:50`. Load seam is `loadDedupeIndexAsync(store?)` at `dedupe-persist.ts:51-58` (KV-first) vs sync `loadDedupeIndex(cwd)` at `:28-47` (file seed). Write seam is `saveDedupeIndex` file mirror at `:60-75` (EROFS warn) + `s.put(DISCOVERY_DEDUPE_INDEX_KEY)` at `:104`. Boundary: file is best-effort mirror in dev, KV is source on ROFS per `R10.md:21-22`.

**R11 — Drop stale comments**
- Module: `src/discovery/harvest.ts` source comments. Seam is comment content, not code. Boundary: keep only `ponytail:` ceiling comments (global lock, O(n) scan) and contract notes; delete narration of removed helpers. No behaviour change, only locality (noise reduction).

**R12 — AutoForge staging policy**
- Module: repo `.gitignore` + `.autoforge/AGENTS.md` (new) policy seam. Interface is a Storage policy section in `.autoforge/AGENTS.md` + single `.gitignore` line (either `.autoforge/` ignored or curated subset committed). Boundary is git index, not runtime code. Decision is human-owned per `vault/CHARTER.md:82-85` analogue — agents propose, owner applies.

**R13 — Eval gate freshness automation**
- Module: `scripts/check-eval-gate-freshness.mjs:7-34` + GitHub Actions step `gate-freshness` (new). Interface: `node scripts/check-eval-gate-freshness.mjs [maxAge]` reads `docs/validation/eval-gates.md:15-38` §§2/3 for maxAge (default `7d` at `:22`), stats `state/eval-scorecards` mtime at `:20-21`, fails with actionable `gh workflow run tier1 --topup <runId>` message per `R13-acceptance:29`. Threshold lives outside script body per `R13:29`.

**R14 — Tier-1 archive housekeeping**
- Module: header comment of the tier1 script (candidate `scripts/tier1-archive.mjs` or if missing, the canonical `scripts/run-eval.ts`/`scripts/check-eval-gate-freshness.mjs`). Interface is the comment block only. Boundary: reference doctrine by path (`docs/validation/eval-gates.md`) not hardcoded threshold.

**R15 — README/CONTRIBUTING deploy refresh**
- Module: `README.md:85-91` and `docs/deployment.md:6-23` text. Interface is the Production deploy paragraph: `main is production; Vercel auto-deploys from main; discovery-harvest schedule refreshes state`. Keep `AGENTS.md:eval gates` freshness window reference.

**R19 — Wayfinder plumbing traceability**
- Module: `src/wayfinder/tickets.ts:169-193` behind `WAYFINDER_MAPS_DIR="workflow/wayfinder/maps"` at `ticket-types.ts:2` + `FRONT_MATTER_RE` at `tickets.ts:34` + `isTerminalStatus` at `:36-38` + `classifyTickets` frontier at `:119-134`. Adapter 1: markdown files (`MAP.md`+`tickets/*.md`). Adapter 2: compiled `TicketIndex` JSON served by `tickets/route.ts:6-17`. Adapter 3: `ticket-board.tsx:28-34` `inLane` rendering. New adapter 4: thin CLI `scripts/wayfinder-tickets.ts` that calls `indexWayfinderTickets()` and prints `wayfinder <n> tickets · frontier <n>…` + `--json` branch. Boundary: markdown remains canonical (`TRACKER.md:17`), view does not write.

## 3. Alternatives — design-it-twice per concern

### 3.1 R5 Cancel

- **A) Status-patch via `updateJob` — CHOSEN (current `cancel/route.ts:16` + `harvest.ts:116-173`)**
  - `POST /cancel {jobId}` → `await updateJob(jobId,{status:"cancelled"})`; `executeJob` polls `getJob` before lock at `:118-130` and before each `DISCOVERY_NODE_IDS` at `:166-173`, logs `D00-CANCELLED` and `return`. Idempotent (re-POST same cancelled job is no-op), admin-gated, reuses seam.
  - Pros: one DB field is truth, all processes see it via KV; `updateJob` already handles KV vs file at `jobs.ts:276-318`; smallest diff; ponytail rung 2/3.
  - Cons: not pre-emptive inside a running node (waits for node boundary) — accepted ceiling per `R5:34` out of scope "mid-process abort signals".
  - `ponytail: per-node poll is ceiling; AbortSignal per node deferred until measured inside-node latency matters.`

- **B) AbortController passed through `runDiscoveryNode`**
  - Pros: true in-node cancellation.
  - Cons: requires threading `signal` through every pipeline node (`pipeline.ts` seam) — large interface growth shallow module, one new param per node, test matrix explosion. Rejected: YAGNI per `R5:34`.

- **C) Separate KV cancel token `discovery:job:cancel:<id>`**
  - Pros: explicit intent key.
  - Cons: second source of truth, must keep token and job status in sync → fork risk same as R10 file/KV fork. Rejected.

Tradeoff matrix:

| Criterion | A status-patch | B AbortSignal | C token key |
|---|---|---|---|
| Interface size | 1 field | N node params | 1 extra key + status |
| KV vs Memory correctness | ✅ via DataStore seam | ✅ but wider plumbing | ❌ dual truth |
| Ponytail | **chosen** | over-built | speculative |

### 3.2 R6 Pagination

- **A) Stable cursor via `loadIndex` scan — CHOSEN (`jobs.ts:223-274`)**
  - `ids = await loadIndex(store)` (KV-backed or file) then `indexOf(cursor)` → `slice(idx+1,idx+1+limit)` else `slice(0,limit)` + `pageIds.length===0 → fallback to latest` at `:234-239`, `nextCursor = last pageId` at `:272`. `limit` clamped `[1,20]` at `jobs/route.ts:13`.
  - Pros: no API shape change (`{jobs,nextCursor,total}`), correct under trim window `slice(0,20)` at `jobs.ts:159`, testable pure cursor arithmetic.
  - Cons: scan is `O(indexLen)` (indexLen ≤20, ponytail ceiling `O(20)` trivial).

- **B) Keep `index.indexOf` over in-memory array trimmed naively**
  - Pros: no code.
  - Cons: stale cursor → `jobs:[] , nextCursor:null` lossy page per `R6:18-19`. Rejected.

- **C) KV sorted set ZADD/ZRANGE or `KEYS discovery:job:*` full scan**
  - Pros: scales beyond 20.
  - Cons: Upstash REST `KEYS` is scan-expensive, `KvRestStore.keys` at `store.ts:112-114` sorts but needs pagination-cross-validation, adds deps. Rejected: speculative until n>500 (see R2 ledger window).

`ponytail: indexLen=20 window is ceiling; KV scan cursor deferred until job volume >500 measurable.`

### 3.3 R7 Refresh parity

- **A) HTML `title` on Refresh — CHOSEN (`provider-health.tsx:482`)**
  - Pros: zero dep, accessible, survives refresh/tab switch via `localStorage` jobId seam at `:57-58`, already implements `R7 Acceptance:27`.
  - Cons: small font — acceptable.

- **B) New `<Tooltip>` component**
  - Pros: richer styling.
  - Cons: new abstraction for one string, violates ponytail rung 2 (already in codebase HTML can do it). Rejected.

### 3.4 R8 Health route

- **A) Pure `aggregateHarvestHealth(entries)` + route derivation — CHOSEN (with fix)**
  - Keep `health-aggregate.ts:20-61` as deep module, change route at `health/route.ts:143-152` to derive from `getLedgerTailKV` + `listJobs` instead of raw file read, fail-soft when KV unavailable (return nulls per `R8 Acceptance:29`). Shape must be documented; reconcile ticket's field list (`lastRunStatus,lockHolder,lockAcquiredAt,indexedEntriesCount` at `R8:21`) vs actual (`lastRunAt,lastSuccessAt,lastHits,degraded` at `health-aggregate.ts:7-12`).
  - Pros: single pure fn test surface, reuse DataStore seam.
  - Cons: shape mismatch needs owner freeze.

- **B) Route inlines aggregation**
  - Cons: duplicates logic, loses isolated test. Rejected.

- **C) External health ping/alerting**
  - Rejected per `R8:32` out of scope.

### 3.5 R9 Doctor JSON

- **A) Single `--json` branch printing one JSON object — CHOSEN (`discovery-doctor.ts:17-53`)**
  - `JSON_MODE` at `:15`, async `Promise.all(ids.map(...provider.discover...))` at `:20-41`, `totals` reduce at `:44-48`, `console.log(JSON.stringify(output,null,2))` at `:51`, `process.exit(0)` at `:52`. Human-readable path untouched at `:55-112`.
  - Pros: deterministic, CI-readable, preserves exit codes.
  - Cons: `--json` ignores `LIVE` flag distinction — discovery still runs limit 3 sample which costs quota — acceptable for CI stability.

- **B) Write JSON to file instead of stdout**
  - Cons: extra file param, breaks `| jq` pipelines. Rejected.

### 3.6 R10 Dedupe KV-truth

- **A) KV-first load + async persist + file best-effort — CHOSEN (to complete)**
  - Load: `await s.get(DISCOVERY_DEDUPE_INDEX_KEY)` if KV else fallback to `loadDedupeIndex(cwd)` file seed at `dedupe-persist.ts:51-58`. Persist: `saveDedupeIndex` file try/catch EROFS warn at `:70-71` then `await s.put(DISCOVERY_DEDUPE_INDEX_KEY)` at `:104`. New `loadDedupeIndexAsync` exists but `persistDedupeFromResult:85` still calls sync version — one-line fix to call async KV-first.
  - Pros: ROFS on Vercel no longer forks; local dev still mirrors file (deterministic tests via fake FS throw at `R10:30`).
  - Cons: sync callers that cannot await must keep sync fallback — ceiling noted.

- **B) File-only (current before R10)**
  - Cons: `state/dedupe-index.json` stale snapshot on ROFS or `EROFS` throw, KV untouched → fork per `R10:19`. Rejected.

- **C) Remove file entirely**
  - Cons: breaks `readDedupeIndex` sync callers and local seed for offline dev. Rejected.

`ponytail: global __KV_DEDUPE_INDEX__ sync shim at :19-26 is ceiling; remove when every caller can await.`

### 3.7 R11 Stale comments

- **A) Delete only stale narration — CHOSEN**
  - Keep `harvest.ts:99-103` ceiling comment (`HARVEST_LOCK process-local only… upgrade path…`) which passes "explains a ceiling or contract" test at `R11:21`, delete any `getGitHead()` or deleted hook narration.
  - No new dep, no behaviour change, typecheck stays green.

- **B) Keep all comments**
  - Rejected: noise per `R11:18`.

### 3.8 R12 Storage policy

- **A) Ignore `.autoforge/` — lean**
  - `.gitignore` add `/.autoforge/` , `.autoforge/AGENTS.md` documents "Storage policy: ignored, `artifacts/` is the committed surface". `git status` clean after pipeline.
  - Pros: no committed churn, parallel agents don't compete on `.autoforge/state.json`.
  - Cons: fresh clone loses run history; `workflow/wayfinder/maps/ops-residual/**` still committed so frontier not lost (Wayfinder markdown is canonical, not `.autoforge/`).

- **B) Commit curated subset — curated**
  - `.gitignore` keep `.autoforge/` tracked but ignore `*.log` etc, commit `state.json`, `plans/`, `decisions*.md`. Policy section lists curated set.
  - Pros: history in git.
  - Cons: merge churn, staging hygiene `AGENTS.md:21-23` burden for every pipeline run.
  - **Recommendation:** B is smaller risk for traceability (maps already commit pipeline evidence via `workflow/wayfinder/**`, but `.autoforge/state.json:1-28` is the only ledger of which modules were planned). Ponytail pick is (a) ignore — smallest diff — but run `R12 Acceptance:29` "`git status` no spurious listings" passes either way; choice is owner policy, not code. Default proposal: **B curated** to keep `.autoforge/state.json + decisions + plans/reviews` committed, extracted evidence untracked — matches `R12 Desired:21(a)`.

### 3.9 R13 Freshness gate

- **A) Script fails + CI step — CHOSEN**
  - Extend `scripts/check-eval-gate-freshness.mjs:11-28` to `process.exit(1)` with `threshold from docs/validation/eval-gates.md:31-38` (parse `7d` default but sourced, not hardcoded) when `ageMs > maxAgeMs`, message `run tier1 --topup <runId>` per `R13:26`. Add GH Action `gate-freshness` job in `.github/workflows/ci.yml` after determinism gate (`ci.yml:35-50` analogue).
  - Pros: doctrinal authority stays in `eval-gates.md`, testable `fresh vs stale` via mtime fixture.
  - Current `console.warn` at `:25` is warn-only ceiling — must harden to fail.

- **B) Manual freshness runbook**
  - Rejected: misses CI enforcement per `AGENTS.md:eval gates` trigger paths.

### 3.10 R14 Tier1 housekeeping

- **A) Header comment strict — CHOSEN**
  - File `scripts/tier1-archive.mjs` (if absent, canonicalize to `scripts/run-eval.ts` which `eval.yml:29` cites for `npx tsx` path) header contains only flags (`--rebase` + `--topup <runId>` next to each other per `R14:21`) + `docs/validation/eval-gates.md` path ref.
  - No behaviour change, typecheck green. If file doesn't exist, create minimal wrapper that delegates to `check-eval-gate-freshness.mjs`.

### 3.11 R15 Docs deploy

- **A) Text-only sync — CHOSEN**
  - `README.md:85-91` `## Deployment` + `docs/deployment.md:6-23` updated to `main is production; Vercel auto-deploys from main; discovery-harvest.yml schedule refreshes state` per `R15:21`. Reference `AGENTS.md:eval gates` freshness window. Keep command order.
  - No new files, lint stays.

### 3.12 R19 Plumbing

- **A) Reuse `tickets.ts` seam + thin CLI — CHOSEN**
  - CLI `scripts/wayfinder-tickets.ts` (new thin adapter): `import {indexWayfinderTickets} from "@/wayfinder/tickets"` → parse `--json/--lane` args at process.argv, print `wayfinder N tickets · frontier N · ready N · hitl N · blocked N` or JSON `{counts,tickets}`. `package.json:8-21` add `"tickets":"tsx scripts/wayfinder-tickets.ts"`. `tickets/route.ts:6-17` already serves JSON to `ticket-board.tsx:11-99`; board `inLane` at `ticket-board.tsx:28-33` is the UI adapter.
  - Pros: one interface `indexWayfinderTickets()` serves API, board, CLI — leverage; locality fix `classifyTickets` once.

- **B) Migrate ops-residual to GitHub Issues**
  - Rejected per `R19:51` out of scope and `TRACKER.md:14`.

- **C) DB-backed ticket index**
  - Rejected: speculative, violates markdown-canonical (`TRACKER.md:17`).

### 3.13 Cross-cutting: KV vs MemoryStore vs file fallback

This is the central risk surface for R5/R6/R8/R10 and prior R1-R4.

| Adapter | File:line | When it holds | Failure mode | Risk | Mitigation |
|---|---|---|---|---|---|
| **MemoryStore** | `store.ts:28-57` | `KV_REST_API_URL` absent (`createFallbackStore:131-133` `!url||!token → new MemoryStore()`), local dev, vitest | Per-function isolation (not shared across Next.js bundles) per `jobs.ts:4-5` comment | Lost cursor/index across lambdas, ledger tail diverges, cancel not visible cross-instance | Accept as ceiling for dev; ticket R1 documents cross-instance need |
| **KvRestStore** | `store.ts:60-126` `keys:112-114` `getMany:108-109` | `KV_REST_API_URL+TOKEN` set (`createFallbackStore:134`) | REST `!res.ok → StoreUnavailableError:85` or `error field →85-93` or 5s abort `:71` | StoreUnavailable deg → fallback to MemoryStore map at `store.ts:145-150` etc keeps call alive but forks state (two truths) | R10 explicitly prefers KV-first then fallback; harvest R1 upgrade adds `SET NX EX` atomicity (see R1 ticket via `R1-cross-instance-harvest-lock.md:24` `["SET",key,"1","NX","EX",3600]`) |
| **Fallback wrapper** | `store.ts:136-180` `kind:"kv" as const` | Always when env set | On `kv.put` fail silently falls to `fallback.put` at `:140-143`, `get` falls to fallback at `:145-150` | Silent split-brain — caller thinks KV-truth but actually MemoryStore-truth this request | Ponytail ceiling: `ponytail: fallback is ceiling; explicit StoreUnavailableError propagation deferred until callers handle it per-store` — R1 tracks proper CAS. For now test with `setDataStoreForTests(memory)` keeps hermetic suites. |
| **File mirror** | `jobs.ts:64-92` `harvest.ts:256-323` `dedupe-persist.ts:60-75` | Dev only (`isKv():53-60` false) and legacy `state/*.json` files | ROFS on Vercel (`EROFS` at `dedupe-persist.ts:70`, `harvest.ts:312 swallows`) | File and KV diverge → `R10 fork` and `ledger index race` | Harden via KV-first loads + swallow with `WARN` log; Head worktree (below) keeps file state deterministic in CI |

**KV vs MemoryStore tradeoff matrix:**

| Criterion | MemoryStore (local) | KV REST (prod) | File mirror |
|---|---|---|---|
| Correctness cross-instance | ❌ per-fn | ✅ shared | ❌ per-image |
| Test hermetic | ✅ `setDataStoreForTests` | ⚠️ needs env | ✅ checked in `state/` |
| Latency | ~0ms map | ~50-200ms fetch + 5s timeout | sync FS |
| Ponytail pick | ceiling for dev/tests | chosen for prod truth | best-effort mirror only |

### 3.14 Cross-cutting: HEAD worktree vs bare vs stash (vault determinism)

| Approach | File:line | Correctness | Cost | Verdict |
|---|---|---|---|---|
| **A HEAD worktree compile — CHOSEN** | `scripts/vault-sync.mjs:16-44` `git worktree add --detach ${tmp} HEAD` at `:17`, symlink `node_modules` at `:19`, compile in tmp at `:21-22`, `Buffer.equals` at `:31` or `writeFileSync(live,compiled)` at `:42` | ✅ immune to foreign uncommitted `vault/journal/**`; CI `--check` at `:27-37` is repo-truth | tmp + worktree add/remove ~100ms, orphan risk on crash `finally:45-52` | **chosen**, only path before commit per `AGENTS.md:15-18` |
| **B Bare `node scripts/vault-import.mjs`** | — | ❌ poisons `state/vault-notes.json` with dirty journals → `git diff --exit-code` fails at `ci.yml:50` | one command | rejected |
| **C Stash-then-compile** | — | ⚠️ loses untracked journals, pop conflicts | slower | deprecated at `AGENTS.md:19` |

`ponytail: worktree+symlink ceiling; per-journal lock deferred until parallel-write measurable.`

## 4. Recommendation — smallest correct change per R

**Keep DataStore seam, reuse Next route handlers, add thin adapters only where second adapter proves seam:**

1. **R5** — keep `cancel/route.ts:16` + `harvest.ts:116-173` poll; add MemoryStore test (`tests/domain/cancel.test.ts`) asserting `running→cancelled` flips and next `executeJob` iteration bails + appends `cancelled`. UI: change `provider-health.tsx:397-414` Stop→`cancelling…` then on poll terminal show `paused · cancelled by user`. No new dep. `ponytail: per-node poll ceiling; AbortSignal deferred.`
2. **R6** — keep `jobs.ts:223-274` stable paging; add route comment `Documented truncation: index trimmed to 20, stale cursor→latest page` above `listJobs`. Tests for `cursor present / missing / trimmed past` (reuse `listJobs` directly, no mocks beyond `MemoryStore`). Cap stays `[1,20]` at `jobs/route.ts:13`.
3. **R7** — keep `provider-health.tsx:482` `title` as only change; no new component. Verify with `vitest` DOM `getByRole("button",{name:"Refresh"})` has `title.includes("dedup")` and `aria-label` fallback.
4. **R8** — extend `health/route.ts:135-155` to compute `harvestHealth` from `getLedgerTailKV` + `jobs.listLatest` (or `listJobs(1)`) when `isKv()` else file ledger fallback, keep `aggregateHarvestHealth` pure. Document shape delta: ticket asks `lastRunStatus/lockHolder/lockAcquiredAt/indexedEntriesCount`, implementation offers `lastRunAt/lastSuccessAt/lastHits/degraded` — propose owner freeze on implemented shape and add `lastRunStatus` derivation (`status` from latest job) + `indexedEntriesCount=total` to bridge without `lockHolder` (R1 blocked). Keep `isAnyProviderDegraded` at `:157` separate.
5. **R9** — keep `discovery-doctor.ts:17-53` JSON branch; add unit test asserting `JSON.parse(stdout)` has `providers[].id|enabled|hostsOk|sampleHits` and `totals` and no extra stdout. Both `--live --json` prints valid JSON per `R9:27`.
6. **R10** — one-line fix in `dedupe-persist.ts:85` → `await loadDedupeIndexAsync(store, cwd)` KV-first before `claimFingerprints`; keep `saveDedupeIndex:60-75` EROFS warn + KV mirror `s.put` at `:104`. Add tests: ROFS fake `writeFileSync` throws `EROFS` → KV still updated + `console.warn` once `dedupe: FS mirror skipped (ROFS)`; local dev writes both. Remove global `__KV_DEDUPE_INDEX__` if no longer needed (`ponytail: remove when async callers cover all paths`).
7. **R11** — prune stale comments in `harvest.ts` only; keep `ponytail:` ceilings (`:99-103` lock, `dedupe-persist.ts:16` writeQueue). Run `typecheck` to gate.
8. **R12** — choose **B curated subset committed** (default): add `/.autoforge/**` handling to `.gitignore` (ignore `*.log` but keep `state.json`, `plans/**`, `architecture/**`), add `.autoforge/AGENTS.md` section `## Storage policy — curated subset: commit state.json + decisions/plans/reviews, extracted evidence untracked` per `R12:28`. Alternative A ignore-all is one line if owner prefers.
9. **R13** — harden `scripts/check-eval-gate-freshness.mjs:24-26` to exit 1 on stale with `Console.error actionable`, add CI job `gate-freshness` in `.github/workflows/ci.yml` after `vault determinism (V2)` reading `docs/validation/eval-gates.md:31-38` threshold table (regex `7d`). Add `tests/eval-gate-freshness.test.mjs` fresh/stale fixtures by stubbing `fs.stat` mtime.
10. **R14** — header-only: locate tier1 script (if missing, note `scripts/check-eval-gate-freshness.mjs` is the canonical freshness gate and `scripts/run-eval.ts` is the eval entry per `README:eval.yml:29`); ensure top comment lists only ` --rebase` + ` --topup <runId>` next to each other (`R14:21`) + path `docs/validation/eval-gates.md`.
11. **R15** — text-only: edit `README.md:85-91` and create `CONTRIBUTING.md` if absent or sync `docs/deployment.md:6-23` to `main is production; Vercel auto-deploys; discovery-harvest schedule refreshes state; see AGENTS.md Eval gates for freshness window` without reordering commands (`R15:29`).
12. **R19** — add `scripts/wayfinder-tickets.ts` thin CLI: `import {indexWayfinderTickets} from "../src/wayfinder/tickets.js"` → `if(argv.includes("--json")) console.log(JSON.stringify(index,null,2)) else log` `wayfinder N tickets · frontier N · ready N · hitl N · blocked N` with `--lane` filter reusing `inLane` logic from `ticket-board.tsx:28-33`. Add `package.json:20` `"tickets":"tsx scripts/wayfinder-tickets.ts"`. No GitHub sync per `R19:48`.

No new dependencies. All variation stays behind existing seams (`DataStore`, `jobs.ts` index, `health-aggregate`, `tickets.ts`).

## 5. Interfaces — precise signatures

**Cancel (R5)**
```
POST /api/dev/discovery/jobs/:id/cancel  admin-gated (requireAdmin at cancel/route.ts:7)
  → 200 {cancelled:true,jobId} | 404 {error:"not found"} | 400 {error:"missing jobId"}  at :11-17
internal: updateJob(jobId,{status:"cancelled",updatedAt:iso,currentNode:null}) at :16
poll sites: harvest.ts:118 getJob(jobId) status==="cancelled" → appendLog D00-CANCELLED + return
        harvest.ts:166 per-node before DISCOVERY_NODE_IDS iteration same check
client: provider-health.tsx:168 void fetch(`/api/dev/discovery/jobs/${jobId}/cancel`,{method:"POST"}).catch(()=>{})
```

**Pagination (R6)**
```
GET /api/dev/discovery/jobs?limit=1..20&cursor=<jobId>  admin-gated at jobs/route.ts:7
  limit = clamp(parseInt(limitRaw)||10,1,20) at :13
  → {jobs:DiscoveryJob[], nextCursor:string|null, total:number} at :14-15
library: listJobs(limit,cursor,store?) at jobs.ts:223
  ids = await loadIndex(store)  // KV INDEX_KEY or file index at :94-113
  if(cursor && idx>=0) pageIds=ids.slice(idx+1,idx+1+limit) with empty-window fallback at :234-239
  else pageIds=ids.slice(0,limit)
  nextCursor = pageIds[pageIds.length-1] ?? null at :272
  fetch via store.getMany(prefix+id) at :253-269 or file data.jobs at :268
```

**Refresh tooltip (R7)**
```
provider-health.tsx:482 <button title="Refresh bypasses onRun dedup — deliberate manual inspection, no scheduling side-effect">
also: aria-label on Stop at :397 "Stop polling — job continues server-side" + Resume at :407
```

**Harvest health (R8)**
```
health-aggregate.ts:20 aggregateHarvestHealth(entries?:LedgerEntry[]|null):HarvestHealth
  HarvestHealth at :6-12 {lastRunAt:string|null,lastSuccessAt:string|null,lastHits:number|null,degraded:boolean}
route: GET /api/dev/health at health/route.ts:15 → JSON at :158-166
  {providers:[{id,enabled,ping}],ledger:{entries,lastAt,ageMs,ageHuman},topology:{drift,details},harvestHealth,degraded:health_degraded}
proposed extension: harvestHealth += {lastRunStatus:string|null,indexedEntriesCount:number,lockHolder:null} until R1 ships
```

**Doctor JSON (R9)**
```
scripts/discovery-doctor.ts --json [--live]
  output: {"providers":[{"id":string,"enabled":boolean,"hostsOk":boolean,"sampleHits":number}],"totals":{"totalProviders":number,"totalEnabled":number,"totalSampleHits":number}} at :44-50
  exit 0 if reachable, otherwise preserved (no change at :52)
```

**Dedupe KV-truth (R10)**
```
keys.ts:50 DISCOVERY_DEDUPE_INDEX_KEY="discovery:dedupe-index"
dedupe-persist.ts:51 loadDedupeIndexAsync(store?,cwd?):Promise<DedupeIndexDoc> // KV get else file at :54-57
dedupe-persist.ts:60 saveDedupeIndex(doc,cwd):void // file writeFileSync then best-effort; EROFS warn at :70-71
dedupe-persist.ts:77 persistDedupeFromResult(packages,bundles,qualities,store?,cwd?):Promise<DedupeIndexDoc|null>
  const index = await loadDedupeIndexAsync(store,cwd) // AFTER FIX (today sync at :85)
  ...claimFingerprints...
  saveDedupeIndex(index,cwd) at :100
  await s.put(DISCOVERY_DEDUPE_INDEX_KEY,index) at :104
```

**Wayfinder plumbing (R19)**
```
tickets.ts:144 loadTicketsFromTree(root)→WayfinderTicket[]  // scans WORKSPACE/WAYFINDER_MAPS_DIR/*/tickets/*.md via FRONT_MATTER_RE at :34
tickets.ts:119 classifyTickets(tickets)→IndexedTicket[]  frontier = status==="open" && assignee===null && blocked_by.every(dep terminal) at :122-130
tickets.ts:169 buildTicketIndex(tickets)→TicketIndex at :169-189 counts{total,open,claimed,blocked,closed,frontier,ready_without_owner,hitl_frontier} maps,tickets sorted
tickets.ts:191 indexWayfinderTickets(root)→TicketIndex
CLI (new): scripts/wayfinder-tickets.ts --json [--lane=ready|hitl|blocked|open|all]
  → stdout JSON {counts,tickets} with counts.total/frontier/ready_without_owner/hitl_frontier/blocked at R19 Acceptance:45-46
API: GET /api/dev/tickets at tickets/route.ts:6 → JSON TicketIndex (ENOENT fallback at :14 to total 0)
Board: ticket-board.tsx:28 inLane(t,lane) + :36-40 rows = index.tickets.filter(inLane)
```

**Least-privilege mapping per interface:**

| Interface | Who writes | Auth | Failure mode |
|---|---|---|---|
| Cancel POST | job owner + admin key (`ADMIN_KEY` at `docs/deployment.md:14`) | `requireAdmin` at `cancel/route.ts:7` (`x-admin-key` at `client.ts:81`) | 404 if missing, 401 if admin wrong, swallow if job already terminal |
| Jobs list | `createJob` at `harvest.ts:407` via `jobs.ts:133` (append to index) | admin read at `jobs/route.ts:7` | stale cursor→latest page (R6) not error |
| Health GET | route only, reads ledger/dedupe | admin at `health/route.ts:16` | file/KV missing→nulls, never throw (catch at `:80-82,127-134,149-155`) |
| Tickets index | markdown editors via `status/assignee` edit (`TRACKER.md:60-62`), compiled read-only | admin read at `tickets/route.ts:7` | ENOENT→{total:0} at `:14`, duplicate key throw at `tickets.ts:161` |
| Dedupe persist | `harvest.ts:218-226` after `executeJob` loops | no extra auth (server side) | ROFS→warn + KV truth kept |

## 6. Dependencies & sequencing (blocked_by as text, not DAG)

**Per-ticket blocked_by from canonical MDs:** R5 `[]` at `R5-server-cancel.md:8`, R6 `[]` at `R6:8`, R7 `[]` at `R7:8`, R8 `[]` at `R8:8`, R9 `[]` at `R9:8`, R10 `[]` at `R10:8`, R11 `[]` at `R11:8`, R12 `[]` at `R12:8`, R13 `[]` at `R13:8`, R14 `[]` at `R14:8`, R15 `[]` at `R15:8`, R19 `[]` at `R19:8` — all are roots, no semantic DAG. Sequencing is **resource-hazard only**, not logical blocking (except R8 needs R1 lockHolder when R1 ships, but not now).

**Hazard groups (single-writer locks):**

```
 discovery done (tracker-index R5-R15,R19 OPEN)
   │
   ▼
 grilling done (grilling-remaining.md Q1-12)
   │
   ▼
 this architecture report (seams, alternatives)
   │
   ├──► R11 (comments only)         hazard: harvest.ts       lock: harvest — trivial, parallel_safe
   ├──► R7  (provider-health tooltip)hazard: provider-health.tsx  lock: none (client)
   ├──► R9  (doctor JSON already)   hazard: scripts/discovery-doctor.ts  lock: none
   ├──► R15 (README/docs text)      hazard: README.md, docs/deployment.md lock: docs-single-writer
   ├──► R14 (tier1 header)          hazard: scripts/*       lock: scripts-single-writer
   ├──► R5  (cancel already)        hazard: cancel/route.ts + harvest.ts  lock: harvest-lock (process-local)
   ├──► R6  (pagination already)    hazard: jobs.ts         lock: job-index-single-writer (index slice is atomic via put)
   ├──► R8  (health route)          hazard: health/route.ts + health-aggregate.ts  lock: health-read
   ├──► R10 (dedupe KV-first)       hazard: dedupe-persist.ts + keys.ts  lock: dedupe-index-single-writer (writeQueue at :17)
   ├──► R13 (freshness CI gate)     hazard: check-eval-gate-freshness.mjs + .github/workflows/ci.yml  lock: ci-single-writer
   ├──► R19 (wayfinder CLI)         hazard: scripts/wayfinder-tickets.ts + package.json + src/wayfinder/*  lock: wayfinder-compile
   └──► R12 (AutoForge policy)      hazard: .gitignore + .autoforge/AGENTS.md  lock: gitignore-single-writer

 R8 lockHolder sub-field blocked_by R1 (R1-cross-instance-harvest-lock.md) — deferred until SET NX ships; R10 KV fallback blocked_by nothing (MemoryStore already).
```

**Waves (= parallel groups) per ponytail:**

| Wave | Members | Parallel? | Guard |
|---|---|---|---|
| **P — stateless text/client** | R11,R7,R15,R14,R9 | **parallel_safe: true** | disjoint touches (`harvest.ts` comments vs `provider-health.tsx` tooltip vs `README.md` vs `discovery-doctor.ts`) |
| **S — state writers (serialize per seam)** | R5,R6,R10 | **serialize per file** — each touches a single-writer seam (`harvest.ts` vs `jobs.ts` vs `dedupe-persist.ts`) so two writers to same file must not overlap; cross-file they can run same turn | `job-index-single-writer` for `jobs.ts`, `dedupe-index-single-writer` for `dedupe-persist.ts` (`writeQueue:17`), `harvest-single-writer` for `HARVEST_LOCK:104` |
| **I — index compile** | R19 (CLI) + `npm run tickets` | **parallel_safe with P, blocked_by nothing** — reads markdown, no state write | `wayfinder-compile` lock not contended |
| **G — gates/docs** | R8,R13,R12 | **sequential per target** (`health/route.ts` vs `ci.yml` vs `.gitignore`) | `ci-single-writer` for `ci.yml`, `docs-single-writer` for deployment docs |

`blocked_by:[]` everywhere means scheduler may batch P+S+I together if file touches are disjoint; only same-file writers serialize.

**Touches / hazard locks table:**

| Concern | Touches | Hazard | Lock |
|---|---|---|---|
| Job cancel | `cancel/route.ts:1-21`, `harvest.ts:116-173,140-148`, `provider-health.tsx:163-171` | `discovery:job:*` keys + `discovery:job:index` at `jobs.ts:41-42` | `harvest-single-writer` (process-local bool) → upgrade to `harvest-lock.ts` SET NX (R1) `ponytail: global lock ceiling` |
| Pagination | `jobs.ts:223-274`, `jobs/route.ts:1-19` | `discovery:job:index` slice window | `job-index-single-writer` — `loadIndex`+`saveIndex` are not atomic today (read then write at `createJob:156-160`) — ponytail ceiling until R2-style CAS |
| Refresh tooltip | `provider-health.tsx:383-391,474-485` | none (client) | none |
| Health aggregate | `health/route.ts:135-165`, `health-aggregate.ts:20-61` | `state/discovery-ledger.json` at `:145`, `getLedgerTailKV` KV path | `persistence-single-writer` at `single-writer.ts:7-16` (in-process only) |
| Doctor JSON | `discovery-doctor.ts:14-53` | credential read via `discovery/keychain` | none |
| Dedupe | `dedupe-persist.ts:51-107`, `keys.ts:50` | `discovery:dedupe-index` key vs `state/dedupe-index.json` file at `:12-14` | `dedupe-index-single-writer` (`writeQueue:17`) `ponytail: serialized queue is single-writer ceiling` |
| Wayfinder index | `src/wayfinder/tickets.ts:144-193`, `ticket-types.ts:2`, `tickets/route.ts:6-17`, `ticket-board.tsx:28-33`, `scripts/wayfinder-tickets.ts` (new) | `workflow/wayfinder/maps/*/tickets/*.md` at `tickets.ts:148-158` | `wayfinder-compile` — `readdirSync` sorted at `:141,151` makes deterministic |
| AutoForge staging | `.gitignore:1-46`, `.autoforge/AGENTS.md` (new) | `.autoforge/**` vs `workflow/wayfinder/maps/**` | `gitignore-single-writer` |
| Freshness gate | `check-eval-gate-freshness.mjs:7-34`, `.github/workflows/ci.yml:35-50` | `docs/validation/eval-gates.md:15-38`, `state/eval-scorecards/` mtime | `ci-single-writer` |

## 7. Risks, ponytail ceilings & mitigations

| Risk | Where it bites | Mitigation | Ponytail ceiling + upgrade path |
|---|---|---|---|
| **KV vs Memory split-brain** — fallback wrapper at `store.ts:136-180` silently falls to MemoryStore on KV failure, two truths | `store.ts:138-150` `try kv → catch → fallback`, `jobs.ts:isKv()` branch picks file path when fallback kind still `"kv"` but per-request isolated | Keep `StoreUnavailableError:9-14` distinction; `setDataStoreForTests` at `:192-194` keeps tests hermetic; R1 tracks true distributed lock | `ponytail: fallback shadow is ceiling; explicit error propagation per call deferred until R1/R2 CAS measurable` |
| **Ledger index race** — `ledger.ts:11-26` read-modify-write `INDEX_KEY` loses concurrent appends | `appendLedgerKV` reads `index` at `:12`, pushes seqs at `:22`, sorts+trims at `:24-25`, writes at `:26` — no CAS | Documented as R2; single harvest lock `HARVEST_LOCK:104` serializes appends today; KV `SET NX` upgrade in R1 | `ponytail: single global harvest lock is ceiling; per-cell KV CAS deferred per MAP.md:30` |
| **Orphan per-entry keys** — `getLedgerTailKV:34-37` filters nulls but leaves `INDEX_KEY` dirty with dead seqs | `ledger.ts:36` `vals.filter(v!==null)` but `INDEX_KEY` still contains dead `seq` | Add self-heal pass dropping index rows whose `getMany` returned null (R2 desired) — sweep on read, write back trimmed index via `withPersistenceSingleWriter` | `ponytail: filter-only is ceiling; index heal deferred until orphan rate measurable` |
| **Dedupe fork on ROFS** — Vercel read-only FS write throws `EROFS`, file lags KV | `dedupe-persist.ts:70` `msg.includes("EROFS")` warn, `harvest.ts:312` swallow | KV-first load at `loadDedupeIndexAsync:54`, file best-effort at `saveDedupeIndex:70-71`, KV put always at `:104` | `ponytail: EROFS warn+continue ceiling; per-account locks deferred (dedupe-persist.ts:16 comment)` |
| **Sync write-queue serialization** — `dedupe-persist.ts:17` `writeQueue` chains but never rejects visibly | `:74 .catch(()=>{})` swallows | Best-effort ok for dev; warn on swallow in future | `ponytail: global queue is ceiling; per-package lock deferred` |
| **Cancel not visible cross-lambda** — `HARVEST_LOCK:104` is process-local bool, second lambda doesn't see first's lock | `harvest.ts:104,140-149` sets flag, `executeJob` before lock checks `getJob` cancelled, but lock itself not in KV | Early `getJob` cancel check at `:118-130` catches server-side cancel even without distributed lock; R1 adds `harvest-lock.ts` `SET NX EX 3600` | `ponytail: process-local lock is ceiling; KV SET NX deferred to R1 exactly as MAP.md:16,41-42 ceiling note` |
| **Stale cursor lossy page** — trim window 20 at `jobs.ts:159,189` evicts cursor | `listJobs:232-242` | Fallback to latest page at `:238,242` never returns empty until last page (`R6 AC:28`) | `ponytail: 20-window is ceiling; KV tail scan deferred until n>500` |
| **Health shape drift** — ticket wants `lastRunStatus/lockHolder` but code offers `lastHits/degraded` | `health-aggregate.ts:7-12` vs `R8:21` | Document shape in route comment; add `lastRunStatus` from `listJobs(1)` status + `indexedEntriesCount=total` bridging without `lockHolder` until R1 | none — shape freeze is owner call |
| **Doctor quota burn** — `--json` pings `discover({limit:3})` at `discovery-doctor.ts:29` costs Brave quota | `:28-29` per enabled provider | Keep limit 3 (was 3, small), document `~1 query each` per `discovery-doctor.ts:5` header | `ponytail: live ping is ceiling; quota monitoring via R16 deferred` |
| **Worktree orphan** — crash leaves `vault-head-*` tmp | `scripts/vault-sync.mjs:45-52` `finally` | Best-effort `worktree remove --force` + `rmSync(tmp,{recursive:true,force:true})` at `vault-sync:14,45-52` | `ponytail: best-effort cleanup ceiling; tmp reaper cron deferred` |
| **Tracker-index drift** — `.autoforge/discovery/tracker-index.md` vs `state/vault-notes.json` open-set | prior report §8 drift note | Not in this frontier (R12 is `.autoforge/` staging, not vault tracker), but same discipline: co-commit via explicit `git add` per `AGENTS.md:21-23` | `ponytail: co-commit ceiling; compileTrackerIndex() deferred until frontier >10` |
| **Staging poison** — `git add -A` pulls foreign `vault/journal/**` lanes | `AGENTS.md:21-23` `explicit git add <paths> only` | Keep rule, no blanket add | doc ceiling |
| **Wayfinder CLI drift** — board vs CLI vs markdown file diverge | `tickets.ts:186` `sort(localeCompare)` deterministic, `ticket-board.tsx:38-40` filters, CLI prints same `index.counts` | Board `counts` from `TicketIndex` at `:172-181` and CLI both call `indexWayfinderTickets()` — single seam ensures parity | `ponytail: single function seam is ceiling; GitHub sync deferred (R19 out of scope)` |

## 8. Deepening opportunities (improve-codebase-architecture lens — speculative)

- **Ledger `appendLedgerKV` shallow sequencer** (`ledger.ts:8-26` read-modify-write index + per-entry puts). Adding second adapter (KV CAS vs MemoryStore) would prove seam; keep shallow until R2 lands with pipeline helper.
  **Recommendation:** `Worth exploring` when R2's 50-concurrent-entry test exists.

- **`loadDedupeIndex` sync shim** (`dedupe-persist.ts:19-26` `__KV_DEDUPE_INDEX__` global). One adapter = hypothetical. Once `persistDedupeFromResult` switches to `loadDedupeIndexAsync`, delete shim.
  **Recommendation:** `Worth exploring` — delete shim after KV-first lands.

- **`health/route.ts` family duplication** — provider ping loop at `:27-52`, ledger age at `:54-82`, topology drift at `:84-134`, harvestHealth at `:135-155` repeat `try readFileSync + catch keep defaults` pattern. Extract helper `ageHuman(ms)` or `safeJsonRead(path)` only when fourth family appears.
  **Recommendation:** `Speculative` — triplication is 3× domain-distinct; keep locality per-family.

- **Wayfinder `FRONT_MATTER_RE` vs `scripts/lib/frontmatter.mjs`** — two front-matter parsers (Wayfinder minimal at `tickets.ts:34-58` vs vault `frontmatter.mjs:9-133` with YAML guards). Wayfinder parse is flat `key: value` only (no YAML quoting), correct for tickets but shallow vs vault's deep guard.
  **Recommendation:** `Speculative` — keep separate until ticket front-matter needs `#`- quoting (not now).

Overall: existing seams are deep where reuse exists (DataStore, TicketIndex, health-aggregate). Keep locality; defer abstractions until second concrete variation appears (one adapter = hypothetical).

## 9. Verification — no new infra beyond thin CLI

- `npm run typecheck && npm run lint && npm run test` remain green after each R (no behaviour change in R7,R11,R14,R15).
- **R5:** `vitest` MemoryStore cancel test — `createJob` at `jobs.ts:133` → `POST /cancel` → `getJob` status `cancelled` → `executeJob` bails before `D01-DISCOVER` and appends `D00-CANCELLED` log. Manual: Start harvest `POST /api/dev/discovery/run` → immediate `POST /cancel` → poll `GET /jobs/:id` shows `cancelled`.
- **R6:** `listJobs` with `MemoryStore` seeded 25 jobs → `listJobs(10,"job_5_staleCursor")` returns latest page `nextCursor !== null` and `total=20` (trimmed). Same via `GET /api/dev/discovery/jobs?cursor=stale`.
- **R7:** `provider-health.tsx` Refresh has `title` containing `dedup` — DOM query `getByTitle(/dedup/i)` passes; no new a11y regression.
- **R8:** `GET /api/dev/health` (admin key) returns `harvestHealth{lastRunAt,lastSuccessAt,lastHits,degraded}` plus bridged `lastRunStatus`/`indexedEntriesCount`; when KV down still returns shape (fallbacks at `health/route.ts:149-155`).
- **R9:** `npx tsx scripts/discovery-doctor.ts --json | jq .` valid, `providers[]` has `id|enabled|hostsOk|sampleHits`, `totals` present; `--live --json` same.
- **R10:** `persistDedupeFromResult` with stubbed `writeFileSync` throwing `EROFS` → `console.warn` once contains `ROFS` and KV `get(DISCOVERY_DEDUPE_INDEX_KEY)` returns new doc.
- **R12:** after `git status`, only `.autoforge/state.json` etc show if curated else no `?? .autoforge/` spurious.
- **R13:** `node scripts/check-eval-gate-freshness.mjs` exit 1 when `state/eval-scorecards` mtime >7d with `gh workflow run tier1 --topup` message, exit 0 when fresh.
- **R19:** `npm run tickets -- --json | jq .counts` matches `GET /api/dev/tickets` counts; `assignee: alice` edit in any `maps/*/tickets/*.md` reflected without code change (re-run CLI shows new counts).

## 10. Self-approve verdict per R (protocol § Critique auto-approve if resolvable — evidence in ticket MDs/MAP.md/CHARTER.md/AGENTS.md is sufficient)

| Ticket | Title (from MAP/TRACKER) | Arch resolvable from evidence? | Verdict | Rationale + what remains |
|---|---|---|---|---|
| **R5** | Stop/Cancel server endpoint | ✅ ticket MD:16-27 + interfaces at `jobs.ts:updateJob` `harvest.ts:116-173` `cancel/route.ts:1-21` spell cancellation protocol; idempotent admin-gated PATCH is bounded | **SELF-APPROVE** | Architecture frozen (status field is truth, per-node poll, fire-and-forget route). Remaining is worker test + label text `cancelling…` — mechanical. |
| **R6** | Pagination across large job index | ✅ `R6-pagination-trim.md:17-26` + `jobs.ts:223-274` already implements stable cursor with fallback; API shape `{jobs,nextCursor,total}` at `jobs/route.ts:14` unchanged | **SELF-APPROVE** | Stable page = `loadIndex` scan is correct. Add truncation doc comment + cursor trimmed past test. |
| **R7** | Refresh parity for parent reload | ✅ `R7-refresh-parity.md:19-23` minimal `title` on existing control, no new abstraction | **SELF-APPROVE** | One HTML attribute at `provider-health.tsx:482`; accessibility title satisfies. No design open. |
| **R8** | Health route harvest-health sub-object | ⚠️ partial — ticket `R8:21` field list (`lastRunStatus/lockHolder/lockAcquiredAt/indexedEntriesCount` via `getLedgerTailKV/getDataStore/jobs.listLatest`) vs actual `health-aggregate.ts:7-12` (`lastRunAt/lastSuccessAt/lastHits/degraded` via file ledger) diverge | **NEEDS REVIEW** | Self-approve blocked on shape freeze: owner must confirm canonical `HarvestHealth` shape. Recommend bridging: keep implemented shape + add `lastRunStatus` from `listJobs(1)` + `indexedEntriesCount=total`; leave `lockHolder/lockAcquiredAt` deferred behind R1. Once shape doc'd, self-approve. |
| **R9** | Discovery doctor JSON contract | ✅ `R9:20-25` single JSON branch contract fully spelled; existing `discovery-doctor.ts:44-50` implements it; CI validator can read deterministically | **SELF-APPROVE** | Print one JSON object to stdout, no extra output, exit codes preserved. Add stale validator contract test. |
| **R10** | state/dedupe-index.json write authority | ✅ `R10:20-25` KV-first + DISCOVERY_DEDUPE_INDEX_KEY + file mirror best-effort fully spelled; `dedupe-persist.ts:51-75` already half-lands; one-line switch to `loadDedupeIndexAsync` is foreseeable | **SELF-APPROVE** | KV-truth with EROFS warn `dedupe: FS mirror skipped (ROFS)` at `:71`, local dev still writes both, fake FS throw test. |
| **R11** | Hardening — drop speculative source comments | ✅ `R11:19-22` remove stale narration, keep `ponytail:` ceilings; no behaviour | **SELF-APPROVE** | Comment-only, `typecheck` gates. |
| **R12** | AutoForge storage policy | ❌ policy choice not derivable — `R12:21` explicitly offers (a) commit curated subset vs (b) ignore `.autoforge/` entirely; needs owner pick | **NEEDS REVIEW (HITL-policy)** | Propose **B curated subset** default (commit `state.json`+`plans`+`architecture`+`reviews`, ignore extracted evidence) and `.autoforge/AGENTS.md` Storage policy section; owner ratifies one line. |
| **R13** | Eval gate freshness automation | ❌ `R13.hitl:true` at `R13:5` + CI step needs owner threshold confirmation | **NEEDS REVIEW (HITL)** | Script hardening to `exit 1` and `.github/workflows/ci.yml` gate-freshness job is resolvable, but HITL flag at `R13-eval-gate-freshness.md:5` means owner must confirm max-age doctrine source and failure message wording before self-approve. |
| **R14** | Tier-1 archive script housekeeping | ⚠️ ambiguous file identity — no `scripts/tier1-archive.mjs` present; `glob scripts/*:18` lists `check-eval-gate-freshness.mjs`/`run-eval.ts` as candidates; header-only change | **NEEDS REVIEW (clarify file)** | If canonical is `scripts/check-eval-gate-freshness.mjs` or `scripts/run-eval.ts`, header fix is self-approvable. Confirm which path `R14:22` headers refer to, then self-approve header ` --rebase` next to `--topup <runId>` edit. |
| **R15** | README+CONTRIBUTING Production deploy refresh | ✅ `R15:20-21` text-only sync `main is production; Vercel auto-deploys; harvest schedule refreshes` with `AGENTS.md:eval gates` ref | **SELF-APPROVE** | No command reorder per `R15:29`, `docs/deployment.md:6-23` already describes truth — just sync README/CONTRIBUTING. |
| **R19** | Wayfinder plumbing traceability | ✅ `R19:29-48` fully spells API/CLI/board contracts, acceptance `npm run tickets --json` counts + board lane parity + `assignee:` edit reflected; existing `tickets.ts:169-193` + `tickets/route.ts:6-17` + `ticket-board.tsx:28-33` already deep; thin CLI reuses seam | **SELF-APPROVE** | Add `scripts/wayfinder-tickets.ts` adapter + `package.json` `tickets` script; no GitHub sync per `R19:48` keeps `ops-residual` local-markdown. |

**Summary: 8 SELF-APPROVE (R5,R6,R7,R9,R10,R11,R15,R19), 4 NEEDS REVIEW (R8 shape, R12 policy, R13 HITL, R14 file identity).** Overall frontier is architecturally sound; ponytail ceilings are documented (§7) and no new deps are needed. Flagged NEEDS REVIEW items are single-owner decisions (shape freeze, policy pick, HITL confirm, file path), not design gaps.

---

Ponytail ladder applied: reuse `DataStore` KV + `MemoryStore` for tests (`jobs.ts:53-60`, `store.ts:28-57,60-126`), Next route handlers (`api/dev/*` admin-gated), stdlib `fs/path/crypto/child_process`, native HTML `title`, existing `yaml` via `frontmatter.mjs` (vault), no new deps. One-line fixes preferred; `ponytail:` ceilings named per module.

Artifacts: `.autoforge/architecture/report-remaining.md` (this file), `.autoforge/architecture/decisions-remaining.md` (ADRs, self-approve flags)
