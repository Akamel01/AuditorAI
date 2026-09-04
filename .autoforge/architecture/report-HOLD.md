# Architecture Report — HOLD Frontier R1–R4 (M1–M8 deferred)

Date: 2026-09-03
Scope: `.autoforge/requirements/grilling-HOLD.md:10-67` (R1–R4 MV + M1–M8 HITL), `.autoforge/discovery/tracker-index.md:3-20` (R1–R4 BLOCKED), `workflow/wayfinder/maps/ops-residual/MAP.md:41-45`, `src/lib/persistence/store.ts:1-200`, `src/discovery/harvest.ts:99-105 HARVEST_LOCK`, `src/discovery/harvest.ts:106-256 executeJob`, `src/discovery/ledger.ts:1-40`, `src/discovery/jobs.ts:1-371`, `src/discovery/dedupe-persist.ts:1-109`, `vault/CHARTER.md:1-85`, `AGENTS.md:1-35`
Status: design-only — no implementation. Ponytail ladder enforced, vault determinism hard where `state/*.json` touched. Model budget 80k tok (inherit `opencode/muse-spark-1.2-contributor-free` 1M·0.30 capped).
Blocked_by: grilling-HOLD. Inputs sized to fit: grilling-HOLD verbatim R1–R4 (57 lines), MAP citations, prior report-remaining AD-11..25 summarized.
Skills invoked: `codebase-design` (module/interface/seam/depth, leverage/locality vocabulary throughout), `improve-codebase-architecture` (selectively — deepening candidates §8).

## 1. Findings — boundaries as they exist (reuse before inventing, ponytail rung 2)

**Map ownership:** `ops-residual` is local-markdown only per `TRACKER.md:14` and `MAP.md:9,39`. No GitHub sync for R1–R4. `v2-agentic-platform` alone is GitHub-canonical on issue #20. `MAP.md:16-17` explicitly declares process-local harvest lock + best-effort KV mirror as **accepted ceilings** for current Close-out — R1 defines the upgrade path. This is the hard boundary for every HOLD decision: nothing written below violates `MAP.md:17` until owner flips R1 OPEN→active.

**Seam inventory before HOLD (reuse where present):**

| Seam | File:line | Interface (what callers must know) | Depth |
|---|---|---|---|
| **DataStore** | `store.ts:16-26` `MemoryStore:28-57` `KvRestStore:60-126` `getDataStore:183-188` `setDataStoreForTests:192-194` | `kind:"memory"|"kv"`, `put/get/getMany/keys/del/delByPrefix`, `StoreUnavailableError:9-14` distinguishes transport failure from absent key (`null`), 5s abort at `:70-71` | Deep: hides `fetch POST ["SET",key,JSON]` at `:68-99`, `KEYS prefix*` at `:112-114`, fallback `Kv→Memory` wrapper at `:130-181`. Leverage: every harvest/ledger/dedupe/jobs path routes through it. Locality: fix quoting/auth once. |
| **Job store** | `jobs.ts:41-42` `PREFIX/INDEX_KEY` `createJob:133-197` `getJob:199-215` `listJobs:223-274` `updateJob:276-318` `appendLog:320-357` `setJobError:369-371` | `DiscoveryJob{status:"queued"|"running"|"done"|"error"|"cancelled"}` at `:10-39`, `listJobs(limit,cursor,store?)→{jobs,nextCursor,total}` cursor contract at `:217-223`, `isKv():53-60` branch, `jobsFilePath:64-66` file mirror | Deep: hides KV vs file vs injected store, index trim `slice(0,20)` at `:159,189`, log trim `200` at `:325`. |
| **Harvest orchestrator** | `harvest.ts:99-105 HARVEST_LOCK` `executeJob:106-256` `persistDiscoveryState:258-334` `harvest:336-429` | `executeJob(jobId,ctx,providerIds,ranAtIso,deps?)` with `HarvestDeps{store,readFileSync,cwd,listProviderIds,providerEnabled,resolveProvider,nowIso}` at `:62-71`, `HARVEST_LOCK` bool at `:104` + `finally` reset at `:252-255`, cancellation poll at `:118-130` + per-node poll at `:166-173`, lock-busy path `if(HARVEST_LOCK) setJobError→return` at `:140-149` | Shallow today (bool is not a module). Depth earns keep once `harvest-lock.ts` adapter exists (R1). Process-local = explicit ceiling per `harvest.ts:100-103` comment. |
| **Ledger** | `ledger.ts:4-40` | `ENTRY_PREFIX="discovery:ledger:entry:"` at `:4`, `INDEX_KEY="discovery:ledger:index"` at `:5`, `appendLedgerKV(entries,store?)` per-entry `put(entryKey(seq))` then dedup `!index.includes(seq)` + sort + `slice(-500)` at `:8-26`, `getLedgerTailKV(limit,store?)→{entries,total}` via `getMany` at `:28-39` | Medium: index ordering + orphan handling is R2 frontier; today `getLedgerTailKV` filters nulls (`:36`) but leaves `INDEX_KEY` dirty with dead seqs, and `appendLedgerKV` read-modify-write loses concurrent appends. |
| **Dedupe persist** | `dedupe-persist.ts:12-109` `keys.ts:50-55` | `loadDedupeIndex(cwd)` at `:28-47`, `loadDedupeIndexAsync(store?,cwd?)` KV-first at `:51-58`, `saveDedupeIndex` EROFS warn at `:60-75`, `persistDedupeFromResult(packages,bundles,qualities,store?)` at `:77-109`, `DISCOVERY_DEDUPE_INDEX_KEY="discovery:dedupe-index"` at `keys.ts:50` | Medium-deep: hides KV-first vs file-seed. `__KV_DEDUPE_INDEX__` global at `:19-26` is shallow synthetic — candidate to delete. `writeQueue:17` is internal single-writer seam. |
| **Single-writer** | `single-writer.ts:1-17` | `withPersistenceSingleWriter(fn)` at `:7` — throws `persistence write in progress` if already held, else sets flag, `finally` resets at `:15` | Shallow but in-process only; R1 KV lock will replace its cross-instance role. |
| **Health aggregate** | `health-aggregate.ts:20-61` `aggregateHarvestHealth(entries)` | Pure `LedgerEntry[]→HarvestHealth{lastRunAt,lastSuccessAt,lastHits,degraded}` at `:7-12` | Deep once KV tail adapter lands; pure test surface today. |
| **Harvest health route** | `health/route.ts:15-169` | `GET /api/dev/health` admin-gated at `:16-17`, returns `{providers,ledger,harvestHealth,health_degraded}` at `:158-166` | Today harvestHealth via `withPersistenceSingleWriter(()=>readFileSync ledger)` at `:143-152` — diverges from R2 KV tail path, reconciled by R4 proof bundle. |

**Current HOLD gap check (delta to close):**

| Ticket | Brief source | Status in code | Delta to close |
|---|---|---|---|
| R1 Cross-instance lock | `R1-cross-instance-harvest-lock.md:19-27` + `grilling-HOLD.md:10-26` | `harvest.ts:104` bool only; `store.ts` has no `SET NX EX` helper, no `harvest:lock` key anywhere (`grep harvest:lock` zero) | Add `DataStore.setIfAbsent(key,val,ttlSec)` to seam + `harvest-lock.ts` module + wire `executeJob` acquire before `D00-QUEUED` + `finally release` |
| R2 Ledger orphan+race | `R2-ledger-improve-indexing.md:19-25` + `grilling-HOLD.md:28-41` | `ledger.ts:11-26` read-modify-write `INDEX_KEY` loses concurrent appends; `getLedgerTailKV:36` filters nulls but leaves index dirty, no orphan sweep | Add `SET NX EX` index-entry key + `DEL` orphan prune on tail read; keep `slice(-500)` window |
| R3 Regression tests | `R3-regression-tests.md:18-24` + `grilling-HOLD.md:43-54` | No `tests/*harvest*.test*` covering `HARVEST_LOCK` busy path or `appendLedgerKV→setJobDone` ordering or `persistDedupeFromResult` dedup | Add 3 focused tests on `MemoryStore` — concurrent lock, dedup claim, ordering spy |
| R4 Proof bundle | `R4-production-harvest-proof.md:18-33` + `grilling-HOLD.md:56-67` | Close-out `ledgerGrowth.verified:false` per `R4:21`; no `state/production-harvest-proof.json` produced; no digest manifest | Define `HarvestProofBundle{jobId,ranAtIso,ledgerDigest,stateDigest,manifest}` persisted to deterministic path + KV single-object atomically; daemon/route emits on `setJobDone` |
| M1–M8 Agentic/broad | `tracker-index.md:103-140` + `grilling-HOLD.md:69-76` | All BLOCKED, no domain model/ADRs for v2/v3 platform | Keep HITL/FOG — no MV; formal ADRs + domain-model phase per grading doc before any code |

## 2. Boundaries per HOLD ticket (module / seam / who owns)

**R1 — Cross-instance harvest lock**
- Module: new `src/discovery/harvest-lock.ts` behind `DataStore` seam at `store.ts:16-26`. Interface (minimal, small surface): `acquireHarvestLock(store?, ttlSec?: number, holder?: string) → {acquired:boolean, release:()=>Promise<void>}` and `HARVEST_LOCK_KEY="harvest:lock"` (workspace-scoped `harvest:lock:{wsHash}` when multi-workspace lands). Behaviour hidden: `["SET", key, holder, "NX","EX",ttl]` via new `DataStore.setIfAbsent(key,value,ttlSec)` at `store.ts:60-126` extension, `DEL` on release only by holder, `finally` in `executeJob:252-255`.
- Who writes: `executeJob` only (single writer). Route handler at `src/app/api/dev/discovery/run/route.ts` does not acquire — only `executeJob` after `createJob` does, so HTTP fast-path unchanged.
- Least-privilege: no new env, reuses `KV_REST_API_URL/TOKEN` via `getDataStore():183-188`; when KV absent, `acquire` returns `acquired:true` via `MemoryStore.setIfAbsent` in-process fallback and emits single `WARN harvest lock: KV unavailable, using process-local guard` — matches `R1 AC:32` fallback warn.
- Ponytail rung: 2 reuse DataStore, 3 stdlib `crypto.randomUUID` for holder, 5 no new dep.

**R2 — Ledger KV ordering + orphan recovery**
- Module: `src/discovery/ledger.ts` behind same `DataStore` seam. Interface: `appendLedgerKV(entries,store?)` and `getLedgerTailKV(limit,store?)` signatures unchanged (depth: callers learn no new params). Behaviour hidden: (a) per-entry atomic index hint `discovery:ledger:index-entry:{seq}` via `SET NX` then `INDEX_KEY` rebuild from `KEYS prefix*` or from `getMany` sweep, so concurrent writers do not race on a single `INDEX_KEY` read-modify-write at `:12-26`; (b) `getLedgerTailKV:34-37` self-heals — `vals.filter(v!==null)` stays, plus collect `orphans = tailSeqs where vals[i]===null` and `del(orphanKey)` + rewrite `INDEX_KEY` without orphans (best-effort, no throw).
- Who writes: `executeJob:225-227` `await appendLedgerKV(persistedEntries,store)` plus future concurrent harvest (serialized by R1 lock — R1 is the primary race fix, R2 is safety net when R1 TTL expires).
- Window `slice(-500)` at `:25` stays — out of scope at `R2:34`.
- Ponytail: one adapter for KV tail vs file mirror makes seam real; keep `store.keys(prefix)` at `store:112` for sweep but cap to `prefix discovery:ledger:entry:` sorted — `O(500)` ceiling, no new infra.

**R3 — Regression tests for lock + dedup**
- Module: tests are the module (test surface = interface). Seams under test: `executeJob` busy path at `harvest.ts:140-149`, `persistDedupeFromResult` at `dedupe-persist.ts:77-109` + `checkDuplicate/claimFingerprints` at `dedupe.ts:39-79`, ordering `appendLedgerKV` → `persistDedupeFromResult` → `setJobDone` at `harvest.ts:214-247`.
- Interfaces exercised: `MemoryStore` at `store.ts:28-57` (hermetic via `setDataStoreForTests:192-194`), `DiscoveryCtx` fixtures at `harvest.ts:36-53` `fixtureDocsFor`, `DedupeIndexDoc` at `dedupe.ts:10-16`, `LedgerEntry` at `ledger.ts:6`.
- Who writes: tests only (no prod code). Bound to existing `vitest` harness at `package.json:8`, no new runner, no mocks beyond `MemoryStore`.
- Ponytail: one file `tests/discovery/hold-r3.test.ts` covers three concerns via `MemoryStore` + spied wrappers — no framework, no fixtures per ponytail test rule.

**R4 — Production harvest proof bundle (Vercel KV + daemon)**
- Module: `src/discovery/proof-bundle.ts` (new tiny deep module) behind `DataStore` + file mirror seam. Interface: `HarvestProofBundle{version:"1.0.0", jobId:string, ranAtIso:string, providers:string[], ledgerDigest:string, ledgerTail:{total:number, entries:LedgerEntry[]}, dedupeDigest:string|null, stateDigest:string|null, capturedAt:string}` + `buildProofBundle(entries,store?)→Bundle` + `persistProofBundle(bundle,store?)` + `readProofBundle(store?)→Bundle|null`. Persist target: `state/production-harvest-proof.json` (deterministic file mirror at `jobs.ts:64-66` style) and KV key `discovery:proof:bundle` via single `put` (atomic per-key).
- Who writes: `executeJob:237` after `setJobDone` succeeds — one writer, fire-and-forget with `catch` swallowed + `appendLog PERSIST-WARN` on failure (same pattern as `harvest.ts:219`). Daemon/route reader `GET /api/dev/discovery/proof` or `GET /api/dev/health` extension surfaces bundle; however minimal MV is file+KV write + existing `GET /api/dev/discovery` tail read proves growth.
- Vault determinism: `state/production-harvest-proof.json` lives under `state/` — commit must follow `AGENTS.md:15-18` `node scripts/vault-sync.mjs` then explicit `git add state/production-harvest-proof.json` — not trusted for vault compile determinism (`state/vault-notes.json` only, `ci.yml:35-50`), so no CI poison.
- Ponytail: no new dep; digest via `node:crypto createHash sha256` at `store.ts:4` reuse; one `put` is atomic per KV key.

**M1–M8 — agentic platform deepening**
- Boundary: no module seam introduced in this report; these are owner-driven platform decisions (quote-bearing GF-6..10 baseline, blob-storage escape hatch, vault sync-conflict UX, report drafting assists, candidate-findings review hardening, audit-history retention, RSC snapshot, Postgres third DataStore adapter per `tracker-index.md:103-140` + `.autoforge/plans/plan.md:66-196`). Interface shape requires domain-model phase (`CONTEXT.md`, glossary, ADR per `grill-with-docs` skill) before any `DataStore` third adapter or vault UX change — one-adapter hypothesis rule applies (Postgres adapter is third after Memory/KvRest, so seam is real but irreversible without migration path). All remain `BLOCKED`, `HITL/FOG` gate.

## 3. Alternatives — design-it-twice per concern

### 3.1 R1 Cross-instance lock — three designs

- **A) `DataStore.setIfAbsent` + `harvest-lock.ts` module + `executeJob` acquire/release — CHOSEN (MAP.md:16,41 `SET NX` + `harvest.ts:99-103` ceiling note)**
  ```ts
  // store.ts addition
  interface DataStore { setIfAbsent?(key:string,value:string,ttlSec:number):Promise<boolean> }
  // MemoryStore impl
  async setIfAbsent(key:string,val:string,ttl:number){ if(this.m.has(key)) return false; this.m.set(key,val); if(ttl) setTimeout(()=>this.m.delete(key),ttl*1000).unref?.(); return true }
  // KvRestStore impl — one REST command, no pipeline body (store.ts:64-67 comment: pipeline-form rejected)
  async setIfAbsent(key:string,val:string,ttl:number){
    const json = await this.call(["SET", key, val, "NX", "EX", String(ttl)]);
    return json.result === "OK";
  }
  // harvest-lock.ts — deep module, small interface, large hidden ttl/holder logic
  const KEY="harvest:lock";
  export async function acquireHarvestLock(store?:DataStore, ttlSec=120, holder=randId()):Promise<{acquired:boolean,release:()=>Promise<void>}> {
    const s=store??getDataStore();
    const trySet = s.setIfAbsent ? await s.setIfAbsent(KEY,holder,ttlSec) : false;
    if(!trySet) {
      // fallback when seam lacks helper (dev) — process-local guard HARVEST_LOCK still at harvest.ts:104
      if(!HARVEST_LOCK){ HARVEST_LOCK=true; return {acquired:true, release:async()=>{HARVEST_LOCK=false}} }
      return {acquired:false, release:async()=>{}};
    }
    return {acquired:true, release:async()=>{ try{ if((await s.get(KEY))===holder) await s.del(KEY);}catch{} }};
  }
  // harvest.ts wire — before D00-QUEUED after cancellation check at :118-130
  const lock=await acquireHarvestLock(store,120); if(!lock.acquired){ await setJobError(jobId,"harvest is already running",store); return; } try{...} finally{ await lock.release(); HARVEST_LOCK=false; }
  ```
  - Pros: single KV key, atomic `SET NX EX`, TTL expiry avoids deadlock on crash (grilling-HOLD MV step 2); process-local bool remains fast-path; `finally` at `harvest.ts:252-255` guarantees release; one interface `acquireHarvestLock` hides holder/TTL/auth; testable via `MemoryStore` concurrent `acquire` (R1 AC:30) without KV env; reversible — delete module + call site + seam helper returns to `HARVEST_LOCK:104` only.
  - Cons: TTL must be > max `executeJob` duration (budget `DISCOVERY_NODE_IDS.length` nodes × provider latency); too short → second harvest sneaks in after TTL mid-run. Mitigated by 120s default (grilling) or 3600s (R1 ticket) — pick 120s for MV with `HARVEST_NODE_POLL_BUDGET` at `harvest.ts:166-172` bounding runtime, document as ponytail ceiling.

- **B) `GET` then conditional `PUT` (non-atomic read-modify-write)**
  - `if(await s.get(KEY)) return busy; await s.put(KEY,holder)` — classic.
  - Pros: no new `SET NX` syntax.
  - Cons: race window between `GET` and `PUT` — two lambdas both read `null` then both `PUT` succeed; violates correctness across Vercel burst. Rejected — fails under exactly the concurrency it must fix.

- **C) Separate Upstash `INCR`/`CAS` distributed sequence allocator (replace `persistDiscoveryState` seq derivation at `harvest.ts:281-313` with KV-side `INCR harvest:seq`)**
  - Pros: true global monotonic seq, eliminates `getLedgerTailKV tailLast` race at `harvest.ts:283-289`.
  - Cons: new protocol (`INCR`) beyond `SET NX EX`, not reusable elsewhere, forces migration of `persistDiscoveryState` + `ledger.ts:8-26` write path, violates ponytail step 1 (speculative until seq collision measured). Rejected as immediate R1 — deferred to post-R1 deepening when `HARVEST_LOCK` proves insufficient for ledger tail merging (MAP.md Not yet specified: cross-shard tail merging).
  - `ponytail: INCR allocator deferred; single SET NX lock is ceiling until tail collision observed.`

**Tradeoff matrix — R1:**

| Criterion | A SET NX + TTL (chosen) | B GET→PUT non-atomic | C INCR allocator |
|---|---|---|---|
| Atomicity | ✅ `SET NX EX` one KV command at `store.ts:call(["SET","NX","EX"])` | ❌ race window | ✅ `INCR` atomic but seq-alloc only, not mutual exclusion |
| TTL deadlock avoidance | ✅ expiry on crash | ❌ need manual DEL else deadlock | ✅ seq doesn't deadlock but doesn't guard append |
| Interface size | 1 fn `acquireHarvestLock` + optional `setIfAbsent` on seam | 1 fn but wrong | 1 new key + `ledger.ts` rewrite |
| Reversibility | ✅ revert by deleting call site | ✅ | ❌ migrates seq scheme |
| Ponytail | **chosen** smallest correct | rejected wrong | speculative layer, skip |

`ponytail: R1 adapts store seam with one helper; CAS-on-INCR per-entry index deferred; global `harvest:lock` with 120s TTL is ceiling — per-cell locks (`MAP.md:30`) deferred until measured.`

### 3.2 R2 Ledger ordering + orphan recovery — three designs

- **A) Atomic index-entry key + tail `getMany` orphan prune — CHOSEN (R2 brief at `R2-ledger-improve-indexing.md:21-25`, grilling-HOLD MV at `:34-37`)**
  - Write: `appendLedgerKV` at `ledger.ts:8-26` additionally `await s.setIfAbsent(indexEntryKey(e.seq), "1", 30*24*3600)` for each entry (indexed hint with long TTL), then rebuild `INDEX_KEY` by `keys(prefix)` + sort + `slice(-500)` **or** by merging existing `INDEX_KEY` read with `setIfAbsent` successes — prefer `keys` sweep on next `getLedgerTailKV` to avoid write-race on `INDEX_KEY`.
  - Read: `getLedgerTailKV(limit,store?)` at `:28-39` after `getMany` collects `orphans = tailSeqs.filter((_,i)=>vals[i]===null)`, if any then `await Promise.all(orphans.map(oseq=>s.del(entryKey(oseq))))` is not needed (key already absent) but `INDEX_KEY = idx.filter(s=>!orphanSet.has(s))` then `await s.put(INDEX_KEY,trimmed)` best-effort via `withPersistenceSingleWriter` guard (in-process) — keeps tail consistent with data per `R2:29`.
  - Pros: signatures unchanged, no duplicate seq (`!index.includes` at `:22` already, but concurrent writers both push same seq now deduped by entry-key `SET NX`); orphan heal keeps tail length == real entries; leverages existing `store.keys/getMany/put` without pipeline (store.ts:64-67 pipeline rejected).
  - Cons: `keys("discovery:ledger:entry:*")` scan is O(500) — acceptable under `slice(-500)` window; not atomic across two writers' `INDEX_KEY` rebuild — R1 lock is primary serialized writer, so race window shrinks to TTL expiry case only.

- **B) Pure `INDEX_KEY` read-modify-write with dedup+sort (current at `ledger.ts:12-26`) plus read-side filter-only (no index heal)**
  - Pros: zero code.
  - Cons: concurrent writers both read `idx=[1,2]`, both push `3`, both sort→`[1,2,3]` but one write wins — technically no dup (dedup guards) but concurrent 50-entry test at `R2 AC:29` (50 unique seq) could still lose tail entries when both append overlapping `INDEX_KEY` slice trims differently; orphan rows stay in `INDEX_KEY` forever (tail over-reports). Rejected — fails orphan heal AC:30.

- **C) KV pipeline `[[SET entry],[SET index-entry],[GET INDEX_KEY]]` atomic transaction / Lua CAS**
  - Pros: true multi-key atomicity if Upstash pipeline or `EVAL` script.
  - Cons: `KvRestStore.call` at `store.ts:64-95` documents pipeline-form bodies `[[..],[..]]` are rejected as malformed single command — requires new `pipelinedCall` helper, new error surface, speculatively assumes Upstash pipeline semantics match Redis `MULTI/EXEC`; adds dep surface. Rejected — over-build for `n=500` trimmed window; ponytail ladder prefers concurrent `Promise.all(map(k=>put))` already at `store.ts:108-109` `Promise.all(keys.map(get))` style.

**Tradeoff matrix — R2:**

| Criterion | A index-entry NX + prune (chosen) | B INDEX_KEY RMW only | C pipeline CAS |
|---|---|---|---|
| Lost entries on concurrent 50 | ✅ `SET NX` dedup per entry | ⚠️ dedup within single index but `INDEX_KEY` RMW still racy without R1 | ✅ if pipeline works |
| Orphan heal | ✅ prune on tail read + rewrite `INDEX_KEY` | ❌ filter-only leaves dirty index | ✅ but needs EVAL |
| Uses existing seam | ✅ `setIfAbsent/keys/getMany/put/del` | ✅ | ❌ needs pipelined `call` |
| Ponytail | **chosen** | rejected (fails heal AC) | speculative, skip |

`ponytail: R2 prunes orphans on read via best-effort INDEX_KEY rewrite; `keys()` O(500) scan + `withPersistenceSingleWriter` in-process guard is ceiling — true KV CAS per-entry deferred until orphan rate >1% measurable.`

### 3.3 R3 Regression tests — three designs

- **A) One `tests/discovery/hold-r3.test.ts` via `MemoryStore` + spies — CHOSEN (ticket `R3-regression-tests.md:20-24` demands 3 focused tests on existing seam, grilling-HOLD MV at `:49-51`)**
  - Test 1 lock: `await Promise.all([executeJob(id1,...store), executeJob(id2,...store)])` asserts `getJob(id2).status==="error" && error.includes("already running")` at `harvest.ts:143` path, `HARVEST_LOCK` reset at `:254`.
  - Test 2 dedup: `checkDuplicate` at `dedupe.ts:39` + `claimFingerprints:65-79` + `loadDedupeIndexAsync→persistDedupeFromResult:77-109` — simulate repeated callback payloads with identical `doc.sha256` and `text_sha256` at `dedupe.ts:81-84` `bundleTextKey`, assert `status:"duplicate"|"near_dup"` hit + only one `clusters` entry at `:76-78`.
  - Test 3 ordering: replace `ledger.appendLedgerKV` and `dedupe-persist.persistDedupeFromResult` with spied wrappers recording `Date.now()` before delegate, call `executeJob`, assert `appendTs < dedupeTs < doneSetJobDone.ts` (done is last at `harvest.ts:237`).
  - All via `MemoryStore:28-57` + `setDataStoreForTests(null)` hermetic; `VITEST!==true` guard at `harvest.ts:215` makes `persistDiscoveryState` skip FS writes in Vitest — leverage existing guard, no extra mocks.

- **B) Separate files per concern (`harvest-lock.test.ts`, `dedupe.test.ts`, `ordering.test.ts`) + mocked `fetch` for Upstash REST**
  - Pros: finer file per concern.
  - Cons: three setups repeating `MemoryStore` + `setDataStoreForTests` boilerplate, mocking `KvRestStore.call` at `store.ts:68` is brittle (5s abort, `StoreUnavailableError` at `:81-93`). Rejected — one file is shorter diff, still covers AC 29-32.

- **C) Full E2E via real Upstash KV URL (`KV_REST_API_URL` at `store.ts:131`) with concurrent lambdas**
  - Pros: production-real.
  - Cons: flaky, requires secrets (`security find-generic-password` at `AGENTS.md:33`), burns KV ops, not CI-deterministic per `eval-gates.md` doctrine; in-process lock proof should not need network. Rejected.

`ponytail: one test file via MemoryStore is ceiling; dedicated harness or live KV cluster deferred.`

### 3.4 R4 Production harvest proof bundle — three designs

- **A) `proof-bundle.ts` pure builder + single KV put + file mirror — CHOSEN (grilling-HOLD MV at `:61-64` + `R4-production-harvest-proof.md:22-27`)**
  - `buildProofBundle({jobId,ranAtIso,providers,ledgerTail,dedupe}) → bundle` with `ledgerDigest=sha256(JSON.stringify(ledgerTail.entries))` via `node:crypto` at `store.ts:4`, `dedupeDigest` from `keys.ts:50` index doc, `stateDigest` from `state/discovery-ledger.json` hash (file mirror best-effort).
  - `persistProofBundle(bundle,store?)` does `Promise.all([ s.put("discovery:proof:bundle",bundle).catch(()=>{}), try{mkdirSync+writeFileSync("state/production-harvest-proof.json",JSON)}catch(EROFS warn) ])` — single KV object is atomic per-key; file path `state/production-harvest-proof.json` follows `dedupe-persist.ts:12-14 DEDUPE_INDEX_PATH` pattern.
  - Read: `getProofBundle(store?)` tries KV `s.get("discovery:proof:bundle")` then file fallback (same fallback chain as `jobs.ts:94-112 loadIndex` and `discovery/route.ts GET` ledger tail at `discovery/route.ts:15-45`).
  - Pros: tamper-evident digest, read-back deterministic, reversible (delete KV key + file), small interface 3 fns, reuses `DataStore` seam, no new dep; validator can `cmp` bundle `ledgerDigest` vs `getLedgerTailKV` digest (same as `vault-sync` `Buffer.equals` at `vault-sync.mjs:31` pattern).

- **B) KV pipeline multi-key bundle `discovery:proof:{jobId} + index discovery:proof:index`**
  - Pros: per-harvest history.
  - Cons: second index key reintroduces `INDEX_KEY` race at `ledger.ts:5` style; needs trim policy (500 window) — speculative until one proof per deployment not per harvest per `R4:29` `store under .autoforge/validation/ops-loop-evidence-live.json` already implies single latest bundle. Rejected — one KV key `discovery:proof:bundle` (last-write-wins) suffices for MV; history view deferred.

- **C) Daemon `launchctl` + Vercel deploy id capture only (no digest, no KV write)**
  - Pros: minimal (ticket `R4:29` cites `launchctl print` + `ledgerGrowth.verified` via `ops-loop-evidence-live.json` at `R4:22`).
  - Cons: no digest → `proof bundle needs to be tamper-evident and reproducible` per `grilling-HOLD.md:59` fails; stale `state/vault-notes.json` vs bundle drift undetected. Rejected for structural proof; kept as validation step (bundle build validates `launchctl` + deploy id captured as `manifest` fields, not replacement).

`ponytail: single KV object + file mirror is ceiling; per-harvest indexed history deferred until evidence reconciliation automation (R17) demands it.`

### 3.5 M1–M8 — three postures (no code now)

- **A) HITL/FOG gate — keep BLOCKED, ADR-only — CHOSEN (grilling-HOLD §M1–M8 at `:69-76`)**
  - Reason: m8 tickets imply schema/UX migrations (Postgres adapter, vault sync-conflict UX per `tracker-index.md:113-140`, `plan.md:105-196`) without domain model — violates codebase-design depth rule "one adapter = hypothetical seam; two adapters = real" and `improve-codebase-architecture` deepening until second variation proven. Charter `vault/CHARTER.md:62-74` curated-notes ownership requires owner blessing for `vault/` UX changes.

- **B) Speculative MV per M ticket (e.g., stub Postgres `DataStore` at `store.ts:60-126` third branch)**
  - Cons: one implementation behind `DataStore` interface is shallow today (no Postgres env in CI), speculative abstraction, new dep violates `MAP.md:14` `no new deps`. Rejected.

- **C) Remove M1–M8 from tracker (close as won't-do)**
  - Cons: loses frontier traceability that `workflow/wayfinder/TRACKER.md:14` preserves for owner loop strategy. Rejected.

## 4. Recommendation — smallest correct change per HOLD ticket

**Keep `DataStore` seam, reuse `executeJob:106-256` + `ledger.ts:8-39` + existing `vitest`/`MemoryStore`, add only `setIfAbsent` helper + 2 tiny modules + 1 proof file + 1 test file:**

1. **R1** — add `DataStore.setIfAbsent?(key,val,ttlSec)→Promise<boolean>` to `store.ts:16-26,60-126` (MemoryStore in-map check with `setTimeout ttl` unref, KvRestStore via `["SET",key,val,"NX","EX",ttl]` single `call` at `:68-99`). Add `src/discovery/harvest-lock.ts` (≤40 lines) exposing `HARVEST_LOCK_KEY="harvest:lock"`, `acquireHarvestLock(store?,ttlSec?,holder?)→{acquired,release}` with `WARN` fallback when `StoreUnavailableError` at `:81-93` or `!setIfAbsent`. Wire `executeJob:140-149` — acquire before `setJobRunning` at `:157` (after cancel check at `:118-130`), `if(!acquired) await setJobError(jobId,"harvest is already running",store); return;` then `try{...} finally{ await release(); }` replacing `HARVEST_LOCK=false` at `:252-255` to also `DEL` holder-guarded key. Keep `HARVEST_LOCK:104` as in-process fast-path inside `harvest-lock.ts` fallback, document `ponytail: global harvest:lock with 120s TTL is ceiling; per-cell locks (MAP.md:30) deferred`. Test via `MemoryStore` two concurrent `acquireHarvestLock` at `R1 AC:30` — one `true` one `false`, third after `release` succeeds. Rollback: delete `harvest-lock.ts` + call site + `setIfAbsent` — revert to `HARVEST_LOCK` bool. `Self-approve: TRUE`.

2. **R2** — extend `ledger.ts:8-39` two small deltas behind same interface: (a) in `appendLedgerKV` write per-entry hint `discovery:ledger:index-entry:{seq}` via `setIfAbsent` with 30d TTL (dedup per-seq, no pipeline per `store.ts:64-67`), then rebuild `INDEX_KEY:5` either by `keys("discovery:ledger:entry:")` map→seqs sorted + `slice(-500)` or by merging read `INDEX_KEY` with hint successes — choose read+merge for minimal `KEYS` cost on hot path, expose `keys` sweep only on orphan recovery. (b) in `getLedgerTailKV` after `getMany` at `:34-36`, collect `orphanSeqs = tailSeqs.filter((s,i)=>vals[i]===null)` then `if(orphans.length)` `idx=idx.filter(s=>!orphanSet.has(s))` + `await s.put(INDEX_KEY, idx.slice(-500)).catch(()=>{})` best-effort heal, no throw. Keep 500 window (out of scope at `R2:34`). Test: simulated 50 concurrent `appendLedgerKV` via `MemoryStore` interleaved `Promise.all` — final `getLedgerTailKV(100).entries.map(e=>e.seq)` contains all 50 unique, no dups; injected orphan by `s.del(entryKey(3))` without `INDEX_KEY` edit → `getLedgerTailKV` drops seq 3 and `INDEX_KEY` no longer contains 3. `ponytail: filter+heal on tail read is ceiling; full tail rebuild via KEYS deferred until orphan rate measurable`. `Self-approve: TRUE`.

3. **R3** — add `tests/discovery/hold-r3.test.ts` covering `R3:29-32` ACs with `MemoryStore` hermetic (`setDataStoreForTests`). Case A concurrent `executeJob` resolves one `status:"done"` (mock `runDiscoveryNode` trivial at `pipeline.ts:6-40`) and one `status:"error"` without throw; case B dedup repeat callback `claimFingerprints` idempotent — second `checkDuplicate` returns `status:"duplicate"` and `clusters.length===1` at `dedupe.ts:76-78`; case C ordering records spy wrappers around imported `appendLedgerKV/persistDedupeFromResult/setJobDone` timestamps. No new mock lib, no KV env, repeatable `vitest run`. `Self-approve: TRUE`.

4. **R4** — add `src/discovery/proof-bundle.ts` (≤70 lines) with `HarvestProofBundle` type (`version, jobId, ranAtIso, providers, ledgerDigest, dedupeDigest, capturedAt, manifest?:{deployId,daemonSnippet}`), `buildProofBundle`, `persistProofBundle`, `readProofBundle`. Persist target file `state/production-harvest-proof.json` (mirrors `jobs.ts:64-66 jobsFilePath` + `dedupe-persist.ts:12-14` pattern) and KV key `discovery:proof:bundle` single `put` (atomic per-key). Wire one line in `executeJob:237-247` after `setJobDone` → `try{ const bundle=await buildProofBundle(...); await persistProofBundle(bundle,store);}catch{ appendLog PERSIST-WARN }` (same swallow as `harvest.ts:219` `appendLog PERSIST-WARN`). Validation: live evidence file `.autoforge/validation/ops-loop-evidence-live.json` (per `R4:22`) can `JSON.parse` bundle and `getLedgerTailKV` digest equals `bundle.ledgerDigest`; `daemonVerified` remains HITL manual step via `launchctl print gui/$(id -u)/com.auditorai.discovery | grep state` at `R4:21` transcript included in `manifest.daemonSnippet` when available, skipped when not. Rollback: delete module + wiring + artifacts; Vercel KV read fallback to empty `ledgerTail` at `discovery/route.ts` still deterministic. Document `ponytail: single last-write-wins bundle key is ceiling; indexed per-harvest history deferred (R17)`. `Self-approve: TRUE for MV bundle generation; live daemon/deploy capture HITL (ticket hitl:true)`. Toggle reversible via env `PROOF_BUNDLE_ENABLED=0` short-circuit.

5. **M1–M8** — no code. Record ADRs `HOLD-M1..M8` as `Status: BLOCKED — HITL/FOG gate` referencing `tracker-index.md:103-140` + `.autoforge/plans/plan.md:66-196`, requiring domain-model (`CONTEXT.md`, glossary, seam map) and owner loop decision before any `DataStore` third adapter, vault UX, or workflow assist ships. `Self-approve: FALSE — NEEDS REVIEW`.

No new dependencies. All variation behind existing `DataStore` seam, `jobs` log contract, `node:crypto` stdlib.

## 5. Interfaces — precise signatures (small interfaces, large hidden behaviour)

**R1 — Distributed harvest lock**
```
store.ts:16 DataStore {
  kind:"memory"|"kv"
  put/get/getMany/keys/del/delByPrefix // existing at :16-26
  setIfAbsent?(key:string, value:string, ttlSec:number):Promise<boolean> // NEW
}
// KvRestStore impl at :60-126
async setIfAbsent(key,val,ttlSec){
  const json = await this.call(["SET", key, val, "NX","EX", String(ttlSec)]);
  return json.result==="OK"; // "OK" when acquired, null when NX blocked
  // on StoreUnavailableError:81-93 propagate so caller can fallback
}
// MemoryStore impl at :28-57
async setIfAbsent(key,val,ttlSec){ if(this.m.has(key)) return false;
  this.m.set(key, JSON.stringify(val));
  if(ttlSec) setTimeout(()=>this.m.delete(key),ttlSec*1000).unref?.();
  return true; }

// harvest-lock.ts (new, deep module — one function hides ttl/holder/del guard)
export const HARVEST_LOCK_KEY="harvest:lock" // future: `harvest:lock:${workspaceHash(ws)}` via workspaceHash at store.ts:196
export async function acquireHarvestLock(store?:DataStore, ttlSec=120, holder?:string)
  :Promise<{acquired:boolean, release:()=>Promise<void>}> // holder defaults to randomUUID
  // fallback when !setIfAbsent or StoreUnavailableError → process-local HARVEST_LOCK at harvest.ts:104 + WARN

// harvest.ts wire at executeJob:106-256
const lock = await acquireHarvestLock(store, 120); // after getJob cancelled check at :118-130, before setJobRunning at :157
if(!lock.acquired){ await setJobError(jobId,"harvest is already running",store); return; }
try{ /* existing D01… done at :157-247 */ } finally{ await lock.release(); }
```

**R2 — Ledger append + tail (signatures unchanged)**
```
ledger.ts:4 ENTRY_PREFIX="discovery:ledger:entry:"
ledger.ts:5 INDEX_KEY="discovery:ledger:index"
ledger.ts:8 appendLedgerKV(entries:LedgerEntry[], store?:DataStore):Promise<void>
  // per-entry: try s.put(entryKey(e.seq),e) at :16 + await s.setIfAbsent?.(`discovery:ledger:index-entry:${e.seq}`,"1",2592000)
  // then rebuild INDEX_KEY: const existing=await s.get<number[]>(INDEX_KEY)??[]; merge + dedup + sort + slice(-500) then s.put(INDEX_KEY,trimmed).catch(()=>{})
  // concurrent-safety: per-entry SET NX ensures seq appears at most once; INDEX_KEY RMW remains but R1 lock serializes hot path

ledger.ts:28 getLedgerTailKV(limit=20, store?:DataStore):Promise<{entries:LedgerEntry[],total:number}>
  // idx=await s.get<number[]>(INDEX_KEY) → tailSeqs=idx.slice(-limit) → vals=await s.getMany(tailSeqs.map(entryKey)) at :34-36
  // entries=vals.filter(v!==null).sort(a.seq-b.seq) at :36
  // orphans=tailSeqs.filter((_,i)=>vals[i]===null); if(orphans.length){ cleaned=idx.filter(s=>!orphanSet.has(s)); await s.put(INDEX_KEY,cleaned.slice(-500)).catch(()=>{}) }
  // return {entries,total:idx.length - orphans.length} or {entries,total:cleaned.length}
  // never throws — catch→{entries:[],total:0} at :39
```

**R3 — Test surface**
```
tests/discovery/hold-r3.test.ts
  beforeEach: store=new MemoryStore(); setDataStoreForTests(store) at store.ts:192-194
  afterEach: setDataStoreForTests(null)
  test "concurrent executeJob resolves one success one busy" →
    createJob at jobs.ts:133, Promise.all([executeJob(id1,...), executeJob(id2,...)]) at harvest.ts:106
    assert (await getJob(id2,store)).error.includes("already running") at harvest.ts:143
  test "callback dedup only one cluster" →
    claimFingerprints(pkg,bundle,index) at dedupe.ts:65-79, checkDuplicate at :39
    persistDedupeFromResult(pkgs,bundles,quals,store) at dedupe-persist.ts:77
  test "append before done ordering" →
    spy wrappers t1=Date.now() before delegate for appendLedgerKV:8, persistDedupeFromResult:77, setJobDone:365
    assert t_append < t_dedupe < t_done
```

**R4 — Proof bundle**
```
proof-bundle.ts (new)
export interface HarvestProofBundle {
  version:"1.0.0"
  jobId:string
  ranAtIso:string
  providers:string[]
  ledgerDigest:string            // sha256(JSON.stringify(ledgerTail.entries))
  ledgerTail:{total:number, entries:LedgerEntry[]}
  dedupeDigest:string|null       // sha256(JSON.stringify(kvDedupeDoc)) or null
  stateDigest:string|null        // sha256(JSON.stringify({entries:[...]})) file mirror or null on EROFS
  capturedAt:string              // new Date().toISOString()
  manifest?:{deployId?:string, daemonSnippet?:string, env:string} // live fields when available
}
export async function buildProofBundle(opts:{jobId:string,ranAtIso:string,providers:string[],store?:DataStore}):Promise<HarvestProofBundle>
  // getLedgerTailKV:28 via opts.store + getDataStore().get(DISCOVERY_DEDUPE_INDEX_KEY) at keys.ts:50 + readFileSync ledger file best-effort
export async function persistProofBundle(bundle:HarvestProofBundle, store?:DataStore):Promise<void>
  // await s.put("discovery:proof:bundle", bundle).catch(()=>{})
  // + try{ mkdirSync(dirname(stateProofPath),{recursive:true}); writeFileSync(stateProofPath, JSON.stringify(bundle,null,2)) }catch(EROFS warn)
  // + if(process.env.PROOF_BUNDLE_ENABLED==="0") return
export async function readProofBundle(store?:DataStore):Promise<HarvestProofBundle|null>
  // try s.get("discovery:proof:bundle") else readFileSync(stateProofPath) else null

// harvest.ts wire after setJobDone at :237-247
try{ const b=await buildProofBundle({jobId,ranAtIso,providers:providerIds,store}); await persistProofBundle(b,store); }catch(e){ await appendLog(jobId,{at:nowIso(),node:"PERSIST-WARN",message:`proof bundle skipped: ${String(e).slice(0,200)}`},store) }

// validation read (existing discovery GET + new proof GET)
GET /api/dev/discovery → ledgerTail at discovery/route.ts:15-45 already KV-first
GET /api/dev/discovery/proof (new, admin-gated at requireAdmin:health/route.ts:16 style) → readProofBundle(store) ?? 404
```

**Least-privilege mapping per interface:**

| Interface | Who writes | Auth | Failure mode |
|---|---|---|---|
| `acquireHarvestLock` / `SET NX EX harvest:lock` | `executeJob` only (single writer) | `KV_REST_API_URL/TOKEN` at `store.ts:131-132` reused; no new secret; when absent → process-local fallback + WARN (R1 AC:32) | `StoreUnavailableError:9` → fallback to `HARVEST_LOCK:104`; TTL expiry → second harvest proceeds after 120s; holder mismatch `DEL` guarded by `get(KEY)===holder` |
| `appendLedgerKV/getLedgerTailKV` | `executeJob:225` `appendLedgerKV` only | same KV auth | orphan index dirty → healed on next tail read; `put(INDEX_KEY)` lost under VT race → R1 lock serializes primary; 500 trim window O(500) |
| `proof-bundle` `put discovery:proof:bundle` + file `state/production-harvest-proof.json` | `executeJob` after `setJobDone:237` only | admin read for `GET /proof`; KV auth same | EROFS file warn then KV truth kept (same pattern as `dedupe-persist.ts:70`); KV down → file mirror only; `PROOF_BUNDLE_ENABLED=0` kills write |
| Tests `MemoryStore` | test process only | `setDataStoreForTests` at `:192` hermetic | never hit KV; `VITEST!==true` guard at `harvest.ts:215` skips FS writes so tests don't pollute `state/` |
| `M1–M8` | none (BLOCKED) | owner via `CHARTER.md:82-85` amendment analogue | HITL/FOG gate prevents speculative adapter insertion |

## 6. Dependencies & sequencing (blocked_by as text, not DAG — plus resource hazards)

**Per-ticket `blocked_by` from canonical MDs:** R1 `[]` at `R1-cross-instance-harvest-lock.md:8`, R2 `[]` at `R2-ledger-improve-indexing.md:8`, R3 `[]` at `R3-regression-tests.md:8`, R4 `[]` at `R4-production-harvest-proof.md:8` — all are roots, no semantic DAG. Grilling-HOLD says each `Self-approve: Yes` with `Gate: HITL/FOG if KV gateway unavailable` at `grilling-HOLD.md:25,40,53,65`. M1–M8 likewise `[]` at `tracker-index.md:103-140` but grilling holds them as non-MV `HITL/FOG` (no sprint until domain model).

**Hazard groups (single-writer locks — ponytail serialize only where files/keys contend):**

```
grilling-HOLD done (grilling-HOLD.md R1-R4 MV + M1-M8 HITL)
    │
    ▼
this architecture report (seams, alternatives, HOLD decisions)
    │
    ├──► R3 tests            hazard: tests/discovery/hold-r3.test.ts  lock: none (hermetic MemoryStore)
    ├──► R1 lock seam        hazard: store.ts:16-26 + harvest-lock.ts (new)   lock: datastore-seam-single-writer
    │         │
    │         ▼ (R1 ships before R2 race relies on it, but parallel-safe for code)
    ├──► R2 ledger heal     hazard: ledger.ts:4-40    lock: discovery-ledger-index-single-writer (INDEX_KEY RMW)
    ├──► R1 wire            hazard: harvest.ts:99-256 (executeJob path) lock: harvest-single-writer (HARVEST_LOCK + harvest:lock)
    ├──► R3 ordering spy     hazard: harvest.ts:214-247 ordering  lock: harvest-single-writer (same file as R1 wire — serialize)
    ├──► R4 bundle module    hazard: proof-bundle.ts (new) + state/production-harvest-proof.json  lock: proof-bundle-single-writer
    └──► R4 wire             hazard: harvest.ts:237-247 (setJobDone tail)  lock: harvest-single-writer (serialize with R1 wire)
    └──► M1–M8 blocked       hazard: none — ADRs only, no touches  lock: plan-decision-single-writer
```

**Waves (= parallel groups) per ponytail:**

| Wave | Members | Parallel? | Guard |
|---|---|---|---|
| **P — pure code, disjoint touches** | R3 tests + R1 `store.ts` helper + R2 `ledger.ts` heal + R4 `proof-bundle.ts` module | **parallel_safe: true** | distinct files (`store.ts` vs `ledger.ts` vs `proof-bundle.ts` vs `tests/**`) — no same-file writers |
| **S — single-writer serialize** | `harvest.ts:106-256` wiring for R1+R2+R4 (same file) + `ledger.ts:8-26` index rebuild | **serialize per file** — R1 `acquire` before `D00-QUEUED` at `:140-157` and R4 `persistProofBundle` after `setJobDone` at `:237` both touch `harvest.ts` so must not overlap in same commit lane; R2 `appendLedgerKV` touches `ledger.ts` which can run parallel with harvest wire | `harvest-single-writer` for `harvest.ts`, `ledger-index-single-writer` for `ledger.ts:5 INDEX_KEY`, `datastore-seam-single-writer` for `store.ts` |
| **H — HITL gate** | M1–M8 + live daemon capture (`launchctl` at `R4:21`) | **blocked until owner HITL ack** — no worker code | `plan-decision-single-writer` for `.autoforge/plans/**` |
| **V — validation** | `proof bundle read-back` + `vault-sync` for `state/*.json` commit | sequential after S | `vault-state-single-writer` at `vault-sync.mjs:16-44` — `node scripts/vault-sync.mjs` then explicit `git add state/production-harvest-proof.json state/discovery-ledger.json` per `AGENTS.md:21-23` |

`blocked_by:[]` everywhere means scheduler may batch P together if file touches are disjoint; only same-file `harvest.ts` writers serialize. R1 should land before R2 strong concurrency test (otherwise 50-concurrent append still loses `INDEX_KEY` without lock) but R2 heal still valid even if R1 absent — degradation is higher orphan rate, test will expose it.

**Touches / hazard locks table:**

| Concern | Touches | Hazard | Lock |
|---|---|---|---|
| Cross-instance lock | `store.ts:16-26,60-126`, `harvest-lock.ts` (new), `harvest.ts:99-105,118-157,252-255` | `harvest:lock` single KV key vs `HARVEST_LOCK:104` bool + `setDataStoreForTests:192` | `harvest-single-writer` — acquire before `setJobRunning:157`, release in `finally:252` holder-guarded; `ponytail: global harvest:lock 120s TTL ceiling` |
| Ledger ordering + orphan | `ledger.ts:4-40`, `store.ts:112 keys` + `108 getMany`, `single-writer.ts:7` guard for index heal | `INDEX_KEY="discovery:ledger:index"` at `:5` RMW + `ENTRY_PREFIX` entries + `discovery:ledger:index-entry:*` hints | `discovery-ledger-index-single-writer` — `appendLedgerKV` merge + `getLedgerTailKV` orphan prune contend on `INDEX_KEY` |
| Regression tests | `tests/discovery/hold-r3.test.ts` (new), `harvest.ts:140-149`, `jobs.ts:369`, `dedupe.ts:39-79`, `dedupe-persist.ts:77-109` | `MemoryStore.m Map` at `store.ts:30` isolated per test | none — hermetic per `setDataStoreForTests` |
| Proof bundle | `proof-bundle.ts` (new), `harvest.ts:237-247`, `state/production-harvest-proof.json` (new deterministic path), KV `discovery:proof:bundle` | `state/*.json` byte-identical determinism (CI `vault compile determinism V2` at `ci.yml:35-50` — not this file, but `AGENTS.md:15 vault-sync` still discipline) + `state/discovery-ledger.json` at `harvest.ts:269` + KV `discovery:proof:bundle` last-write-wins | `proof-bundle-single-writer` + `vault-state-single-writer` for `state/*.json` commit |
| Dedupe (touched by R3/R4 digests) | `dedupe-persist.ts:51-109`, `keys.ts:50` | `discovery:dedupe-index` key vs file `state/dedupe-index.json` | `dedupe-index-single-writer` at `dedupe-persist.ts:17 writeQueue` |
| M1–M8 agentic | `.autoforge/plans/plan.md:66-196`, `tracker-index.md:103-140`, `.autoforge/requirements/grilling-HOLD.md:69-76` | `workflow/wayfinder/**` lane ownership | `plan-decision-single-writer` — no code, decisions.md only |

## 7. Risks, ponytail ceilings & mitigations (R1–R4 deep, M1–M8 gate)

| Risk | Where it bites | Mitigation | Ponytail ceiling + upgrade path |
|---|---|---|---|
| **Process-local vs KV split-brain — R1 primary risk** — `HARVEST_LOCK:104` is per-lambda bool; Vercel burst spins second lambda, both pass `if(HARVEST_LOCK)` at `:140` (false in both), both produce ledger entries, `persistDiscoveryState:281-289` tail race derives same `nextSeq` → duplicate seq | `harvest.ts:104,140-149,252` + `persistDiscoveryState:281-313` tail lookup | R1 `SET NX EX harvest:lock` at `R1:24` `["SET",key,"1","NX","EX",3600]` serializes writers; `acquire` before `D00-QUEUED` at `:155-157` + holder-guarded `DEL` in `finally`; `MemoryStore.setIfAbsent` provides deterministic test without KV; fallback WARN when `StoreUnavailableError:81-93` | `ponytail: process-local HARVEST_LOCK is explicit ceiling per MAP.md:16; 120s TTL global lock is ceiling; per-cell harvest locks (MAP.md:30) deferred until measured cross-cell throughput` |
| **TTL expiry mid-harvest deadlock vs sneak-in** — TTL 120s too short for slow provider crawl (`DISCOVERY_NODE_IDS` budget at `harvest.ts:166-172` up to `DISCOVERY_NODE_IDS.length` nodes × `withHostBudget` at `provider` level), lock expires → second harvest acquires stale same run, races ledger; TTL too long → crashed harvest holds lock for full TTL blocking next run | `harvest.ts:166-172 budget`, `harvest-lock.ts ttlSec` | Pick 120s for MV (grilling-HOLD) with `HARVEST_NODE_POLL_BUDGET` bound, document in interface; holder `get(KEY)===holder` guard on `DEL` prevents releasing чужой lock; crash path still frees after TTL (best-effort is intentional per `R1:19 release or let TTL expire`); upgrade: extend via `EXPIRE` heartbeat on long `runDiscoveryNode` if measured | `ponytail: fixed TTL 120s is ceiling; heartbeat TTL extension deferred until long-run >120s observed` |
| **Ledger index race — R2 primary risk** — `ledger.ts:12-26` read-modify-write `INDEX_KEY` loses concurrent appends (both read `[1,2]`, both push `3`→`[1,2,3]`, one wins but 50-concurrent unique seq at `R2 AC:29` may still lose tail trim slicing) + orphan rows (`INDEX_KEY` lists seq whose `entryKey(seq)` missing due to TTL/partial delete) cause `getLedgerTailKV:36` over-report vs file mirror | `ledger.ts:11-26 append`, `ledger.ts:28-39 tail`, `harvest.ts:281-289 tail lookup for nextSeq` | R2 per-entry `SET NX discovery:ledger:index-entry:{seq}` dedups seq appearance; `INDEX_KEY` rebuild via merge vs `keys()` sweep; R1 lock is primary serialized writer shrinking race to TTL-expiry window only; tail orphan prune rewrites `INDEX_KEY` without orphans (best-effort `withPersistenceSingleWriter` at `single-writer.ts:7` in-process guard) | `ponytail: INDEX_KEY read→merge→sort→put is ceiling; true CAS EVAL pipeline at store.ts:64-67 deferred (pipeline rejection doc). O(500) keys scan ceiling; cross-shard ledger tail merging (MAP.md Not yet specified) deferred.` |
| **Orphan index dirty forever** — `getLedgerTailKV:36` `vals.filter(v!==null)` today hides orphan entries from caller but leaves `INDEX_KEY` containing dead seqs, so `total` over-reports and repeated tails stay `total` high while `entries` filtered short; also `persistDiscoveryState:281-289` tail-derived `nextSeq` may reuse orphan seq leading to duplicate `put` | `ledger.ts:5 INDEX_KEY`, `ledger.ts:36 filter`, `harvest.ts:281 lastSeq` | Tail prune writes back `INDEX_KEY` without orphans immediately after detection at `getLedgerTailKV:39` catch path; `nextSeq` derivation at `harvest.ts:283-287` `tailLast > lastSeq ? tailLast` already dedups, but after prune `tailLast` is live max; test asserts orphan seq removed from `INDEX_KEY` after one tail read | `ponytail: heal on read (lazy) is ceiling; proactive background sweep deferred until orphan rate >1%` |
| **KV vs Memory split-brain — R1+R2 cross-cut** — `store.ts:136-180` fallback wrapper silently falls to `MemoryStore` on `StoreUnavailableError:81-93` or 5s abort at `:70-71`, two truths this request; caller thinks KV-truth but actually `MemoryStore` (per-request isolated) → `cancel` not visible cross-lambda, ledger tail diverges, proof bundle KV missing | `store.ts:138-150` `try kv → catch → fallback`, `jobs.ts:isKv():53-60` branch picks file path when fallback kind still `"kv"` | Keep `StoreUnavailableError` distinction at `:9-14`; `setDataStoreForTests:192-194` hermetic suites; R1 `acquire` path surfaces fallback WARN so operator knows degraded mode; proof bundle file mirror ensures at least one durable copy when KV down; R4 `getLedgerTailKV` already KV-first then file fallback at `discovery/route.ts:15-45` so tail degrades gracefully | `ponytail: fallback shadow is ceiling; explicit StoreUnavailableError propagation per call deferred until callers handle per-store — tracked as next deepening (M8 Postgres adapter is where seam discipline hardens).` |
| **File mirror ROFS on Vercel — dedupe/ledger/proof bundle diverge** | `dedupe-persist.ts:70` `EROFS` warn, `harvest.ts:312` swallow `writeFileSync`, `proof-bundle.ts` file write same | KV-first load at `dedupe-persist.ts:51-58`, file best-effort at `:70-71` + KV `put` always at `:104`; `persistDiscoveryState:314-322` file `writeFileSync` already try/catch swallow; proof bundle `state/production-harvest-proof.json` same `EROFS` warn+continue, KV is truth | `ponytail: EROFS warn+continue is ceiling; per-account locks (dedupe-persist.ts:16 comment) deferred` |
| **Persist-before-done ordering — R3 flagged** — validator flagged `R3:21` `appendLedgerKV`/`persistDedupeFromResult` must be awaited before `setJobDone:237` else visibility-triggered reload sees `done` but `ledgerTail` still stale | `harvest.ts:214-247` (entries `persistDiscoveryState` at `:217` → KV `appendLedgerKV` at `:225` → `persistDedupeFromResult` at `:230` → `setJobDone` at `:237`) | Keep strict await chain (no fire-and-forget for these three) — R3 test asserts timestamp ordering `appendTs < dedupeTs < doneTs`; `harvest.ts:215 VITEST guard` already preserves deterministic test isolation | none — ordering is contract, already at `harvest.ts:214-247` |
| **Proof bundle vault determinism hazard — R4** — `state/production-harvest-proof.json` lives under `state/` checked by `git diff --exit-code -- vault/views state/vault-notes.json` at `ci.yml:50` today **not** checking `state/production-harvest-proof.json`, but parallel `vault/journal/**` lanes rule at `AGENTS.md:21-23` `explicit git add <paths> only` still applies → blanket `git add -A` would pull foreign proof bundles and poison commit | `AGENTS.md:15-18 vault-sync HEAD worktree`, `ci.yml:35-50` | Document `state/production-harvest-proof.json` as `state/` deterministic but **not** vault-compiled (only `state/vault-notes.json` is HEAD-compiled); commit via `node scripts/vault-sync.mjs` then `git add state/production-harvest-proof.json` explicitly — same staging hygiene as prior `report:23 staging hygiene`; untracked parallel bundles stay `??` until deliberate add | `ponytail: explicit git add for state bundle is ceiling; pre-commit hook deferred` |
| **M1–M8 speculative deepening** — adding Postgres third adapter without domain model repeats `ledger.ts` race at scale, vault sync-conflict UX without `CHARTER.md:72-74` human-wins rule breaks determinism | `store.ts:60-126`, `vault/CHARTER.md:62-74` | Gate as `BLOCKED — HITL/FOG` per `grilling-HOLD.md:74-75`; require `CONTEXT.md` + glossary + ADR (grill-with-docs) before any adapter/UX lands; one-adapter hypothetical rule defers seam until variation proved | `ponytail: ADR-only is ceiling; code deferred` |

## 8. Deepening opportunities (improve-codebase-architecture lens — speculative until second adapter proves seam)

- **Ledger `appendLedgerKV` shallow sequencer** (`ledger.ts:8-26` read-modify-write index + per-entry puts). One existing adapter (KV index) is hypothetical until R2 second dedup hint key lands. After R2 `setIfAbsent` hint key + orphan prune are two adapters over `INDEX_KEY`, seam becomes real and warrants dedicated `tailSequencer` module.
  **Recommendation:** `Worth exploring` after R2 test (50-concurrent entries green) — do not extract until heal path proves stability.

- **Harvest lock shallow `HARVEST_LOCK` bool** (`harvest.ts:104` global bool). One adapter = process-local only. Second adapter (`SET NX EX harvest:lock` via `DataStore.setIfAbsent`) makes seam real — `harvest-lock.ts` is justified exactly because KV vs Memory are two adapters over same `acquireHarvestLock` interface. Keep `writeQueue` internal seam at `dedupe-persist.ts:17` private until R1 lands.
  **Recommendation:** `Worth exploring` — ship `harvest-lock.ts` with R1; deletion test passes (removing it re-scatters lock logic across `executeJob:140-149,252`).

- **`loadDedupeIndex` sync shim** (`dedupe-persist.ts:19-26` `__KV_DEDUPE_INDEX__` global). One adapter = hypothetical. Once R3 `persistDedupeFromResult` switches to `loadDedupeIndexAsync:51-58`, delete shim.
  **Recommendation:** `Worth exploring` — delete shim after KV-first lands (R10 in prior report).

- **`proof-bundle.ts` as initially shallow aggregator** — if only `executeJob` calls it, one caller = hypothetical `proof` seam. Becomes deep only once validator + dashboard both consume `readProofBundle` — two adapters prove seam.
  **Recommendation:** `Speculative` — keep as single module until dashboard `GET /proof` second consumer exists; delete test: removing module would scatter digest/sha logic into `harvest.ts:237` and `health/route.ts:135`.

- **M8 Postgres adapter** (`store.ts:60-126` third branch). Today `MemoryStore` + `KvRestStore` are two adapters proving `DataStore` depth. Third adapter is real variation but invasive (migration, `createFallbackStore:130-181` branch, credential `env`). Defer until `improve-codebase-architecture` scan after M8 domain model.
  **Recommendation:** `Speculative` — keep `DataStore` seam stable; no third adapter until M8 HITL.

## 9. Verification — no new infra (ponytail checks)

- `setIfAbsent` KV path: `await acquireHarvestLock(memory,2)` twice concurrently via `MemoryStore` → one `acquired:true` one `false`; after `await lock.release()` third acquires — repeatable `vitest run` no env.
- `ledger` 50-concurrent: `Promise.all(Array(50).fill(0).map(async (_,i)=>appendLedgerKV([{seq:tailSeq+i+1,at:ranAtIso,payload_kind:"test",data:{}}],store)))` → `getLedgerTailKV(100)` contains 50 unique seq, no duplicates; orphan inject `await store.del(entryKey(orphanSeq))` → next `getLedgerTailKV` drops orphan and `s.get(INDEX_KEY)` no longer contains it.
- `R3` ordering spy: wrap `appendLedgerKV/persistDedupeFromResult/setJobDone` with `Date.now()` probes → assert order.
- `proof bundle`: `await buildProofBundle({jobId,ranAtIso,providers:["seed-portals"],store})` then `await persistProofBundle(bundle,store)` → `await readProofBundle(store)` byte-equals bundle, `ledgerDigest===sha256(JSON.stringify(tail.entries))` and `dedupeDigest` stable across two builds when dedupe unchanged.
- `node scripts/vault-sync.mjs --check` → `committed vault state matches HEAD compilation` when `state/production-harvest-proof.json` committed via explicit `git add` (not `git add -A`) per `AGENTS.md:21-23`.
- `npm run lint && npm run typecheck && npm run build` green — no new deps.
- Live `discovery/route.ts GET` still `getLedgerTailKV(20)` KV-first at `:15-45` then file fallback — deterministic even when KV down.

---
No new dependencies. No generic facades. All HOLD variation behind `DataStore` seam (`store.ts:16-26`), small `harvest-lock.ts`/`proof-bundle.ts` deep modules, fixed TTL + index-entry hint + lazy orphan heal ceilings. Smallest correct change per R1–R4 reversible via module/call-site deletion.
