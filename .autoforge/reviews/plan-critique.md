# Plan Critique — 28-entry Frontier (R1–R19 + T2 + M1–M8) — Executable DAG

**Reviewer:** autoforge-reviewer (independent, read-only, ponytail, grill-with-docs)  
**Date:** 2026-09-01  
**Scope:** `.autoforge/plans/plan.md` (394 lines verbatim) + `.autoforge/execution/work-order.json` (66 lines verbatim) vs `.autoforge/discovery/tracker-index.md` (28 entries, 140 lines) + `.autoforge/requirements/grilling.md` (519 lines patched) + `.autoforge/architecture/report.md` (346 lines) + `decisions.md` (124 lines) + `workflow/wayfinder/maps/ops-residual/MAP.md:41-59` + `src/lib/persistence/store.ts:16-181` + `scripts/vault-sync.mjs:16-44`  
**Mode:** planning-only critique; no product code dispatched; 80k tok cap inherited (muse-spark-1.2 1M → 80k) respected — inputs sized to cap verbatim  
**Skills:** `code-review` (standards + spec two-axis), `ponytail` (ladder), `lean-build` smallest-diff

## Verdict

**APPROVED_WITH_NOTES**

Plan is complete, architecturally consistent, and safe to hold as planning-only. All 28 tracker entries are enumerated once with correct `touches`/`locks`/`wave`/`acceptance`, DAG is minimal (`M1→M4` + `R4→T2` traceability only), R19 gap resolved, vault determinism & evidence byte-identity invariants preserved, ponytail enforced. Three file-level lock/hazard normalizations remain before any parallel scheduler dispatch — not exploitable today (overlapping writers are gated BLOCKED/FOG or serialized by wave order) but must be normalized so a scheduler honoring only `locks` cannot race. No irreversible, ambiguous, or doctrine-violating defect found.

---

## 1. Completeness — PASS

- **28 entries enumerated exactly once:** `plan.md:11-42` table lists 19×R + 1×T2 + 8×M = 28; `.autoforge/discovery/tracker-index.md:1-140` same 28 verbatim; `work-order.json:15-43` modules 28 × `id`. Counting proof `plan.md:44` `19R+1T2+8M=28` and `work-order.json:11` `19R + 1T2 + 8M = 28` match. Prior 27-entry omission of R19 is explicitly fixed at `plan.md:44` and `work-order.json:12` `r19_note`.
- **R19 added correctly:** `tracker-index.md:93-95` `R19 Wayfinder plumbing traceability — OPEN` triaged 2026-09-01; canonical `MAP.md:58-59` (read 59 lines) lists R19 last; `plan.md:33` R19 row `OPEN — markdown canonical via tickets.ts` + `plan.md:235-243` module with `touches` 5 files, `read_for_gate`, `blocked_by:[]`, `Lock: none — Wave: A`; `work-order.json:34` R19 entry matches; `architecture/report.md:187-203` + `decisions.md:63-71` AD-09 cover seam (`tickets.ts:30-42` `parseTicketFrontMatter`/`classifyTickets`). No omission, no invention.
- **Source label lag reconciled:** `tracker-index.md:2` still `v2/v3 Not-yet-specified` stale label per `plan.md:13-42` `Tracker Source` column; canonical pinned to `MAP.md:41-59` for R1–R19 and Loop-3 `plan.md:66-196` for M1–M8 — correct per `grilling.md:3` and `architecture/report.md:4`.
- **Every module declares `touches`, `lock`, `wave`, `acceptance`:** Verified in `plan.md:66-325` §3 (28 modules) each has `touches: [...]`, `blocked_by`, `Lock`/`Locks`, `Wave`, `Acceptance: [ ]` checkboxes (including verify-only R18 `touches: []` + read_for_gate, T2 `touches: []`). `work-order.json:15-43` mirrors per-module `touches`/`locks`/`wave`. Acceptance boxes are concrete and testable (see §5).

## 2. Dependency ordering — PASS

- **Semantic DAG edges only where data/HITL requires it:** `plan.md:46` `Only true DAG edges: M1→M4 and R4→T2` + `plan.md:328-337` diagram (M1→M4, R4→T2) + `work-order.json:45` `edges: [{M1→M4},{R4→T2}]`. All other `blocked_by:[]` (26 modules) per `plan.md:73,83,93,101,112...` and `work-order.json:16-43`. Matches `grilling.md:14-15` hazard-only + prior plan `393-395` + `architecture/report.md:16` `Single-writer locks … blocked_by stays semantic only (M1→M4)`. Graph acyclic; no false `M2→M6→M8` chain.
- **Hazard vs DAG separated correctly:** Resource overlaps (`persistence`, `page-workspace`, `vault-state`, `eval-canonical`) are serialized by `locks` not `blocked_by` — `plan.md:339-346` locks table + `architecture/report.md:255-264` + `decisions.md:88-94` AD-11. Correct per lean-build: smallest diff without speculative ordering.
- **External HITL/owner gates enumerated:** `work-order.json:13` `source_label_note` + `plan.md:60-61` `External gates 5 R HITL + 8 M owner gates — held = not dispatched` matching `decisions.md:14-18` `AD-10` gates (`OWNER_GF_SOURCE`, `BLOB_LIMIT_TRIGGER`, `VAULT_CONFLICT_TRIGGER`, `FLAG_1/2`, `PHASE_3`, `HITL_PRODUCTION_DAEMON_PROOF`, `FOG_BRAVE_QUOTA_REPLENISHMENT_HITL`). No dispatch before gate.

## 3. Architecture consistency — PASS

- **Seams reuse, not invention:** R1 `DataStore.setIfAbsent` via `KvRestStore.call()` at `store.ts:68` (`plan.md:69` `["SET",k,v,"NX","EX",ttl]` + `MemoryStore` atomic) reuses `store.ts:16-26,68`; R2 ledger `appendLedgerKV`/`getLedgerTailKV` at `ledger.ts:8-39` hardening; R8 `health-aggregate.ts` pure fn; R10 KV-first `dedupe-persist.ts:16-72` + `keys.ts:50`; R16 402 `return []` observable; R19 `tickets.ts:30-42` compile. All match `architecture/report.md §2-3` seam inventory + `decisions.md AD-01..AD-09`. No `DistLockService`, ORM, AI framework.
- **Locks sourced from architecture:** `plan.md:339-346` lock table vs `architecture/report.md:259-264` + `decisions.md:88-94` — `vault-state-single-writer` 7 members, `persistence-single-writer` 10 members (+R16 hazard parenthetical), `page-workspace-single-writer` 5 members, `eval-canonical-report` 4 members. Policy sequential/ready-order correct.
- **Frozen doctrine preserved:** `plan.md:59` `Thresholds, judge prompts, E5, ODD frozen` + `work-order.json:60-64` `global_guardrails` citing `docs/validation/eval-gates.md:8-12`; R13 threshold sourced from file not hardcoded `plan.md:181`; M1 no threshold mutation. Verified `eval-gates.md:13-18` trigger paths unchanged.
- **Vault & evidence as structural invariants:** `plan.md:52-55` guardrails + `plan.md:363` `Global proof before handoff` (`vault-sync --check` + `cmp -s` + `typecheck`) + `architecture/report.md §5` + `decisions.md AD-12`. At review time verified: `vault-sync --check` pass (`scripts/vault-sync.mjs:16-44` HEAD worktree compiler) and `cmp -s .autoforge/validation/ops-loop-evidence.json stages/07_validate/output/ops-loop-evidence.json` identical (`plan.md:394` anchors `056b75f`/`61c7475`/`a715ee8` consistent with current `HEAD a715ee8`).

## 4. Assumptions — explicit and justified

- R1 TTL 3600 >> maxDuration 60s (`plan.md:74` `ponytail: 3600s TTL ceiling`) — justified at `store.ts:130-181` fallback discussion + `architecture/report.md:45`.
- Ledger 500-trim bound (`plan.md:84` `ponytail: 500-trim bound`) — `ledger.ts:25` cited, bounded for `KEYS` latency.
- `getDataStore()` silent fallback split-brain flagged as accepted ceiling until M8 (`plan.md:384` + `architecture/report.md:310` + `store.ts:130-181`) — not silently fixed, honest `store?` injection retained.
- Evidence `generatedAt` ±24h HEAD author date (`plan.md:219`) — explicit via `check-evidence-head.mjs`.

## 5. Testability / Acceptance — PASS

Every module has checkbox acceptance with `vitest`/`typecheck`/`build`/`lint`/`rg`/`cmp` concrete checks, no new harness:

- R1 `plan.md:74` concurrent MemoryStore 1 true/1 false + release + WARN fallback
- R2 `plan.md:84` 50-entry concurrent append + orphan heal writeback
- R3 `plan.md:93` busy-harvest + `lastOnRunJobId` dedup at `provider-health.tsx:138` + spy `appendLedgerKV` before `setJobDone` at `harvest.ts:188-211`
- R5 `plan.md:113` cancel flip `running→cancelled` + next iteration bails
- R6 `plan.md:122` cursor present/missing/trimmed-past 3-case
- R7 `plan.md:130` DOM title `bypasses.*dedup`
- R8 `plan.md:140` `GET /health` additive shape nullable
- R9 `plan.md:148` `--live --json` valid JSON
- R11 `plan.md:166` `rg getGitHead` 0 hits + typecheck green — lean
- R13 `plan.md:186` fresh→pass stale→fail + `run tier1 --topup` msg
- R16 `plan.md:213` mock 402 → `[]` + refusal + WARN
- R17 `plan.md:223` exit 0 when `commit==HEAD` else actionable msg + `cmp -s` identical
- R18 `plan.md:232` `git ls-files --others | grep -E "\.jsx|\.js$"` 0 shadow + build 13.9kB + lint 0 + `git diff main...feat/mission-control -- ui/` empty — verify-only
- R19 `plan.md:242` `npm run tickets` prints R19 OPEN + Mission Control Tickets tab lists R19 + `tracker-index.md:93-95` matches `MAP.md:58-59`

## 6. Rollback / Hazard handling — PASS

Hazards distinguished from `touches` via `hazard_touches` globs + `locks` serialization (`plan.md:72,82,111...` + `work-order.json: hazard_touches`). R2 heal idempotent best-effort; R4 live bundle additive no schema break; M1 prior baseline restore, M6/M8 owner backup/restore noted at `architecture/report.md §3 M gates`. No destructive migration without restore point. Global proof `vault-sync --check` + `cmp -s` before handoff prevents poison.

## 7. Modularity — PASS

One module per tracker entry (28), smallest diff per frontier, no bundling (Postgres+Blob, report+assists, vault UX+compiler kept separate per `decisions.md AD-13`). Touches scoped ≤4 files per R, ≤5 per M; reads via `read_for_gate`. Conditional `touches` (M2/M3/M5/M6/M7/M8) remain BLOCKED so no speculative write. Ponytail ceilings tagged per module (`ponytail:` at `plan.md:74,84,113,122,140,242`).

## 8. Parallelism — APPROVED_WITH_NOTES (3 fixable normalizations before dispatch)

Waves A/B/C/D/E/F per `plan.md:348-357` + `work-order.json:52-58` correctly distinguish semantic DAG from resource hazards. Claim "A (`R9,R11,R15,R14,R19`) parallel safe — disjoint touches/locks" holds for current OPEN set but has three file-level / lock-membership gaps that a lock-only scheduler could mis-execute:

**Finding P1 — R11 shares `src/discovery/harvest.ts` without hazard/lock**
- `plan.md:161-167` `R11 — Drop speculative source comments — touches: [src/discovery/harvest.ts] — Lock: none — Wave: A — parallel_safe:true`
- `work-order.json:26` `R11 touches [src/discovery/harvest.ts] hazard_touches [] locks [] wave A`
- Overlaps `plan.md:70` R1 touches `[store.ts, harvest-lock.ts, harvest.ts]` and `plan.md:110` R5 touches `[cancel/route, jobs.ts, harvest.ts, provider-health.tsx]` both `persistence-single-writer`. R11 is a writer on same file (comment-only but writer). Today safe because R1 BLOCKED and R5 is Wave B (recommended order A before B at `plan.md:361`), but scheduler honoring only `locks` could run R11 ∥ R5.
- **Required fix before dispatch:** set `work-order.json R11 hazard_touches: ["src/discovery/harvest.ts"]` (or `["src/lib/persistence/**"]`) and document `schedule: R11 before any harvest.ts writer; never parallel with R1/R5` OR give R11 `persistence-single-writer` hazard. Lean note: `plan.md:359` guard should add "R11 touches harvest.ts — serialize A with B when both ready."

**Finding P2 — R16 touches health route same as R8 but not in persistence lock**
- `plan.md:205-214` `R16 — touches: [brave-search.ts, pipeline.ts, health/route.ts] — hazard_touches: [src/lib/persistence/**] — Lock: none — Wave: E`
- `plan.md:135-140` R8 `touches: [health-aggregate.ts, health/route.ts]` `Lock: persistence-single-writer — Wave: B`
- `work-order.json:31` R16 `touches` includes `health/route.ts` `locks:[]` `hazard_touches:[persistence/**]` vs `work-order.json:48` `persistence-single-writer modules [M2,M6,M8,R1,R2,R5,R6,R8,R10]` omits R16 (parenthetical hazard only at `plan.md:344`).
- R16 is a writer (not just read hazard) and its hazard implies serialization, yet lock membership excludes it. Wave E∥B could race on `health/route.ts`.
- **Required fix:** add `R16` to `resource_locks.persistence-single-writer.modules` (and serialize health writers) OR narrow R16 `touches` to exclude `health/route.ts` until dispatch (keep as `read_for_gate`). Recommended former — minimal, aligns with `plan.md:344` parenthetical.

**Finding P3 — R14 and R13 share `eval-canonical-report` but sit in different waves both marked parallel-safe/serial**
- `work-order.json:50` `eval-canonical-report modules [M1,M4,R13,R14]`
- `work-order.json:53` Wave A `members [R9,R11,R15,R14,R19] parallel:true` vs `work-order.json:56` Wave D `members [R12,R13,R17] parallel:false`
- `plan.md:346` same lock table + `plan.md:352` Wave A vs `plan.md:355` Wave D.
- Text `plan.md:359` says "Waves A and E may run in parallel (disjoint locks)" but A contains R14 sharing lock with D's R13 — not disjoint. Scheduler must serialize A∩D via that lock.
- **Required fix:** annotate `Wave A reason: R14 shares eval-canonical-report with R13 — serialize A∩D when both ready` and/or move R14 to Wave D, or set `R14 parallel_safe:false` when `eval-canonical-report` contended. `plan.md:359` guard should state this.

**Finding P4 — R19 lock membership vs per-module locks (informational, not a defect)**
- `work-order.json:34` R19 `locks:[]` `parallel_safe:true` but `work-order.json:49` `page-workspace-single-writer modules [M5,M7,R5,R7,R19]` includes R19. `plan.md:345` same + `plan.md:354` note "R19(board polling hazard) serializes under same lock if editing but dispatched in A". This is hazard-only read — correct by design, but keep annotation so scheduler knows R19 ticket-file edits serialize with `page-workspace` writers (R5,R7,M5,M7).

Parallel safety otherwise sound: persistence writers (R1,R2,R5,R6,R8,R10,M2,M6,M8) serialized; page-workspace writers (R5,R7,M5,M7,R19 hazard) serialized; vault-state writers (M1,M3,R4,R10,R12,R13,R17) serialized; eval-canonical (M1,M4,R13,R14) serialized. No live race today (overlapping writers all gated FOG/BLOCKED per Wave F `plan.md:357`).

## 9. Risks — carried and mitigated

- Cross-lambda split-brain via `createFallbackStore` silent fallback `store.ts:130-181` — `plan.md:384` + `architecture/report.md:310` mitigation via `store?` injection + R1 WARN, resolved before M8 cutover (StoreUnavailableError honest) — accepted ceiling.
- Ledger `KEYS` star-expansion bounded by 500 trim `ledger.ts:25` + orphan heal — `plan.md:385`.
- Health shape break additive only nullable degraded flag `health/route.ts:132-138` — `plan.md:386`.
- Staging poison via `git add -A` — `plan.md:387` + `AGENTS.md` + R12 curated commit `plan.md:170-176`.
- Brave silent degrade — `plan.md:388` R16 `refusals` + WARN + health degraded after 2 zero-hit runs.
- Ticket index drift (R19) — `plan.md:389` mitigate via `npm run tickets` CI check; `tracker-index.md` curated commit via R12.
- Evidence staleness `commit != HEAD` — `plan.md:390` R17 CI gate + atomic twin-write `cmp -s`.

## 10. Scope — PASS

Planning-only output per `plan.md:3` `planning-only. No product code dispatched, no tracker/map/ADR/state mutation. Ponytail ladder enforced; vault determinism & evidence byte-identity hard constraints.` Honored: `git diff HEAD --stat` shows plan/discovery/architecture/grilling tracked changes only, no `stages/*/output` mutation beyond curated `.autoforge` per `AGENTS.md` Storage policy.

## 11. Acceptance — PASS

Global proof `plan.md:363` `vault-sync --check` + `cmp -s` + `npm run typecheck` green — verified at review time both pass. Evidence anchors `056b75f 2026-08-31T22:05:26Z` (historicalProbe `61c7475`), `HEAD a715ee8` at `plan.md:394` pinned and consistent with `git rev-parse HEAD`. R17 regen twin-write preserves byte-identity; R4 live bundle is additive `plan.md:99` mirrored evidence.

## 12. Ponytail / Lean-build — PASS

Every seam reuses installed `DataStore`/`KvRestStore.call()` at `store.ts:68`, stdlib, single-method extension `setIfAbsent`, pure fns (`health-aggregate.ts`, `tickets.ts` compile), WARN tokens, no new deps/facade/ORM/cache/framework. `ponytail:` ceilings tagged at `plan.md:74 (3600s)`, `84 (500-trim)`, `113 (per-iteration poll)`, `122 (20-index cap)`, `242 (pure fn compile)`. Checks lean-build smallest diff: no speculative M1-M8 bundling.

## 13. Vault-sync + cmp twin invariants — PASS

- `scripts/vault-sync.mjs:16-44` HEAD worktree compilation via `git worktree add --detach HEAD` + `vault-import/export` + `git show HEAD:state/vault-notes.json` comparison — never bare `vault-import/export` per `AGENTS.md:15-17` and `plan.md:52`.
- `work-order.json:60-62` `global_guardrails vault_determinism: node scripts/vault-sync.mjs --check` + `evidence_byte_identity: cmp -s .autoforge/validation/ops-loop-evidence.json stages/07_validate/output/ops-loop-evidence.json` — both verified pass at review time.
- No worker scheduled to mutate `state/vault-notes.json` concurrently without `vault-state-single-writer` per `plan.md:343` lock.

## 14. DAG correctness — PASS

Only `M1→M4` (quality gate precedes AI assists per `plan.md:123-130` + `decisions.md AD-10`) and `R4→T2` traceability (T2 CLOSED per `plan.md:245-252` `blocked_by:[R4] traceability only, not dispatch gate`) — `work-order.json:45` edges match. All other overlaps hazard-only per `grilling.md:14-15`. Acyclic.

---

## Required changes before execution (directly resolvable, no need-human)

These are the same three normalizations flagged in prior `plan-critique.md` for 27-entry plan — carried forward correctly but not yet normalized in the 28-entry work-order:

1. **R11 hazard** — `work-order.json:26` add `hazard_touches: ["src/discovery/harvest.ts"]` and annotate `schedule R11 before any harvest.ts writer; never parallel with R1/R5`. Update `plan.md:161` to list `hazard_touches: [src/discovery/harvest.ts]` and `plan.md:359` guard to note A↔B harvest.ts serialization.
2. **R16 lock** — `work-order.json:48` add `R16` to `persistence-single-writer.modules` (or remove `health/route.ts` from `work-order.json:31` touches). Update `plan.md:344` to remove parenthetical and list `R16` explicitly in that row, and `plan.md:356` Wave E guard to note health write hazard serializes with Wave B.
3. **R14/R13 wave** — `plan.md:352-355` / `work-order.json:53,56` annotate `R14 shares eval-canonical-report with R13 — serialize A∩D when both ready` (or move R14 to Wave D). Set `R14 parallel_safe:false` when eval lock contended; update `plan.md:359` "A and E may parallel (disjoint locks)" to "A and E may parallel except R14↔R13 via eval-canonical-report".

Optional polish (not gating):
- Keep `plan.md:44` R19 counting proof wording; no "1 behind" drift text remains (fixed vs prior 27-entry critique).
- Ensure `work-order.json:19` R4 touches mirror `plan.md:99` (both now list `.autoforge/validation/ops-loop-evidence-live.json` + `stages/...` + `report.md`) — currently consistent.

No `need-human.md` required — all gaps are resolvable from evidence, non-destructive, planning-only, gated by existing HITL/owner gates.

## References

- Vault determinism & evidence byte-identity verified `vault-sync --check` pass, `cmp -s` identical at review time.
- Thresholds/judge/E5 frozen per `docs/validation/eval-gates.md:8-12`; ponytail ladder, no new deps.
- Wayfinder MAP: `workflow/wayfinder/maps/ops-residual/MAP.md:41-59` (R1–R19), `MAP.md:21` T2 blocked wording reconciled via R4.
- Model policy `muse-spark-1.2 1M → 80k cap` — inputs verbatim `tracker-index 140 + grilling 519 + plan 394` tracked, within cap.

---
*Reviewer: independent, least-privilege read-only; no speculative M1–M8 implementation proposed; E5/judge/threshold frozen; vault determinism and evidence byte-identity preserved; ponytail ladder respected; grill-with-docs rigor.*
