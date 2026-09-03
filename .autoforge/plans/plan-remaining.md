# Plan — Remaining Frontier R5,R6,R7,R9,R10,R11,R15,R19 (ops-residual self-approving)

**Scope:** planning-only — no implementation dispatched. Concrete, modular, dependency-aware, testable, traceable. Ponytail ladder enforced; vault determinism guard retained. Model budget 80k tok (inherit `opencode/muse-spark-1.2-contributor-free` 1M*0.30 capped).

**Sources pinned (verbatim / summarized):**
- `.autoforge/discovery/tracker-index.md:22-96` R5–R15,R19 OPEN verbatim (12 lines); R16–R18 FOG; R1–R4 BLOCKED — see §1 reconciliation
- `.autoforge/requirements/grilling-remaining.md:1-122` Q1–Q12 (R5 `self-approve:false` at :27, R6 :36, R7 :44, R8 :52, R9 :58, R10 :64, R11 :72, R12 :80, R13 :86, R14 :92, R15 :100, R19 :107 — all grilling `false` initially; architectural decisions override 8 to `TRUE`)
- `.autoforge/architecture/report-remaining.md:1-448` seams (DataStore `store.ts:16-26`, Job store `jobs.ts:41-42`, Health-aggregate `health-aggregate.ts:20-61`, Wayfinder `tickets.ts:34-193`, Dedupe `dedupe-persist.ts:12-107`, Ledger `ledger.ts:4-40`, Harvest `harvest.ts:106-247`), hazard locks §6, wave table §6, ponytail ceilings
- `.autoforge/architecture/decisions-remaining.md:1-203` AD-11…AD-25 (self-approve `TRUE` for AD-11 R5, AD-12 R6, AD-13 R7, AD-15 R9, AD-16 R10, AD-17 R11, AD-21 R15, AD-22 R19; `FALSE/NEEDS REVIEW` for AD-14 R8, AD-18 R12, AD-19 R13, AD-20 R14 — deferred, see §1)
- `workflow/wayfinder/maps/ops-residual/MAP.md:39-59` `Not yet specified` residual tickets; `MAP.md:9,14-17` local-markdown canonical + ponytail + staging hygiene
- `workflow/wayfinder/maps/ops-residual/tickets/R5-server-cancel.md:1-35`, `R6-pagination-trim.md:1-33`, `R7-refresh-parity.md:1-32`, `R9-discovery-doctor-json.md:1-32`, `R10-dedupe-write-authority.md:1-34`, `R11-drop-stale-comments.md:1-32`, `R15-docs-production-deploy-refresh.md:1-33`, `R19-wayfinder-plumbing-traceability.md:1-53` full briefs
- Prior execution ` .autoforge/execution/work-order.json:1-140` vault lane VG-01/VG-02→VG-SYNC lock context for guard reuse
- Existing code seams cited per ticket: `src/discovery/jobs.ts:41-42,64-66,94-113,133-357`, `src/lib/persistence/store.ts:16-188`, `src/discovery/harvest.ts:99-173`, `src/discovery/dedupe-persist.ts:12-107`, `src/app/api/dev/discovery/jobs/[id]/cancel/route.ts:1-21`, `src/app/dev/mission-control/_components/provider-health.tsx:163-171,383-391,474-485`, `scripts/discovery-doctor.ts:14-53`, `src/wayfinder/tickets.ts:34-193`, `src/wayfinder/ticket-types.ts:2`, `src/app/api/dev/tickets/route.ts:6-17`, `src/app/dev/mission-control/_components/ticket-board.tsx:28-40`

**Blocked_by:** discovery done → grilling-remaining done → architect-remaining done (report-remaining + decisions-remaining AD-11..25) → **this plan**. No dispatch before `node scripts/vault-sync.mjs --check` baseline green. Skills: `codebase-design`, `wayfinder` (R19 only), `lean-build`, `verify-and-stop`.

---

## 1. Tracker and status reconciliation (MUST cover all — one module per frontier ticket where self-approving)

| # | Tracker-index line (verbatim) | Frontier ticket (canonical) | State in code / decisions | Plan disposition |
|---|---|---|---|---|
| 5 | `R5 — Stop/Cancel server endpoint (server mark cancelled vs client-only Stop)` at `tracker-index.md:23` | `workflow/wayfinder/maps/ops-residual/tickets/R5-server-cancel.md:1-35` `status:open` `blocked_by:[]` `hitl:false` | Wired `cancel/route.ts:1-21` + `harvest.ts:116-173` poll already; needs test+label per `report-remaining:31` / `AD-11` | **M-R5** — self-approving |
| 6 | `R6 — Pagination across large job index (cursor stability)` at `:28` | `R6-pagination-trim.md:1-33` `open` `[]` | Already fixed `jobs.ts:223-274` stale→latest per `report:32` / `AD-12` | **M-R6** — self-approving |
| 7 | `R7 — Refresh parity for parent reload on manual click` at `:33` | `R7-refresh-parity.md:1-32` `open` `[]` | Done `provider-health.tsx:482 title=` per `report:33` / `AD-13` | **M-R7** — self-approving |
| 8 | `R8 — Health route exposes harvest-health sub-object` at `:38` | `R8-harvest-health-route.md` `open` `[]` | Partial `health/route.ts:135-155` shape drift per `report:34` | **DEFERRED** — AD-14 `FALSE NEEDS REVIEW (shape freeze)` — not in this work-order; tracks after owner freeze |
| 9 | `R9 — Discovery doctor JSON contract stable for CI` at `:43` | `R9-discovery-doctor-json.md:1-32` `open` `[]` | Done `discovery-doctor.ts:14-53` `JSON_MODE` per `report:35` / `AD-15` | **M-R9** — self-approving |
| 10 | `R10 — state/dedupe-index.json write authority (KV-truth vs file fallback)` at `:48` | `R10-dedupe-write-authority.md:1-34` `open` `[]` | Half `dedupe-persist.ts:51-75` KV-first exists, `persistDedupeFromResult:85` still sync per `report:36` / `AD-16` | **M-R10** — self-approving |
| 11 | `R11 — Hardening: drop speculative source comments` at `:53` | `R11-drop-stale-comments.md:1-32` `open` `[]` | Comments `harvest.ts:99-103` ceilings per `report:37` / `AD-17` | **M-R11** — self-approving |
| 12 | `R12 — AutoForge staging: exclude .autoforge/ from committed tree` at `:58` | `R12-autoforge-storage-policy.md` `open` `[]` | Untracked `?? .autoforge/` per `report:38` | **DEFERRED** — AD-18 `FALSE HITL-policy` — owner picks (a) curated vs (b) ignore |
| 13 | `R13 — Eval gate §2 freshness automation: timestamp check` at `:62` | `R13-eval-gate-freshness.md` `open` `[]` | Half `check-eval-gate-freshness.mjs:11-28` warn not fail per `report:39` | **DEFERRED** — AD-19 `FALSE HITL` — threshold owner ack |
| 14 | `R14 — Tier-1 archive: keep helper script, de-skill its drift` at `:67` | `R14-tier1-housekeeping.md` `open` `[]` | No `tier1-archive.mjs` per `report:40` | **DEFERRED** — AD-20 `NEEDS REVIEW (clarify file)` |
| 15 | `R15 — README + CONTRIBUTING: refresh Production deploy section` at `:72` | `R15-docs-production-deploy-refresh.md:1-33` `open` `[]` | `README.md:85-91` stale per `report:41` / `AD-21` | **M-R15** — self-approving |
| 19 | `R19 — Wayfinder plumbing traceability — ticket index + Mission Control board` at `:93` | `R19-wayfinder-plumbing-traceability.md:1-53` `open` `[]` | Already deep `tickets.ts`+API+board per `report:42` / `AD-22`; missing CLI `scripts/wayfinder-tickets.ts` | **M-R19** — self-approving |
| 1 | `R1 — Cross-instance harvest lock via Vercel KV atomic SET NX` at `:3` | `R1-cross-instance-harvest-lock.md` | `BLOCKED` — not-yet-specified, out-of-lane | **OUT OF LANE** — not in this work-order (vault lane prior) |
| 2 | `R2 — Ledger KV ordering + orphan-key recovery` at `:7` | `R2-ledger-improve-indexing.md` | `BLOCKED` | **OUT OF LANE** |
| 3 | `R3 — Regression tests for in-process lock + callback dedup` at `:12` | `R3-regression-tests.md` | `BLOCKED` | **OUT OF LANE** |
| 4 | `R4 — Production harvest proof bundle` at `:17` | `R4-production-harvest-proof.md` | `BLOCKED` | **OUT OF LANE** |
| 16 | `R16 — Brave quota 402 graceful degradation` at `:78` | `R16-brave-quota-degradation.md` | `FOG` | **OUT OF SCOPE** (triaged 2026-08-31) |
| 17 | `R17 — Evidence bundle reconciliation + HEAD anchoring` at `:82` | `R17-evidence-reconciliation-automation.md` | `FOG` | **OUT OF SCOPE** |
| 18 | `R18 — Bento components merge verification` at `:87` | `R18-bento-verification.md` | `FOG` | **OUT OF SCOPE** |

**Counting proof:** `tracker-index.md:22-96` contains 12 OPEN lines (R5,R6,R7,R8,R9,R10,R11,R12,R13,R14,R15,R19) + 4 BLOCKED (R1-4) + 3 FOG (R16-18) = 19 total. Discovery report `report-remaining.md:4` maps same 12. This plan enumerates **8 self-approving modules** (R5,R6,R7,R9,R10,R11,R15,R19 = `8` = `12 OPEN - 4 NEEDS REVIEW` deferred R8,R12,R13,R14). No merge: distinct operational domains (cancel vs pagination vs tooltip vs doctor vs dedupe vs comments vs docs vs wayfinder); dedup cite would fail per `report-remaining §1` map ownership local-markdown only `TRACKER.md:14`. First-item-only (only R5) would be **failure** per instructions.

**Shared-state note:** R5,R6 share `src/discovery/jobs.ts` job-index; R5,R11 share `src/discovery/harvest.ts` lock site; R5,R7 share `provider-health.tsx` client; R10 owns `dedupe-persist.ts` + `keys.ts` + `state/dedupe-index.json` file mirror; R19 owns wayfinder compile. Each `touches: [globs]` below captures hazard for DAG guard.

---

## 2. Global execution guardrails

| Guardrail | Enforcement | Cite |
|---|---|---|
| **Vault determinism (HEAD worktree only)** | Never `node scripts/vault-import.mjs` / `vault-export.mjs` bare before commit. Only `node scripts/vault-sync.mjs` (sync) or `node scripts/vault-sync.mjs --check` (CI). Pre-flight before any `state/**` commit. | `AGENTS.md:15-18` `scripts/vault-sync.mjs:16-44` `report-remaining §3.14` `decisions-remaining AD-09` |
| **Byte-identical registries → views** | `state/vault-notes.json` sorted `path.localeCompare` at `vault-import.mjs:79`; views `source_hash: sha12` at `vault-export.mjs:14-16`; CI `git diff --exit-code -- vault/views state/vault-notes.json` | `vault-export.mjs:14-16,45-48` `.github/workflows/ci.yml:35-50` |
| **Staging hygiene** | Explicit `git add <paths>` only; never `git add -A` (foreign lane journals/wayfinder maps poison). Each module lists exact `git add` set. | `AGENTS.md:21-23` `MAP.md:15` |
| **Ponytail ladder** | Reuse `DataStore` seam `store.ts:16-26`, `MemoryStore` for tests, `getDataStore`/`setDataStoreForTests`, stdlib `fs/path/crypto`, existing `yaml`; no new deps, no generic facades, `title` over component. | `decisions-remaining AD-11..AD-22` `report-remaining §3` |
| **Single-writer locks** | See §5 locks table; any `state/**`, `vault/views/**`, `state/dedupe-index.json`, `jobs.ts` index, `harvest.ts` lock, `wayfinder` compile, `ci.yml`, `.gitignore`, docs serialize | `decisions-remaining AD-24` `report-remaining §6` |
| **Frozen doctrine** | `docs/validation/eval-gates.md:15-38` thresholds frozen; `workflow/wayfinder/TRACKER.md:17` markdown canonical for ops-residual | `AGENTS.md:eval gates` |
| **Vault-state-single-writer (retained)** | Even though this frontier is ops-residual not vault-prose, any writer of `state/vault-notes.json` or `vault/views/**` or `.autoforge/discovery/tracker-index.md` or `vault/gotchas/**` settlement must still serialize under `vault-state-single-writer`; none of the 8 modules intend to write `state/vault-notes.json` directly, but guard is declared and respected — R10 file mirror `state/dedupe-index.json` is analogous file-KV fork guarded by `dedupe-index-single-writer` + EROFS pattern, and pre-commit still runs `vault-sync --check` | `scripts/vault-sync.mjs:16-44` `vault/CHARTER.md:19-20` `work-order.json:resource_locks.vault-state-single-writer` |

---

## 3. Phases — text/client/docs → state writers → gates

```
Phase 0 — Baseline (gated):  node scripts/vault-sync.mjs --check  →  green? ──no──▶ vault-sync, commit
                              │
Phase P — Stateless / client / docs (parallel_safe, disjoint touches):
                              ├──► M-R7  tooltip   (provider-health title)
                              ├──► M-R9  doctor    (scripts/discovery-doctor.ts JSON branch)
                              ├──► M-R15 docs      (README/deployment text)
                              ├──► M-R19 wayfinder CLI (scripts/wayfinder-tickets.ts + tickets seam)
                              └──► M-R11 comments  (harvest.ts prune — share harvest.ts hazard → see guard)
                              │         (P members dispatch same turn if touches disjoint; intersecting file = sequential)
                              ▼
Phase S — State writers (serialize per seam; blocked_by [] but hazard-guarded):
                              ├──► M-R10 dedupe KV-truth  (dedupe-persist.ts + keys.ts — dedupe-index-single-writer)
                              ├──► M-R6  pagination       (jobs.ts listJobs — job-index-single-writer)
                              └──► M-R5  cancel           (jobs.ts+harvest.ts+cancel/route+provider-health — harvest-single-writer + job-index + provider-health)
                              │         (S writers cannot parallel on shared mutable state; see §5 guard)
                              ▼
Phase G — Proof gates:  npm run lint && npm run typecheck && npm run test (vitest) && npm run build && node scripts/vault-sync.mjs --check
```

Phase separation respects: **module boundary ≠ child-session boundary** — modules are independent units of planning/review/testability; execution may batch disjoint-touch modules in one parallel `Task` turn. Ponytail: no extra phase for ADR/charter amendment (deferred until owner asks `CHARTER.md:82-85`). R8/R12/R13/R14 deferred stay unblocked but HITL-gated after this lane.

---

## 4. Modules — objective, inputs/outputs, touches, dependencies, acceptance, skills, agent

### M-R5 — Stop/Cancel server endpoint — FRONTIER — self-approving (AD-11 TRUE)

- **Objective:** Make UI Stop honest — `POST /api/dev/discovery/jobs/:id/cancel` marks `running→cancelled` via `updateJob`, worker `executeJob` polls `getJob` before lock `harvest.ts:118-130` and per-node `166-173` then `appendLog D00-CANCELLED` + return. UI `provider-health.tsx:163-171` fire-and-forget + polling to terminal `cancelling… → paused · cancelled by user`. Ponytail: one `updateJob` field is smallest diff; `ponytail: per-node poll ceiling; AbortSignal deferred until inside-node latency measured` at `harvest.ts:99-103`.
- **Inputs:** `src/app/api/dev/discovery/jobs/[id]/cancel/route.ts:1-21` admin-gated `requireAdmin` at `:7` (same `x-admin-key` `client.ts:81` as `health/route.ts:16`); `src/discovery/jobs.ts:10-39` `DiscoveryJobStatus` + `updateJob:276-318`; `src/discovery/harvest.ts:62-71` `HarvestDeps` + `HARVEST_LOCK:104` + `finally:244`; `provider-health.tsx:57-58` jobId `localStorage` seam.
- **Outputs:** Job `status:"cancelled"` persisted via `DataStore` seam (`KvRestStore:60-126` or `MemoryStore:28-57` via `setDataStoreForTests:192-194`); worker bails at next poll point. No new dep, no schema change beyond status variant.
- **touches:** [`src/app/api/dev/discovery/jobs/[id]/cancel/route.ts`, `src/discovery/jobs.ts`, `src/discovery/harvest.ts`, `src/app/dev/mission-control/_components/provider-health.tsx`, `tests/domain/cancel.test.ts`]
- **hazard_touches:** [`src/discovery/jobs.ts`, `src/discovery/harvest.ts`, `src/app/dev/mission-control/_components/provider-health.tsx`] — intersects M-R6 (`jobs.ts`) and M-R11/M-R7 (see §5)
- **blocked_by:** [] — frontier root per `R5-server-cancel.md:8`; gated only by architect (this plan) + Phase 0.
- **Locks:** `harvest-single-writer` (process-local `HARVEST_LOCK:104` → `harvest-lock.ts` SET NX upgrade is R1) + `job-index-single-writer` (via `updateJob` read) — sequential on those files.
- **Wave:** S — **sequential** with any other `harvest.ts`/`jobs.ts`/`provider-health.tsx` writer — see parallel guard below.
- **Acceptance (testable):**
  - [ ] `POST /api/dev/discovery/jobs/:id/cancel` admin-gated flips `running` → `cancelled` in `MemoryStore` (`setDataStoreForTests(new MemoryStore())` harness); `404` if missing `jobId`, `401` if admin wrong (via `requireAdmin`).
  - [ ] `executeJob(jobId,ctx,providerIds,ranAtIso,{store:getDataStore()})` with `MemoryStore` seeded cancelled before lock bails without calling any `DISCOVERY_NODE_IDS` node and `getJob(jobId).logs` contains `D00-CANCELLED` and `status==="cancelled"`.
  - [ ] Per-node: run that already completed one node then `cancel` set mid-job stops before next node (`harvest.ts:166-173` poll).
  - [ ] Idempotent: second `POST /cancel` on already `cancelled` is no-op `200 {cancelled:true}`.
  - [ ] UI: `provider-health.tsx` Stop→ `cancelling…` label then poll terminal `paused · cancelled by user` (DOM `getByRole('button',{name:/Stop/})` → title/aria).
  - [ ] `npm run typecheck` + `npm run test` (`vitest run` includes `tests/domain/cancel.test.ts`) green; `npm run build` green.
  - [ ] Staging: `git add src/app/api/dev/discovery/jobs/[id]/cancel/route.ts src/discovery/jobs.ts src/discovery/harvest.ts src/app/dev/mission-control/_components/provider-health.tsx tests/domain/cancel.test.ts` only.
- **Skills/tools/tests:** `lean-build` (reuse `updateJob`/`getJob` seam), `codebase-design` (seam depth), `verify-and-stop` + `vitest`.
- **Agent role:** `autoforge-worker (surgical — narrow route+store)` — **Reviewer:** `autoforge-reviewer` checks admin gate reuse, idempotence, no `AbortSignal` widening, no `discovery:job:cancel:*` second truth, ponytail ceiling comment kept.
- **Ponytail:** One `updateJob` call is the lazy solution. Skipped `AbortSignal` through every `runDiscoveryNode` (would widen N node interfaces) and separate KV cancel token (second truth fork). Add `AbortSignal` only when inside-node latency > measured before next node poll matters.
- **Self-approve:** **TRUE** — contract fully in `R5-server-cancel.md:22-27` + code at `cancel/route.ts:16`/`harvest.ts:166-173` mechanical; grilling `false` overridden by AD-11 architectural decision (code reuse of `updateJob` seam).
- **Self-approve grilling session:** Not required — mechanical reuse; if owner wants, 1-question grilling ("confirm per-node poll ceiling acceptable for long nodes") — expected **APPROVE**.

### M-R6 — Pagination cursor stability — FRONTIER — self-approving (AD-12 TRUE)

- **Objective:** Stable paging under 20-entry trim window `jobs.ts:159,189 slice(0,20)`. Use KV-backed `loadIndex(store?)→string[]` at `jobs.ts:94-113` (`INDEX_KEY="discovery:job:index"` at `:42`) then `indexOf(cursor)→slice(idx+1,idx+1+limit)` else `slice(0,limit)` with empty-window fallback `slice(0,limit)` at `:234-239`, `nextCursor:=last pageId` at `:272`. Document truncation in route comment. Keep `GET /api/dev/discovery/jobs?limit&cursor → {jobs,nextCursor,total}` at `jobs/route.ts:14-15` and cap `[1,20]` at `:13`. Ponytail: `O(indexLen)` where `indexLen≤20` trivial; KV sorted-set deferred.
- **Inputs:** `src/discovery/jobs.ts:223-274` `listJobs(limit,cursor,store?)` + `loadIndex` seam; `src/app/api/dev/discovery/jobs/route.ts:1-19` handler; `DataStore` `KvRestStore.keys`/`getMany` at `store.ts:108-114`.
- **Outputs:** Callers learn `nextCursor` not trim internals; stale cursor never yields lossy `jobs:[] , nextCursor:null` until last page per `R6:28`.
- **touches:** [`src/discovery/jobs.ts`, `src/app/api/dev/discovery/jobs/route.ts`, `tests/domain/jobs-pagination.test.ts`]
- **hazard_touches:** [`src/discovery/jobs.ts`] — intersects M-R5 (shared `jobs.ts` index scheme) → sequential.
- **blocked_by:** [] — root `R6-pagination-trim.md:8`. Cross-dep R2 index hygiene noted but not blocking now (single harvest lock serializes `appendLedgerKV` at `ledger.ts:11-26`).
- **Locks:** `job-index-single-writer` — `createJob:156-160` index update `put(INDEX_KEY)` atomic per KV `put` but read-modify-write not CAS; acceptable with single harvest at a time (`HARVEST_LOCK:104`). `ponytail: 20-window O(20) ceiling; KV tail scan deferred until n>500` at `jobs.ts:159`.
- **Wave:** S — **sequential** with M-R5 on `jobs.ts`; can parallel with P members (docs/client) if not touching `jobs.ts`.
- **Acceptance (testable):**
  - [ ] Route comment `// Documented truncation: index trimmed to 20; stale cursor→latest page` above `listJobs` or `jobs/route.ts:12`.
  - [ ] `listJobs` with `MemoryStore` seeded 21 jobs (first evicted): `cursor=evictedId → {jobs: latest 10, nextCursor: lastId, total:20}` never `nextCursor:null` until last page consumed.
  - [ ] Tests: `cursor present → slice(idx+1)`; `cursor missing → slice(0,limit)`; `cursor trimmed past → fallback latest page`; `total=ids.length`; `nextCursor=pageIds[pageIds.length-1] ?? null`; `limit clamp [1,20]`.
  - [ ] `jobs/route.ts:13` cap preserved `Math.min(20,Math.max(1,parseInt(limitRaw)||10))`.
  - [ ] `npm run test` includes pagination tests green; `typecheck`/`build` green.
  - [ ] Staging: `git add src/discovery/jobs.ts src/app/api/dev/discovery/jobs/route.ts tests/domain/jobs-pagination.test.ts` only.
- **Skills/tools/tests:** `lean-build`, `codebase-design` (keep `loadIndex` internal seam), `tdd` pure cursor arithmetic.
- **Agent role:** `autoforge-worker` — **Reviewer:** `autoforge-reviewer` verifies no API shape change, no `KEYS prefix*` scan introduced, ceiling comment present.
- **Ponytail:** Stable cursor via `loadIndex` scan wins over full KV `KEYS discovery:job:*` scan (expensive at `store.ts:112-114`). Skipped sorted-set until volume >500.
- **Self-approve:** **TRUE** — paging already lands at `jobs.ts:223-274`, shape preserved, contract at `R6:20-21`.
- **Self-approve grilling session:** Not required — pure read-path fix; optional 1-question ("confirm 20-window acceptable") → **APPROVE**.

### M-R7 — Refresh parity tooltip — FRONTIER — self-approving (AD-13 TRUE)

- **Objective:** Surface why Refresh bypasses dedup as structured help, not JSX comment. Keep single HTML `title` at `provider-health.tsx:482` `title="Refresh bypasses onRun dedup — deliberate manual inspection, no scheduling side-effect"` plus existing `aria-label` at `:397` Stop, `:407` Resume. BBC `R7 Refresh parity` no-ops beyond tooltip.
- **Inputs:** `src/app/dev/mission-control/_components/provider-health.tsx:383-391` comment intent + `474-485` Refresh button slot; HTML `title`/`aria-label` as native affordance (ponytail rung 4).
- **Outputs:** Discoverability for future readers, accessible.
- **touches:** [`src/app/dev/mission-control/_components/provider-health.tsx`, `tests/domain/provider-health-refresh.test.tsx`]
- **hazard_touches:** [`src/app/dev/mission-control/_components/provider-health.tsx`] — intersects M-R5 (same file) → sequential with M-R5, parallel_safe with doc/script lanes.
- **blocked_by:** [] — `R7-refresh-parity.md:8` root.
- **Locks:** none (client-only); `provider-health-client` file-level sequential with M-R5.
- **Wave:** P — **parallel_safe: true with docs/script lanes**, but **sequential with M-R5** on same file — see guard.
- **Acceptance (testable):**
  - [ ] `provider-health.tsx:482` Refresh `title` includes `dedup` and `manual inspection` (or `bypasses onRun dedup`) — `getByRole('button',{name:'Refresh'})` has `title.includes('dedup')`.
  - [ ] `aria-label` fallback present for tooltip consumers; no new component or dep.
  - [ ] `npm run test` DOM query passes; `typecheck` green.
  - [ ] Staging: `git add src/app/dev/mission-control/_components/provider-health.tsx tests/domain/provider-health-refresh.test.tsx` only.
- **Skills/tools/tests:** `lean-build` (native HTML), `verify-and-stop`.
- **Agent role:** `autoforge-worker (surgical — one attribute)` — **Reviewer:** `autoforge-reviewer` checks no `<Tooltip>` abstraction introduced (rung 2 violation), accessibility kept.
- **Ponytail:** HTML `title` is laziest solution. Skipped custom `<Tooltip>` component (new abstraction for one string). Keep `title` even if small font — survivability via `localStorage` jobId seam at `:57-58`.
- **Self-approve:** **TRUE** — trivial attribute, no deps, no behaviour change beyond discoverability.
- **Self-approve grilling session:** Not required — 0-risk UI string; auto **APPROVE**.

### M-R9 — Discovery doctor JSON contract — FRONTIER — self-approving (AD-15 TRUE)

- **Objective:** Keep `--json` branch at `scripts/discovery-doctor.ts:14-53` printing single JSON `{"providers":[{id,enabled,hostsOk,sampleHits}],"totals":{totalProviders,totalEnabled,totalSampleHits}}` at `:44-51` under `JSON_MODE=process.argv.includes("--json")` at `:15`. Both `--live --json` print valid JSON. Human path untouched `:55-112`. Deterministic for CI.
- **Inputs:** `scripts/discovery-doctor.ts:14-53` existing `LIVE:14` + `JSON_MODE:15` + `Promise.all(ids.map(... discover({limit:3}) :28-29))` reduce at `:44-48`; `DISCOVERY_SECRETS` shape via `keychain.ts`.
- **Outputs:** `stdout` one JSON object; `process.exit(0)` at `:52` if reachable, code preserved. `~1 query each` quota note at header `:5` stays.
- **touches:** [`scripts/discovery-doctor.ts`, `tests/domain/discovery-doctor-json.test.ts`]
- **hazard_touches:** [`scripts/discovery-doctor.ts`] — disjoint from all other modules (no other writer to this file) — fully parallel_safe.
- **blocked_by:** [] — `R9-discovery-doctor-json.md:8` root.
- **Locks:** none.
- **Wave:** P — **parallel_safe: true** with any P/S member (disjoint touches).
- **Acceptance (testable):**
  - [ ] `npx tsx scripts/discovery-doctor.ts --json > out.json && jq '.providers[0] | has("id") and has("enabled") and has("hostsOk") and has("sampleHits")' out.json` → true; `jq '.totals | has("totalProviders")'` → true.
  - [ ] `npx tsx scripts/discovery-doctor.ts --live --json` still prints valid JSON (header documents `limit:3` quota cost).
  - [ ] No `console.log` outside JSON branch; human-readable `else` path `:55-112` unchanged (no shape regression).
  - [ ] Unit test mocks `resolveProvider(...).discover` to return 3 hits and asserts `JSON.parse(stdout)` exact shape.
  - [ ] `npm run test` expects doctor test passes; `build` green (script is not bundled).
  - [ ] Staging: `git add scripts/discovery-doctor.ts tests/domain/discovery-doctor-json.test.ts` only.
- **Skills/tools/tests:** `lean-build` (reuse `discover` seam), `tdd`.
- **Agent role:** `autoforge-worker` — **Reviewer:** `autoforge-reviewer` checks no file output added, exit codes preserved, deterministic validator.
- **Ponytail:** Single `--json` branch is laziest. Skipped writing JSON to file (breaks `| jq` pipelines) and replacing human mode.
- **Self-approve:** **TRUE** — contract pinned at `R9:20-25`, exit preserved.
- **Self-approve grilling session:** Not required — auto **APPROVE**.

### M-R10 — Dedupe KV-truth with file seed fallback — FRONTIER — self-approving (AD-16 TRUE)

- **Objective:** Prefer KV truth on Vercel ROFS. Load `loadDedupeIndexAsync(store?,cwd?)` at `dedupe-persist.ts:51-58` `await s.get(DISCOVERY_DEDUPE_INDEX_KEY)` at `keys.ts:50` else fallback `loadDedupeIndex(cwd)` file seed at `:28-47`. Persist `persistDedupeFromResult:77-107` now `const index = await loadDedupeIndexAsync(store,cwd)` (replacing sync at `:85`) → `claimFingerprints` → `saveDedupeIndex(index,cwd)` at `:100` (EROFS warn at `:70-71` `WARN dedupe persist EROFS…`) → `await s.put(DISCOVERY_DEDUPE_INDEX_KEY,index)` at `:104`. File is best-effort mirror on ROFS per `R10:21`. Single writer `writeQueue:17` serializes.
- **Inputs:** `src/discovery/dedupe-persist.ts:12-107` + `src/lib/persistence/keys.ts:50` `DISCOVERY_DEDUPE_INDEX_KEY="discovery:dedupe-index"` + `src/lib/persistence/store.ts:16-26` `DataStore` seam; `harvest.ts:218-226` caller persists after loops; `state/dedupe-index.json` fallback file at `:12-14` if `isKv()` false.
- **Outputs:** ROFS no longer forks; local dev still writes both (`file + KV mirror`) deterministic in tests via fake `writeFileSync` throw `EROFS`. Global `__KV_DEDUPE_INDEX__:19-26` shim is ceiling — may delete when every caller can `await` (ponytail note).
- **touches:** [`src/discovery/dedupe-persist.ts`, `src/lib/persistence/keys.ts`, `tests/domain/dedupe-kv-truth.test.ts`]
- **hazard_touches:** [`src/discovery/dedupe-persist.ts`, `state/dedupe-index.json`] — disjoint from job-index/health/docs/wayfinder except future harvest persister; owns `dedupe-index-single-writer` via `writeQueue:17`.
- **blocked_by:** [] — `R10-dedupe-write-authority.md:8` root; `store.ts:130-181` fallback wrapper orthogonal (KV truth fallback still `MemoryStore` per-request island `isKv():53-60`).
- **Locks:** `dedupe-index-single-writer` — serialized `writeQueue.then` at `:17,74` is ceiling `ponytail: global queue ceiling; per-package lock deferred` at `:16`.
- **Wave:** S — **sequential only within this lock**; can parallel with P members (disjoint touches) — no file hazard with R5/R6/R7/R9/R15/R19 except via harvest caller but call is server-side not file-write parallel.
- **Acceptance (testable):**
  - [ ] `persistDedupeFromResult(packages,bundles,qualities,store?,cwd?)` with `MemoryStore` (or fake KV) loads via `loadDedupeIndexAsync` not sync `loadDedupeIndex(cwd)` — diff shows one-line swap at `:85`.
  - [ ] ROFS: stub `writeFileSync` to throw `{code:"EROFS"}` → `await persistDedupeFromResult(...)` still `await s.put(DISCOVERY_DEDUPE_INDEX_KEY, index)` succeeds and single `console.warn` `dedupe: FS mirror skipped (ROFS)` emitted (once) per `R10 AC:28`.
  - [ ] Local dev: both file exists (`stat state/dedupe-index.json` updated) and KV value equals file content after non-ROFS run.
  - [ ] Tests via `setDataStoreForTests(new MemoryStore())` deterministic; no new dep.
  - [ ] `npm run test` vitest ROFS/local dual tests green; `typecheck`/`build` green.
  - [ ] Staging: `git add src/discovery/dedupe-persist.ts src/lib/persistence/keys.ts tests/domain/dedupe-kv-truth.test.ts` only.
- **Skills/tools/tests:** `lean-build` (reuse `DataStore` KV seam), `surgical-patch` (one-line load swap), `tdd` fake FS.
- **Agent role:** `autoforge-worker (one-line fix + EROFS test)` — **Reviewer:** `autoforge-reviewer` verifies KV-first seam spelled at `R10:21-25` + `keys.ts:50`, no file-only regression, no secret, ponytail ceiling comments retained (`:17` queue).
- **Ponytail:** KV-first load + async persist + EROFS warn is ladder rung 2/3. Skipped removing file entirely (breaks `loadDedupeIndex` sync callers) and keeping file-only (forks on ROFS).
- **Self-approve:** **TRUE** — KV-first seam fully documented; fix is one-line load swap + EROFS test via fake `writeFileSync` throw per `R10 AC:30`.
- **Self-approve grilling session:** Not required — mechanical KV-first swap; auto **APPROVE** (optional 1-question "confirm file best-effort on ROFS acceptable" → **APPROVE**).

### M-R11 — Drop stale source comments — FRONTIER — self-approving (AD-17 TRUE)

- **Objective:** Prune narration that references removed helpers (`getGitHead()`, deleted global hook) in `src/discovery/harvest.ts` only per `R11:24`. Keep only `ponytail:` ceiling comments (`HARVEST_LOCK:99-103` process-local ceiling + upgrade `harvest-lock.ts` SET NX, `dedupe-persist.ts:16` per-package lock) and contract notes. No behaviour change.
- **Inputs:** `src/discovery/harvest.ts:99-103,116-173,140-148,244,256-323` as file to audit for `rg "getGitHead|global hook"` hits.
- **Outputs:** Source comments reduced; `typecheck` stays green.
- **touches:** [`src/discovery/harvest.ts`]
- **hazard_touches:** [`src/discovery/harvest.ts`] — intersects M-R5 (same file) → **sequential** with M-R5; parallel_safe otherwise.
- **blocked_by:** [] — `R11-drop-stale-comments.md:8` root; hazard-only sequence with M-R5.
- **Locks:** `harvest-single-writer` file-level — trivial comment-only lock.
- **Wave:** P — **sequential with M-R5** on same file; disjoint from R6/R9/R10/R15/R19.
- **Acceptance (testable):**
  - [ ] `rg -n "getGitHead|deleted global hook" src/discovery/harvest.ts` → 0 hits.
  - [ ] Every remaining comment passes "explains a ceiling or contract" test per `R11:21` — e.g. `HARVEST_LOCK process-local only… upgrade path…` kept, no stale removed-helper narration.
  - [ ] `npm run typecheck` — 0 errors; `npm run test` unaffected; `npm run build` green.
  - [ ] Staging: `git add src/discovery/harvest.ts` only (comment-only diff).
- **Skills/tools/tests:** `lean-build` (deletion over addition), `verify-and-stop`.
- **Agent role:** `autoforge-worker (surgical — prose comments)` — **Reviewer:** `autoforge-reviewer` (single line diff review, charter contract unchanged).
- **Ponytail:** Deletion over addition. Skipped broad `docs/` refactor (out of scope at `R11:30`).
- **Self-approve:** **TRUE** — prune stale comments, keep `ponytail:` ceilings.
- **Self-approve grilling session:** Not required — no logic change; auto **APPROVE**.

### M-R15 — README + CONTRIBUTING refresh — FRONTIER — self-approving (AD-21 TRUE)

- **Objective:** Text-only sync: `README.md:85-91` `## Deployment` + `docs/deployment.md:6-23` + `CONTRIBUTING.md` (create if absent, sync `docs/ops/deploy.md` if present) to `main is production; Vercel auto-deploys from main; discovery-harvest schedule refreshes state; see AGENTS.md Eval gates for freshness window` per `R15:21`. Keep command order per `R15:29` (no reorder). Reference `AGENTS.md:eval gates` + `docs/validation/eval-gates.md:15-38`.
- **Inputs:** `README.md:85-91` existing A/B Vercel options; `docs/deployment.md:6-23` auto-deploy from `main`; `CONTRIBUTING.md` existence check; `AGENTS.md:eval gates` freshness window.
- **Outputs:** Docs match actual `main is prod` flow; `git status` clean aside from doc edits.
- **touches:** [`README.md`, `CONTRIBUTING.md`, `docs/deployment.md`]
- **hazard_touches:** [`README.md`, `docs/deployment.md`, `CONTRIBUTING.md`] — disjoint from code seams — docs-single-writer only.
- **blocked_by:** [] — `R15-docs-production-deploy-refresh.md:8` root.
- **Locks:** `docs-single-writer` — sequential only with other doc writers (none else in this batch except possibly R14-tier1 if were included — deferred so no contention).
- **Wave:** P — **parallel_safe: true** with any code/script lane — touches disjoint (`*.md` text only).
- **Acceptance (testable):**
  - [ ] `rg -n "main is production|Vercel auto-deploys|discovery-harvest.*schedule" README.md docs/deployment.md` → at least 1 hit each; `rg "manual Vercel CLI" README.md` → 0 (no misleading manual invocation).
  - [ ] `docs/deployment.md` or `README.md:85-91` references `AGENTS.md Eval gates` freshness window (path preserved, not hardcoded threshold).
  - [ ] No commands reordered: diff shows only sentence edits in Deployment section, no `npm`/`npx` line reorder per `R15 AC:29`.
  - [ ] `npm run build` still green (docs don't affect build).
  - [ ] Staging: `git add README.md CONTRIBUTING.md docs/deployment.md` only.
- **Skills/tools/tests:** `lean-build` (prose only), `domain-modeling` glossary.
- **Agent role:** `autoforge-worker (surgical — prose)` — **Reviewer:** `autoforge-reviewer` (text-only, no code lock).
- **Ponytail:** Text-only sync is minimal. Skipped tutorial migration (out of scope `R15:32`).
- **Self-approve:** **TRUE** — text-only sync, no code.
- **Self-approve grilling session:** Not required — auto **APPROVE**.

### M-R19 — Wayfinder plumbing traceability — FRONTIER — self-approving (AD-22 TRUE)

- **Objective:** Make ticket compilation traceable — thin CLI reusing deep seam `src/wayfinder/tickets.ts:34-193` (`FRONT_MATTER_RE:34`, `isTerminalStatus:36-38`, `ticketKey:40-42`, `classifyTickets frontier:119-134`, `buildTicketIndex:169-189` counts `total/open/claimed/blocked/closed/frontier/ready_without_owner/hitl_frontier`, `indexWayfinderTickets:191` scans `WAYFINDER_MAPS_DIR="workflow/wayfinder/maps"` at `ticket-types.ts:2`). New adapter `scripts/wayfinder-tickets.ts` calls `indexWayfinderTickets()` → parse `--json/--lane` at `process.argv`, print `wayfinder N tickets · frontier N · ready N · hitl N · blocked N` or JSON `{counts,tickets}`. Add `package.json:8-21` `"tickets":"tsx scripts/wayfinder-tickets.ts"`. Existing adapters prove seam real: markdown files `workflow/wayfinder/maps/*/tickets/*.md` (`tickets.ts:148-158`), compiled `TicketIndex` JSON at `src/app/api/dev/tickets/route.ts:6-17` (ENOENT→`{total:0}` at `:14`), `ticket-board.tsx:28-33` `inLane` rendering. Markdown stays canonical per `TRACKER.md:17` (`status`+`assignee` edit at `:60-62` reflected without code change). No GitHub sync per `R19:51` out of scope.
- **Inputs:** `src/wayfinder/tickets.ts:34-193` + `ticket-types.ts:2-51` + `tickets/route.ts:6-17` + `ticket-board.tsx:11-99` + `workflow/wayfinder/TRACKER.md:14-17` + `workflow/wayfinder/maps/ops-residual/MAP.md:39-59` decision surface; prior R19 execution `R19.md:1-...` evidence `npm run tickets --json` shape validated.
- **Outputs:** `npm run tickets` and `npx tsx scripts/wayfinder-tickets.ts --json` emit valid JSON with `counts.total/frontier/ready_without_owner/hitl_frontier/blocked` and `tickets[].key|status|hitl|ready_without_owner` per `R19 AC:45-46`; `/dev/mission-control` Tickets lane same counts via same `TicketIndex`.
- **touches:** [`src/wayfinder/tickets.ts`, `src/wayfinder/ticket-types.ts`, `src/app/api/dev/tickets/route.ts`, `src/app/dev/mission-control/_components/ticket-board.tsx`, `scripts/wayfinder-tickets.ts`, `package.json`, `tests/domain/wayfinder-tickets.test.ts`, `workflow/wayfinder/maps/ops-residual/tickets/R19-wayfinder-plumbing-traceability.md`]
- **hazard_touches:** [`workflow/wayfinder/maps/**`, `scripts/wayfinder-tickets.ts`, `package.json`, `src/wayfinder/**`] — disjoint from jobs/harvest/dedupe/docs/doctor; owns `wayfinder-compile` lock (`readdirSync` sorted at `tickets.ts:141,151` makes deterministic). Reads `maps` only, no write contention.
- **blocked_by:** [] — `R19:8` `blocked_by:[]` root per ticket; hazard-free roots may batch with P.
- **Locks:** `wayfinder-compile` — `readdirSync` + `FRONT_MATTER_RE` at `tickets.ts:141,151` deterministic; no write contention (reads only); CLI `package.json` `tickets` script update uses `gitignore-single-writer` analogue `package.json-single-writer` if concurrent `package.json` edits exist — none else touches `package.json` in this batch, so parallel_safe.
- **Wave:** P — **parallel_safe: true** with all P members (R7,R9,R15,R11) and S members logically but execution may batch after P for clarity; file touches disjoint from R5/R6/R10.
- **Acceptance (testable):**
  - [ ] `npm run tickets -- --json` (or `npx tsx scripts/wayfinder-tickets.ts --json`) emits valid JSON: `jq '.counts | has("total") and has("frontier") and has("ready_without_owner") and has("hitl_frontier") and has("blocked")'` → true; `jq '.tickets[0] | has("key") and has("status") and has("hitl")'` → true; `counts.total` == `tickets.length` or `≥ frontier`.
  - [ ] `npm run tickets` human summary matches `wayfinder <N> tickets · frontier <N> · ready <N> · hitl <N> · blocked <N>` and `--lane=ready|hitl|blocked|all` filter reuses `inLane` logic.
  - [ ] `/dev/mission-control` Tickets lane counts equal CLI `frontier/ready_without_owner/hitl_frontier/blocked` (manual visual or `flow.spec` if present `ticket-board.tsx:36-40` rows `index.tickets.filter(inLane)`).
  - [ ] Editing one ticket front-matter `status: open→claimed` with `assignee: alice` reflected in both CLI and board without code change (canonical `TRACKER.md:60-62`).
  - [ ] `npm run test` includes `wayfinder-tickets.test.ts` green (deterministic sort `localeCompare` at `:186`); `typecheck` + `build` green.
  - [ ] Staging: `git add scripts/wayfinder-tickets.ts src/wayfinder/tickets.ts src/wayfinder/ticket-types.ts src/app/api/dev/tickets/route.ts src/app/dev/mission-control/_components/ticket-board.tsx package.json tests/domain/wayfinder-tickets.test.ts workflow/wayfinder/maps/ops-residual/tickets/R19-wayfinder-plumbing-traceability.md` (explicit; never `git add -A`).
- **Skills/tools/tests:** `codebase-design` (seam depth one interface three adapters proves real), `wayfinder` (maps/Destination/Notes), `lean-build` (thin adapter), `verify-and-stop`.
- **Agent role:** `autoforge-worker (surgical — thin CLI)` — **Reviewer:** `autoforge-reviewer` checks reuse of `indexWayfinderTickets` seam, no GitHub sync introduced (R19 out of scope at `:51`), markdown canonical retained, `FRONT_MATTER_RE` not widened.
- **Ponytail:** Single-function seam `indexWayfinderTickets()` serves API+board+CLI — leverage. Skipped migrating ops-residual to GitHub Issues (rejected at `R19:51`) and DB-backed index (speculative). `ponytail: single function seam is ceiling; GitHub sync deferred`.
- **Self-approve:** **TRUE** — contract fully spelled at `R19:38-48` with 3 real adapters (markdown, compiled JSON, board UI) — one adapter would be hypothetical but we have 3, CLI is 4th thin.
- **Self-approve grilling session:** Not required — mechanical reuse; if 1-question grilling ("confirm local-markdown canonical for ops-residual stays") → **APPROVE** per `TRACKER.md:17`.

---

## 5. Execution work order (DAG + resource serialization + waves)

**DAG (blocked_by edges — semantic ordering, not hazard locks):**

```
M-R5  (cancel)     ─┐
M-R6  (pagination) ─┤ blocked_by:[] all roots — no semantic DAG
M-R7  (tooltip)    ─┤ (hazard-only serialization per §6 grilling note)
M-R9  (doctor)    ─┼──► no downstream blocked_by (all roots)
M-R10 (dedupe)    ─┤
M-R11 (comments)  ─┤
M-R15 (docs)      ─┤
M-R19 (wayfinder) ─┘
```

- Semantic `blocked_by:[]` for all 8 per tickets `R5:8`…`R19:8` — none is logically blocked by another frontier ticket. Sequencing is **resource-hazard only** (same-file writes), not DAG. Deferred R8/R12/R13/R14 are not nodes in this lane; they become successors only after owner review, hence no edges from them.
- Shared-state note: R8 `lockHolder` sub-field would block on R1 `harvest-lock.ts` SET NX when that ships — deferred, not in this lane.

**Resource locks (single-writer guards):**

| Lock | Members in this plan | Policy | Touches that force serialization |
|---|---|---|---|
| `vault-state-single-writer` | none directly writing `state/vault-notes.json`/`vault/views/**` in this lane — but declared as global guard; would serialize any such writer; pre-commit still runs `node scripts/vault-sync.mjs --check` at `scripts/vault-sync.mjs:16-44` (HEAD worktree `git worktree add --detach ${tmp} HEAD` `:17` + symlink `node_modules` `:19` + `Buffer.equals` `:31`) | sequential; `vault-sync --check` before handoff | `state/vault-notes.json`, `vault/views/**`, `.autoforge/discovery/tracker-index.md`, `vault/gotchas/**` settlement |
| `harvest-single-writer` | `M-R5`, `M-R11` | sequential on `src/discovery/harvest.ts` `HARVEST_LOCK:104` + `finally:244` → `harvest-lock.ts` upgrade is R1 `SET NX EX 3600` at `R1-cross-instance-harvest-lock.md:24` | `src/discovery/harvest.ts:99-173,244` |
| `job-index-single-writer` | `M-R5`, `M-R6` | sequential on `src/discovery/jobs.ts` index `PREFIX:41` `INDEX_KEY:42` `slice(0,20)` at `:159,189`; `put(INDEX_KEY)` not CAS but single harvest at a time | `src/discovery/jobs.ts:41-42,64-92,133-357` + `src/app/api/dev/discovery/jobs/*` |
| `provider-health-client` | `M-R5`, `M-R7` | sequential on `src/app/dev/mission-control/_components/provider-health.tsx` client component (no KV lock, file-level) | `provider-health.tsx:163-171,383-391,474-485` |
| `dedupe-index-single-writer` | `M-R10` (only writer in this lane) | serialized `writeQueue.then` at `dedupe-persist.ts:17,74` `ponytail: global queue ceiling; per-package lock deferred` | `src/discovery/dedupe-persist.ts:12-107`, `src/lib/persistence/keys.ts:50`, `state/dedupe-index.json` (best-effort mirror) |
| `wayfinder-compile` | `M-R19` | `readdirSync` sorted at `tickets.ts:141,151`; no write contention (reads `workflow/wayfinder/maps/**`); deterministic `notes.sort(localeCompare)` analogue | `src/wayfinder/tickets.ts:34-193`, `workflow/wayfinder/maps/**`, `scripts/wayfinder-tickets.ts`, `package.json`, `ticket-board.tsx` |
| `docs-single-writer` | `M-R15` (only doc writer in this lane; R14 deferred so no contention) | text-only, no lock needed but `git add` explicit | `README.md`, `CONTRIBUTING.md`, `docs/deployment.md` |
| `health-read` (deferred) | — (R8 not in lane) | in-process `withPersistenceSingleWriter` at `single-writer.ts:7-16` | `src/app/api/dev/health/route.ts:15-169`, `src/discovery/health-aggregate.ts:20-61` |
| `ci-single-writer` (deferred) | — (R13 not in lane) | `check-eval-gate-freshness.mjs` + `.github/workflows/ci.yml` after HITL | `.autoforge/**`, `ci.yml` |

Staging hygiene `git add <paths>` only, never `git add -A` (`AGENTS.md:21-23`). Parallel `vault/journal/**` lanes apply only to vault frontier lane, not ops-residual, but same rule keeps `workflow/wayfinder/**` edits disjoint per ticket file.

**Waves (= parallel groups):**

| Wave | Members | Parallel? | Guard / rationale |
|---|---|---|---|
| **P-stateless-docs-client** | `M-R7`, `M-R9`, `M-R15`, `M-R19` | **parallel_safe: true** *within P if touches disjoint* | disjoint `touches` (`provider-health.tsx` tooltip vs `discovery-doctor.ts` vs `README.md` vs `wayfinder` tickets seam + CLI). *Exception:* `M-R7` touches `provider-health.tsx` same as `M-R5` — flagged **sequential with M-R5** below, but safe with R9/R15/R19. `R19` `wayfinder-compile` reads markdown only → no write contention. |
| **P-comments** | `M-R11` | **parallel_safe with P-stats where file disjoint**; **sequential with M-R5** on `harvest.ts` | comment-only; shares `harvest.ts` hazard with `M-R5` → flagged sequential; otherwise may batch same turn as P. |
| **S-state-writers** | `M-R5`, `M-R6`, `M-R10` | **serialize per seam** — each touches a single-writer seam (`harvest.ts` vs `jobs.ts` vs `dedupe-persist.ts`) | `M-R5↔M-R6` on `jobs.ts` → sequential; `M-R5↔M-R11` on `harvest.ts` → sequential; `M-R10` standalone on dedupe lock, can run same turn as S members if touches disjoint *but* `S` wave defined as serial per file — cross-file (dedupe vs jobs) may parallel same turn *only if* scheduler proves `touches` disjoint — they are (`dedupe-persist.ts` vs `jobs.ts`), so `M-R10` may dispatch parallel with one of `M-R5`/`M-R6` *after* their file conflict resolved. Simplest schedule is serial `M-R10 → M-R6 → M-R5` with `M-R11` before or after `M-R5`. |
| **G-gates** | (none in this lane; R8 health / R13 CI deferred) | — | — |

**Parallelization guard flags (touches intersecting = sequential):**
- `M-R5` + `M-R6` parallel **NOT allowed** (both touch `src/discovery/jobs.ts` → `job-index-single-writer`).
- `M-R5` + `M-R11` **NOT allowed** (both touch `src/discovery/harvest.ts` → `harvest-single-writer`).
- `M-R5` + `M-R7` **NOT allowed** (both touch `provider-health.tsx` → `provider-health-client` file).
- `M-R6` + `M-R11` **allowed** (touches disjoint `jobs.ts` vs `harvest.ts` — but note `M-R5` is the interferer; so `M-R6` and `M-R11` can parallel each other).
- `M-R7` + `M-R11` **allowed** (`provider-health.tsx` vs `harvest.ts` disjoint from each other except both sequential with M-R5).
- `M-R9`, `M-R15`, `M-R19` **allowed among themselves and with S/P** (all touches disjoint from jobs/harvest/provider-health/dedupe).
- `M-R10` **allowed with P and with S members that don't share `dedupe-persist.ts`** (only R10 owns that seam, so technically allowed with both M-R5 and M-R6 in same turn, but conservative lane serializes `S` wave members for lock clarity).
- `vault-state` writers (none in this lane writing `state/vault-notes.json`) — declared guard still applies; if a future module in same turn touches `state/vault-notes.json`, it must serialize behind `vault-sync --check` — none here, so no contention.

**Recommended schedule (aggressive where disjoint, conservative where touches intersect):**
1. Baseline: `node scripts/vault-sync.mjs --check` (if fail, `node scripts/vault-sync.mjs && git add state/vault-notes.json vault/views && git commit` before plan). `npm run build` dry-run green.
2. Turn P1: dispatch `M-R9` + `M-R15` + `M-R19` in parallel (disjoint `scripts/discovery-doctor.ts` vs `README.md` vs `wayfinder` seam — three `Task autoforge-worker` same turn ok). `M-R7` waits because it shares `provider-health.tsx` with `M-R5` — if `M-R5` not yet dispatched, `M-R7` could join P1; but to avoid conflict, run `M-R7` with `M-R11` in next turn or before `M-R5`.
3. Turn P2: dispatch `M-R11` + `M-R7` parallel (disjoint files `harvest.ts` vs `provider-health.tsx` — allowed).
4. Turn S1: dispatch `M-R10` alone or parallel with P remainder (disjoint with all P, safe same turn as `M-R11`/`M-R7` if scheduler proves `touches` disjoint — they are — so `M-R10` may batch with P2 for throughput; simplest is serial after P2).
5. Turn S2: `M-R6` (pagination `jobs.ts`).
6. Turn S3: `M-R5` (cancel touches `jobs.ts`+`harvest.ts`+`provider-health.tsx` — must be **alone** after `M-R6` and `M-R11`+`M-R7` committed; explicit `git add` set at §4).
7. Commit discipline: each module commits its `touches` set with explicit `git add <paths>` — never `git add -A`. Example `M-R5`: `git add src/app/api/dev/discovery/jobs/[id]/cancel/route.ts src/discovery/jobs.ts src/discovery/harvest.ts src/app/dev/mission-control/_components/provider-health.tsx tests/domain/cancel.test.ts`.
8. Proof: `npm run lint && npm run typecheck && npm run test (vitest) && npm run build` green + `node scripts/vault-sync.mjs --check` green + `git diff --exit-code -- vault/views state/vault-notes.json` green if vault unchanged.

**Global proof before handoff (must be in every module's DoD):** `npm run build` green + `vitest` green + `node scripts/vault-sync.mjs --check` green (committed `state/vault-notes.json` equals HEAD-compiled via `Buffer.equals` at `vault-sync.mjs:31`) + tracker-index drift 0 for settled items + staging hygiene `git status --porcelain` shows only `touches` lane.

---

## 6. Skills & agent roles per module

| Skill | When in this plan |
|---|---|
| **lean-build** | every module — reuse `DataStore`/`MemoryStore`/`updateJob`/`loadIndex`/`title`/`yaml` seams, stdlib, smallest diff, no new deps |
| **codebase-design** | seam awareness — keep `jobs.ts:listJobs` deep (small `nextCursor` interface), `dedupe-persist.ts:loadDedupeIndexAsync` medium-deep, `health-aggregate` deep, `wayfinder:indexWayfinderTickets` deep (one interface, 4 adapters), `frontmatter.mjs` deep vs `FRONT_MATTER_RE` shallow |
| **domain-modeling** | glossary for `ops-residual` `frontier` `blocked_by` `status:open|closed` `harvestHealth` `wayfinder-compile` |
| **wayfinder** | **M-R19 only** — reads `workflow/wayfinder/maps/ops-residual/MAP.md:39-59` + `TRACKER.md:14-17` + `tickets/*.md` front-matter; deferred `compileTrackerIndex()` until frontier >10 (n=12 total but 8 self-approving → keep hand-edited tracker-index, no DB) |
| **tdd / verify-and-stop** | M-R5 cancel `MemoryStore` flip test, M-R6 cursor trim tests, M-R9 `JSON.parse` shape test, M-R10 ROFS fake-FS test, M-R19 `wayfinder-tickets` counts test |
| **surgical-patch** | M-R10 one-line `loadDedupeIndexAsync` swap, M-R11 comment prune, M-R5 narrow route+store patch |
| **improve-codebase-architecture** | §8 deepening candidates — only where second adapter proves seam (wayfinder 3→4 adapters, dedupe KV vs file) |

**Agent roles:**
- `M-R5` → `autoforge-worker (surgical — route+store)` + `autoforge-reviewer` (admin gate + idempotence + ponytail ceiling)
- `M-R6` → `autoforge-worker` + `autoforge-reviewer` (no API shape change)
- `M-R7` → `autoforge-worker (one attribute)` + `autoforge-reviewer` (no `<Tooltip>`)
- `M-R9` → `autoforge-worker` + `autoforge-reviewer` (JSON branch deterministic)
- `M-R10` → `autoforge-worker (one-line KV-first)` + `autoforge-reviewer` (ROFS warn)
- `M-R11` → `autoforge-worker (prose comments)` + `autoforge-reviewer` (comment-only diff)
- `M-R15` → `autoforge-worker (prose docs)` + `autoforge-reviewer` (text-only)
- `M-R19` → `autoforge-worker (thin CLI + wayfinder seam)` + `autoforge-reviewer` + optional `autoforge-validator` (CLI↔board consistency)

**Task grouping for `05_execute`:** Parallel group `[M-R9, M-R15, M-R19]` may dispatch same turn (disjoint `touches`). Partial parallel `[M-R11, M-R7]` next turn. Sequential group `[M-R10] → [M-R6] → [M-R5]` where each holds its `*-single-writer` — they cannot parallel on intersecting files (jobs/harvest/provider-health). `vault-state` writers (none in this lane) would be sequential `G` if added; instead `G` is proof gate after all lanes. `module boundary ≠ child-session boundary` — `M-R9`+`M-R15`+`M-R19` are distinct modules but may be executed in one child session batch (parallel calls); `M-R5` must follow in next turn after `M-R6`/`M-R11`/`M-R7` land to avoid same-file race.

---

## 7. Verification — no new infra, testability via vault-sync + vitest + build

- **Per-module runnable check (no fixtures):**
  - M-R5: `vitest run tests/domain/cancel.test.ts` — asserts `seeding running→POST /cancel → status cancelled && next executeJob bails + D00-CANCELLED`.
  - M-R6: `vitest run tests/domain/jobs-pagination.test.ts` — asserts `cursor present/missing/trimmedPast` + `limit clamp [1,20]`.
  - M-R7: `vitest run tests/domain/provider-health-refresh.test.tsx` — `getByRole('button',{name:'Refresh'})` has `title.includes('dedup')`.
  - M-R9: `npx tsx scripts/discovery-doctor.ts --json | jq '.providers[0] | has("id")'` → true; `vitest` doc-json shape.
  - M-R10: `vitest run tests/domain/dedupe-kv-truth.test.ts` — stubs `writeFileSync→EROFS` → `WARN` once + KV updated; non-ROFS → both written.
  - M-R11: `rg "getGitHead"` 0 hits; `npm run typecheck` 0 errors.
  - M-R15: `rg "main is production" README.md` 1+ hit; `rg "manual Vercel CLI" README.md` 0.
  - M-R19: `npx tsx scripts/wayfinder-tickets.ts --json | jq '.counts.frontier'` number; `vitest` wayfinder compile sorted deterministic.
- **Global gates (must pass before handoff, per §5):**
  - `npm run lint` green (no new dep, `title`/`tsx` seams preserve lint).
  - `npm run typecheck` (`tsc --noEmit`) green — especially `M-R11` comment-only must not break types, `M-R19` `tsx` CLI types via `npx tsc --noEmit` (scripts excluded but `src/wayfinder` keeps types).
  - `npm run test` (`vitest run`) green — all 5+ domain tests (+ existing `discovery-harvest.test.ts`, `wayfinder-tickets.test.ts`).
  - `npm run build` (`next build`) green — health/wayfinder/jobs seams keep API shape.
  - `node scripts/vault-sync.mjs --check` → `[vault-sync] committed vault state matches HEAD compilation` at `:38` (exit 0) — even though this lane is ops-residual, guard ensures no vault determinism poison via `state/vault-notes.json` or `vault/views/**` was introduced by doc/script edits (docs don't touch vault, but gate still required per `AGENTS.md:15-18`).
  - `git diff --exit-code -- vault/views state/vault-notes.json` green if unchanged; if touched (shouldn't be), `node scripts/vault-sync.mjs` + explicit `git add` co-commit with `vault/views` via `vault-state-single-writer`.
  - Staging audit: `git status --porcelain` shows only `touches` files per §4 `git add` sets — no `??` `.autoforge/` spurious, no `vault/journal/**` foreign lane pulled.
- **Bloom second-order:** `jq '.notes[] | select(.status=="open")' state/vault-notes.json` unchanged (this lane doesn't settle gotchas); `workflow/wayfinder/TRACKER.md` line count stable; `wayfinder` index `counts.frontier` = 8 self-approving OPEN before runs → decreases as modules claim/resolve via front-matter edit (`status: open→closed` or `assignee:`) reflected in CLI & board without code change.

---

## 8. Risks & mitigations (carried from grilling-remaining + report-remaining §7 + decisions-remaining AD-24..25)

| Risk | Where it bites | Mitigation in this plan | Ponytail ceiling |
|---|---|---|---|
| **KV vs Memory split-brain** — fallback wrapper `store.ts:136-180` silently falls to MemoryStore on KV failure | `store.ts:138-150` `try kv→catch→fallback`; `jobs.ts:isKv()` branch picks file when fallback kind still `"kv"` | Keep `StoreUnavailableError:9-14` distinction; `setDataStoreForTests` hermetic tests; R1 tracks distributed `SET NX EX 3600` | `ponytail: fallback shadow ceiling; explicit error propagation deferred until R1/R2 CAS measurable` |
| **Ledger index race** — `ledger.ts:11-26` read-modify-write loses concurrent `INDEX_KEY` | `appendLedgerKV:22 sort+slice(-500):24-25` | Single `HARVEST_LOCK:104` serializes (`harvest-single-writer`); KV CAS upgrade R1 | `ponytail: global harvest lock ceiling; per-cell KV CAS deferred per MAP.md:17` |
| **Orphan per-entry keys** — `getLedgerTailKV:34-37` filters nulls but leaves INDEX dirty | `ledger.ts:36` `filter(v!==null)` | Self-heal pass dropping dead seqs would be R2 — defer until orphan rate measurable | `ponytail: filter-only ceiling` |
| **Dedupe fork on ROFS** — Vercel `EROFS`, file lags KV | `dedupe-persist.ts:70` `msg.includes("EROFS")` | KV-first `loadDedupeIndexAsync:54` + EROFS warn+continue at `:70-71` + KV `put` at `:104`; `writeQueue:17` single-writer | `ponytail: EROFS warn+continue ceiling; per-account locks deferred at :16` |
| **Cancel not visible cross-lambda** — `HARVEST_LOCK:104` local bool | `harvest.ts:104,140-149` | Early `getJob` cancel check `118-130` catches server cancel even without distributed lock; R1 adds KV SET NX | `ponytail: process-local lock ceiling; KV deferred to R1 at MAP.md:16,41-42` |
| **Stale cursor lossy page** — trim window 20 | `jobs.ts:159,189` `slice(0,20)`; `listJobs:232-242` | Fallback to latest page `:238,242` never empty until last page | `ponytail: 20-window ceiling; KV tail scan deferred until n>500` |
| **Health shape drift** — ticket wants `lastRunStatus/lockHolder` but code `lastHits/degraded` | `health-aggregate.ts:7-12` vs `R8:21` | Deferred — R8 NEEDS REVIEW until owner freezes `HarvestHealth` (bridge `lastRunStatus`+`indexedEntriesCount` after R1 if needed) | none — shape freeze owner call |
| **Doctor quota burn** — `--json` pings `discover({limit:3})` | `discovery-doctor.ts:28-29` | Keep limit 3 small `~1 query each` at header `:5`; R16 deferred | `ponytail: live ping ceiling; quota monitoring via R16 deferred` |
| **Worktree orphan** — crash leaves `vault-head-*` tmp | `scripts/vault-sync.mjs:45-52` `finally` | Best-effort `worktree remove --force` + `rmSync(tmp)` at `:45-52`; `ponytail: best-effort cleanup ceiling; tmp reaper cron deferred` | — |
| **Tracker-index drift** — `.autoforge/discovery/tracker-index.md` vs `state/vault-notes.json` open-set | `tracker-index.md:22-96` vs `state/vault-notes.json` | Not in this frontier core (R8/R12/R14/R15 differ) but same discipline: co-commit via explicit `git add` per `AGENTS.md:21-23` | `ponytail: co-commit ceiling; compileTrackerIndex() deferred until frontier >10` |
| **Staging poison** — `git add -A` pulls foreign `vault/journal/**` / `workflow/wayfinder/**` lanes | `AGENTS.md:21-23` | Each module `git add <paths>` exact `touches`; no blanket add | doc ceiling |
| **Wayfinder CLI drift** — board vs CLI vs markdown | `tickets.ts:186 sort localeCompare`, `ticket-board.tsx:38-40` filters, CLI same `index.counts` | Board+CLI both call `indexWayfinderTickets()` — single seam parity; deterministic `readdirSync` sorted at `tickets.ts:141,151` | `ponytail: single function seam ceiling; GitHub sync deferred per R19:51` |
| **Storage policy churn** — `.autoforge/**` vs `workflow/wayfinder/maps/**` canonical | `.gitignore:1-46` + `.autoforge/state.json` | R12 deferred — do not touch `.gitignore`/`.autoforge/AGENTS.md` in this lane; leave `workflow/wayfinder/maps/**` canonical for ops-residual per `TRACKER.md:17` | curated vs ignore owner call |
| **Freshness gate warn-only** — `check-eval-gate-freshness.mjs:25` never fails CI | `R13` deferred HITL — must harden to `exit 1` + GH Action before enforcement | Deferred lane ensures no accidental CI break in this 8-module batch | — |

---

## 9. Interfaces & seam traceability (reference — ponytail ladder rung cited)

```
DataStore seam (reuse rung 2)         KV vs Memory vs file mirror
  src/lib/persistence/store.ts:16-26   MemoryStore:28-57  KvRestStore:60-126  getDataStore:183-188  setDataStoreForTests:192-194
  Jobs own index/key: jobs.ts:PREFIX:41 INDEX_KEY:42  loadIndex:94-113  createJob:133-197  listJobs:223-274  updateJob:276-318
  Dedupe owns: keys.ts:50 DISCOVERY_DEDUPE_INDEX_KEY + dedupe-persist.ts:28-107 (loadDedupeIndexAsync:51-58 KV-first)
  Cancel owns:  POST /api/dev/discovery/jobs/:id/cancel  admin-gated requireAdmin:cancel/route.ts:7  → updateJob→status cancelled
  Harvest owns polls: harvest.ts:118-130 before lock + 166-173 per-node + log D00-CANCELLED + HARVEST_LOCK:104 finally:244
  Provider-health owns UI: provider-health.tsx:163-171 POST /cancel fire-and-forget + title/aria at 383-391/474-485
  Doctor owns CLI: discovery-doctor.ts:14-53 LIVE:14 JSON_MODE:15  Promise.all(discover limit:3):28-29  stdout JSON:44-51
  Wayfinder owns compile: tickets.ts:34-193 FRONT_MATTER_RE:34 isTerminal:36-38 ticketKey:40-42 classifyTickets:119-134 buildTicketIndex:169-189 indexWayfinderTickets:191  ticket-types.ts:2 WAYFINDER_MAPS_DIR  tickets/route.ts:6-17  ticket-board.tsx:28-33 inLane
  Health (deferred R8): health-aggregate.ts:20-61 pure + health/route.ts:15-169 (future KV+listJobs bridge; degraded at :157)
```

Least-privilege: cancel POST writes via `updateJob` admin-gated; pagination reads via `loadIndex` admin-read; tooltip client-only; doctor reads `providerEnabled`+`discover` read-only; dedupe persists server-side via `DataStore.put(DISCOVERY_DEDUPE_INDEX_KEY)` after `writeQueue`; wayfinder compiles read-only; docs have no privilege. All variation stays behind existing seams — no new deps, stdlib `fs/path/crypto`, existing `yaml`, `tsx` already installed.

---

## 10. Self-approve verdict per module (grilling → decisions override)

| Decision | Grilling `self-approve` at `grilling-remaining.md` | Architectural decision `self-approve` at `decisions-remaining.md` | Final verdict for this plan | Grilling session needed? |
|---|---|---|---|---|
| M-R5 cancel | `false` at :27 | **AD-11 TRUE** | **TRUE self-approving** | No — 0- or 1-q session ("confirm per-node poll ceiling") → **APPROVE** |
| M-R6 pagination | `false` at :36 | **AD-12 TRUE** | **TRUE self-approving** | No — auto **APPROVE** |
| M-R7 tooltip | `false` at :44 | **AD-13 TRUE** | **TRUE self-approving** | No — auto **APPROVE** |
| M-R9 doctor JSON | `false` at :58 | **AD-15 TRUE** | **TRUE self-approving** | No — auto **APPROVE** |
| M-R10 dedupe KV-truth | `false` at :64 | **AD-16 TRUE** | **TRUE self-approving** | No — auto **APPROVE** (optional "ROFS warn wording") → **APPROVE** |
| M-R11 comments | `false` at :72 | **AD-17 TRUE** | **TRUE self-approving** | No — auto **APPROVE** |
| M-R15 deploy docs | `false` at :100 | **AD-21 TRUE** | **TRUE self-approving** | No — auto **APPROVE** |
| M-R19 plumbing | `false` at :107 | **AD-22 TRUE** | **TRUE self-approving** | No — auto **APPROVE** (optional "local-markdown canonical confirm") → **APPROVE** |

**Deferred (not in this execution lane):** `R8 AD-14 FALSE NEEDS REVIEW (shape freeze)`, `R12 AD-18 FALSE HITL-policy`, `R13 AD-19 FALSE HITL`, `R14 AD-20 NEEDS REVIEW (clarify file)` — each requires single-owner grilling before workers harden consumers; R8 grilling topic "HarvestHealth field freeze: `lastRunAt/lastSuccessAt/lastHits/degraded` vs ticket `lastRunStatus/lockHolder/lockAcquiredAt/indexedEntriesCount` — bridge or rename?" expected 15-min owner session; R12 "curate vs ignore `.autoforge/` — pick (a) or (b)" + R13 "freshness `7d` threshold source + `process.exit(1)` wording" + R14 "canonical `tier1-archive.mjs` path" similarly.

**Overall 8/8 self-approving for this lane; 4 deferred need single-owner review — matches `decisions-remaining.md:184-200` 8/12 self-approved overall.** No new ADR beyond this log and prior `AD-01..AD-10` + `AD-11..AD-25` remaining; if owner requests formal `docs/adr/*`, short ADRs for `AD-14 harvest-health shape` and `AD-18 AutoForge staging` only when `CHARTER.md:82-85` amendment triggers.

---

*Evidence anchoring for this plan:* `state/vault-notes.json:4` `note_count:25` baseline (vault lane) unchanged by this ops-residual lane but guard `vault-sync --check` at `scripts/vault-sync.mjs:16-44` still gates; `tracker-index.md:22-96` 12 OPEN → 8 modules; `jobs.ts:41-42,223-274` cursor stability; `harvest.ts:104,118-173` cancel polls; `provider-health.tsx:482` tooltip; `discovery-doctor.ts:44-51` JSON contract; `dedupe-persist.ts:51-58,85,104` KV-truth; `wayfinder/tickets.ts:169-191` canonical compile; `package.json` `tickets` script. Next anchor after execution: `tests/domain/{cancel|jobs-pagination|provider-health-refresh|discovery-doctor-json|dedupe-kv-truth|wayfinder-tickets}.test.ts` green + `npm run build` + `vault-sync --check` pass + `git status --porcelain` shows only `touches` lanes + `workflow/wayfinder/maps/ops-residual/tickets/*` front-matter `status/assignee` lane sync.
