# Architecture Decisions — HOLD Frontier R1–R4 (M1–M8 deferred)

Date: 2026-09-03
Source: `workflow/wayfinder/maps/ops-residual/MAP.md:41-45`, `R1-cross-instance-harvest-lock.md:16-40`, `R2-ledger-improve-indexing.md:16-35`, `R3-regression-tests.md:16-37`, `R4-production-harvest-proof.md:16-36`, `.autoforge/requirements/grilling-HOLD.md:10-67` (R1–R4 MV + M1–M8 HITL), `.autoforge/discovery/tracker-index.md:3-20` (R1–R4 BLOCKED), `src/lib/persistence/store.ts:9-200`, `src/discovery/harvest.ts:99-256`, `src/discovery/ledger.ts:4-40`, `src/discovery/jobs.ts:41-371`, `src/discovery/dedupe-persist.ts:12-109`, `src/lib/persistence/single-writer.ts:1-17`, `vault/CHARTER.md:1-85`, `AGENTS.md:15-23`
Ponytail: reuse `DataStore` KV seam + `MemoryStore` for tests + `node:crypto` stdlib + `withPersistenceSingleWriter` guard; no new deps, no generic facades.

Prior decisions AD-01..AD-10 at `.autoforge/architecture/decisions.md:7-112`, AD-11..AD-25 at `decisions-remaining.md:1-203`. This HOLD file continues AD-26..AD-33.

---

## AD-26 — R1 Cross-instance harvest lock via `SET NX EX` (DataStore seam + harvest-lock module)

**Decision:** Add optional `DataStore.setIfAbsent(key,value,ttlSec):Promise<boolean>` to `store.ts:16-26,60-126` and a tiny deep module `src/discovery/harvest-lock.ts` exposing `HARVEST_LOCK_KEY="harvest:lock"` (future scoped `harvest:lock:${workspaceHash(ws)}` via `workspaceHash` at `store.ts:196` when multi-workspace lands) and `acquireHarvestLock(store?, ttlSec=120, holder?=randomUUID):Promise<{acquired:boolean,release:()=>Promise<void>}>`.

- `MemoryStore:28-57` impl: `if(m.has(key)) return false; m.set(key,JSON(key)); if(ttlSec) setTimeout(()=>m.delete(key),ttlSec*1000).unref?.(); return true;` — TTL expiry mirrors KV `EX` for hermetic concurrent tests without env.
- `KvRestStore:60-126` impl: `await this.call(["SET", key, value, "NX","EX", String(ttlSec)])` at `store.ts:68-99` style; return `json.result==="OK"` (OK = acquired, `null` = NX blocked per Upstash REST). `StoreUnavailableError:9-14` propagates so caller can fallback; `call` already 5s abort at `:70-71`, `!res.ok→StoreUnavailableError` at `:85`, `error field→85-93`.
- `harvest-lock.ts` fallback: when `!s.setIfAbsent` or `StoreUnavailableError` or `!KV_REST_API_URL/TOKEN` at `store.ts:131-133`, fall back to process-local `HARVEST_LOCK:104` check with single `console.warn("WARN harvest lock: KV unavailable, using process-local guard")` per `R1 AC:32`.
- Wire in `executeJob:106-256`: acquire **after** early cancellation check at `:118-130` and **before** `setJobRunning("D01-DISCOVER")` at `:157` — if `!acquired` then `await setJobError(jobId,"harvest is already running",store); return;` at `:143` path. `try{ ... 214-247 persist + done ... } finally{ await release(); }` replaces `HARVEST_LOCK=false` at `:252-255`; `release` is holder-guarded `if((await s.get(KEY))===holder) await s.del(KEY)` so TTL expiry race doesn't DEL чужой lock. Keep `HARVEST_LOCK:104` as in-process fast-path inside `harvest-lock.ts` fallback and clear in `finally` regardless of `StoreUnavailableError`.

**Interface distinction:** seam is `DataStore.setIfAbsent` (small: 3 params, 1 bool result) + `acquireHarvestLock` (small: optional store/ttl/holder, 2 fields). Large behaviour hidden: `["SET","NX","EX"]` REST encoding, holder `randomUUID` generation, 5s abort propagation, TTL-vs-`HARVEST_NODE_POLL_BUDGET` at `harvest.ts:166-172` sizing, `DEL` guard, process-local fallback. Deletion test: removing module scatters lock reasoning back across `executeJob:140-149,252` — locality fails, passes deep-module test.

**Rejected:** (1) non-atomic `GET`→`PUT` (race window two lambdas both read `null` then both `PUT` succeed, `R1:24-27` NX requirement violated) — fails exactly the burst it must fix; (2) `INCR harvest:seq` seq-allocator replacing `persistDiscoveryState:281-289` tail derive (atomic but only solves seq, not mutual exclusion, forces `ledger.ts:8-26` rewrite — speculative until tail collision measured at `MAP.md:30` cross-shard note).

**Boundary:** `jobs.ts` stores are untouched; `harvest.ts:213-237` ledger/dedupe writes stay behind same `store?` injection; HTTP `POST /api/dev/discovery/run` route at `src/app/api/dev/discovery/route.ts:6-40` still only `createJob` + fire-and-forget `executeJob` — lock contention surfaces as `setJobError` at `:143` visible via `getJob` polling, not as thrown `500`. Least-privilege: reuses `KV_REST_API_URL/TOKEN` at `store.ts:131`, no new secret, `requireAdmin` gate unchanged.

**Risk:** TTL must exceed max `executeJob` runtime (budget `min(DISCOVERY_NODE_IDS.length, HARVEST_NODE_POLL_BUDGET)` nodes × provider latency at `harvest.ts:166-172`). Mitigated by 120s default (grilling-HOLD MV) covering bounded budget + doc; too short → second harvest sneaks after TTL — mitigated by holder guard and accepted as explicit ceiling. Crash holding lock blocks next run for TTL window — intentional per `R1:19 let TTL expire` vs deadlock.

`ponytail: global harvest:lock 120s TTL is ceiling; per-cell locks (MAP.md:30) + heartbeat EXPIRE extension deferred until measured.`

**Self-approve:** **TRUE** — MV minimal wiring under KV lock is reversible; no code-paths removed; revert by deleting `harvest-lock.ts` + `store.ts:setIfAbsent` + `executeJob` call site returns to `HARVEST_LOCK:104` only. Grilling-HOLD `Self-approve: Yes` at `:24` — reversible where KV gateway available; HITL only if `KV_REST_API_URL/TOKEN` gateway absent or cross-region timing hazards per `:25`. Tests: two concurrent `acquireHarvestLock(MemoryStore)` → one `true` one `false`, third after `release()` succeeds per `R1 AC:30-33`.

---

## AD-27 — R2 Ledger KV ordering + orphan-key recovery (index-entry hint + lazy heal)

**Decision:** Extend `src/discovery/ledger.ts:4-40` behind unchanged `appendLedgerKV(entries,store?)` and `getLedgerTailKV(limit,store?)→{entries,total}` signatures — keep small interface, hide ordering + heal inside.

- Write: for each `e` in `entries` at `ledger.ts:13-22` do `await s.put(entryKey(e.seq),e)` at `:16` (existing swallow) plus `await s.setIfAbsent?.("discovery:ledger:index-entry:"+e.seq,"1",30*24*3600).catch(()=>{})` (30d hint, `SET NX` deduplicates seq appearance). Then rebuild `INDEX_KEY:5`: read `idx=await s.get<number[]>(INDEX_KEY) ?? []`, merge new `e.seq` where `!idx.includes(e.seq)` at `:22`, `idx.sort((a,b)=>a-b)` at `:24`, `trimmed=idx.slice(-500)` at `:25`, `await s.put(INDEX_KEY,trimmed).catch(()=>{})` at `:26`. Do **not** use `store.ts:64-67` pipeline-form `[[..],[..]]` — Upstash REST rejects pipelined body per `store.ts:64-67` comment — instead concurrent `Promise.all` per-key `put` at `store.ts:108-109` style.
- Read: `getLedgerTailKV` at `:28-39` keeps `vals.filter(v!==null).sort(a.seq-b.seq)` at `:36`, then `orphanSeqs = tailSeqs.filter((_,i)=>vals[i]===null)`; if any, `cleaned = idx.filter(seq=>!orphanSet.has(seq))` then `await withPersistenceSingleWriter(async()=>await s.put(INDEX_KEY,cleaned.slice(-500)))` best-effort (swallow) at `single-writer.ts:7-17` in-process guard. Returns `{entries:filtered, total:cleaned.length}`. Never throws — `catch→{entries:[],total:0}` at `:39`.

**Interface distinction:** callers learn no new params (`entries, limit, store?` only); large behaviour hidden: per-entry `SET NX` dedup, `keys("discovery:ledger:entry:")` sweep vs merge choice, `sort+slice(-500)` window, orphan `SET NX` hint TTL, heal-on-read. 500-entry window preserves `ledger.ts:25` trim contract (out of scope at `R2:34`).

**Rejected:** (1) pure `INDEX_KEY` RMW with read-side filter-only (current `:36` without heal) — fails `R2 AC:30` `getLedgerTailKV drops index rows whose per-entry keys return null` and leaves `total` over-reported; (2) KV pipeline `[[SET entry],[SET index],[GET INDEX_KEY]]` `MULTI/EXEC` / `EVAL` script — requires new `pipelinedCall` helper, assumes Upstash pipeline semantics, speculatively assumes Lua available — over-build for O(500) window.

**Boundary:** `harvest.ts:281-289` tail-derived `nextSeq` uses `getLedgerTailKV(50,store).tailLast` vs file `ledgerEntries` max — both folded into `lastSeq = max(fileTail, kvTail)` at `:281-289`, so R2 heal propagates seq monotonicity without changing `persistDiscoveryState:258-334` file mirror at `:314-322` swallow. R1 lock is primary writer serialization; R2 is safety net when TTL expires and two writers race `INDEX_KEY` rebuild.

**Risk:** `INDEX_KEY` RMW remains non-atomic across two writers' `get→sort→put` even with hint dedup — mitigated by R1 lock making concurrent `append` rare; `keys("discovery:ledger:entry:*")` scan is O(500) via `store.keys` at `store.ts:112-114` sorted — acceptable under trim window, upgrade is true CAS `EVAL` when `R2` 50-concurrent-entry test at `:29` measures loss. Orphan heal is lazy on read — repeated reads before heal see stale `total` one window.

`ponytail: per-entry SET NX hint + lazy orphan heal on tail read is ceiling; full KEYS rebuild deferred until orphan rate >1% measurable; O(500) scan is ceiling.`

**Self-approve:** **TRUE** — MV local to ledger-persist path; reversibility straightforward by reverting `ledger.ts:4-40` changes per `grilling-HOLD.md:39` (R2 Self-approve Yes). GIT `FOG` only if orphan recovery risks corrupting existing ledger state or tail sequencing requires broader schema migration at `:40`.

---

## AD-28 — R3 Regression tests for `HARVEST_LOCK` busy path + `appendLedgerKV→setJobDone` ordering + callback dedup

**Decision:** One colocated test file `tests/discovery/hold-r3.test.ts` via `MemoryStore:28-57` + `setDataStoreForTests` at `store.ts:192-194`, covering `R3:29-32` ACs:

- **Busy lock:** `Promise.all([executeJob(id1,ctx,ids,iso,{store}), executeJob(id2,ctx,ids,iso,{store})])` with trivial `runDiscoveryNode` stub — asserts `getJob(id2,store).status==="error"` and `error.includes("already running")` via `setJobError:369-371` path at `harvest.ts:143`, and `HARVEST_LOCK:104` reset at `:252-255`. When KV lock ships, same test swaps to `acquireHarvestLock(store)` two concurrent at `AD-26` — one `true` one `false`.
- **Callback dedup:** `checkDuplicate(pkg,bundle,index)` at `dedupe.ts:39-62` + `claimFingerprints:65-79` + `persistDedupeFromResult:77-109` with `MemoryStore` — simulate repeated callbacks identical `doc.sha256` and `extraction.text_sha256` at `dedupe.ts:81-84` `bundleTextKey(bundle,doc_id)` → second `checkDuplicate` returns `{status:"duplicate"}` via `shaHit` at `:59` or `{status:"near_dup"}` via `textHit` at `:60`, only one `clusters` entry at `:76-78`.
- **Ordering:** spy wrappers recording `Date.now()` before delegate for `appendLedgerKV:8` and `persistDedupeFromResult:77` and `setJobDone:365` at `harvest.ts:214-247`; assert `t_append < t_dedupe < t_done` (done is last at `:237`).

**Interface distinction:** tests cross the same `executeJob`/`DataStore`/`DedupeIndexDoc` seams as production callers; no new helper interfaces. Harness is stdlib `vitest` already at `package.json:8`, `VITEST!==true` guard at `harvest.ts:215` preserves deterministic FS-skip, no `fetch` mocking of `KvRestStore.call:68` 5s abort.

**Rejected:** (1) three-file split (`harvest-lock.test.ts` + `dedupe.test.ts` + `ordering.test.ts`) repeating `MemoryStore` setup and `setDataStoreForTests` reset — longer diff for same coverage; (2) live Upstash KV E2E with concurrent lambdas — flaky, requires `security find-generic-password` secrets at `AGENTS.md:33`, burns quota, not CI deterministic; (3) React `onRun` dedup harness via `provider-health.tsx` fetch mock — separate concern from harvest lock, violates scope `R3:34 out-of-scope distributed cross-instance lock`, keep focussed on discovery seams per `R3:26` interfaces.

**Boundary:** tests are non-invasive, never touch `state/*.json` files (via `harvest.ts:215` guard), run under `V2 determinism` gate at `ci.yml:35-50` `git diff -- vault/views state/vault-notes.json` — no vault state mutation. Tie to existing harness at `R3:51-52`.

`ponytail: one test file with MemoryStore is ceiling; dedicated harness or live KV cluster deferred until flake/throughput measured.`

**Self-approve:** **TRUE** — tests are non-invasive and reversible; they only verify existing behavior per `grilling-HOLD.md:52` (R3 Self-approve Yes). HITL/FOG only if tests rely on KV-backed locks or external dependencies at `:53`.

---

## AD-29 — R4 Production harvest proof bundle (Vercel KV single-object + file mirror, daemon transcript as manifest)

**Decision:** Add tiny deep module `src/discovery/proof-bundle.ts` (≤70 lines) with small interface: `HarvestProofBundle{version:"1.0.0", jobId, ranAtIso, providers:string[], ledgerDigest:string, ledgerTail:{total:number, entries:LedgerEntry[]}, dedupeDigest:string|null, stateDigest:string|null, capturedAt:string, manifest?:{deployId?:string, daemonSnippet?:string, env:string}}` plus:

- `buildProofBundle(opts:{jobId,ranAtIso,providers,store?}):Promise<HarvestProofBundle>` — `getLedgerTailKV(20,store) ?? getLedgerTailKV(20)` KV-first then file at `harvest.ts:281` style, `sha256(JSON.stringify(entries))` via `node:crypto createHash` at `store.ts:4`, `DISCOVERY_DEDUPE_INDEX_KEY` at `keys.ts:50` via `store.get`, state file hash best-effort.
- `persistProofBundle(bundle,store?):Promise<void>` — `await s.put("discovery:proof:bundle",bundle).catch(()=>{})` (single-key atomic) + `try{ mkdirSync(dirname(stateProofPath),{recursive:true}); writeFileSync("state/production-harvest-proof.json", JSON.stringify(bundle,null,2)) }catch(EROFS warn per dedupe-persist.ts:70 }` — `PROOF_BUNDLE_ENABLED=0` env short-circuit for rollback.
- `readProofBundle(store?):Promise<HarvestProofBundle|null>` — `await s.get<Bundle>("discovery:proof:bundle") ?? readFileSync("state/production-harvest-proof.json")` fallback (same chain as `discovery/route.ts:15-45` ledger tail KV-first then file).

Wire one line in `executeJob:237-247` after `setJobDone` at `:237` succeeds: `try{ const b=await buildProofBundle({jobId,ranAtIso,providers:providerIds,store}); await persistProofBundle(b,store); }catch(e){ await appendLog(jobId,{at:nowIso(),node:"PERSIST-WARN",message:`proof bundle skipped: ${String(e).slice(0,200)}`},store) }` — same swallow as `harvest.ts:219` `PERSIST-WARN` so route's 202 `{jobId}` contract at `harvest.ts:426` unchanged.

Validation shape: optional `GET /api/dev/discovery/proof` (admin-gated at `health/route.ts:16` `requireAdmin` style) delegates to `readProofBundle` and returns bundle JSON; existing `GET /api/dev/discovery` at `discovery/route.ts:9` already returns `ledgerTail` KV-first, which validator can `cmp` against `bundle.ledgerDigest`. Live daemon `manifest.daemonSnippet` captures `launchctl print gui/$(id -u)/com.auditorai.discovery | grep state` at `R4:21` when `process.env.PICTURE_BOOK_DAEMON` reachable, else `null` — does not block bundle emit.

**Interface distinction:** route `GET /api/dev/discovery/proof` learns one object `HarvestProofBundle` without learning `KEYS` prefix or hash algorithm; callers reuse `DataStore` seam for KV vs `MemoryStore` vs file fallback. File path `state/production-harvest-proof.json` follows `dedupe-persist.ts:12-14 DEDUPE_INDEX_PATH` convention for deterministic `state/*.json` layout.

**Rejected:** (1) per-harvest indexed history `discovery:proof:{jobId}` + `discovery:proof:index` like `ledger INDEX_KEY:5` — reintroduces `INDEX_KEY` RMW race and needs trim policy (speculative until more than latest bundle is needed; single last-write-wins key matches `R4:22` `store under .autoforge/validation/ops-loop-evidence-live.json` latest-only); (2) `launchctl`+deploy-only transcript with no KV `put` and no digest — fails grilling-HOLD requirement at `:59` "tamper-evident and reproducible; requires canonical digest and durable path to read-back"; kept as `manifest` fields within bundle not replacement; (3) `POST` bundle via `INCR` seq — new dep.

**Boundary:** `state/production-harvest-proof.json` is `state/*.json` machine-canonical per `vault/CHARTER.md:20` (`state/` JSON-canonical) but **not** vault-compiled (`scripts/vault-sync.mjs:16-44` compiles only `state/vault-notes.json` + `vault/views/**` at `ci.yml:35-50`); commit hygiene `AGENTS.md:21-23` `explicit git add state/production-harvest-proof.json` (never `git add -A` at `AGENTS.md:22-23`) plus `node scripts/vault-sync.mjs` or `--check` before push keeps vault determinism green. Vault `journal/` append-only lanes do not touch this file. Secrets remain redacted at `R4:25`.

`ponytail: single last-write-wins KV object + file mirror with sha256 digest is ceiling; indexed per-harvest history deferred until R17 evidence reconciliation automation demands it; no new deps.`

**Self-approve:** **TRUE for MV bundle generation; live daemon/deploy capture HITL** — MV is small, tightly scoped, reversible (delete module + wiring + artifacts at `state/production-harvest-proof.json` + `discovery:proof:bundle` key); no changes to core discovery path per `grilling-HOLD.md:64`. Grilling self-approves at `:65` but gates with `HITL/FOG if environment does not provide a durable path` at `:65-66`; ticket `R4-production-harvest-proof.md:5 hitl:true` and `AC:27-32` `ledgerGrowth.verified / productionDeploymentVerified / daemonVerified` flipping `blocked→resolved` are HITL because they require live Vercel (`auditorai-gamma.vercel.app/api/dev/discovery` per `:22`) + `launchctl active count >0` at `:22` which cannot be validated in local-worktree. Toggle `PROOF_BUNDLE_ENABLED=0` reverts without code removal.

---

## AD-30 — HOLD M1–M8 agentic platform deepening stays `BLOCKED — HITL/FOG` (no sprint)

**Decision:** M1 `Quote-bearing GF-6..10 baseline upgrade` at `tracker-index.md:103-105` + `plan.md:66-68`, M2 `Conditional blob-storage escape hatch` at `:108-111`/`plan.md:81-90`, M3 `Vault sync-conflict UX` at `:113-115`/`plan.md:105-106`, M4 `Report/recommendation drafting assists` at `:118-121`/`plan.md:123-130`, M5 `Candidate-findings review UX hardening` at `:123-126`/`plan.md:135-146`, M6 `Audit-history retention policy` at `:128-131`/`plan.md:150-164`, M7 `RSC initial Repository snapshot (fog)` at `:133-139`/`plan.md:165-178`, M8 `Postgres third DataStore adapter` at `:138-140`/`plan.md:180-196` — all remain `BLOCKED` with `HITL/FOG` gate per `grilling-HOLD.md:74-75`.

**Rationale (codebase-design + ponytail):** These imply cross-cutting interface changes (vault curated-notes ownership at `vault/CHARTER.md:62-74` for M3, `DataStore` seam third adapter for M8 inverting to 3 adapters where 2 already prove seam at `store.ts:28-126` — M8 without domain model violates "one adapter = hypothetical" but with two existing adapters the seam is real yet irreversible without migration), workflow assists (M4/M5) needing extension of `CandidateFinding|DraftRationale|EvidenceSummary|MissingInformationQuestion|PotentialRecommendation` typings from `docs/adr/0001`, and `T2`-scoped durability before platform deepening. `MAP.md:39-59` bundles M-tickets under separate `v2-agentic-platform` / `v3-architecture-deepening` maps — owner-driven ADR + `CONTEXT.md` glossary phase required (grill-with-docs).

**Rejected:** speculative MV per M ticket (stub Postgres `KvRestStore` branch, vault UX handler, assists scaffolds) — adds deps, widens interfaces, violates `MAP.md:14` `no new deps` and `AD-07 charter amendment procedure` at `CHARTER.md:82-85` analogue for `.autoforge/` staging.

**Self-approve:** **FALSE — NEEDS REVIEW (HITL/FOG)** — explicit owner decisions required per `grilling-HOLD.md:74-75` and `M1–M8 BLOCKED` status; delegating to workers without domain model risks scope creep and regressions at `:72`.

---

## AD-31 — Module depth & seam placement for HOLD frontier

- `store.ts:DataStore` — deep module (small `put/get/getMany/keys/del/delByPrefix` + new `setIfAbsent` at `AD-26`, large hidden REST fetch/`SET NX EX`/5s abort at `:70-93`). Two adapters (`MemoryStore:28-57`, `KvRestStore:60-126`) prove seam — add `setIfAbsent` to harden R1/R2 without new seam. Locality: fix quoting/auth/TTL once. `ponytail: SET NX EX string literal reuse, no pipeline.`
- `harvest-lock.ts` — new deep module (small `acquireHarvestLock` interface, large hidden holder/TTL/WARN/fallback). Internal seam is holder `get→DEL` guard, private. Becomes two-adapter real seam (Memory vs KV) — keep.
- `ledger.ts:appendLedgerKV/getLedgerTailKV` — medium-deep → deepen with index-entry hint + lazy heal; internal `entryKey(seq)` at `:7` stays private, `INDEX_KEY:5` public for observability. `keys(prefix*)` at `store.ts:112-114` internal sweep sorted ensures deterministic `slice(-500)`.
- `proof-bundle.ts` — new medium-deep aggregator (small `build/persist/readProofBundle` interface, hidden `sha256+put+file mirror+EROFS warn`). Single caller `executeJob:237` today = hypothetical until `GET /proof` second consumer exists — keep shallow, promote after second adapter (dashboard/validator).
- `dedupe-persist.ts` — medium-deep via `loadDedupeIndexAsync:51-58` KV-first already proven; keep `writeQueue:17` serialized global lock `ponytail: global queue ceiling`.
- `harvest.ts:executeJob` — orchestrator stays orchestrator (thin, delegates to `harvest-lock.ts`+`ledger.ts`+`proof-bundle.ts`+`dedupe-persist.ts`), depth is in adapters not orchestrator.

**Principles applied:** acceptance before seam (no seam without reuse), interface is test surface (callers/tests cross `DataStore`/`acquireHarvestLock`/`getLedgerTailKV`/`buildProofBundle` seams), deletion test per candidate (report-HOLD §8), depth is measured by leverage (one KV helper pays across R1+R2+R4).

---

## AD-32 — Locks & touches for HOLD frontier (least-privilege)

| Lock | Members | Policy |
|---|---|---|
| `harvest-single-writer` | `harvest.ts:HARVEST_LOCK:104` + `harvest-lock.ts:HARVEST_LOCK_KEY` `SET NX EX` + `executeJob:118-130 cancel poll` + `140-149 busy→setJobError` + `152-255 try/finally DEL` | Global per-workspace; cross-instance via KV line at `store.ts:60-126`, in-process fallback via bool; only `executeJob` writes; `ponytail: 120s TTL ceiling; per-cell locks (MAP.md:30) deferred` |
| `discovery-ledger-index-single-writer` | `ledger.ts:5 INDEX_KEY` `appendLedgerKV:12-26` merge + `getLedgerTailKV:28-39` orphan prune + `withPersistenceSingleWriter:7` in-process guard + `persistDiscoveryState:281-313` seq derive | KV `INDEX_KEY` RMW + per-entry `SET NX` hints at `ledger.ts:12-22`; serialized by `harvest-single-writer` (R1) so hot race window = TTL expiry only |
| `datastore-seam-single-writer` | `store.ts:28-57 MemoryStore.m` + `store.ts:60-126 KvRestStore.call:68-95` + `setDataStoreForTests:192-194` | No concurrent `call` pipeline (`store.ts:64-67` pipeline rejection documented); batching means concurrent `Promise.all(keys.map(getMany)):108-109` |
| `dedupe-index-single-writer` | `dedupe-persist.ts:17 writeQueue` `saveDedupeIndex:60-75` + `persistDedupeFromResult:100-104` at `harvest.ts:230` | Serialized `writeQueue.then` global lock `ponytail: ceiling` |
| `proof-bundle-single-writer` | `proof-bundle.ts:42-55 persistProofBundle` `put("discovery:proof:bundle")` + `state/production-harvest-proof.json` `writeFileSync` at `harvest.ts:237-247` wiring | Last-write-wins KV key (no index contention) + file `mkdirSync+writeFileSync` try/catch `EROFS` swallow |
| `vault-state-single-writer` | `scripts/vault-sync.mjs:16-44` `git worktree add --detach HEAD` + `state/vault-notes.json:42` + `state/*.json` commits of bundle/ledger/dedupe | `AGENTS.md:15-18 never bare import/export`, `node scripts/vault-sync.mjs --check` at `ci.yml:35-50`, explicit `git add <paths>` at `AGENTS.md:21-23` |

Staging hygiene `git add <paths>` only, never `git add -A` (`AGENTS.md:21-23`). Parallel `vault/journal/**` lanes remain disjoint per session via file-per-session at `vault/CHARTER.md:27` — `state/production-harvest-proof.json` is outside vault so does not poison journal determinism but follows same explicit-add discipline.

---

## AD-33 — Risk register delta (HOLD frontier)

- Process-local vs KV deadlock/TTL slip: tracked as AD-26 risk → mitigate via 120s TTL + holder-guarded DEL + `HARVEST_NODE_POLL_BUDGET` at `harvest.ts:166-172` bound.
- Ledger index race + orphan dirty: tracked as AD-27 → per-entry `SET NX` hint + lazy heal on tail read + 500-window O(500) ceiling.
- KV vs Memory split-brain + ROFS file fork: cross-cut `store.ts:136-180` fallback shadow + `dedupe-persist.ts:70` EROFS warn — `AD-27`/`AD-29` keep KV-first + file best-effort pattern (`keys.ts:50` `DISCOVERY_DEDUPE_INDEX_KEY` already KV-truth, file seed fallback at `dedupe-persist.ts:28-47`).
- Persist-before-done ordering: `harvest.ts:214-247` await chain — R3 test enforces `appendTs < dedupeTs < doneTs`.
- Proof bundle vault determinism / staging poison: AD-29 — explicit `git add state/production-harvest-proof.json` + `vault-sync` discipline; bundle `ledgerDigest` cmp validates reproducibility like `vault-sync.mjs:31 Buffer.equals`.
- M1–M8 scope creep: AD-30 FOG gate — ADR-only until `CONTEXT.md` + owner loop.

---

## ADR deltas / self-approve summary

| Decision | Self-approve | Next step |
|---|---|---|
| AD-26 R1 KV lock | **TRUE** (reversible, `Self-approve: Yes` at `grilling-HOLD.md:24`) | worker adds `store.setIfAbsent` + `harvest-lock.ts` + `executeJob` wire + `MemoryStore` concurrent test |
| AD-27 R2 ledger heal | **TRUE** (`grilling-HOLD.md:39` MV local reversible) | extend `ledger.ts` per-entry hint + tail orphan prune, 50-concurrent + orphan-inject tests |
| AD-28 R3 tests | **TRUE** (`grilling-HOLD.md:52` non-invasive tests) | add `tests/discovery/hold-r3.test.ts` 3 cases via `MemoryStore` |
| AD-29 R4 proof bundle KV+file | **TRUE for MV bundle · HITL for live daemon/deploy** (`grilling-HOLD.md:65` reversible small, but `R4:5 hitl:true` for `daemonVerified/productionDeploymentVerified` at `R4:27-32`) | add `proof-bundle.ts` + `executeJob:237` wire + `GET /proof` + `.autoforge/validation/ops-loop-evidence-live.json` bundle; live `launchctl` + deploy capture HITL |
| AD-30 M1–M8 agentic | **FALSE — HITL/FOG** (`grilling-HOLD.md:74`) | owner domain-model + ADR phase; no code |

**Overall 3.5/5 self-approved for HOLD MV (R1–R3 true, R4 true for MV bundle / HITL for live capture, M1–M8 false).** No new ADR beyond this decision log unless owner requests formal `docs/adr/NNNN-harvest-lock-orphan-recovery-proof-bundle.md` — auto-forge decision log + `grilling-HOLD.md` self-approve flags are sufficient for reversible MV per pony ladder.

---
Acceptance: boundaries per R at §2 of report-HOLD, interfaces at §5 of report-HOLD, ledger race + process-local vs KV + proof bundle + dedup risks (§7 tables), ponytail ceilings named (`harvest:lock 120s TTL global` at `store.ts:60 HARVEST_LOCK:104`, `ledger slice(-500) O(500) + SET NX hint + lazy heal :25,36`, `dedupe writeQueue:17`, `proof single last-write-wins KV key + file mirror`), least-privilege cited (`vault/CHARTER.md:62-74`, `AGENTS.md:15-23`, `store.ts:9-14,16-26,28-126`, `jobs.ts:41-371`), self-approve flags per R where reversible KV lock NX TTL, ledger tail monotonic, tests, proof bundle.
