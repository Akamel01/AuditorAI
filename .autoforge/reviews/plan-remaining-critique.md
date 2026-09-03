# Plan-Remaining Critique — ops-residual 8/12 self-approving (R5,R6,R7,R9,R10,R11,R15,R19)

**Reviewer:** autoforge-reviewer (independent, read-only, ponytail) — model `opencode/muse-spark-1.2-contributor-free` inherit, 80k tok cap
**Date:** 2026-09-03
**Scope (read-only):** `.autoforge/plans/plan-remaining.md:1-448` (64k verbatim <80k) + `.autoforge/execution/work-order-remaining.json:1-468` (20k verbatim) vs `.autoforge/discovery/tracker-index.md:22-96` (12 OPEN lines verbatim) + `.autoforge/requirements/grilling-remaining.md:1-122` Q1-12 + `.autoforge/architecture/report-remaining.md:1-487` §1-10 + `.autoforge/architecture/decisions-remaining.md:1-203` AD-11..25 + `vault/CHARTER.md:14-20` zones + `AGENTS.md:15-23` vault-determinism & staging + `workflow/wayfinder/maps/ops-residual/MAP.md:39-59` frontier + 8 ticket briefs `R5:1-35 R6:1-33 R7:1-32 R9:1-32 R10:1-34 R11:1-32 R15:1-33 R19:1-53`
**Blocked_by:** discovery done → grilling-remaining done → architect-remaining done (report+decisions) → this plan — satisfied
**Skills:** `code-review` (Standards vs Spec two-axis, read-only), `ponytail` ladder, `lean-build`, `codebase-design`, `verify-and-stop`
**Mode:** planning-only, no dispatch, `node scripts/vault-sync.mjs --check` remains gate before any `state/**` commit

---

## Verdict

**APPROVED_WITH_NOTES**

Plan is complete, traceable, dependency-correct, parallel-safe, ponytail-minimal, and testable. It correctly enumerates **8 self-approving modules from 12 OPEN frontier lines** (4 deferred as NEEDS REVIEW/HITL per AD-14,18,19,20), enforces single-writer overlap guards where `touches` intersect, allows parallelism only where `touches` are disjoint, retains vault determinism guard even for this ops-residual lane, and flags deferred items where owner-shape/policy/HITL/file-identity blocks self-approve per protocol §16 autonomous. No frozen-doctrine, irreversible, or speculative-scope defect. Two polish notes (topological_order flattening + explicit rollback per module) remain — neither blocks planning approval nor is exploitable before dispatch.

---

## 1. Enumeration 8/12 — PASS (covers acceptance)

| Check | Evidence | Result |
|---|---|---|
| **Tracker OPEN count** | `tracker-index.md:22-96` contains 12 OPEN lines — `R5:23 R6:28 R7:33 R8:38 R9:43 R10:48 R11:53 R12:58 R13:62 R14:67 R15:72 R19:93` verified via `grep -c "Status: OPEN"` 12; plus 4 BLOCKED `R1:3 R2:7 R3:12 R4:17` and 3 FOG `R16:78 R17:82 R18:87` =19 total. `report-remaining.md:4` maps same 12. | ✅ |
| **Plan §1 reconciliation enumerates all** | `plan-remaining.md:21-42` table rows 5-15,R19 plus 4 OUT OF LANE R1-4 and 3 OUT OF SCOPE FOG with verbatim citations `tracker-index.md:23` etc; `plan-remaining.md:43` counting proof `12 OPEN =8 modules +4 deferred` + `work-order-remaining.json:9-18` `tracker_index_verbatim` 8 + `deferred_verbatim` 4 + `tracker_total_open:12 tracker_count:8` | ✅ |
| **No merge / no omission / no invention** | Plan `43` "No merge: distinct operational domains (cancel vs pagination vs tooltip vs doctor vs dedupe vs comments vs docs vs wayfinder); dedup cite would fail per `report-remaining §1` map ownership local-markdown only `TRACKER.md:14`" — verified distinct `touches` per module §4: cancel touches `cancel/route+harvest+jobs+provider-health`, pagination `jobs:list`, tooltip `provider-health title`, doctor `discovery-doctor.ts`, dedupe `dedupe-persist+keys`, comments `harvest.ts`, docs `README/CONTRIBUTING/deployment`, wayfinder `tickets seam+CLI`. First-item-only failure flagged `43` last sentence. | ✅ |
| **Work-order mirrors plan 1:1** | `work-order-remaining.json:42-270` 8 modules `M-R5 M-R6 M-R7 M-R9 M-R10 M-R11 M-R15 M-R19` each with `frontier_ticket` `workflow/wayfinder/maps/ops-residual/tickets/*.md:1-35` citation, `touches`/`hazard_touches`/`locks`/`wave` matching `plan §4` per-module tables `91-269`. `reconciliation.counting_proof:34` restates 8+4=12. | ✅ |
| **BTL: single R only would be failure** | Plan `43` and work-order `34` explicitly state first-item-only (only R5) would be failure per instructions — guard present. | ✅ |

**Self-approve flag per deferred — correctly NEEDS REVIEW (see §10):** R8,R12,R13,R14 are **not** in work-order `modules` and are listed only in `deferred_verbatim:19-23` + plan `26,31-33` rows marked DEFERRED; 8 dispatched modules are all `self_approve:true` per `decisions-remaining.md AD-11,12,13,15,16,17,21,22 TRUE` — see §10 table below.

---

## 2. Touches overlap guard — PASS

All 8 modules declare `touches` (exact `git add <paths>` set) + `hazard_touches` (subset that forces file-level serialization) — plan §4 per-module bullet + work-order `touches`/`hazard_touches` arrays:

| Module | touches (plan §4) | hazard_touches that force single-writer | Lock declared |
|---|---|---|---|
| M-R5 cancel | `cancel/route.ts, jobs.ts, harvest.ts, provider-health.tsx, tests/domain/cancel.test.ts` at `plan:96` / `work-order:50-55` | `jobs.ts, harvest.ts, provider-health.tsx` `97` / `57-61` | `harvest-single-writer + job-index-single-writer + provider-health-client` `99`/`63` |
| M-R6 pagination | `jobs.ts, jobs/route.ts, tests/domain/jobs-pagination.test.ts` `120` / `83-87` | `jobs.ts` `121`/`88` | `job-index-single-writer` `123`/`90` |
| M-R7 tooltip | `provider-health.tsx, tests/domain/provider-health-refresh.test.tsx` `143` / `110-113` | `provider-health.tsx` `144`/`114` | `provider-health-client` `146`/`116` |
| M-R9 doctor | `discovery-doctor.ts, tests/domain/discovery-doctor-json.test.ts` `164` / `136-139` | `discovery-doctor.ts` `165`/`140` | none (disjoint) `167`/`142` |
| M-R10 dedupe | `dedupe-persist.ts, keys.ts, tests/domain/dedupe-kv-truth.test.ts` `187` / `162-166` | `dedupe-persist.ts, keys.ts, state/dedupe-index.json` `188`/`167-171` | `dedupe-index-single-writer` `190`/`173` |
| M-R11 comments | `harvest.ts` `210`/`193` | `harvest.ts` `211`/`194` | `harvest-single-writer` `213`/`196` |
| M-R15 docs | `README.md, CONTRIBUTING.md, docs/deployment.md` `232`/`216` | same `233`/`217` | `docs-single-writer` `234`/`219` |
| M-R19 wayfinder | `tickets.ts, ticket-types.ts, tickets/route.ts, ticket-board.tsx, scripts/wayfinder-tickets.ts, package.json, tests/domain/wayfinder-tickets.test.ts, R19 md` `253`/`239-248` | `maps/**, scripts/wayfinder-tickets.ts, package.json, src/wayfinder/**` `254`/`249-256` | `wayfinder-compile` (+ `package.json-single-writer` impl via wayfinder-compile) `256`/`258` |

**Overlap intersections correctly flagged sequential:**
- `M-R5↔M-R6` share `src/discovery/jobs.ts` → `job-index-single-writer` sequential — plan `317` / work-order `423-424` `sequential_groups[0] ["M-R5","M-R6"]` + §5 locks `297-303`.
- `M-R5↔M-R11` share `src/discovery/harvest.ts` → `harvest-single-writer` — plan `318` / work-order `425`.
- `M-R5↔M-R7` share `provider-health.tsx` → `provider-health-client` — plan `319` / work-order `426`.
Plan `45` shared-state note and work-order `shared_state_guard:429` explicitly state "Intersecting touches = sequential per instruction."

**Disjoint correctly allowed parallel** (no false serialization):
- `M-R6↔M-R11` `jobs.ts vs harvest.ts` → allowed `320` / `419`; `M-R7↔M-R11` `provider-health.tsx vs harvest.ts` → allowed `321` / work-order `413` implicitly via `parallel_safe_groups`; `M-R9/M-R15/M-R19` mutually disjoint → fully parallel_safe `322` / `411-412` groups. Work-order `parallel_groups.parallel_safe_groups:411-422` lists 10 valid disjoint pairs including `[M-R11,M-R6]`, `[M-R10,M-R6]`, `[M-R9,M-R15,M-R19]` etc — matches plan §5 guard table — no false parallel claim on shared files.

**Staging hygiene guard present:** `AGENTS.md:21-23` explicit `git add <paths> only, never -A` cited at plan `55,305,384` and work-order `467` with per-module exact `git add` sets e.g. `plan:108,131,152,175,198,219,241,264` — prevents foreign lane `vault/journal/**` or `workflow/wayfinder/maps/**` poison beyond owning ticket file.

---

## 3. Parallel safety — PASS

**Waves & locks (plan §5 + report §6 vs work-order waves §5):**

| Wave (plan §5 `310-314` / work-order `368-409`) | Members | Parallel? | Guard rationale |
|---|---|---|---|
| P-stateless-docs-client | `M-R7,R9,R15,R19` (plan `311` `M-R7,R9,R15,R19`) / work-order `wave-P-stateless` `M-R9,R15,R19` + `wave-P-client-comments` `M-R11,R7` split for hazard clarity | **parallel_safe within P if touches disjoint** | disjoint files `provider-health title vs discovery-doctor vs README vs wayfinder seam` — no shared lock; exception `M-R7` shares file with `M-R5` so flagged sequential with M-R5 below — matches `plan 310 guard` + `work-order parallel_notes:374-383` |
| P-comments | `M-R11` (plan `312`) | parallel with P-stats where file disjoint, sequential with M-R5 on `harvest.ts` | correctly flagged `work-order:381-383` |
| S-state-writers | `M-R5,M-R6,M-R10` (plan `313`) / work-order `S-dedupe:386-392` `S-jobs-pagination:393-400` `S-cancel-terminal:401-408` | serialize per seam | each holds single-writer seam; cross-file `M-R10 dedupe vs M-R6 jobs` may parallel same turn if scheduler proves disjoint — plan `313` documents conservative serial `M-R10→M-R6→M-R5` but notes may parallel where disjoint, matching report `§6 S serialize per seam, cross-file they can run same turn`. |
| G-gates | proof gate (none in lane, R8/R13 deferred) | — | — |

**Resource locks table (plan §5 `292-304` / work-order `281-367`):** `vault-state-single-writer` declared uncontended (no writer in lane — analog `state/dedupe-index.json` guarded by `dedupe-index-single-writer`) `295/282-289`; `harvest-single-writer` `M-R5+R11` on `harvest.ts:99-173,244` `296/290-296`; `job-index-single-writer` `M-R5+R6` on `jobs.ts:41-42,64-92,133-357` `297/297-303`; `provider-health-client` `M-R5+R7` on `provider-health.tsx` `298/304-310`; `dedupe-index-single-writer` singleton `M-R10` `300/311-317`; `wayfinder-compile` singleton `M-R19` `301/318-324`; `docs-single-writer` singleton `M-R15` `302/325-331`; deferred `health-read, ci-single-writer, gitignore-single-writer` correctly mode `deferred` `303-304,346-367`. All cite exact file:lines verified against code (e.g. `HARVEST_LOCK:104` at `harvest.ts:104`, `INDEX_KEY:42` at `jobs.ts:42`, `writeQueue:17` at `dedupe-persist.ts:17`, `readdirSync sorted 141,151` at `tickets.ts:141,151`, `vault-sync.mjs:16-44` worktree + `Buffer.equals :31`).

**DAG edges:** plan `275-289` + work-order `272-280` `DAG.nodes 8 edges []` with reason "All 8 have `blocked_by:[]` per tickets `R5:8 … R19:8` — no semantic DAG; sequencing is hazard-only (same-file writes) via resource locks, not blocked_by." Verified each ticket front-matter `blocked_by: []` (read `R5:8 R6:8 R7:8 R9:8 R10:8 R11:8 R15:8 R19:8`). Deferred `R8/R12/R13/R14` correctly not nodes, no edges (plan `288`, work-order `273`). Prior vault lane `VG-01→VG-SYNC` worktree edge `plan:12,279,295` retained as reference but not part of this lane's DAG — correct isolation of ops-residual vs vault lane.

**Recommended schedule (plan `326-333`):** P1 `M-R9+M-R15+M-R19` parallel disjoint, P2 `M-R11+M-R7` parallel disjoint, S1 `M-R10`, S2 `M-R6`, S3 `M-R5` alone terminal (holds 3 locks) — respects all sequential guards; alternative hazard-respecting orders exist (work-order `278` note). Module boundary ≠ child-session boundary respected — parallel_safe groups may batch as parallel `Task` calls in one turn per `plan:74,362` and work-order `429` `module_boundary_note` / `430`.

**Minor note (non-blocking):** work-order `DAG.topological_order:277` flattens to single array `[M-R7,M-R9,M-R15,M-R19,M-R11,M-R10,M-R6,M-R5]` which serializes P members that are actually parallel_safe together. The `waves` array `368-409` correctly splits parallelism; the flat topological_order is a misleading serialization artifact of empty-semantic-DAG lanes — **note, not defect:** scheduler should use `waves` + `parallel_safe_groups` for dispatch, not the flat order.

---

## 4. Architecture consistency — PASS

**Seam reuse & depth (ponytail rung 2 enforced):**
- Plan §2 `56,60` and work-order `437,465` cite `DataStore seam store.ts:16-26` `MemoryStore 28-57 KvRestStore 60-126 getDataStore 183-188 setDataStoreForTests 192-194`, Job store `jobs.ts:41-42,94-113,223-274,276-318`, Harvest `harvest.ts:62-71,99-173,104,244`, Health-aggregate `health-aggregate.ts:20-61` pure `LedgerEntry[]→HarvestHealth`, Wayfinder `tickets.ts:34-193 isTerminal 36-38 ticketKey 40-42 classifyTickets 119-134 buildTicketIndex 169-189 indexWayfinderTickets 191 + ticket-types.ts:2 WAYFINDER_MAPS_DIR`, Dedupe `dedupe-persist.ts:12-107 loadDedupeIndexAsync 51-58 saveDedupeIndex 60-75 persit 77-107 + keys.ts:50 DISCOVERY_DEDUPE_INDEX_KEY`, Ledger `ledger.ts:4-40`, `discovery-doctor.ts:14-53 JSON_MODE 15` — all verified exists via `ls`/`grep` at review time; `jobs.ts` `loadIndex`, `harvest.ts` `executeJob` `HARVEST_LOCK`, `dedupe-persist.ts` `writeQueue:17`, `wayfinder` `FRONT_MATTER_RE:34` all found.
- `report-remaining.md §3` alternatives matrices design-it-twice per concern and §5 Interfaces exact signatures `POST /cancel → updateJob → cancelled`, `listJobs cursor contract`, `title tooltip`, `doctor JSON shape`, `dedupe KV-first`, `wayfinder indexWayfinderTickets` — keep variation behind existing seams, no new deps (stdlib `fs/path/crypto`, existing `yaml`, `tsx` already installed for doctor/wayfinder CLI), native `title` over `<Tooltip>` (rung 4), `MemoryStore` for tests (rung 2), deletion over addition for R11 — consistent with `decisions-remaining.md AD-11..AD-25` ponytail ladders.

**Least-privilege & auth:** plan `352-359` and work-order `352-359` map: cancel `requireAdmin` at `cancel/route.ts:7` same `x-admin-key` as `health/route.ts:16` `jobs/route.ts:7`; jobs list admin read `jobs/route.ts:7`; health `requireAdmin` `health/route.ts:16`; tickets `requireAdmin` `tickets/route.ts:7`; wayfinder `ENOENT→{total:0}` at `tickets/route.ts:14`; dedupe server-side no extra auth — correct.

**Ceilings explicit:** plan `95,116,137,156,201,211,245,267` ponytail comments per module + §8 table `391-404`: `20-window O(20) jobs.ts:159,189 slice(0,20)` deferred until n>500, `global dedupe writeQueue:17` per-package locks deferred, `HARVEST_LOCK process-local 104` → `harvest-lock.ts SET NX` R1, `vault-sync worktree+symlink ceiling`, `readdirSync sorted 141,151` deterministic, `global __KV_DEDUPE_INDEX__ 19-26` shim ceiling, `title` small-font acceptable — all cited at `report §7` hazard ceilings.

**Vault determinism retained for ops-residual lane:** plan `51-53,59,295` + work-order `282-289,432-437` `vault-state-single-writer` declared global, guard `node scripts/vault-sync.mjs --check` (`AGENTS.md:15-18` HEAD worktree `vault-sync.mjs:16-44` `git worktree add --detach ${tmp} HEAD :17 + symlink node_modules :19 + Buffer.equals :31`) — even though none of the 8 intends to write `state/vault-notes.json`/`vault/views/**`/`tracker-index.md`/`gotchas/**`, plan correctly serializes any future writer and requires `vault-sync --check` before handoff + `git diff --exit-code -- vault/views state/vault-notes.json` in global proof `336,382-383` — matches `AGENTS.md` and `decisions AD-09`. `state/dedupe-index.json` ROFS fork guarded analogously by `dedupe-index-single-writer` EROFS warn `dedupe-persist.ts:70-71` — correct single-writer analogy.

---

## 5. Ponytail (ladder) — PASS

- Every module skips unrequested abstractions per rung: M-R5 one `updateJob` call skips `AbortSignal` through N nodes and second KV token (§4 `111`); M-R6 `loadIndex` scan skips KV `KEYS discovery:job:*` scan and sorted-set (§4 `134`); M-R7 HTML `title` skips `<Tooltip>` (§4 `155`); M-R9 single `--json` branch skips file output (§4 `178`); M-R10 KV-first + EROFS warn skips removing file entirely and keeping file-only (§4 `201`); M-R11 deletion over addition skips docs refactor (§4 `222`); M-R15 text-only skips tutorial migration (§4 `244`); M-R19 single `indexWayfinderTickets()` seam skips GitHub sync and DB index (§4 `267`). Work-order `465` rung mapping `R5 rung2 … R19 rung2` concise and accurate.
- No new dependency introduced: `package.json` `tickets` script reuses `tsx` already installed for `discovery-doctor.ts` — verified via `report §8` no-new-deps.
- `ponytail:` ceiling comments retained per module (`harvest.ts:99-103` process-local, `dedupe-persist.ts:16-17` queue, `jobs.ts:159` window, `vault-sync.mjs:16-44` worktree) — matches decisions `AD-11..22` ponytail notes.

---

## 6. Testability — PASS

**Per-module runnable check (no fixtures beyond `MemoryStore`/`fake FS`):**

| Module | Plan §4 acceptance `101-108,125-131,148-152,169-175,192-198,215-219,236-241,258-264` | Work-order acceptance `67,94,120,146,177,200,223,262` | Runnable gate |
|---|---|---|---|
| M-R5 cancel | `POST /cancel` admin-gated flips `running→cancelled` in MemoryStore via `setDataStoreForTests(new MemoryStore())`; `executeJob` with cancelled seed bails before lock `harvest.ts:118-130` and per-node `166-173` + `D00-CANCELLED`; idempotent second POST `200`; UI `Stop→cancelling…→paused · cancelled by user` DOM query; `typecheck/test/build` + `git add` | memory flip + per-node poll + idempotence + UI polling terminal | `vitest run tests/domain/cancel.test.ts` + `typecheck` |
| M-R6 pagination | route comment `Documented truncation: index trimmed to 20`; `listJobs` with 21 seeded jobs `cursor=evictedId → latest 10` never `null` until last page; tests `cursor present/missing/trimmedPast + limit clamp [1,20] :13`; `build` green | pure cursor arithmetic via `loadIndex` seam | `vitest jobs-pagination.test.ts` |
| M-R7 tooltip | `provider-health.tsx:482 title includes dedup and manual inspection` `getByRole('button',{name:'Refresh'}) title.includes('dedup')` + `aria-label` fallback, no new component | DOM query | `vitest provider-health-refresh.test.tsx` |
| M-R9 doctor | `npx tsx discovery-doctor.ts --json \| jq '.providers[0] | has(...)'` true + `totals`; `--live --json` valid; human path `55-112` untouched; unit mock `resolveProvider.discover limit 3` shape | `JSON.parse(stdout)` exact shape | `vitest discovery-doctor-json.test.ts` + `jq` |
| M-R10 dedupe | `persistDedupeFromResult` swap `await loadDedupeIndexAsync` at `:85`; ROFS fake `writeFileSync throw EROFS → s.put` succeeds + single `console.warn` `dedupe: FS mirror skipped (ROFS)` per AC:28; local both written | async KV-first + fake FS throw test via `setDataStoreForTests` | `vitest dedupe-kv-truth.test.ts` (dual ROFS/local) |
| M-R11 comments | `rg "getGitHead\|deleted global hook" harvest.ts` 0 hits; remaining comments pass `explains ceiling or contract` `R11:21` keep `HARVEST_LOCK` ceiling | `typecheck 0` | `rg` + `typecheck` |
| M-R15 docs | `rg "main is production\|Vercel auto-deploys\|discovery-harvest.*schedule" README` 1+ each; `rg "manual Vercel CLI" 0`; reference `AGENTS.md Eval gates` window; no commands reordered per `R15:29` | prose only | `rg` + `build` |
| M-R19 wayfinder | `npm run tickets -- --json` valid JSON `counts.total/frontier/ready_without_owner/hitl_frontier/blocked` + `tickets[].key/status/hitl/ready` per AC:45-46; board lane same counts via same `TicketIndex inLane 28-33`; `status:open→claimed assignee:alice` reflected without code change `TRACKER.md:60-62`; no GitHub sync | CLI↔board parity + markdown canonical | `vitest wayfinder-tickets.test.ts` + `jq` + manual visual |

**Global proof before handoff (plan `336,377-385` / work-order `438-439`):** `npm run lint && npm run typecheck && npm run test (vitest) && npm run build && node scripts/vault-sync.mjs --check` green + `git diff --exit-code -- vault/views state/vault-notes.json` green if unchanged + staging audit `git status --porcelain` shows only `touches` lane — present in every module's DoD `§7`. Verified conservative: lint/typecheck/build not mutated by docs/script modules (R7,R9,R11,R15,R19) but still gated.

**No over-tested fixtures:** each non-trivial branch has ONE runnable check (assert-based `vitest` or `jq`/`rg`), trivial one-liner `title` needs only DOM query — matches ponytail "non-trivial logic leaves ONE runnable check" rubric — no frameworks beyond vitest/jq.

---

## 7. Rollback / Modularity / Scope — PASS

- **Modularity:** 8 modules = 8 distinct operational domains (cancel endpoint+worker poll vs pagination cursor vs tooltip vs doctor CLI vs dedupe KV-truth vs comment prune vs docs vs wayfinder index) — single-responsibility per file seam, interface small (`nextCursor`, `title`, `JSON shape`, `DISCOVERY_DEDUPE_INDEX_KEY`, `indexWayfinderTickets`). Deletion test passes per `report §8` speculative deferrals.
- **Rollback:** implicit is `git revert <module-commit>` because plan enforces **one module → one commit with explicit `git add <touches>` only** `plan 333,384 work-order 467` staging audit — each module's touches set is its revert boundary. Docs/script modules (`M-R7,R9,R11,R15,R19`) are text-only/comment-only/CLI-additive → zero-risk revert; state writers (`M-R5,M-R6,M-R10`) are additive KV truth (cancelled field, stale-cursor fallback, KV-first load) — revert is single-line diff reversal, no migration. **Note:** plan does not list `git revert <sha>` explicitly per module — add to executor checklist (§8 change not required, planner already enforces per-module commit).
- **Scope containment:** R1-4 `BLOCKED` (vault lane prior, cross-instance lock/ledger/proof) correctly `OUT OF LANE` `plan 35-38` `work-order 24-28`; FOG `R16 Brave quota, R17 Evidence HEAD, R18 Bento` correctly `OUT OF SCOPE` triaged 2026-08-31 `plan 39-41` `MAP.md:76-89`. No scope creep: `R19` explicitly out-of-scope `MAP Destination rewrite, GitHub sync, vault R17/Brave R16 hooks` per `R19:50-51`; `R5` mid-process AbortSignal, `R10` file-removal, `R15` tutorial migration, `R8` alerting — all listed as skipped ponytail. No frozen doctrine breach (`docs/validation/eval-gates.md:15-38` thresholds frozen `plan 58`).

---

## 8. Risks & mitigations — PASS

Plan §8 `389-406` + report §7 matrix cover 14 risk families with bite location, mitigation in plan, ponytail ceiling & upgrade path — no missing carrier:
KV split-brain `store.ts:136-180 fallback shadow`, ledger race `ledger.ts:11-26`, orphan `getLedgerTailKV`, dedupe ROFS `dedupe-persist.ts:70`, cancel cross-lambda `HARVEST_LOCK:104`, stale cursor `jobs.ts:159,189`, health shape drift `R8`, doctor quota `discovery-doctor.ts:28-29`, worktree orphan `vault-sync.mjs:45-52`, tracker drift `tracker-index.md vs vault-notes.json`, staging poison `AGENTS.md:21`, wayfinder drift `tickets.ts:186/board inLane`, storage churn `R12`, freshness warn-only `R13` — each mitigation is hazard serialization or ponytail ceiling with deferred upgrade to `R1/R2` CAS as `MAP.md:16,41-42` defines. No new risk introduced by the 8.

---

## 9. Acceptance (global) — PASS

Work-order `451` global acceptance enumerates exactly 8 self-approving Rs per `AD-11,12,13,15,16,17,21,22 TRUE` with touches for `jobs.ts (M-R5/M-R6), harvest.ts (M-R5/M-R11), provider-health.tsx (M-R5/M-R7), dedupe-persist/keys.ts + state/dedupe-index.json (M-R10), health deferred R8, docs (M-R15), wayfinder compile+CLI+board+API (M-R19)` plus locks, parallel groups, testability, staging hygiene — matches plan §4 per-module `[ ]` checkboxes (7-8 per module) + global gates §7. Every acceptance is file:line citable and `vitest`/`jq`/`rg` runnable.

---

## 10. Self-approve verdict per module (grilling → decisions override → independent review)

Protocol §16 autonomous: self-approve where evidence in ticket MDs/CHARTER.md/AGENTS.md/implemented seams is sufficient; otherwise NEEDS REVIEW/HITL. Grilling `self-approve:false` at `grilling-remaining.md:27,36,44,58,64,72,100,107` for all 12 initially is overridden by architecture decisions AD-11..25 where contract fully documented and seam reuse mechanical (ponytail). This aligns with tracker `hitl:false` except R13 `hitl:true`.

| Module | Tracker `hitl` & grilling `false` | Decision `AD` | Plan `§10` verdict | **Independent review verdict** | Rationale (cite) |
|---|---|---|---|---|---|
| **M-R5 cancel** | `R5-server-cancel.md:5 hitl:false` `blocked_by:[]:8` contract `22-27` + grilling `27 false` | **AD-11 TRUE** `decisions:21` mechanical `updateJob` seam `cancel/route.ts:16` `harvest.ts:166-173` | TRUE self-approving | **TRUE — SELF-APPROVE** | Contract fully in ticket `R5:22-27` + code `cancel/route.ts:1-21` `harvest.ts:118-130,166-173` already wired + admin gate `requireAdmin:7`; ponytail per-node poll ceiling deferred until inside-node latency measured; test `MemoryStore` flip is mechanical. No HITL. |
| **M-R6 pagination** | `R6-pagination-trim.md:5 false` `8 []` `20-21` cursor stability | **AD-12 TRUE** `35` stable paging lands `jobs.ts:223-274` | TRUE | **TRUE — SELF-APPROVE** | Already fixed `jobs.ts:232-242 slice(idx+1)` + fallback `238` `nextCursor null` only last page; shape `{jobs,nextCursor,total}` preserved `jobs/route.ts:14-15` cap `[1,20]:13`; 20-window ceiling `O(20)` trivial. No shape change. |
| **M-R7 tooltip** | `R7:5 false` `20-24` title | **AD-13 TRUE** `45` trivial `title` `provider-health.tsx:482` | TRUE | **TRUE — SELF-APPROVE** | One HTML attribute `title="Refresh bypasses onRun dedup…"` native rung 4, no dep, no behaviour change beyond discoverability; `aria-label` fallback `397,407` kept. Auto APPROVE. |
| **M-R9 doctor JSON** | `R9:5 false` `20-25` single JSON branch | **AD-15 TRUE** `69` pinned `JSON_MODE:15` `providers 44-51` | TRUE | **TRUE — SELF-APPROVE** | `--json` prints single JSON `{providers:[{id,enabled,hostsOk,sampleHits}],totals}` `discovery-doctor.ts:44-51` `process.exit(0):52` human path `55-112` untouched; `--live --json` valid — deterministic validator, exit preserved. |
| **M-R10 dedupe KV-truth** | `R10:5 false` `20-22` KV-first + file seed | **AD-16 TRUE** `81` one-line swap `loadDedupeIndexAsync` `51-58` + `keys.ts:50` | TRUE | **TRUE — SELF-APPROVE** | KV-first load `s.get(DISCOVERY_DEDUPE_INDEX_KEY)` else fallback `loadDedupeIndex`, persist `saveDedupeIndex :100` `EROFS warn :70-71` + `s.put :104`; `writeQueue:17` single-writer ceiling; file best-effort on ROFS per `R10:21`; fake `writeFileSync` throw test per `R10 AC:30` foreseeable. Keep sync `loadDedupeIndex` for callers that cannot await (ceiling). |
| **M-R11 comments** | `R11:5 false` `19-22` prune stale | **AD-17 TRUE** `89` comment-only | TRUE | **TRUE — SELF-APPROVE** | `harvest.ts` only — prune `getGitHead|deleted global hook` narration, keep `ponytail:` ceilings `99-103` process-local lock upgrade path `16`; `typecheck` gates; no logic. |
| **M-R15 deploy docs** | `R15:5 false` `20-21` `main is prod` | **AD-21 TRUE** `129` text-only sync | TRUE | **TRUE — SELF-APPROVE** | `README.md:85-91` `docs/deployment.md:6-23` + `CONTRIBUTING.md` create-if-absent to `main is production; Vercel auto-deploys; discovery-harvest schedule; see AGENTS.md Eval gates` keep command order `R15:29`; no commands reorder. |
| **M-R19 plumbing** | `R19:5 false` `38-48` fully spelled CLI/board/lane | **AD-22 TRUE** `141` 3 adapters prove seam `tickets.ts:34-193` `FRONT_MATTER_RE:34` `indexWayfinderTickets:191` + `tickets/route.ts:6-17` + `board inLane:28-33` | TRUE | **TRUE — SELF-APPROVE** | 3 real adapters (markdown, compiled JSON, board UI) prove seam; CLI 4th thin `scripts/wayfinder-tickets.ts` calls `indexWayfinderTickets()` → `wayfinder N tickets` + `--json {counts,tickets}` per `R19 AC:45-46`; markdown canonical `TRACKER.md:17,60-62` claim/resolve via front-matter without code change; no GitHub sync per `R19:51`. |
| **R8 harvest-health** | `R8:5 false` | **AD-14 FALSE NEEDS REVIEW (shape freeze)** `59` | DEFERRED | **NEEDS REVIEW** ✅ correctly deferred | Ticket field list `R8:21 lastRunAt,lastRunStatus,lockHolder,lockAcquiredAt,indexedEntriesCount` vs actual `health-aggregate.ts:7-12 lastRunAt,lastSuccessAt,lastHits,degraded` diverge + `health/route.ts:143-152` file ledger vs `getLedgerTailKV/jobs.listLatest` — owner must freeze canonical `HarvestHealth` shape and bridge (`lastRunStatus,indexedEntriesCount`) vs deferred `lockHolder` behind R1. Not self-approvable. |
| **R12 storage policy** | `R12:5 false` but `21` offers (a) curated subset vs (b) ignore `.autoforge/` | **AD-18 FALSE HITL-policy** `101` | DEFERRED | **NEEDS REVIEW (HITL-policy)** ✅ correctly deferred | Policy choice not derivable from evidence; owner must pick (a) commit `state.json+decisions/plans/reviews` vs (b) `/.autoforge/` in `.gitignore` + `.autoforge/AGENTS.md` Storage policy; either passes `R12 AC:29` `git status` no spurious. |
| **R13 freshness** | `R13:5 hitl:true` `16-30` threshold from doctrine | **AD-19 FALSE HITL** `113` `hitl:true` blocks even though code mechanical | DEFERRED | **NEEDS REVIEW (HITL)** ✅ correctly deferred | `check-eval-gate-freshness.mjs:11-28` warn vs `exit 1` + `ci.yml gate-freshness` job is mechanical, but `R13.hitl:true` at ticket header and protocol "HITL flag requires owner ack" means self-approve blocked until owner confirms `7d` max-age source `docs/validation/eval-gates.md:31-38` and actionable `gh workflow run tier1 --topup <runId>` wording. |
| **R14 tier1 housekeeping** | `R14:5 false` `21` header comment | **AD-20 NEEDS REVIEW (clarify file)** `121` no `scripts/tier1-archive.mjs` present (`glob scripts/*:18` lists none) | DEFERRED | **NEEDS REVIEW (clarify file)** ✅ correctly deferred | Header-only ` --rebase` next to `--topup <runId>` + doctrine path `docs/validation/eval-gates.md` is self-approvable once canonical path confirmed (`scripts/tier1-archive.mjs` vs `run-eval.ts` vs `check-eval-gate-freshness.mjs`). |

**Summary self-approve:** **8/8 dispatched modules self-approving** per AD-11,12,13,15,16,17,21,22 TRUE; **4 deferred R8,R12,R13,R14 NEEDS REVIEW/HITL** per AD-14,18,19,20 — each requires single-owner grilling (15-min shape/policy/HITL/file-identity) before hardening. Grilling `false` overridden only where architectural seam is proven reusable and ticket contract fully documented (ponytail rung 2). This matches `report-remaining.md §10` 8 SELF-APPROVE +4 NEEDS REVIEW and decisions summary `199-200`.

---

## Findings (code-review two-axis)

### Standards — within tolerance ( Ponytail + lean-build enforced )

- Documented standards cited: `AGENTS.md:15-18` vault determinism, `21-23` staging hygiene (`git add <paths>` never `-A`), `docs/validation/eval-gates.md:15-38` thresholds frozen, `vault/CHARTER.md:14-20` zones, `TRACKER.md:14-17` local-markdown canonical — all respected. No undocumented discretion.
- Smell baseline: **No `Mysterious Name`** (job status `cancelled`, `loadDedupeIndexAsync`, `indexWayfinderTickets` honest); **No Duplicated Code** (cancel `updateJob` reused, not reimplemented per caller); **No Feature Envy** (wayfinder compile owns `FRONT_MATTER_RE`+`classifyTickets` parse, not delegated); **No Data Clumps** (touches as file-list is minimal); **No Primitive Obsession** (`DiscoveryJobStatus` variant vs string); **No Repeated Switches**; **No Shotgun Surgery** (one lock per file); **No Divergent Change** (docs vs code vs harvest vs dedupe own files); **No Speculative Generality** (AbortSignal, sorted-set, `<Tooltip>`, DB index, GitHub sync all explicitly skipped with ponytail ceiling); **No Message Chains**; **No Middle Man**. Only `Speculative Generality` risk was present and **correctly suppressed** by pony-tailling.
- Ponytail enforced: reuse `DataStore`/`MemoryStore`/`loadIndex`/`title`/`yaml` seams, stdlib `fs/path/crypto`, no new deps — shortest diff wins. Skipped abstraction list in §4 per module matches ladder rung and matches required acceptance ("covers ponytail").

### Spec — faithful (no scope creep, no missing acceptance)

- Each spec line traced: `R5:22-27` → plan `93` cancel route+poll+UI label; `R6:20-21` → `122-124` stable cursor + truncation doc; `R7:20-24` → `140-141` title at `482`; `R9:20-25` → `161` single JSON `providers+totals :44-51`; `R10:20-25` → `184-188` KV-first + `keys.ts:50` + EROFS warn `:70-71`; `R11:19-22` → `207` keep ceilings `99-103`; `R15:20-21` → `228` main-is-prod text; `R19:38-48` → `250-252` 3 adapters + CLI `scripts/wayfinder-tickets.ts`. Quotes match ticket MD lines. No extra behaviour (no AbortSignal, no KEYS scan, no Tooltip component, no file removal, no GH sync) — scope faithful.
- Missing or partial: none for the 8; deferred `R8` shape drift is intentionally **not** hidden — plan `26` + `398-399` and decisions `AD-14` correctly flag bridging (`lastRunStatus` from `listJobs(1)` + `indexedEntriesCount=total`) vs deferred `lockHolder/lockAcquiredAt` behind R1, requiring owner freeze before hardening — proper.

---

## Required changes vs notes

| Finding | Severity | Location | Fix | Blocking? |
|---|---|---|---|---|
| `DAG.topological_order` flattened serialization masks P parallelism | **Note** | `work-order-remaining.json:277` single array; plan §5 waves split correctly | Scheduler must use `waves` + `parallel_safe_groups:411-422` not flat `topological_order` for dispatch; optionally emit `topological_order` as `[ [P-group],[S1],[S2],[S3] ]` or remove flat field | No — waves already authoritative |
| Rollback implicit per `git revert <module-commit>` but not listed per module | **Note** | plan `333` commit discipline + work-order `467` staging hygiene | Executor checklist: add `rollback: git revert <sha>` per module (trivial since one commit ↔ one touches set); no plan edit needed | No |
| All other enumeration / overlap / parallel / ponytail / testability / deferred flags — see §1-10 PASS | — | `plan §1,§4,§5,§7,§8,§10` `work-order reconciliation 33-41,451` | — | — |

**No `CHANGES_REQUIRED` findings** — gaps are polish, not correctness or safety regressions.

---

## Parallel safety re-verification (independent grep)

Cross-checked `rg "src/discovery/jobs.ts"` appears only in `M-R5` and `M-R6` hazard_touches → must serialize ✅; `rg "src/discovery/harvest.ts"` only `M-R5`+`M-R11` → serialize ✅; `rg "provider-health.tsx"` only `M-R5`+`M-R7` → serialize ✅; `rg "dedupe-persist"` only `M-R10` ✅; `rg "discovery-doctor.ts"` only `M-R9` ✅; `rg "wayfinder"` only `M-R19` ✅; `rg "README.md"` only `M-R15` ✅. No hidden caller missed — grep every caller of `updateJob/loadIndex/writeQueue/indexWayfinderTickets` routes through declared seams (`store.ts`,`jobs.ts:94-113`,`dedupe-persist.ts:17,51-58`,`tickets.ts:191`).

---

## Traceability (what was pinned)

- `tracker-index.md:22-96` verbatim 12 OPEN lines
- `grilling-remaining.md:27 false R5, :36 R6, :44 R7, :52 R8, :58 R9, :64 R10, :72 R11, :80 R12, :86 R13, :92 R14, :100 R15, :107 R19` — all initially false; architectural override 8→TRUE per decisions
- `report-remaining.md:31-42` gap check (R5 wired, R6 fixed, R7 done, R8 partial shape drift, R9 done, R10 half, R11 ceilings, R12 untracked, R13 warn not fail, R14 no file, R15 stale, R19 deep+missing CLI)
- `decisions-remaining.md AD-11 TRUE R5, AD-12 TRUE R6, AD-13 TRUE R7, AD-15 TRUE R9, AD-16 TRUE R10, AD-17 TRUE R11, AD-21 TRUE R15, AD-22 TRUE R19; AD-14 FALSE R8 shape, AD-18 FALSE R12 policy, AD-19 FALSE R13 HITL, AD-20 NEEDS REVIEW R14 file`
- `MAP.md:39-59` frontier tickets + `14-17` local-markdown canonical + `15` staging hygiene
- Code seams `jobs.ts:41-42,94-113,133-357,223-274,276-318` `store.ts:16-26,28-57,60-126,130-188,192-194` `harvest.ts:62-71,99-173,104,244` `dedupe-persist.ts:12-107,51-58,60-75,85,104` `keys.ts:50` `cancel/route.ts:1-21` `health/route.ts:15-169` `health-aggregate.ts:20-61` `discovery-doctor.ts:14-53,44-51` `wayfinder/tickets.ts:34-193 tickets/route.ts:6-17 board inLane 28-33` `provider-health.tsx:163-171,383-391,474-485`

---

## Acceptance criteria for this review task

- [x] covers enumeration 8/12 (R5,R6,R7,R9,R10,R11,R15,R19 self-approving; R8,R12,R13,R14 deferred)
- [x] touches overlap guard verified — intersecting = sequential (`M-R5↔M-R6 jobs`, `M-R5↔M-R11 harvest`, `M-R5↔M-R7 provider-health`), disjoint = parallel_safe (`M-R6↔M-R11`, `M-R7↔M-R11`, `M-R9/M-R15/M-R19` group, `M-R10` singleton) — file:line cited
- [x] parallel safety verified — waves `P-stateless, P-comments, S-dedupe, S-jobs, S-cancel-terminal` with hazard locks `harvest-single-writer, job-index-single-writer, provider-health-client, dedupe-index-single-writer, wayfinder-compile, docs-single-writer, vault-state-single-writer` declared sequential
- [x] ponytail verified — ladder rung cited per module, ceilings named, no new dep, stdlib/native/title reuse, skid abstraction deletions documented
- [x] testability verified — per-module `vitest`/`jq`/`rg` runnable acceptance + global `lint+typecheck+test+build+vault-sync --check` gates
- [x] deferred R8,R12,R13,R14 correctly flagged as NEEDS REVIEW vs self-approve (AD-14 shape freeze, AD-18 HITL-policy curated-vs-ignore, AD-19 HITL `hitl:true`, AD-20 clarify file `tier1-archive.mjs` absent) — matches protocol §16 autonomous single-owner review gate

---

**Artifact path:** `.autoforge/reviews/plan-remaining-critique.md` (this file)
**Next step:** executor may dispatch waves `P1:[M-R9,M-R15,M-R19]`,`P2:[M-R11,M-R7]`,`S1:M-R10`,`S2:M-R6`,`S3:M-R5` after `node scripts/vault-sync.mjs --check` baseline green; deferred lane `R8,R12,R13,R14` awakes only after owner grilling per `decisions-remaining.md:184-200`.

**Self-approve per module (independent):** M-R5 **TRUE** · M-R6 **TRUE** · M-R7 **TRUE** · M-R9 **TRUE** · M-R10 **TRUE** · M-R11 **TRUE** · M-R15 **TRUE** · M-R19 **TRUE** — 8/8 self-approving; R8/R12/R13/R14 **NEEDS REVIEW** (owner-only).
