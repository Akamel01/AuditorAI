# Plan — HOLD Frontier R1–R4 (self-approving MV, daemon HITL deferred)

**Scope:** planning-only — no implementation dispatched. Concrete, modular, dependency-aware, testable, traceable. Ponytail ladder enforced; vault determinism guard retained. Model budget 80k tok (inherit `opencode/muse-spark-1.2-contributor-free` 1M*0.30 capped — `report-HOLD.md:5`).

**Sources pinned (verbatim / summarized):**
- `.autoforge/discovery/tracker-index.md:3-20` R1–R4 BLOCKED verbatim (4 lines) — see §1 reconciliation; R5–R15,R19 OPEN + R16–R18 FOG out-of-lane for this HOLD
- `.autoforge/requirements/grilling-HOLD.md:10-67` R1–R4 MV sections verbatim (57 lines) — each `Self-approve: Yes` at `:24,:39,:52,:65` with `Gate: HITL/FOG if KV gateway not available` at `:25,:40,:53,:65` + M1–M8 `HITL/FOG` at `:74`
- `.autoforge/architecture/report-HOLD.md:1-373` seams (`DataStore store.ts:16-26,28-57,60-126`, `Job store jobs.ts:41-42`, `Harvest harvest.ts:99-105 HARVEST_LOCK + 106-256 executeJob`, `Ledger ledger.ts:4-40`, `Dedupe dedupe-persist.ts:12-109`, `Single-writer single-writer.ts:7-17`), boundaries §2, alternatives §3, interfaces §5, locks §6, ponytail ceilings
- `.autoforge/architecture/decisions-HOLD.md:1-163` AD-26..AD-33 (AD-26 R1 TRUE, AD-27 R2 TRUE, AD-28 R3 TRUE, AD-29 R4 TRUE MV / HITL live, AD-30 M1–M8 FALSE HITL/FOG, AD-31 seam depth, AD-32 locks, AD-33 risks)
- `workflow/wayfinder/maps/ops-residual/MAP.md:41-45` tickets R1–R4 + `MAP.md:9 local-markdown only ops-residual`, `MAP.md:14 no new deps`, `MAP.md:15 staging hygiene`, `MAP.md:16-17 process-local harvest lock + best-effort KV mirror accepted ceilings`
- `workflow/wayfinder/maps/ops-residual/tickets/R1-cross-instance-harvest-lock.md:1-40` `blocked_by:[] hitl:false status:open` + `R2-ledger-improve-indexing.md:1-35` `[] hitl:false` + `R3-regression-tests.md:1-37` `[] hitl:false` + `R4-production-harvest-proof.md:1-36` `[] hitl:true`
- Existing code seams cited per ticket: `src/lib/persistence/store.ts:16-26,28-57,60-126,130-181,183-194`, `src/discovery/harvest.ts:99-105,106-256,214-247,258-334,336-429`, `src/discovery/ledger.ts:4-40`, `src/discovery/jobs.ts:41-42,64-66,94-371`, `src/discovery/dedupe-persist.ts:12-109`, `src/lib/persistence/single-writer.ts:7-17`
- Prior execution `.autoforge/execution/work-order-remaining.json:1-468` lock context for gauge reuse (vault-state-single-writer, harvest-single-writer, job-index-single-writer, dedupe-index-single-writer, wayfinder-compile, etc.)

**Blocked_by:** grilling-HOLD done → architect-HOLD done (report-HOLD + decisions-HOLD AD-26..33) → **this plan**. No dispatch before `node scripts/vault-sync.mjs --check` baseline green. Skills: `codebase-design`, `wayfinder` only if frontier >10 (not here; keep hand-edited per AD-31), `lean-build`, `verify-and-stop`.

---

## 1. Tracker and status reconciliation (MUST cover all — one module per frontier ticket where self-approving)

| # | Tracker-index line (verbatim) | Frontier ticket (canonical) | State in code / decisions | Plan disposition |
|---|---|---|---|---|
| 1 | `R1 — Cross-instance harvest lock via Vercel KV atomic SET NX` at `tracker-index.md:3` `Status: BLOCKED` `Citations: MAP.md:41-42` | `workflow/wayfinder/maps/ops-residual/tickets/R1-cross-instance-harvest-lock.md:1-40` `type:task hitl:false status:open blocked_by:[]` + `grilling-HOLD.md:10-26` MV 6 steps + `report-HOLD.md:28-30` delta + `decisions-HOLD.md AD-26` | `harvest.ts:99-105` bool only; `store.ts:60-126` no `SET NX EX` helper, no `harvest:lock` key anywhere (`grep harvest:lock` zero per report §1) | **M-R1** — self-approving (AD-26 TRUE) |
| 2 | `R2 — Ledger KV ordering + orphan-key recovery` at `tracker-index.md:7` `BLOCKED` `MAP.md:42-43` | `R2-ledger-improve-indexing.md:1-35` `open [] hitl:false` + `grilling-HOLD.md:28-41` + `report-HOLD.md:30-31` + `AD-27` | `ledger.ts:11-26` RMW `INDEX_KEY` loses concurrent, `getLedgerTailKV:36` filters nulls but leaves index dirty, no sweep per §1 delta | **M-R2** — self-approving (AD-27 TRUE) |
| 3 | `R3 — Regression tests for in-process lock + callback dedup` at `tracker-index.md:13` `BLOCKED` `MAP.md:43-44` | `R3-regression-tests.md:1-37` `open [] hitl:false` + `grilling-HOLD.md:43-54` + `report-HOLD.md:32` + `AD-28` | No `tests/*harvest*.test*` covering `HARVEST_LOCK` busy path or `appendLedgerKV→setJobDone` ordering per delta | **M-R3** — self-approving (AD-28 TRUE) |
| 4 | `R4 — Production harvest proof bundle (Vercel KV + daemon)` at `tracker-index.md:18` `BLOCKED` `MAP.md:44-45` | `R4-production-harvest-proof.md:1-36` `open [] hitl:true` + `grilling-HOLD.md:56-67` + `report-HOLD.md:33` + `AD-29` | `ledgerGrowth.verified:false` per `R4:21`; no `state/production-harvest-proof.json` produced; no digest manifest per delta | **M-R4** — self-approving **bundle only** (AD-29 TRUE for MV) — **daemon HITL deferred** (live `launchctl` + deploy capture `hitl:true` per `R4:5` + `AD-29 HITL for live`) |
| 5 | `R5 — Stop/Cancel server endpoint …` at `:23` | `R5-server-cancel.md` | `OPEN` — out-of-lane | **OUT OF LANE** — in `work-order-remaining.json` M-R5 (self-approving remaining frontier) |
| 6 | `R6 — Pagination …` at `:28` | `R6-pagination-trim.md` | `OPEN` | **OUT OF LANE** — M-R6 |
| 7 | `R7 — Refresh parity …` at `:33` | `R7-refresh-parity.md` | `OPEN` | **OUT OF LANE** — M-R7 |
| 8 | `R8 — Health route …` at `:38` | `R8-harvest-health-route.md` | `OPEN DEFERRED AD-14` | **OUT OF LANE** — deferred |
| 9 | `R9 — Discovery doctor …` at `:43` | `R9-discovery-doctor-json.md` | `OPEN` | **OUT OF LANE** — M-R9 |
| 10 | `R10 — state/dedupe-index.json …` at `:48` | `R10-dedupe-write-authority.md` | `OPEN` | **OUT OF LANE** — M-R10 |
| 11 | `R11 — Hardening: drop speculative …` at `:53` | `R11-drop-stale-comments.md` | `OPEN` | **OUT OF LANE** — M-R11 |
| 12 | `R12 — AutoForge staging …` at `:58` | `R12-autoforge-storage-policy.md` | `OPEN DEFERRED AD-18` | **OUT OF LANE** |
| 13 | `R13 — Eval gate §2 freshness …` at `:62` | `R13-eval-gate-freshness.md` | `OPEN DEFERRED AD-19` | **OUT OF LANE** |
| 14 | `R14 — Tier-1 archive …` at `:67` | `R14-tier1-housekeeping.md` | `OPEN DEFERRED AD-20` | **OUT OF LANE** |
| 15 | `R15 — README + CONTRIBUTING …` at `:72` | `R15-docs-production-deploy-refresh.md` | `OPEN` | **OUT OF LANE** — M-R15 |
| 16-18 | `R16 Brave quota … FOG` at `:78` `R17 Evidence reconciliation … FOG` at `:82` `R18 Bento … FOG` at `:87` | `R16/R17/R18` | `FOG` | **OUT OF SCOPE** (triaged 2026-08-31) |
| 19 | `R19 — Wayfinder plumbing …` at `:93` | `R19-wayfinder-plumbing-traceability.md` | `OPEN` | **OUT OF LANE** — M-R19 |
| M1–M8 | `M1 Quote-bearing …` at `:103-140` `BLOCKED` | `grilling-HOLD.md:69-76` + `decisions-HOLD.md AD-30` | `M1–M8 BLOCKED HITL/FOG` | **DEFERRED — no code** per AD-30 (owner domain-model + ADRs before `DataStore` third adapter etc.) |

**Counting proof:** `tracker-index.md:3-20` contains 4 BLOCKED lines (R1,R2,R3,R4) + 12 OPEN (R5,R6,R7,R8,R9,R10,R11,R12,R13,R14,R15,R19) + 3 FOG (R16,R17,R18) + 8 M1–M8 BLOCKED = 27 total. Discovery `tracker-index.md:3-20` maps same 4. This plan enumerates **4 self-approving modules** (R1,R2,R3,R4-bundle) = `4 BLOCKED HOLD frontier where MV reversible` per `grilling-HOLD.md:24,39,52,65` + `AD-26..AD-29 TRUE` (R4 true for bundle, HITL for daemon). No merge: distinct operational domains (distributed lock vs ledger ordering vs regression tests vs proof bundle); dedup would fail per `report-HOLD.md §1 map-ownership` + `MAP.md:14` reuse-seam rule — each hides different mutable key (`harvest:lock` vs `INDEX_KEY` vs test surface vs `discovery:proof:bundle`). First-item-only (only R1) would be **failure** per instructions.

**Shared-state note:** R1,R2 share `DataStore` seam but distinct files (`store.ts:setIfAbsent` vs `ledger.ts:4-40 INDEX_KEY`); R1+R4 share `src/discovery/harvest.ts` lock site (`HARVEST_LOCK:104` → KV wire at `:118-157` vs `setJobDone` tail at `:237-247`); R3 touches only tests; R4 owns `proof-bundle.ts` + `state/production-harvest-proof.json` file mirror. Each `touches: [globs]` below captures hazard for DAG guard. `vault-state-single-writer` retained for `state/production-harvest-proof.json` commit via `vault-sync` discipline even though not `state/vault-notes.json` (see §2).

---

## 2. Global execution guardrails

| Guardrail | Enforcement | Cite |
|---|---|---|
| **Vault determinism (HEAD worktree only)** | Never `node scripts/vault-import.mjs` / `vault-export.mjs` bare before commit. Only `node scripts/vault-sync.mjs` (sync) or `node scripts/vault-sync.mjs --check` (CI). Pre-flight before any `state/**` commit including `state/production-harvest-proof.json` + `state/discovery-ledger.json`. | `AGENTS.md:15-18` `scripts/vault-sync.mjs:16-44` `report-HOLD.md §1 seam inventory` `decisions-HOLD.md AD-32 vault-state-single-writer` |
| **Byte-identical registries → views** | `state/vault-notes.json` sorted `path.localeCompare` at `vault-import.mjs:79`; views `source_hash: sha12` at `vault-export.mjs:14-16`; CI `git diff --exit-code -- vault/views state/vault-notes.json` | `vault-export.mjs:14-16,45-48` `.github/workflows/ci.yml:35-50` |
| **Staging hygiene** | Explicit `git add <paths>` only; never `git add -A` (foreign lane journals/wayfinder maps poison). Each module lists exact `git add` set including `state/production-harvest-proof.json` when that file is touched. | `AGENTS.md:21-23` `MAP.md:15` `decisions-HOLD.md AD-32` |
| **Ponytail ladder** | Reuse `DataStore` seam `store.ts:16-26` + `MemoryStore` for tests via `setDataStoreForTests`, stdlib `fs/path/crypto`, `withPersistenceSingleWriter`; no new deps, no generic facades, no pipeline-form bodies per `store.ts:64-67`. | `decisions-HOLD.md AD-26..AD-29 ponytail ceilings` `report-HOLD.md §3 alternatives` |
| **Single-writer locks** | See §5 locks table; any `state/**`, `harvest.ts`, `ledger.ts` `INDEX_KEY`, `proof bundle` serialize | `decisions-HOLD.md AD-32` `report-HOLD.md §6` |
| **Frozen doctrine** | `docs/validation/eval-gates.md` thresholds frozen; `TRACKER.md:17` markdown canonical for ops-residual | `AGENTS.md:eval gates` |
| **Vault-state-single-writer (retained)** | Even though HOLD is not vault-prose, any writer of `state/production-harvest-proof.json` or `state/discovery-ledger.json` or `state/vault-notes.json` or `vault/views/**` or `.autoforge/discovery/tracker-index.md` must serialize under `vault-state-single-writer`; M-R4 bundle produces `state/production-harvest-proof.json` so it holds that analog guard via `proof-bundle-single-writer` + `vault-state-single-writer` together; none of R1-R3 write `state/vault-notes.json` directly, but `vault-sync --check` still runs before handoff | `scripts/vault-sync.mjs:16-44` `vault/CHARTER.md:19-20` `work-order-remaining.json:resource_locks.vault-state-single-writer` |

---

## 3. Phases — seam extensions → wiring → tests → bundle → gates

```
Phase 0 — Baseline (gated):  node scripts/vault-sync.mjs --check  →  green? ──no──▶ vault-sync, commit
                              │
Phase P — Pure code, disjoint touches (parallel_safe where files differ):
                              ├──► M-R1-seam  DataStore.setIfAbsent + harvest-lock.ts module (store.ts + new file)
                              ├──► M-R2-heal  ledger.ts index-entry hint + orphan prune (ledger.ts)
                              ├──► M-R3-tests regression tests (tests/discovery/hold-r3.test.ts)
                              └──► M-R4-module proof-bundle.ts builder (proof-bundle.ts new file)
                              │         (dispatch same turn if touches disjoint; intersecting file = sequential)
                              ▼
Phase S — Single-writer wiring (serialize per seam — blocked_by [] but hazard-guarded):
                              ├──► M-R1-wire  executeJob acquire/release in harvest.ts (harvest-single-writer)
                              ├──► M-R4-wire  persistProofBundle after setJobDone in harvest.ts (same harvest-single-writer → serialize with R1-wire)
                              │         (ledger.ts heal already lands in P; harvest.ts writers must not overlap same commit lane)
                              ▼
Phase G — Proof gates:  npm run lint && npm run typecheck && npm run test (vitest holds R3 + R1/R2) && npm run build && node scripts/vault-sync.mjs --check
                              │
Phase H — HITL deferred (no worker code): M1–M8 (AD-30 FOG) + R4 live daemon/deploy evidence (.autoforge/validation/ops-loop-evidence-live.json)
```

Phase separation respects: **module boundary ≠ child-session boundary** — modules are independent units of planning/review/testability; execution may batch disjoint-touch modules in one parallel `Task` turn. Ponytail: no extra phase for ADR/charter amendment (deferred until owner asks `CHARTER.md:82-85`). M1–M8 stay `BLOCKED HITL/FOG` until domain-model + ADRs.

---

## 4. Modules — objective, inputs/outputs, touches, dependencies, acceptance, skills, agent

### M-R1 — Cross-instance harvest lock via Vercel KV atomic SET NX — FRONTIER — self-approving (AD-26 TRUE)

- **Objective:** Replace process-local `HARVEST_LOCK:104` single-instance ceiling with KV-distributed `SET NX EX` lock `harvest:lock` per workspace, TTL-guarded, holder-scoped, reversible. Keep `HARVEST_LOCK` as in-process fast-path fallback when KV absent. Ponytail: global `harvest:lock` 120s TTL is ceiling; per-cell locks (`MAP.md:30`) + heartbeat deferred until measured.
- **Inputs:** `src/lib/persistence/store.ts:16-26 DataStore interface + 28-57 MemoryStore + 60-126 KvRestStore.call:68-95 5s abort at :70-71 + 130-181 fallback wrapper` + `src/discovery/harvest.ts:99-105 HARVEST_LOCK + 106-256 executeJob:118-130 cancel check, 140-149 busy→setJobError, 252-255 finally, 166-172 HARVEST_NODE_POLL_BUDGET` + `MAP.md:41-42` + `R1-cross-instance-harvest-lock.md:19-27` + `grilling-HOLD.md:17-24`.
- **Outputs:** `DataStore.setIfAbsent(key,value,ttlSec):Promise<boolean>` optional on seam; `KvRestStore` calls `["SET",key,val,"NX","EX",ttl]` via `call` at `store.ts:68-99` style, returns `json.result==="OK"`; `MemoryStore` in-map check with `setTimeout ttl*1000).unref()`; `src/discovery/harvest-lock.ts` new deep module ≤40 lines exposing `HARVEST_LOCK_KEY="harvest:lock"` + `acquireHarvestLock(store?,ttlSec=120,holder?=randomUUID):Promise<{acquired:boolean,release:()=>Promise<void>}>` with WARN fallback `WARN harvest lock: KV unavailable, using process-local guard` per `R1 AC:32` on `StoreUnavailableError:9-14` or `!setIfAbsent`. Wire `executeJob` acquire after cancel check `:118-130` before `setJobRunning("D01-DISCOVER")` at `:157` — `if(!acquired) await setJobError(jobId,"harvest is already running",store); return;` then `try{…} finally{await release(); HARVEST_LOCK=false;}` holder-guarded `DEL` only if `get(KEY)===holder`.
- **touches:** [`src/lib/persistence/store.ts`, `src/discovery/harvest-lock.ts`, `src/discovery/harvest.ts`]
- **hazard_touches:** [`src/lib/persistence/store.ts`, `src/discovery/harvest.ts`] — intersects M-R4-wire (`harvest.ts`) → sequential; `store.ts` disjoint from ledger/proof/tests.
- **blocked_by:** [] — frontier root per `R1-cross-instance-harvest-lock.md:8` + `report-HOLD.md §6 blocked_by:[]`; **hazard recommends landing before R2's strong concurrency test** (R2 50-append race shrinks to TTL-expiry window only when R1 serializes), but not semantic block — scheduler may parallel with R2-heal/R3.
- **Locks:** `datastore-seam-single-writer` (extends `DataStore` seam — one `SET NX EX` literal reuse) + `harvest-single-writer` (executeJob path `118-157` acquire + `252-255` release).
- **Wave:** P for seam+module, S for wire — **sequential with M-R4-wire on harvest.ts**.
- **Acceptance (testable):**
  - [ ] `store.ts:16-26` shows `setIfAbsent?(key:string,value:string,ttlSec:number):Promise<boolean>`; `KvRestStore` impl at `60-126` calls `this.call(["SET",key,val,"NX","EX",String(ttl)])` and `return json.result==="OK"`; `MemoryStore` impl at `28-57` does `if(m.has(key)) return false; m.set(key,val); if(ttl) setTimeout(()=>m.delete(key),ttl*1000).unref?.(); return true;`
  - [ ] `src/discovery/harvest-lock.ts` exists ≤40 lines, exports `HARVEST_LOCK_KEY` and `acquireHarvestLock`; fallback path emits single `WARN harvest lock: KV unavailable…` when `StoreUnavailableError` or `!KV_REST_API_URL/TOKEN` at `store.ts:131-133`.
  - [ ] `harvest.ts:106-256` diff shows `const lock=await acquireHarvestLock(store,120)` after `getJob cancelled` check (`:118-130`) before `setJobRunning` (`:157`); `if(!lock.acquired){await setJobError(jobId,"harvest is already running",store); return;}` at `:143` path; `finally{await lock.release();}` replacing plain `HARVEST_LOCK=false`.
  - [ ] Tests via `MemoryStore` concurrent `await Promise.all([acquireHarvestLock(m,120,"h1"), acquireHarvestLock(m,120,"h2")])` → exactly one `true` one `false`; third after `release()` succeeds — covers `R1 AC:30-31`.
  - [ ] `executeJob` busy path does not throw; second call's job `getJob(id2,store).error.includes("already running")` per `R1:35`.
  - [ ] Rollback proof: deleting `harvest-lock.ts` + `store.ts:setIfAbsent` + call site returns to `HARVEST_LOCK:104` only with no other drift.
  - [ ] Staging: `git add src/lib/persistence/store.ts src/discovery/harvest-lock.ts src/discovery/harvest.ts` only — never `git add -A`.
- **Skills/tools/tests:** `lean-build` (reuse DataStore seam, `crypto.randomUUID` stdlib), `codebase-design` (deep module), `tdd` via `MemoryStore` + `vitest`.
- **Agent role:** `autoforge-worker (surgical — seam + narrow wire)` — **Reviewer:** `autoforge-reviewer` checks `SET NX EX` atomicity (no `GET→PUT` race), TTL 120 vs `HARVEST_NODE_POLL_BUDGET` bound doc, holder guard on DEL, no new env/secret, ponytail ceiling comment kept.
- **Ponytail:** One `setIfAbsent` helper + one `acquireHarvestLock` fn is the lazy fix. Skipped `GET→PUT` non-atomic, `INCR harvest:seq` allocator (speculative per `report-HOLD.md §3.1`), per-cell locks. `ponytail: global harvest:lock 120s TTL ceiling; per-cell locks deferred`.
- **Self-approve:** **TRUE** — MV minimal wiring under KV lock is reversible; no code-paths removed; revert by deletion per `grilling-HOLD.md:24` + `decisions-HOLD.md AD-26 Self-approve TRUE`. HITL only if KV gateway absent or cross-region timing hazards per `:25`.
- **Self-approve grilling session:** Not required — reversible seam extension; if 1-question grilling (confirm TTL 120 acceptable) → **APPROVE** per legend `Self-approve: Yes` + `Gate: HITL/FOG if KV gateway not available`.

### M-R2 — Ledger KV ordering + orphan-key recovery — FRONTIER — self-approving (AD-27 TRUE)

- **Objective:** Make `appendLedgerKV` + `getLedgerTailKV` monotonic under concurrent KV writers and self-heal `INDEX_KEY` when per-entry keys are gone. Keep signatures unchanged (`appendLedgerKV(entries,store?)`, `getLedgerTailKV(limit,store?)` at `ledger.ts:8,28`), keep `slice(-500)` window, no pipeline-form bodies per `store.ts:64-67`.
- **Inputs:** `src/discovery/ledger.ts:4-40` + `store.ts:16-26,60-126` `keys` at `:112-114` `getMany` at `:108-109` + `grilling-HOLD.md:28-41` + `R2-ledger-improve-indexing.md:19-30` + `report-HOLD.md §3.2` + `AD-27` + `harvest.ts:281-289 tailLast vs file lastSeq`.
- **Outputs:** Write: per-entry `s.put(entryKey(seq),e)` at `:16` + `await s.setIfAbsent?.("discovery:ledger:index-entry:"+e.seq,"1",30*24*3600).catch(()=>{})` dedup hint (30d TTL) then rebuild `INDEX_KEY="discovery:ledger:index"` at `:5` via `const existing=await s.get<number[]>(INDEX_KEY)??[]; merge where !includes, sort, slice(-500), put`. Read: after `getMany` at `:34-36`, `orphanSeqs=tailSeqs.filter((_,i)=>vals[i]===null)` then `if(orphans.length){ cleaned=idx.filter(s=>!orphanSet.has(s)); await withPersistenceSingleWriter(async()=>await s.put(INDEX_KEY,cleaned.slice(-500))).catch(()=>{}) }` best-effort at `single-writer.ts:7-17` returning `{entries:filtered,total:cleaned.length}`. Never throws — `catch→{entries:[],total:0}` at `:39` preserved.
- **touches:** [`src/discovery/ledger.ts`, `src/lib/persistence/single-writer.ts`]
- **hazard_touches:** [`src/discovery/ledger.ts`] — intersects no other HOLD file except via `harvest.ts:281-289` seq derive (read-only) — can parallel with M-R1 seam/M-R4 module/M-R3 tests; `INDEX_KEY` RMW serialize internally via `discovery-ledger-index-single-writer`.
- **blocked_by:** [] — root `R2:8`; **recommend landing after M-R1 wire for strongest 50-concurrent test** (R1 lock is primary race fix), but MV still valid without R1 — degradation is higher orphan rate which tail prune exposes, so no semantic block; hazard-only.
- **Locks:** `discovery-ledger-index-single-writer` (`INDEX_KEY` at `:5` + `ENTRY_PREFIX` at `:4` + `discovery:ledger:index-entry:*` hints; O(500) scan ceiling) + `vault-state-single-writer` analog for future `state/discovery-ledger.json` file mirror if healed.
- **Wave:** P — **parallel_safe: true** with M-R1-seam/M-R4-module/M-R3 (disjoint files); may also parallel M-R1-wire if ledger heal lands before wire, but S wire serialization is only on `harvest.ts` so no conflict.
- **Acceptance (testable):**
  - [ ] `ledger.ts:8-26` shows per-entry `setIfAbsent` hint and `INDEX_KEY` merge+sort+slice(-500) (not just `put` entries); uses `Promise.all` per-key `put` not `[[..],[..]]` pipeline per `store.ts:64-67`.
  - [ ] `ledger.ts:28-39` shows `vals.filter(v!==null)` kept plus `orphanSeqs` collect + `idx.filter(!orphanSet)` + `put(INDEX_KEY,cleaned)` best-effort heal (no throw).
  - [ ] Simulated 50 concurrent `appendLedgerKV` via `MemoryStore` interleaved `Promise.all` — `getLedgerTailKV(100,store).entries.map(e=>e.seq)` contains all 50 unique, no dups, sorted — covers `R2 AC:28`.
  - [ ] Injected orphan by `s.del(entryKey(3))` without `INDEX_KEY` edit → `getLedgerTailKV(20,store)` drops seq 3 and `await s.get<number[]>(INDEX_KEY)` no longer contains 3 — covers `R2 AC:29`.
  - [ ] `tests/domain/discovery-harvest.test.ts` continues to pass with no new mocks when KV env absent (store seam hermetic).
  - [ ] Staging: `git add src/discovery/ledger.ts src/lib/persistence/single-writer.ts` only.
- **Skills/tools/tests:** `lean-build` (reuse `DataStore` seam), `codebase-design` (keep signatures small), `tdd` via `MemoryStore` concurrent harness.
- **Agent role:** `autoforge-worker` — **Reviewer:** `autoforge-reviewer` verifies orphan heal not via pipeline CAS (keeps `store.ts:64-67` rejection doc), `slice(-500)` preserved, `withPersistenceSingleWriter` in-process guard not cross-instance, ponytail ceilings named.
- **Ponytail:** Per-entry `SET NX` hint + lazy orphan heal on tail read is ceiling; full `KEYS` rebuild via `keys("discovery:ledger:entry:")` O(500) deferred until orphan rate >1% measurable. `ponytail: filter+heal on read is ceiling; full tail rebuild deferred`.
- **Self-approve:** **TRUE** — MV local to ledger-persist path, reversible by reverting `ledger.ts:4-40` per `grilling-HOLD.md:39` + `AD-27 TRUE`. HITL only if orphan recovery risks corrupting ledger or tail needs schema migration per `:40`.
- **Self-approve grilling session:** Not required — reversible where KV avalable; if 1-q (confirm 500-window stays) → **APPROVE**.

### M-R3 — Regression tests for in-process lock + callback dedup — FRONTIER — self-approving (AD-28 TRUE)

- **Objective:** Prove busy-harvest, callback dedup, and persist-before-done ordering without new harness or KV env, via `MemoryStore` hermetic. One file covers three concerns per ponytail test rule.
- **Inputs:** `src/discovery/harvest.ts:99-105,118-149,214-247,252-255` + `src/discovery/jobs.ts:369 setJobError + 223-274 listJobs` + `src/discovery/dedupe-persist.ts:77-109 persistDedupeFromResult` + `src/discovery/dedupe.ts:39-79 checkDuplicate/claimFingerprints + 81-84 bundleTextKey` + `src/lib/persistence/store.ts:28-57 MemoryStore + 192-194 setDataStoreForTests` + `package.json:14 vitest` + `grilling-HOLD.md:43-54` + `R3-regression-tests.md:19-33` + `decisions-HOLD.md AD-28`.
- **Outputs:** `tests/discovery/hold-r3.test.ts` (new) via `MemoryStore` + `setDataStoreForTests(null)` isolation:
  - Busy lock: `Promise.all([executeJob(id1,ctx,ids,iso,{store}), executeJob(id2,ctx,ids,iso,{store})])` with trivial `runDiscoveryNode` stub — asserts one `getJob(...).status==="done"` or error and the other `status==="error" && error.includes("already running")` at `harvest.ts:143` plus `HARVEST_LOCK:104` reset at `:252-255` (and when R1 ships swaps to `acquireHarvestLock(store)` concurrent pair one `true` one `false`).
  - Callback dedup: `checkDuplicate` + `claimFingerprints` + `persistDedupeFromResult` with identical `doc.sha256` and `extraction.text_sha256` → second `checkDuplicate` returns `{status:"duplicate"}` via `shaHit` at `dedupe.ts:59` or `near_dup` via `textHit` at `:60`, only one `clusters` entry at `:76-78`.
  - Ordering: spy wrappers recording `Date.now()` before delegate for `appendLedgerKV:8` and `persistDedupeFromResult:77` and `setJobDone:365` at `harvest.ts:214-247` → `t_append < t_dedupe < t_done` (done is last at `:237`); `VITEST!==true` guard at `harvest.ts:215` preserves FS-skip.
- **touches:** [`tests/discovery/hold-r3.test.ts`, `src/discovery/harvest.ts` (read-only reference), `src/discovery/dedupe-persist.ts` (read-only), `src/discovery/ledger.ts` (read-only)]
- **hazard_touches:** [] — tests are file-only, hermetic `MemoryStore.m Map` at `store.ts:30` isolated; no prod file write.
- **blocked_by:** [] — root `R3:8`; independent of R1/R2 wire (strengthens when R1 ships but not blocked). Can dispatch any wave.
- **Locks:** none — hermetic per-test `setDataStoreForTests`.
- **Wave:** P — **parallel_safe: true** with all other modules (disjoint `tests/**`); may dispatch same turn as M-R1-seam/M-R2-heal/M-R4-module (three parallel Tasks ok per `plan-remaining.md` pattern).
- **Acceptance (testable):**
  - [ ] `tests/discovery/hold-r3.test.ts` exists with 3 cases; `beforeEach` does `store=new MemoryStore(); setDataStoreForTests(store)` at `store.ts:192`, `afterEach` resets to `null`.
  - [ ] `npm run test` — `vitest run tests/discovery/hold-r3.test.ts` green, repeatable, no `fetch` mocking of `KvRestStore.call:68` 5s abort, no new runner dep.
  - [ ] Coverage: concurrent lock one succeeds one busy without throw; dedup repeat shows single cluster; ordering spy `append < dedupe < done`.
  - [ ] `npm run typecheck && npm run build` green; no `state/*.json` mutation (guard via `VITEST!==true` at `harvest.ts:215`).
  - [ ] Staging: `git add tests/discovery/hold-r3.test.ts` only.
- **Skills/tools/tests:** `tdd` (MemoryStore hermetic), `lean-build` (reuse seams), `verify-and-stop`.
- **Agent role:** `autoforge-worker (test surface)` — **Reviewer:** `autoforge-reviewer` checks no `fetch` KV mock, no framework beyond `vitest`, no FS writes, ponytail test rule obeyed.
- **Ponytail:** One test file via `MemoryStore` is ceiling; dedicated harness or live KV cluster deferred until flake/throughput measured. `ponytail: one file is ceiling`.
- **Self-approve:** **TRUE** — tests are non-invasive and reversible per `grilling-HOLD.md:52` + `AD-28 TRUE`. HITL only if tests rely on KV-backed locks per `:53` (they don't — MemoryStore).
- **Self-approve grilling session:** Not required — auto **APPROVE** (tests prove existing behavior).

### M-R4 — Production harvest proof bundle (Vercel KV + file mirror, daemon HITL deferred) — FRONTIER — self-approving bundle (AD-29 TRUE MV / HITL live)

- **Objective:** Emit tamper-evident `HarvestProofBundle` after `setJobDone` at `harvest.ts:237` — single KV `put` (atomic per-key) + deterministic `state/production-harvest-proof.json` file mirror, digest via `node:crypto` at `store.ts:4`. Daemon `launchctl` + deploy id capture stays HITL manual (ticket `R4 hitl:true` + `AD-29 HITL for live` + `work-order-remaining.json deferred R4` analogue). Keep reversible via `PROOF_BUNDLE_ENABLED=0` short-circuit. Ponytail: single last-write-wins KV key is ceiling; indexed per-harvest history deferred until R17.
- **Inputs:** `src/discovery/harvest.ts:214-247 persist ordering + 258-334 persistDiscoveryState + 336-429 harvest() route`, `src/discovery/ledger.ts:28 getLedgerTailKV`, `src/discovery/dedupe-persist.ts:51-58 loadDedupeIndexAsync` + `keys.ts:50 DISCOVERY_DEDUPE_INDEX_KEY`, `src/discovery/jobs.ts:41-42 PREFIX/INDEX_KEY`, `src/lib/persistence/store.ts:9-26,60-126`, `node:crypto createHash sha256`, `health/route.ts:16 requireAdmin` pattern, `grilling-HOLD.md:56-67` + `R4-production-harvest-proof.md:19-33` + `decisions-HOLD.md AD-29` + `report-HOLD.md §2 R4`.
- **Outputs:** `src/discovery/proof-bundle.ts` new deep module ≤70 lines:
  - `HarvestProofBundle{version:"1.0.0", jobId, ranAtIso, providers:string[], ledgerDigest:string, ledgerTail:{total,entries:LedgerEntry[]}, dedupeDigest:string|null, stateDigest:string|null, capturedAt:string, manifest?:{deployId?:string, daemonSnippet?:string, env:string}}` — `ledgerDigest=sha256(JSON.stringify(entries))` via `createHash`, `dedupeDigest` from KV index doc, `stateDigest` from `state/discovery-ledger.json` file best-effort.
  - `buildProofBundle(opts:{jobId,ranAtIso,providers,store?}):Promise<Bundle>` — KV-first `getLedgerTailKV(20,store)`, digest.
  - `persistProofBundle(bundle,store?):Promise<void>` — `await s.put("discovery:proof:bundle",bundle).catch(()=>{})` + `try{mkdirSync(dirname(stateProofPath),{recursive:true}); writeFileSync("state/production-harvest-proof.json",JSON.stringify(bundle,null,2))}catch(EROFS warn per dedupe-persist.ts:70)` + `if(process.env.PROOF_BUNDLE_ENABLED==="0") return`.
  - `readProofBundle(store?):Promise<Bundle|null>` — `await s.get("discovery:proof:bundle") ?? readFileSync("state/production-harvest-proof.json")` fallback (same chain as `discovery/route.ts:15-45`).
  - Wire one line in `executeJob:237-247` after `setJobDone` at `:237` succeeds: `try{ const b=await buildProofBundle({jobId,ranAtIso,providers:providerIds,store}); await persistProofBundle(b,store);}catch(e){ await appendLog(jobId,{at:nowIso(),node:"PERSIST-WARN",message:`proof bundle skipped: ${String(e).slice(0,200)}`},store)}` — swallow like `harvest.ts:219` so `202 {jobId}` at `:426` unchanged. Optional admin-gated `GET /api/dev/discovery/proof` delegates to `readProofBundle` (same gate as `health/route.ts:16`).
  - Validation: live evidence file `.autoforge/validation/ops-loop-evidence-live.json` (per `R4:22` + `work-order-remaining.json deferred R4` same path) can be populated by `JSON.parse( bundle )` and `getLedgerTailKV` digest `cmp` equals `bundle.ledgerDigest` like `vault-sync.mjs:31 Buffer.equals`. `manifest.daemonSnippet` captures `launchctl print gui/$(id -u)/com.auditorai.discovery | grep state` at `R4:21` when `process.env.PICTURE_BOOK_DAEMON` reachable else `null` — does not block bundle emit.
- **touches:** [`src/discovery/proof-bundle.ts`, `src/discovery/harvest.ts`, `src/app/api/dev/discovery/proof/route.ts`, `state/production-harvest-proof.json`, `tests/discovery/proof-bundle.test.ts`]
- **hazard_touches:** [`src/discovery/harvest.ts`, `state/production-harvest-proof.json`, `state/discovery-ledger.json`] — intersects M-R1-wire (`harvest.ts`) → sequential on `harvest-single-writer`; `state/production-harvest-proof.json` under `state/*.json` so `vault-state-single-writer` discipline applies (explicit `git add` + `vault-sync --check`); disjoint from ledger.ts, store.ts seam helper, tests.
- **blocked_by:** [] — root `R4:8`; **hazard recommends landing after M-R1-wire** (`harvest.ts:237` wire contends same file) but semantic blocked_by stays `[]`; may parallel module-build (P) with R1-seam/R2/R3 while wire serializes later (S).
- **Locks:** `proof-bundle-single-writer` (KV `discovery:proof:bundle` last-write-wins + `state/production-harvest-proof.json` `writeFileSync` EROFS swallow) + `vault-state-single-writer` (any `state/*.json` commit) + `harvest-single-writer` (wire at `:237-247`).
- **Wave:** P for module file, S for wire — **sequential with M-R1-wire on harvest.ts**; module itself parallel_safe with M-R1-seam/M-R2/M-R3.
- **Acceptance (testable):**
  - [ ] `src/discovery/proof-bundle.ts` exists with `build/persist/readProofBundle` + `HarvestProofBundle` type `version:"1.0.0"`; uses `node:crypto createHash sha256` at `store.ts:4` reuse, no new dep; single `put("discovery:proof:bundle")` atomic per-key.
  - [ ] `harvest.ts:237-247` shows one-line wire after `setJobDone` with `try{build+persist} catch{appendLog PERSIST-WARN}`.
  - [ ] Unit test `tests/discovery/proof-bundle.test.ts` via `MemoryStore` does `await executeJob` or `buildProofBundle` then `await readProofBundle(store)` → bundle non-null, `ledgerDigest` equals `sha256(JSON.stringify(ledgerTail.entries))`, `version==="1.0.0"`, file mirror `state/production-harvest-proof.json` JSON parse valid when `NODE_ENV!=test` stubbed or `proof-bundle.test.ts` directly writes via `persistProofBundle`.
  - [ ] `PROOF_BUNDLE_ENABLED=0` short-circuits write (env guard).
  - [ ] Optional `GET /api/dev/discovery/proof` admin-gated returns bundle JSON or `404` when absent (same `requireAdmin` gate).
  - [ ] Live-proof deferred NOT in this module's DoD: `ledgerGrowth.verified / productionDeploymentVerified / daemonVerified` flipping `blocked→resolved` + `launchctl active count >0` + `ledgerGrowth before/after` at `R4:27-32` remain `HITL` per `R4-production-harvest-proof.md:5 hitl:true` — captured as `manifest.daemonSnippet` best-effort, not gate for bundle emit.
  - [ ] Staging: `git add src/discovery/proof-bundle.ts src/discovery/harvest.ts src/app/api/dev/discovery/proof/route.ts state/production-harvest-proof.json tests/discovery/proof-bundle.test.ts` only; then `node scripts/vault-sync.mjs --check` green before commit (state file discipline).
- **Skills/tools/tests:** `lean-build` (reuse DataStore + crypto), `codebase-design` (aggregator module), `tdd` via `MemoryStore`, `verify-and-stop`.
- **Agent role:** `autoforge-worker (thin aggregator + file mirror)` — **Reviewer:** `autoforge-reviewer` checks `state/production-harvest-proof.json` is **not** vault-compiled (`scripts/vault-sync.mjs:16-44` only compiles `state/vault-notes.json` + `vault/views/**` at `ci.yml:35-50` so no poison), explicit `git add` discipline, `EROFS` swallow, KV-first then file fallback chain, digest reproducibility, toggle reversibility.
- **Ponytail:** Single last-write-wins KV object + file mirror with sha256 digest is ceiling; indexed per-harvest history deferred until R17 evidence reconciliation automation demands it; no new deps. `ponytail: single KV object is ceiling`.
- **Self-approve:** **TRUE for MV bundle generation; HITL for live daemon/deploy capture** — MV small, tightly scoped, reversible (delete module+wire+artifacts) per `grilling-HOLD.md:65` + `AD-29 TRUE for MV bundle · HITL for live`. Daemon/deploy verification at `R4:27-32` stays `hitl:true` so no auto-flip to `resolved`.
- **Self-approve grilling session:** MV bundle **APPROVE** reversible; live capture **needs 1-question HITL** (confirm durable path + `launchctl` snippet available) → if live env not provided (`AGENTS.md:33` keychain + Vercel) stay HITL/FOG per `grilling-HOLD.md:65-66`.

### M1–M8 — v2/v3 agentic platform & architecture deepening — DEFERRED — no code (AD-30 FALSE HITL/FOG)

- **Objective:** Keep `BLOCKED HITL/FOG` — no sprint. Require domain-model (`CONTEXT.md` glossary, seam map) + owner loop decision before `DataStore` Postgres third adapter (`M8` third after `MemoryStore`/`KvRestStore`), vault sync-conflict UX (`M3` `CHARTER.md:62-74`), blob-storage escape hatch (`M2`), report drafting assists (`M4/M5`), audit-history retention (`M6`), RSC snapshot (`M7`), quote-bearing GF-6..10 (`M1`). Ponytail: one adapter proved hypothetical, two adapters prove seam — `M8` without domain model violates irreversibility.
- **Inputs:** `tracker-index.md:103-140` M1–M8 + `grilling-HOLD.md:69-76` + `report-HOLD.md §2 M1–M8 boundaries` + `decisions-HOLD.md AD-30` + `.autoforge/plans/plan.md:66-196` (prior M1–M8 plan context) + `work-order-remaining.json` R8/R12/R13/R14 deferred pattern.
- **Outputs:** None — ADRs `HOLD-M1..M8` stay `Status: BLOCKED — HITL/FOG gate`; no `touches`; no `blocked_by` edges emitted in this work-order; informal `docs/adr/NNNN-*.md` only if owner requests.
- **touches:** []
- **blocked_by:** N/A — not in DAG; gated by owner review.
- **Locks:** `plan-decision-single-writer` for `.autoforge/plans/**` decisions only.
- **Wave:** H — HITL gate — no worker code.
- **Acceptance:** No dispatch; plan records `AD-30 FALSE — HITL/FOG` and cites `grilling-HOLD.md:74-75` + `M1–M8 BLOCKED`.
- **Self-approve:** **FALSE — NEEDS REVIEW (HITL/FOG)** — explicit owner decisions required; delegating without domain model risks scope creep per `grilling-HOLD.md:72`.

---

## 5. Execution work order (DAG + resource serialization + waves)

**DAG (blocked_by edges — semantic ordering, not hazard locks):**

```
M-R1  (lock seam+wire)  ─┐
M-R2  (ledger heal)     ─┤ blocked_by:[] all roots — no semantic DAG edges
M-R3  (tests)           ─┤ (hazard-only serialization per report-HOLD.md §6 grilling note)
M-R4  (proof bundle)    ─┤
                         └──► no downstream blocked_by (all roots); M1–M8 not nodes (HITL/FOG)
```

- Semantic `blocked_by:[]` for all 4 per tickets `R1:8`…`R4:8` and `report-HOLD.md §6 blocked_by:[]` — none is logically blocked by another frontier ticket. Sequencing is **resource-hazard only** (same-file writes), not DAG. Deferred M1–M8 and prior remaining frontier (M-R5…M-R19) are not nodes in this HOLD lane; they become successors only after owner review / prior lane commits, hence no edges from them. `R1 before R2` is **hazard recommendation** not semantic DAG (report-HOLD §6 wave note: "R1 should land before R2 strong concurrency test (otherwise 50-concurrent still loses INDEX_KEY without lock) but R2 heal still valid even if R1 absent").

**Resource locks (single-writer guards):**

| Lock | Members in this plan | Policy | Touches that force serialization |
|---|---|---|---|
| `vault-state-single-writer` | `M-R4` (only writer of `state/production-harvest-proof.json` in this lane; `M-R1/M-R2/M-R3` don't write `state/vault-notes.json` directly) — but declared as global guard; would serialize any `state/vault-notes.json`/`vault/views/**`/`tracker-index.md`/`state/discovery-ledger.json` writer | sequential; `node scripts/vault-sync.mjs --check` before handoff; `vault-sync.mjs:16-44` HEAD worktree `git worktree add --detach ${tmp} HEAD` `:17` + symlink `node_modules` `:19` + `Buffer.equals` `:31` | `state/vault-notes.json`, `vault/views/**`, `.autoforge/discovery/tracker-index.md`, `vault/gotchas/**` settlement, `state/production-harvest-proof.json`, `state/discovery-ledger.json`, `state/discovery-jobs.json` |
| `harvest-single-writer` | `M-R1`, `M-R4` | sequential on `src/discovery/harvest.ts` `HARVEST_LOCK:104` + `finally:252` → `harvest-lock.ts SET NX EX 120` at `R1:24` | `src/discovery/harvest.ts:99-105,118-157,214-247,252-255` |
| `discovery-ledger-index-single-writer` | `M-R2` (only writer in this HOLD lane) — but declared to serialize any future `INDEX_KEY` contenders; serialized by `harvest-single-writer` (R1) so hot race window = TTL expiry only | sequential on `INDEX_KEY="discovery:ledger:index"` at `ledger.ts:5` + `ENTRY_PREFIX` entries + `discovery:ledger:index-entry:*` hints | `src/discovery/ledger.ts:4-40`, `src/lib/persistence/single-writer.ts:7-17` guard for index heal |
| `datastore-seam-single-writer` | `M-R1` (extends `store.ts:16-26`) — sole extender of `DataStore` seam in this lane; `M-R2` reads via `getMany/keys` not extending seam, so disjoint | sequential on `DataStore.setIfAbsent` addition — no concurrent `call` pipeline (`store.ts:64-67` pipeline rejection documented) | `src/lib/persistence/store.ts:16-26,28-57,60-126,130-181,192-194` |
| `dedupe-index-single-writer` | — (not in this HOLD lane; retained from `work-order-remaining.json` for gauge) | `writeQueue:17` serialized global lock `ponytail: global queue ceiling` | `src/discovery/dedupe-persist.ts:12-107,17` |
| `proof-bundle-single-writer` | `M-R4` (only writer) | last-write-wins KV `discovery:proof:bundle` + file `mkdirSync+writeFileSync` try/catch `EROFS` swallow | `src/discovery/proof-bundle.ts`, `state/production-harvest-proof.json`, KV `discovery:proof:bundle` |
| `wayfinder-compile` | — (not in this HOLD lane) | `readdirSync` sorted at `tickets.ts:141,151` deterministic | `src/wayfinder/**`, `workflow/wayfinder/maps/**`, `scripts/wayfinder-tickets.ts` |
| `docs-single-writer` | — (not in this HOLD lane) | text-only | `README.md`, `CONTRIBUTING.md`, `docs/**` |
| `plan-decision-single-writer` | `M1–M8` deferred | no code, decisions.md only | `.autoforge/plans/**`, `.autoforge/architecture/**` |

Staging hygiene `git add <paths>` only, never `git add -A` (`AGENTS.md:21-23`). Parallel `vault/journal/**` lanes apply only to vault frontier lane, not HOLD, but same rule keeps `workflow/wayfinder/**` edits disjoint per ticket file.

**Waves (= parallel groups):**

| Wave | Members | Parallel? | Guard / rationale |
|---|---|---|---|
| **P — pure code, disjoint touches** | `M-R1-seam` (`store.ts` + `harvest-lock.ts`), `M-R2-heal` (`ledger.ts`), `M-R3-tests` (`tests/**`), `M-R4-module` (`proof-bundle.ts`) | **parallel_safe: true** *within P if touches disjoint* | distinct files (`store.ts` shows `setIfAbsent` vs `ledger.ts:4-40` vs `proof-bundle.ts` new vs `tests/discovery/hold-r3.test.ts`) — no same-file writers per `report-HOLD.md §6 P wave` |
| **S — single-writer serialize** | `M-R1-wire` + `M-R4-wire` (both touch `harvest.ts:106-256`) + `M-R2-ledger` already in P | **serialize per file** — `harvest.ts:99-105,118-157,214-247` wiring for R1 acquire before `D00-QUEUED` at `:140-157` and R4 `persistProofBundle` after `setJobDone` at `:237` both touch `harvest.ts` so must not overlap in same commit lane; `ledger.ts:8-26` index rebuild can run parallel with harvest wire (different file) | `harvest-single-writer` for `harvest.ts`, `discovery-ledger-index-single-writer` for `ledger.ts:5 INDEX_KEY`, `datastore-seam-single-writer` for `store.ts` |
| **H — HITL gate** | M1–M8 + live daemon capture (`launchctl` at `R4-production-harvest-proof.md:21`) | **blocked until owner HITL ack** — no worker code | `plan-decision-single-writer` for `.autoforge/plans/**` |
| **V — validation** | `proof bundle read-back` + `vault-sync` for `state/*.json` commit | sequential after S | `vault-state-single-writer` at `vault-sync.mjs:16-44` — `node scripts/vault-sync.mjs` then explicit `git add state/production-harvest-proof.json state/discovery-ledger.json` per `AGENTS.md:21-23` |

**Parallelization guard flags (touches intersecting = sequential):**
- `M-R1` + `M-R2` parallel **allowed** (touches disjoint `store.ts` vs `ledger.ts` — but `M-R1` wire vs `M-R2` heal don't share file; note if `M-R1` touches listed `store.ts` only and `M-R2` touches `ledger.ts`, they are disjoint → parallel_safe) per `report-HOLD.md §6` `P wave` distinct files.
- `M-R3` + any other parallel **allowed** (touches only `tests/**` → disjoint from all prod files).
- `M-R4-module` + `M-R1-seam`/`M-R2`/`M-R3` parallel **allowed** (disjoint `proof-bundle.ts` vs `store.ts` vs `ledger.ts` vs tests).
- `M-R1-wire` + `M-R4-wire` **NOT allowed** (both touch `src/discovery/harvest.ts` → `harvest-single-writer`; flagged sequential).
- `M-R1` + `M-R4` as full modules parallel **NOT allowed in wire phase** (share `harvest.ts`), but their **P-phase files** (`harvest-lock.ts` vs `proof-bundle.ts` vs `store.ts`) are parallel_safe — so scheduler must split M-R1 and M-R4 into seam-phase (parallel) + wire-phase (serial).
- `M-R2` + `M-R4` parallel **allowed** (`ledger.ts` vs `proof-bundle.ts`/`harvest.ts` wire is different file except harvest.ts not shared with lexer).
- `vault-state` writers — `M-R4`'s `state/production-harvest-proof.json` contends with any other `state/**` writer (none other here, but would hold if exists) — guarded by `vault-state-single-writer` + `proof-bundle-single-writer`; staging `git add state/production-harvest-proof.json` explicitly.
- `M1–M8` deferred — no contention, not dispatched.

**Recommended schedule (aggressive where disjoint, conservative where touches intersect):**
1. Baseline: `node scripts/vault-sync.mjs --check` (if fail, `node scripts/vault-sync.mjs && git add state/vault-notes.json vault/views && git commit` before plan). `npm run build` dry-run green.
2. Turn P1: dispatch `M-R1-seam` + `M-R2-heal` + `M-R3-tests` + `M-R4-module` in parallel (disjoint `store.ts`+`harvest-lock.ts` vs `ledger.ts` vs `tests/**` vs `proof-bundle.ts` — four `Task autoforge-worker` same turn ok per `report-HOLD.md §6`).
3. Turn S1: `M-R1-wire` (`harvest.ts:118-157,252-255` acquire/release) — alone on `harvest-single-writer`.
4. Turn S2: `M-R4-wire` (`harvest.ts:237-247` proof emit) — alone after M-R1-wire committed; or merge both wires into one commit if owner prefers single `harvest.ts` edit (still sequential within lane).
5. Commit discipline: each module commits its `touches` set with explicit `git add <paths>` — never `git add -A`. Example `M-R1`: `git add src/lib/persistence/store.ts src/discovery/harvest-lock.ts src/discovery/harvest.ts`; `M-R2`: `git add src/discovery/ledger.ts src/lib/persistence/single-writer.ts`; `M-R3`: `git add tests/discovery/hold-r3.test.ts`; `M-R4`: `git add src/discovery/proof-bundle.ts src/discovery/harvest.ts src/app/api/dev/discovery/proof/route.ts state/production-harvest-proof.json tests/discovery/proof-bundle.test.ts`.
6. Proof: `npm run lint && npm run typecheck && npm run test (vitest includes hold-r3 + proof-bundle + existing discovery-harvest) && npm run build` green + `node scripts/vault-sync.mjs --check` green + `git diff --exit-code -- vault/views state/vault-notes.json` green if vault unchanged (ops-residual lane).

**Global proof before handoff (must be in every module's DoD):** `npm run build` green + `vitest` green + `node scripts/vault-sync.mjs --check` green (committed `state/production-harvest-proof.json` and any `state/**` equals HEAD worktree via `Buffer.equals` at `vault-sync.mjs:31` if `state/vault-notes.json` also touched — here only `state/production-harvest-proof.json` so `vault-sync --check` still required but `state/vault-notes.json` unchanged) + staging hygiene `git status --porcelain` shows only `touches` lane.

---

## 6. Skills & agent roles per module

| Skill | When in this plan |
|---|---|
| **lean-build** | every module — reuse `DataStore`/`MemoryStore`/`getDataStore`/`setDataStoreForTests`, `withPersistenceSingleWriter`, stdlib `fs/path/crypto`, existing `yaml`, `tsx`; no new deps |
| **codebase-design** | seam awareness — keep `store.ts:DataStore` deep (small `setIfAbsent` interface), `harvest-lock.ts` deep (one interface hides TTL/holder/DEL guard), `ledger.ts:appendLedgerKV/getLedgerTailKV` medium-deep (one interface, 4 adapters), `proof-bundle.ts` aggregator medium-deep |
| **domain-modeling** | glossary for `harvest:lock` `INDEX_KEY` `orphan` `proof bundle` `harvest-single-writer` `vault-state-single-writer` |
| **wayfinder** | **not needed** at n=4 (tracker-index stays hand-edited shallow per `report-HOLD.md §8` `Speculative`); invoke only if frontier grows >10 and `compileTrackerIndex()` deepening requested — track via `work-order-remaining.json:wayfinder_compile` precedent |
| **tdd / verify-and-stop** | M-R1 concurrent `acquireHarvestLock` MemoryStore, M-R2 50-append + orphan inject, M-R3 busy/dedup/ordering spies, M-R4 bundle digest repro |
| **surgical-patch** | M-R2 narrowest ledger extend, M-R1 narrowest seam extend, M-R4 one-line wire |

**Agent roles:**
- `M-R1` → `autoforge-worker (surgical — seam + lock)` + `autoforge-reviewer` (atomicity, TTL, holder guard)
- `M-R2` → `autoforge-worker` + `autoforge-reviewer` (no pipeline, window kept)
- `M-R3` → `autoforge-worker (test surface)` + `autoforge-reviewer` (ponytail test rule)
- `M-R4` → `autoforge-worker (thin aggregator)` + `autoforge-reviewer` (KV/file mirror, digest, EROFS, toggle)
- `VG-SYNC` analogy for vault-state not needed here except for `state/production-harvest-proof.json` commit guard
- `M1–M8` → no worker (HITL owner)

**Task grouping for `05_execute`:** Parallel group `[M-R1-seam, M-R2-heal, M-R3-tests, M-R4-module]` may be dispatched same turn as separate `Task autoforge-worker` calls (disjoint `touches`). Sequential groups `[M-R1-seam/M-R4-module] → [M-R1-wire] → [M-R4-wire]` (M-R1-wire blocked by M-R1-seam file existence, M-R4-wire blocked by M-R1-wire harvest-single-writer). `vault-state` writer M-R4 cannot parallel with any other `state/**` writer.

---

## 7. Verification — no new infra, testability via MemoryStore + vault-sync + vitest

- **Per-module dry check (M-R1):** `node --input-type=module -e "import{acquireHarvestLock}from './src/discovery/harvest-lock.ts'; import{MemoryStore,setDataStoreForTests} from './src/lib/persistence/store.ts'; const m=new MemoryStore(); setDataStoreForTests(m); const [a,b]=await Promise.all([acquireHarvestLock(m,120,'h1'), acquireHarvestLock(m,120,'h2')]); console.assert(a.acquired!==b.acquired); await a.acquired?a.release():b.release(); const c=await acquireHarvestLock(m,120,'h3'); console.assert(c.acquired);"` → pass without KV env.
- **M-R2 gate:** `vitest run tests/discovery/hold-r2.test.ts` (embedded in R3 file) covers 50-append + orphan prune; `getLedgerTailKV` after `s.del(entryKey(3))` shows `idx` cleaned.
- **M-R3 gate:** `npm run test` includes `hold-r3` 3 cases green; `npm run typecheck` + `lint` green.
- **M-R4 gate:** `npm run test tests/discovery/proof-bundle.test.ts` → bundle digest equals `sha256(JSON.stringify(entries))`; `node scripts/vault-sync.mjs --check` green after `git add state/production-harvest-proof.json`.
- **Global gates:** `npm run lint && npm run typecheck && npm run test && npm run build` green per `package.json:14-19`; `node scripts/vault-sync.mjs --check` green (CI `vault compile determinism V2` at `ci.yml:35-50`); `git status --porcelain` shows only touched lane.
- **No harness:** existing `vitest` at `package.json:14` already covers discovery; no `playwright` needed beyond `provider-health` dedup which stays in R3's `onRun` mock; if charter demands one more test beyond `hold-r3`, add single `assert` self-check: `node -e "import fs from 'fs'; const b=JSON.parse(fs.readFileSync('state/production-harvest-proof.json')); console.assert(b.version==='1.0.0')"` when file exists.

---

## 8. Risks & mitigations (carried from grilling Q1–Q4 + arch §7 + decisions AD-33)

| Risk | Where it bites | Mitigation in this plan | Ponytail ceiling |
|---|---|---|---|
| **Process-local vs KV split-brain — R1 primary** — `HARVEST_LOCK:104` per-lambda bool lets burst both pass `if(HARVEST_LOCK)` at `harvest.ts:140` → duplicate `nextSeq` at `persistDiscoveryState:281-289` | `harvest.ts:104,140-149,252` + `persistDiscoveryState:281-313` | R1 `SET NX EX harvest:lock` `["SET",key,"1","NX","EX",120]` serializes writers; `acquire` before `D00-QUEUED` at `:155-157` + holder-guarded `DEL` in `finally`; `MemoryStore.setIfAbsent` deterministic test; fallback WARN when `StoreUnavailableError:81-93` | `ponytail: global harvest:lock 120s TTL ceiling; per-cell locks (MAP.md:30) deferred` |
| **TTL expiry mid-harvest sneak-in** — TTL 120 too short for slow provider crawl at `harvest.ts:166-172` (`budget = min(DISCOVERY_NODE_IDS.length, HARVEST_NODE_POLL_BUDGET)`) → second harvest sneaks after TTL mid-run | `harvest.ts:166-172`, `harvest-lock.ts ttlSec` | Pick 120 MV (grilling-HOLD) with bounded budget, document; holder `get(KEY)===holder` guard on `DEL`; crash frees after TTL per `R1:19 let TTL expire` intentional; upgrade heartbeat `EXPIRE` only if long-run >120 observed | `fixed TTL is ceiling; heartbeat deferred` |
| **Ledger index race — R2 primary** — `ledger.ts:12-26` RMW `INDEX_KEY` loses entries under 50-concurrent | `ledger.ts:12-26` + `harvest.ts:281-289` | R2 per-entry `SET NX discovery:ledger:index-entry:{seq}` dedup + merge+sort+slice; R1 lock primary serialization shrinks race to TTL-expiry window only; tail prune rewrites `INDEX_KEY` without orphans best-effort `withPersistenceSingleWriter:7` | `ponytail: read→merge→sort→put is ceiling; true CAS EVAL at store.ts:64-67 deferred (pipeline rejected doc); O(500) scan ceiling` |
| **Orphan dirty forever** — `getLedgerTailKV:36 filter` hides but leaves `INDEX_KEY` dirty, `total` over-reports, `nextSeq` reuse → dup `put` | `ledger.ts:5 INDEX_KEY`, `:36 filter`, `harvest.ts:281 lastSeq` | Tail prune writes back `INDEX_KEY` without orphans immediately after detection at `:39`; `nextSeq` derivation at `harvest.ts:283-287` dedups via `tailLast > lastSeq`; test asserts orphan seq removed after one tail read | `heal on read (lazy) is ceiling; proactive sweep deferred until orphan >1%` |
| **KV vs Memory split-brain — R1+R2 cross-cut** — `store.ts:136-180` fallback shadow silently falls to `MemoryStore` on `StoreUnavailableError` or 5s abort at `:70-71` → second truth | `store.ts:138-150` | Keep `StoreUnavailableError` distinction at `:9-14`; `setDataStoreForTests:192-194` hermetic; R1 fallback WARN; proof bundle file mirror ensures durable copy when KV down; R4 KV-first then file fallback at `discovery/route.ts:15-45` | `fallback shadow is ceiling; explicit StoreUnavailableError propagation deferred until callers handle per-store (M8)` |
| **File mirror ROFS on Vercel — dedupe/ledger/proof bundle diverge** | `dedupe-persist.ts:70 EROFS`, `harvest.ts:312 swallow`, `proof-bundle.ts` file write same | KV-first load, file best-effort + KV `put` always; `persistDiscoveryState:314-322` swallow; proof bundle `EROFS warn+continue`, KV truth kept | `EROFS warn+continue is ceiling; per-account locks at dedupe-persist.ts:16 deferred` |
| **Staging poison** — `git add -A` commits foreign lane | `AGENTS.md:21-23` | Explicit `git add <paths>` only in §4 acceptance | `doc ceiling; pre-commit porcelain hook deferred` |
| **Proof bundle vault poison** — `state/production-harvest-proof.json` committed with wrong `vault-sync` path poisons determinism | `AGENTS.md:15-18` `state/*.json` | Never `vault-import.mjs` bare; only `vault-sync.mjs --check` before push; `state/production-harvest-proof.json` not compiled into `state/vault-notes.json` (ci checks only `vault/views state/vault-notes.json` at `ci.yml:35-50`) but still explicit add | `worktree+symlink ceiling; best-effort cleanup` |

---

## 9. Interfaces & seam traceability (reference)

```
DataStore seam (store.ts:16-26): put/get/getMany/keys/del/delByPrefix + setIfAbsent?(R1)
  ├─ MemoryStore:28-57 (Map<string,string> + TTL setTimeout unref)
  └─ KvRestStore:60-126 (fetch POST ["SET",key,JSON] at :68-99, KEYS prefix* at :112, 5s abort :70, StoreUnavailableError :9-14)
       └─ harvest-lock.ts: acquireHarvestLock(store?,ttlSec,holder?) → {acquired,release} (TTL/holder/WARN/fallback)
             └─ harvest.ts:106-256 executeJob (cancel poll :118-130, busy→setJobError :140, try/finally :252, D01…done :157-247)
                  ├─ ledger.ts:8 appendLedgerKV(entries,store?) + 28 getLedgerTailKV(limit,store?) (INDEX_KEY:5, entryKey:7, slice(-500):25)
                  ├─ dedupe-persist.ts:77 persistDedupeFromResult (KV-first :51, writeQueue:17)
                  └─ proof-bundle.ts: build/persist/readProofBundle (KV discovery:proof:bundle + file state/production-harvest-proof.json)
```

Least-privilege: human owns `vault/decisions|research-notes|gotchas` (`CHARTER.md:66-67`); agent may `append journal` (`:18,64`); machines own `vault/views/**` + `state/*.json` via compiles (`:19-20`) plus `state/production-harvest-proof.json` via `proof-bundle` single writer (not vault-compiled). Wayfinder markdown canonical `TRACKER.md:17` not used here; `tickets.ts` seam deferred.

---

*Evidence anchoring for this plan:* `tracker-index.md:3-20` 4 BLOCKED (R1–R4), `grilling-HOLD.md:10-67` R1–R4 MV + `Self-approve: Yes` at `:24,:39,:52,:65`, `report-HOLD.md:3-40 seam inventory` + `MAP.md:41-45` + `store.ts:16-26,28-126` + `harvest.ts:99-105,106-256` + `ledger.ts:4-40` + `decisions-HOLD.md AD-26..AD-33 self-approve TRUE for R1–R3 TRUE + AD-29 TRUE MV bundle / HITL live + AD-30 FALSE M1–M8`. `work-order-remaining.json:resource_locks` gauge reused. Next anchor after execution: `store.ts` shows `setIfAbsent` + `harvest-lock.ts` present, `ledger.ts` shows hint+heal, `tests/discovery/hold-r3.test.ts` 3 cases green, `state/production-harvest-proof.json` byte-identical digest + `vault-sync --check` pass + `git add` staging hygiene.
