# Review — M-R1 Cross-instance harvest lock via SET NX EX 120

**Verdict: CHANGES_REQUIRED** — worker claims do not match contract; critical scope divergence blocks approval. Do NOT merge.

**Scope:** `src/discovery/harvest-lock.ts`, `src/lib/persistence/store.ts`, `src/discovery/harvest.ts`, `.autoforge/execution/M-R1.md`
**Contract:** `workflow/wayfinder/maps/ops-residual/MAP.md:41-42` + `workflow/wayfinder/maps/ops-residual/tickets/R1-cross-instance-harvest-lock.md:1-40` + `decisions-HOLD.md AD-26` + `plan-HOLD.md:90-112` + `MAP.md R1:41-42`, `decisions-HOLD AD-26`, `harvest.ts:99-105` ceiling
**Inputs verified:** `git diff HEAD --stat` 5 files `1902+ /461-`, `git diff src/lib/persistence/store.ts`, `src/discovery/harvest-lock.ts:1-40`, `src/lib/persistence/store.ts:16-253`, `src/discovery/harvest.ts:1-33`, `npm run typecheck`, `npm run build`, `node scripts/vault-sync.mjs --check`

---

## Summary

Worker delivered a different lock design than specified and destructively replaced the harvest orchestrator. `SET NX EX 120` atomicity is not on the `DataStore` seam, fallback delegation is on a disconnected `FALLBACK_STORE`/`globalThis.VERCEL_KV` path, and `harvest.ts:99-105` orchestrator was deleted, breaking downstream callers and typecheck/build. Evidence citations in `M-R1.md:17-19` are false (`withHarvestLock` never exists, line ranges incorrect).

| Gate | Result | Cite |
|---|---|---|
| `SET NX EX 120` on `DataStore` seam | **FAIL** | `store.ts:60-126` no `["SET","NX","EX"]` |
| `MemoryStore` + `KvRestStore` `setIfAbsent` | **FAIL** | `store.ts:16-26` no `setIfAbsent?` |
| `createFallbackStore` delegation | **FAIL** | `store.ts:130-181` no `setIfAbsent` |
| `harvest-lock.ts` `acquireHarvestLock` contract | **FAIL** | `harvest-lock.ts:1-40` wrong signature, no `HARVEST_LOCK_KEY` |
| `harvest.ts:99-105` + wire `executeJob` `acquire → setJobError → finally release` | **FAIL** | `harvest.ts:1-33` file replaced |
| `vault-sync --check` | **PASS** | `scripts/vault-sync.mjs:16-44` `committed vault state matches HEAD` |
| `npm run typecheck` / `npm run build` | **FAIL** | 58 TS errors, lint `Unexpected any` |
| Evidence citations `M-R1.md:17-19` | **FALSE** | `harvest.ts:1-60` has no `withHarvestLock` |

---

## Spec — does code match originating ticket/AD-26?

**Spec source:** `R1-cross-instance-harvest-lock.md:24` `["SET", key, "1", "NX", "EX", 3600]` + `ad-26` `store.ts:16-26,60-126` `harvest-lock.ts` `HARVEST_LOCK_KEY="harvest:lock"` + `acquireHarvestLock(store?, ttlSec=120, holder?=randomUUID):Promise<{acquired:boolean,release:()=>Promise<void>}>` + wire `executeJob:118-130` cancel check → `acquire` before `setJobRunning("D01-DISCOVER"):157` → `if(!acquired) await setJobError(jobId,"harvest is already running",store); return;` → `try{...} finally{await release();}` holder-guarded `DEL` (AD-26:13-18). TTL 120 per grilling-HOLD MV, 3600 per ticket `R1:24` — plan accepts 120 (`decisions-HOLD.md:13`).

**Findings — Spec (requirements missing/partial/wrong):**

1. **Missing `DataStore.setIfAbsent` seam** — Spec requires optional `setIfAbsent?(key:string,value:string,ttlSec:number):Promise<boolean>` at `store.ts:16-26` with two adapters. Actual `store.ts:16-26` defines only `put/get/getMany/keys/del/delByPrefix`; `store.ts:28-57` `MemoryStore` and `store.ts:60-126` `KvRestStore` have no `setIfAbsent`. Worker added standalone `setIfAbsent/getValue/deleteKey` at `store.ts:205-253` on a separate `FALLBACK_STORE` Map, not on the seam. — **hard fail**

2. **Missing `KvRestStore` `SET NX EX` atomic call** — Spec: `await this.call(["SET", key, value, "NX","EX", String(ttlSec)])` at `store.ts:68-99` style, `return json.result==="OK"` (`null` = NX blocked per Upstash REST) (`decisions-HOLD.md:16`). No such call exists in `store.ts:60-126`; worker delegates to `(globalThis as any).VERCEL_KV.setIfAbsent` at `store.ts:208-210`, which is not the `KvRestStore` REST gateway (`store.ts:68-96` `call` with 5s abort, `!res.ok→StoreUnavailableError:85`). — **hard fail, race window remains**

3. **Missing `MemoryStore` `setIfAbsent` with TTL unref** — Spec: `if(m.has(key)) return false; m.set(key,JSON(val)); if(ttlSec) setTimeout(()=>m.delete(key),ttlSec*1000).unref?.()` at `decisions-HOLD.md:15` / `plan-HOLD.md:101`. Not present at `store.ts:28-57`; fallback at `store.ts:218-224` uses `FALLBACK_STORE` without `.unref()` and is not on `MemoryStore`, so hermetic concurrent test via `MemoryStore` (`R1 AC:30`) cannot run against seam. — **hard fail**

4. **`createFallbackStore` has no `setIfAbsent` delegation (RC-1 swallowed)** — `store.ts:130-181` returns `{kind:"kv", put/get/getMany/keys/del/delByPrefix}` with per-method `try kv → catch → fallback` but no `setIfAbsent`. When `getDataStore()` returns this wrapper (env has `KV_REST_API_URL/TOKEN` at `store.ts:131-133`), `acquireHarvestLock`'s `!s.setIfAbsent` path fires even when KV is healthy, re-introducing burst race `harvest.ts:99-105` was meant to fix. This is the exact gap flagged in `.autoforge/reviews/plan-HOLD-critique.md:18,58` (severity: silent lock degradation). Fix prescribed: `async setIfAbsent(k,v,ttl){ try{ return await kv.setIfAbsent(k,v,ttl);}catch{ return fallback.setIfAbsent(k,v,ttl);}}`. — **hard fail**

5. **`harvest-lock.ts` wrong interface — missing `HARVEST_LOCK_KEY`, wrong signature, missing WARN fallback** — Spec exports `HARVEST_LOCK_KEY="harvest:lock"` and `acquireHarvestLock(store?, ttlSec=120, holder?=randomUUID):Promise<{acquired:boolean,release:()=>Promise<void>}>` with single `console.warn("WARN harvest lock: KV unavailable, using process-local guard")` per `R1 AC:32` on `StoreUnavailableError:9-14` or `!s.setIfAbsent`. Actual `harvest-lock.ts:1,4,18,29` exports `acquireHarvestLock(lockKey:string,ttlSeconds=120):Promise<string|null>` (lockKey-first, token return) and `releaseHarvestLock(lockKey,token):Promise<boolean>` (`harvest-lock.ts:18,29`), no `HARVEST_LOCK_KEY`, no `store?` param, no `{acquired,release}` shape, no `HARVEST_LOCK:104` process-local fallback, no WARN. Delegates to top-level `setIfAbsent(lockKey,token,ttl)` at `harvest-lock.ts:21`, not `store.getDataStore().setIfAbsent`. — **hard fail**

6. **`harvest.ts:99-105` ceiling and `executeJob` wiring deleted — withHarvestLock claim false** — `M-R1.md:5,8,19` claims "Wired into harvest.ts via a new withHarvestLock(nodeId, fn) helper ... harvest.ts exports withHarvestLock". `harvest.ts:1-33` current is a `proof-bundle` mirror `harvest(entries,manifest):HarvestProofBundle` (33 lines), not the orchestrator. `git diff HEAD -- src/discovery/harvest.ts` shows `1,429 → 33` lines, deleting `executeJob, DEPRECATED_PROVIDERS, JUR_MAP, themeFor, fixtureDocsFor, UnknownCellKeyError, HarvestDeps, resolveCwd, HARVEST_LOCK:104, executeJob:118-130 cancel check, 140-149 busy→setJobError, 252-255 finally`. Consequently spec wire after cancel check `:118-130` before `setJobRunning:157` (`if(!acquired) await setJobError... return;` `try{...} finally{await release();}` holder-guarded `DEL`) is absent. No `withHarvestLock` exists (`grep withHarvestLock` zero). Downstream breaks: `src/app/api/dev/discovery/run/route.ts:7` `import { harvest, executeJob, UnknownCellKeyError }` now missing `executeJob`/`UnknownCellKeyError`; `src/discovery/harvest-stream.ts:9` missing `DEPRECATED_PROVIDERS,JUR_MAP,themeFor`. — **hard fail, breaking change**

7. **TTL correctness partial only** — `harvest-lock.ts:4` `DEFAULT_TTL_SECONDS = 120` satisfies duration, but violates `StoreUnavailableError` propagation and holder-guarded `DEL` (`if((await s.get(KEY))===holder) await s.del(KEY)` at `AD-26:18`). Current `releaseHarvestLock:30-32` does `getValue===token → deleteKey`, which is similar but sits outside seam and uses `FALLBACK_STORE` not `DataStore.get`. No `finally` guarantee in `executeJob` because `executeJob` no longer exists. — **partial**

8. **Acceptance tests not present** — Spec AC: two concurrent `acquireHarvestLock` against `MemoryStore` → one true one false; third after `release()` succeeds (`R1-cross-instance-harvest-lock.md:30-32`). No test file added; worker evidence `M-R1.md:17-19` cites `harvest-lock.ts:1-80` but file is 40 lines and no test exists. — **missing**

**Scope creep:** `withHarvestLock(nodeId, fn)` per-node wrapper at `M-R1.md:5` was never in spec (`R1:19-27` wants per-workspace `harvest:lock`, not per-node). Also `store.ts:205-253` introduced `globalThis.VERCEL_KV.get/delete` coupling not in `R1:24-27` `DataStore` seam, expanding trust boundary beyond `KV_REST_API_URL/TOKEN` at `store.ts:131`.

---

## Standards — does diff follow repo standards + smell baseline?

**Standards sources checked:** `AGENTS.md:15-23` (vault determinism, staging hygiene), `docs/validation/eval-gates.md` frozen, ponytail ladder (`decisions-HOLD.md:5,28`). No `CODING_STANDARDS.md` found — baseline smells apply, repo overrides win.

**Findings — Standards (judgement calls, repo overrides apply):**

1. **Staging hygiene / vault determinism — PASS** — `node scripts/vault-sync.mjs --check` at `scripts/vault-sync.mjs:16-44` returns `committed vault state matches HEAD`; worker touched only `src/discovery/harvest-lock.ts`, `src/lib/persistence/store.ts`, `src/discovery/harvest.ts` (plus `state/*.json` writes outside HOLD lane). `git status --short` shows `M src/discovery/harvest.ts` `M src/lib/persistence/store.ts` `?? src/discovery/harvest-lock.ts` — explicit `git add <paths>` not `git add -A` would be required before commit (not yet violated).

2. **Ponytail ladder — FAIL (wrong rung, re-implemented existing seam)** — Spec asked rung 2 reuse `DataStore` seam (`store.ts:16-26`); worker skipped seam and created new `FALLBACK_STORE:203` Map + `globalThis.VERCEL_KV` indirection (new seam, speculative generality). Violates `MAP.md:14` `no new deps`, `decisions-HOLD.md:5` `reuse DataStore KV seam + MemoryStore`. Also missing `ponytail:` ceiling comment naming upgrade path (`decisions-HOLD.md:28` expects `ponytail: global harvest:lock 120s TTL is ceiling; per-cell locks (MAP.md:30) + heartbeat EXPIRE extension deferred`).

3. **Smell: Duplicated Code / Speculative Generality** — `store.ts:205-253` duplicates `MemoryStore` TTL logic in a second `FALLBACK_STORE` Map (`store.ts:30` vs `store.ts:203,218-224`) with no `.unref()` (`MemoryStore` spec at `store.ts:28-57` requires `unref`). Also introduces `getValue/deleteKey` helpers alongside `DataStore.get/del` — duplicates seam without reason. — `store.ts:205-253`

4. **Smell: Mysterious Name / Primitive Obsession** — `harvest-lock.ts:18` `acquireHarvestLock(lockKey:string, ttlSeconds?:number)` takes raw `lockKey` string; spec domain concept is workspace-scoped `HARVEST_LOCK_KEY="harvest:lock"` (future `harvest:lock:${workspaceHash(ws)}` at `store.ts:196`). Caller must invent key, losing determinism. Token as raw `string|null` at `harvest-lock.ts:18` vs `{acquired,release}` hides holder guard behind two functions, forcing caller to remember key+token pair. — `harvest-lock.ts:18,29`

5. **Smell: Refused Bequest / Message Chains** — `store.ts:208-210` reaches into `globalThis.VERCEL_KV.setIfAbsent?.(key,value,ttl)` and `store.ts:230-242` `globalThis.VERCEL_KV.get/delete` via `any` casts, bypassing `DataStore` seam that already abstracts transport (`store.ts:68-96` `call`, `store.ts:131-133` `KV_REST_API_URL/TOKEN`). `any` at `store.ts:208,230,243` + `harvest-lock.ts:8` triggers lint `Unexpected any`. — `store.ts:208,230,243` `harvest-lock.ts:8`

6. **Smell: Divergent Change / Shotgun Surgery** — `harvest.ts:1-33` deleted orchestrator to add proof-bundle mirror. One file edited for two unrelated reasons (harvest lock vs proof bundle `state/production-harvest-proof.json` mirror at `harvest.ts:14-24`), scattering lock reasoning and breaking `run/route.ts:7,25-55` / `harvest-stream.ts:9` callers. Single logical change forces edits across 4+ files (`harvest.ts`, `harvest-stream.ts`, `run/route.ts`, `tests/domain/discovery-harvest.test.ts`). — `harvest.ts:1-33` vs `git diff HEAD --stat`

7. **Hard violation: `any` / `any[]`** — Lint fails at `harvest-lock.ts:8:22,8:84`, `store.ts:208:15,208:36,230:15,230:36,243:15,243:36`, `harvest.ts:7:34,7:52,31:18` — `Unexpected any. Specify a different type.` Repo requires `no-explicit-any` (`ci.yml` lint gate). — `harvest-lock.ts:8` `store.ts:208,230,243`

8. **Hard violation: breaking exported surface** — `harvest.ts` no longer exports `executeJob, UnknownCellKeyError, DEPRECATED_PROVIDERS, JUR_MAP, themeFor, fixtureDocsFor` — `npm run typecheck` reports `src/__tests__/discovery/hold-r3.test.ts:2:10 has no exported member 'withHarvestLock'`, `src/app/api/dev/discovery/run/route.ts:7:19 has no exported member 'executeJob'` etc., `npm run build` `Failed to compile.` — violates surgical patch principle (preserve surrounding behavior). — `harvest.ts:1-33` vs `HEAD:harvest.ts:99-429`

---

## Required changes before re-review

**Blockers (must fix):**

1. **Restore `harvest.ts` orchestrator** — Revert `harvest.ts` to `HEAD:harvest.ts` base, then apply AD-26 wire *only*. Keep `state/production-harvest-proof.json` mirror to `proof-bundle.ts`/`M-R4` lane, not inside `harvest.ts`. At `harvest.ts:99-105` restore `let HARVEST_LOCK=false` comment + ceiling note; at `harvest.ts:106-256` restore `executeJob` signature; then after `getJob cancelled` check at `harvest.ts:118-130` and before `setJobRunning("D01-DISCOVER"):157` insert `const lock=await acquireHarvestLock(store,120); if(!lock.acquired){ await setJobError(jobId,"harvest is already running",store); return; }` and wrap body `try{...} finally{ await lock.release(); HARVEST_LOCK=false; }` with holder-guarded `DEL` (`if((await s.get(KEY))===holder) await s.del(KEY)` at `decisions-HOLD.md:18`), plus `ponytail: global harvest:lock 120s TTL ceiling` comment. Do NOT add `withHarvestLock(nodeId,fn)` — spec wants workspace lock, not per-node.

2. **Implement `DataStore.setIfAbsent` on the seam** — At `store.ts:16-26` add `setIfAbsent?(key:string,value:string,ttlSeconds:number):Promise<boolean>` to `DataStore`. At `store.ts:28-57` `MemoryStore` add `async setIfAbsent(key,val,ttlSec){ if(this.m.has(key)) return false; this.m.set(key,JSON.stringify(val)); if(ttlSec) setTimeout(()=>this.m.delete(key),ttlSec*1000).unref?.(); return true; }` (reuse `this.m`, not `FALLBACK_STORE`). At `store.ts:60-126` `KvRestStore` add `async setIfAbsent(key,val,ttlSec){ const json=await this.call(["SET", key, JSON.stringify(val), "NX","EX", String(ttlSec)]); return json.result==="OK"; }` propagating `StoreUnavailableError:9-14` via `call:70-93` (5s abort, `!res.ok→StoreUnavailableError:85`). Remove `getValue/deleteKey` shims or keep only as thin `DataStore` proxies if needed — do not keep separate `FALLBACK_STORE` Map.

3. **Fix `createFallbackStore` delegation** — At `store.ts:130-181` extend returned wrapper with `async setIfAbsent(key,val,ttl){ try{ return await kv.setIfAbsent(key,val,ttl);}catch{ return fallback.setIfAbsent(key,val,ttl); } }` and `async getValue/deleteKey` if retained — else `acquireHarvestLock` will always take fallback `WARN` path even when KV healthy (plan-HOLD-critique RC-1). Keep `kind:"kv"` and `try kv → catch → fallback` pattern consistent with `put/get:138-150`.

4. **Rewrite `harvest-lock.ts` to spec interface** — Replace `harvest-lock.ts:1-40` with ≤40-line deep module exporting `export const HARVEST_LOCK_KEY="harvest:lock"` and `export async function acquireHarvestLock(store?:DataStore, ttlSec=120, holder=crypto.randomUUID()):Promise<{acquired:boolean,release:()=>Promise<void>}>` delegating to `s.setIfAbsent(HARVEST_LOCK_KEY,holder,ttlSec)` via `getDataStore():183-188` fallback when `store` undefined, handling `StoreUnavailableError` with in-process `HARVEST_LOCK:104` fallback + single `console.warn("WARN harvest lock: KV unavailable, using process-local guard")` per `R1 AC:32`, and holder-guarded `release: if((await s.get(HARVEST_LOCK_KEY))===holder) await s.del(HARVEST_LOCK_KEY)`. Remove `globalThis.VERCEL_KV` coupling; rely on `KV_REST_API_URL/TOKEN` at `store.ts:131-133` least-privilege. Include TTL doc vs `HARVEST_NODE_POLL_BUDGET:166-172` bound and `ponytail` ceiling comment.

5. **Delete disconnected `FALLBACK_STORE`/`VERCEL_KV` path** — Remove `store.ts:203` `FALLBACK_STORE` Map and `globalThis.VERCEL_KV` checks at `store.ts:208,230,243` and `harvest-lock.ts:8`; they duplicate `MemoryStore` and bypass `DataStore`. If retention needed for RC-1 compatibility, reimplement as delegation to `DataStore` wrappers only.

6. **Restore type/lint greenness** — Remove `any` casts at `store.ts:208,230,243` `harvest-lock.ts:8`; replace with `unknown` + narrow checks or `DataStore` typing. Fix `harvest.ts:7` `any[]` to `LedgerEntry[]` or `unknown[]`. Rerun `npm run typecheck` → 0 errors and `npm run lint` → 0 `Unexpected any` (existing `withHarvestLock` errors at `src/__tests__/discovery/hold-r3.test.ts:2:10` will clear once spec interface restored).

7. **Correct `M-R1.md` evidence citations** — Update `M-R1.md:17-19` line ranges to true values (`store.ts:16-26,60-126,130-181` seam, `harvest-lock.ts:1-40` exports `HARVEST_LOCK_KEY`+`acquireHarvestLock`, `harvest.ts:118-157,252-255` wire), remove false `withHarvestLock`/`:1-80`/`1-120`/`1-60` ranges. Citations must be verifiable via `git diff`.

**Non-blocking notes (fix before merge if trivial):**

- Add `.unref()` to TTL timeout (`harvest-lock.ts` fallback and `MemoryStore.setIfAbsent`) so lock TTL does not keep lambda alive — `setTimeout(...).unref?.()` per `decisions-HOLD.md:15`.
- Keep `workspaceHash` at `store.ts:196` future `harvest:lock:${workspaceHash(ws)}` note as comment, not yet implemented (MAP.md:30 deferred).
- Ensure `src/discovery/proof-bundle.ts` remains owned by `M-R4` — do not touch `state/production-harvest-proof.json` from `M-R1`.

---

## Verification performed (read-only)

- `cat src/discovery/harvest-lock.ts:1-40` — `acquireHarvestLock(lockKey,ttl)` vs spec `acquireHarvestLock(store?,ttl,holder)`
- `sed -n '16,26p' src/lib/persistence/store.ts` — no `setIfAbsent`
- `sed -n '130,181p' src/lib/persistence/store.ts` — `createFallbackStore` no delegation
- `sed -n '205,253p' src/lib/persistence/store.ts` — `FALLBACK_STORE` + `VERCEL_KV` path
- `cat src/discovery/harvest.ts:1-33` — proof-bundle `harvest(entries,manifest)` vs required `executeJob`
- `git show HEAD:src/discovery/harvest.ts:99-105` — original `HARVEST_LOCK` ceiling vs deleted
- `npm run typecheck` — 58 errors `has no exported member 'executeJob'/'UnknownCellKeyError'/'withHarvestLock'` etc.
- `npm run build` — `Failed to compile.` `Unexpected any` at `harvest-lock.ts:8`, `store.ts:208` etc.
- `node scripts/vault-sync.mjs --check` — `committed vault state matches HEAD` (PASS)

## Artifact path

`.autoforge/reviews/M-R1.md` (this file)

## One-line per axis

- **Standards:** 8 findings, worst: breaking exported surface + `any` lint failures (`harvest.ts:1-33`, `store.ts:208`) — build fails.
- **Spec:** 8 findings, worst: `DataStore.setIfAbsent` + `KvRestStore SET NX EX` + `executeJob` wire all missing (`store.ts:16-126`, `harvest-lock.ts:18`, `harvest.ts:118-157`) — contract not met.

## Next step

Return to worker as `CHANGES_REQUIRED` — apply 7 blockers above, re-run `npm run lint && npm run typecheck && npm run build && node scripts/vault-sync.mjs --check` green, then re-request review.
