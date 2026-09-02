# Grilling Review — .autoforge/requirements/grilling.md (28 tickets R1-R19, T2, M1-M8)

**Reviewer:** autoforge-reviewer (independent, read-only, ponytail) — model: muse-spark-1.2-contributor-free (inherit 80k cap, helpers 20k)
**Date:** 2026-09-01
**Scope:** `.autoforge/requirements/grilling.md:1-513` (verbatim) ↔ `stages/02_grill/output/grilling.md` (byte-identical), vs `.autoforge/discovery/tracker-index.md:1-140` (28 entries), `.autoforge/plans/plan.md:1-443` gates, `workflow/wayfinder/maps/ops-residual/MAP.md:1-59`, `.autoforge/architecture/report.md` + `decisions.md`, `docs/validation/eval-gates.md`
**Mode:** read-only review, no product mutation, file:line per finding, grill-with-docs rigor, ponytail least-privilege check

---

## Verdict

**CHANGES_REQUIRED**

Grilling is **structurally complete** (28/28 present with required triad) and safe to keep as planning input, but **not ready for Architect/Plan to consume verbatim**. Citations for FOG items are inaccurate, dependency ordering misstates `blocked_by` semantics, M-series HITL/owner gates are under-specified, and testability/arch constraints (locks, vault determinism, evidence byte-identity) are too shallow to prevent scope creep in execution. Fixes are narrow documentation patches — no product code, no `need-human.md` required.

---

## 1. Inputs verified

- `grilling.md:1-513` byte-identical to `stages/02_grill/output/grilling.md` (verified `diff` empty, `wc -l` 513) — canonical = `.autoforge/requirements/grilling.md` per Storage policy (R12).
- `tracker-index.md:1-140` lists 28 tickets: R1-R19 (19) + T2 (1) + M1-M8 (8). Source labels `v2/v3 Not-yet-specified` stale per `plan.md:11,45` — canonical is `MAP.md:41-59` (R1-R19) and `plan.md:66-196` (M1-M8).
- `plan.md:1-443` gates checked: `plan.md:15-42` reconciliation, `plan.md:66-196` M1-M8 blocks, `plan.md:398-405` locks, `plan.md:418` global proof.
- `MAP.md:1-59` (ops-residual) is canonical for R1-R19; `v3-architecture-deepening/MAP.md` holds Phase 0-7 close-out, not FOG triage — grilling's FOG citations must point to ops-residual 56-58, not v3.

---

## 2. Completeness — PASS (structural)

| Check | Result | Evidence |
|---|---|---|
| Every tracker entry appears | **PASS** 28/28 | `grilling.md:9-500` enumerates R1(9), R2(34), R3(54), R4(73), R5(91), R6(109), R7(127), R8(144), R9(161), R10(178), R11(195), R12(212), R13(230), R14(246), R15(263), R16(281), R17(297), R18(314), R19(331), T2(348), M1(366), M2(384), M3(401), M4(418), M5(435), M6(452), M7(469), M8(486) — each with `Established facts`, `Self-questions`, `Recommendations`, `Challenge of recommendation`, `Blocking edges` |
| Triad per ticket | **PASS** | Each of 28 has ≥1 self-question, ≥1 recommendation sentence, ≥1 challenge sentence — meets task `self-question, recommendation, and challenge of recommendation` gate |
| Mirror invariant | **PASS** | `stages/02_grill/output/grilling.md` mirrors canonical — no divergence |

No omission, no invented module. Counting proof `grilling.md:1` matches `tracker-index.md:140` + `plan.md:43`.

---

## 3. Citation accuracy — CHANGES_REQUIRED (4 gaps)

**Finding C1 — R16-R18 MAP citations point to wrong lines/file** `grilling.md:283,302,318` vs `tracker-index.md:80,85,90` vs `MAP.md:56-58`
- `grilling.md:283` cites `MAP:25-26` for R16, `grilling.md:302` cites `MAP:25-28` for R17, `grilling.md:318` cites `MAP:28-29` for R18.
- `MAP.md:1-59` length is 59; lines 25-29 are the *Triage residual note* (`MAP.md:25`) describing harvest degraded, not the Tickets list. Canonical tickets are `MAP.md:56` (R16), `MAP.md:57` (R17), `MAP.md:58` (R18) plus `MAP.md:58-59` (R19). Correct cite is `MAP.md:56-58` (or at minimum `MAP.md:56-59` for the group).
- `tracker-index.md:80` cites `MAP.md:76-78` etc. — impossible (file is 59 lines). That stale cite already flagged in `architecture/report.md:3` source pin `MAP.md:39-58`. Grilling propagated a different wrong cite instead of fixing it.
- **Fix:** Change `grilling.md:283` → `MAP.md:56`, `grilling.md:302` → `MAP.md:57`, `grilling.md:318` → `MAP.md:58`; normalize `tracker-index` citations separately (out of scope here but flag to Plan). Cite `workflow/wayfinder/maps/ops-residual/MAP.md:56-58` explicitly.

**Finding C2 — Plan gate citations missing or off-by-section for hygiene items** `grilling.md:212-260` vs `plan.md:204-243,66-196`
- R12 `grilling.md:214` cites `MAP:52-53` but omits `plan.md:204-211` (staging policy) that defines curated commit vs ephemeral.
- R13 `grilling.md:233` cites `MAP:53-54` but omits `plan.md:216-223` which pins threshold sourcing from `docs/validation/eval-gates.md` and `HITL_EVAL_DOCTRINE_FROZEN`.
- R14 `grilling.md:249` omits `plan.md:229-235` (header hygiene with `--topup`/`--rebase`).
- M1-M8 `grilling.md:371,390,404,421,438,455,472,489` cite only `plan.md:66-68` etc. single-line ranges; correct ranges per plan are `M1:66-68`, `M2:81-90`, `M3:105-106`, `M4:123-130`, `M5:135-146`, `M6:150-164`, `M7:165-178`, `M8:180-196` — grilling truncates M4/M5/M6 ranges (e.g., `grilling.md:421` cites `plan.md:127-130` but canonical is `123-130`).
- **Fix:** Add exact plan gate lines to each Established facts/Blocking edges section; add `docs/validation/eval-gates.md:14-25` (§2 trigger paths) and `plan.md:204-243` to R12-R15.

**Finding C3 — R5-R11 plan citations claim `plan.md:19-21` but those rows are reconciliation table, not gate definitions** `grilling.md:94,113,155`
- `grilling.md:94` `R5: plan.md:19` points to reconciliation row, not the execution guardrail/lock definition. True seam is `plan.md:121-131` (M5) vs `plan.md:121-131` for R5 (R5 objective at `plan.md:121-131`). Misleading.
- **Fix:** Cite `plan.md:121-131` for R5, `plan.md:133-143` for R6, `plan.md:145-155` for R7, etc., per §3 modules.

**Finding C4 — Evidence citations omit arch source** `grilling.md:30,50,69`
- R1-R3 evidence lists `tracker-index.md:4; plan.md:15; MAP.md:41-42` but omits `architecture/report.md:35-53` and `decisions.md:AD-02/03` which are the canonical seam decisions the grill should trace.
- **Fix (minor):** Add `architecture/report.md:35-43` (R1 seam) and `decisions.md:AD-02` etc. to evidence citations — consistent with task `MAP.md:41-59, plan.md:204-243, :66-196` plus arch.

---

## 4. Dependency ordering — CHANGES_REQUIRED (1 material + 1 nuance)

**Finding D1 — R1→R2→R3 ordering inverted** `grilling.md:15,39,58` vs `plan.md:70-105,393-395` vs `architecture/report.md:124-129`
- `grilling.md:15` states "Blocking edges: none in this ticket itself, but its completion unlocks R2 and R3 per plan (blocked_by in plan.md rows 16-17)" and `grilling.md:39` "Blocking edges: dependent on R1 completion; R3 blocked behind R1/R2 seams (plan.md:17)".
- `plan.md:78-83` shows `R1 blocked_by: []`, `R2 blocked_by: []`, `R3 blocked_by: []` — all three share `persistence-single-writer` *hazard* but no semantic `blocked_by` edge. True DAG is `M1→M4` only (`plan.md:393-395`, `decisions.md:AD-09`); `T2 blocked_by:[R4]` is traceability only (`plan.md:295`). Lock serialization is via `plan.md:399-404` table, not DAG.
- This misstates the scheduler contract: R1 does NOT gate R2/R3; they serialize by lock, not by DAG. Executing R1 before R2 is a policy ordering, not a dependency.
- **Fix:** Rewrite `grilling.md:15,39,58` Blocking edges to: "`blocked_by: []` per plan; hazard `persistence-single-writer` shared with R2/R5/R6/R8/R10 — scheduler serializes, no DAG edge. First-ready wins after gate opens. Reference `plan.md:393-395` + `plan.md:399-404` locks table."

**Finding D2 — M1→M4 edge under-specified, others missing external gate names** `grilling.md:378,395,412,429,446,463,480,497`
- `grilling.md:378` lists `BLOCKED; escalate per HITL` but omits gate name `OWNER_GF_SOURCE_AND_ACCEPTANCE + passes_corpus_mark + fresh Tier-1` (`plan.md:66-68`, `eval-gates.md:28-36`).
- Similarly M2 omits `BLOB_LIMIT_TRIGGER` specifics, M3 omits `VAULT_CONFLICT_TRIGGER_AND_OWNER`, M4 omits `M1→M4 + OWNER_ASSIST_SCHEMA + FRESH_TIER_1`, M5 omits `FLAG_2 + LIVE_REVIEW_BOTTLENECK`, etc.
- **Fix:** Enumerate exact external gate tokens per `plan.md:66-196` in each M's Blocking edges — required for scheduler HITL check.

---

## 5. Architecture consistency — CHANGES_REQUIRED (3 gaps)

**Finding A1 — Single-writer locks and hazard_touches not surfaced per ticket** `grilling.md:14,39,58,102,120,138,155,173,190,207,224,241,258`
- Plan and arch enforce four locks: `vault-state-single-writer`, `persistence-single-writer`, `page-workspace-single-writer`, `eval-canonical-report` (`plan.md:399-404`, `architecture/report.md:124-129`, `decisions.md:AD-10`). Grilling mentions lock only for R1 (`grilling.md:14`) and vague "persistence hazard" elsewhere; R5 (`grilling.md:102`), R6 (`120`), R8 (`155`), R10 (`190`), R12/R13 (`207,224`) omit lock membership entirely.
- Reader cannot tell that `R5` must acquire *both* `persistence` + `page-workspace`, that `R7` is `page-workspace-single-writer`, that `R12/R13/R17` contend on `vault-state-single-writer`.
- **Fix:** Add `Lock: <name>` line to each ticket's Established facts referencing `plan.md:399-404` table; align with `architecture/report.md:133-143` hazard_touches.

**Finding A2 — Vault determinism & evidence byte-identity missing from R10/R12/R13/R17** `grilling.md:186,207,233,304`
- `architecture/report.md:145-148` and `plan.md:55-56,418` define invariants: `state/vault-notes.json` compiled from HEAD worktree only (`node scripts/vault-sync.mjs --check`), `ops-loop-evidence.json` ↔ `stages/07_validate/output/ops-loop-evidence.json` must `cmp -s` identical. R10 (`grilling.md:186`) mentions "ROFS" but not vault-state serialization; R12 (`207`) omits `vault-sync --check` as acceptance; R17 (`304`) mentions deterministic script but omits atomic twin-write requirement (`plan.md:269,56`).
- **Fix:** Add invariant citations to those tickets' acceptance/challenge sections.

**Finding A3 — Ponytail ladder not invoked as decision lens** `grilling.md:22,44,63,99,117,134...`
- Arch mandates ponytail (reuse `DataStore`/`KvRestStore` seam, stdlib, smallest diff, no new dep) (`plan.md:58`, `architecture/report.md:14`). Grilling recommendations drift toward "add guardrails" without rung citation; e.g., `grilling.md:22` says "new harvest-lock.ts" but doesn't state "rung 5 → rung 3 reuse of existing `call()`" (`decisions.md:AD-02`).
- **Fix:** One-line ponytail tag per ticket where code is proposed (e.g., "Ponytail: reuse `DataStore.call`, no new dep; `ponytail:` comment if TTL fallback ceiling kept").

---

## 6. Assumptions — PARTIAL (needs hardening)

| Ticket | Grilling assumption | What's missing | Fix reference |
|---|---|---|---|
| R1 `grilling.md:17-26` | SET NX minimal surface | Upstash REST `["SET",k,v,"NX","EX",ttl]` atomicity is via existing `call()` seam (`store.ts:68`); TTL 3600 >> `maxDuration 60s` safety; local fallback is accepted ceiling not fix | Add `architecture/report.md:37-43` + `plan.md:74` to Established facts; challenge must note silent fallback split-brain until M8 (`architecture/report.md:160`) |
| R2 `grilling.md:41-46` | Dedup+trim sufficient | Assumes 500-trim bounds `KEYS` latency; orphan self-heal is best-effort and masks star-expansion cost | Add `architecture/report.md:48-50` + `plan.md:87` to challenge |
| R4 `grilling.md:79-83` | Dummy bundle proves durability | Requires 24h window, deploy id `33295…`, `launchctl print` active + log tail (`plan.md:117-119`); schema-compat with validator, no secret leak | Expand recommendation to cite `plan.md:108-119` acceptance |
| R5 `grilling.md:97-101` | Stop endpoint thin contract | Assumes explicit `DiscoveryJobStatus "cancelled"` vs sentinel reuse; `executeJob` per-node bail (`plan.md:123-129`) | Call out enum choice via `decisions.md:AD-06` |
| R13 `grilling.md:234-238` | Freshness respects frozen doctrine | Threshold MUST be parsed from `eval-gates.md:14-25` not hardcoded; script read-only | Add `plan.md:218-220` + `docs/validation/eval-gates.md:14-25` citation |

---

## 7. Testability / Acceptance — CHANGES_REQUIRED (M-series weakest)

**Finding T1 — OPEN tickets R7,R9,R11,R12,R13,R14,R15 lack concrete `npm run` checks** `grilling.md:132-275`
- `grilling.md:134` (R7) says "tests focus on DOM attributes" but omits `npm run typecheck && npm run lint && npm run build` + DOM title assert (`bypasses.*dedup`). `grilling.md:168` (R9) omits `--live --json` stdout single-JSON + exit code unchanged. `grilling.md:202` (R11) omits `rg getGitHead` 0 hits + typecheck. `grilling.md:219` (R12) omits `git status` clean + `vault-sync --check`.
- **Fix:** Copy acceptance lines from `plan.md:149-249` verbatim (or cite them) — plan already has testable checks.

**Finding T2 — M-series acceptance is generic, not owner-gated** `grilling.md:373-498`
- `grilling.md:374` (M1): "Align GF baseline… avoid scope creep" vs required `plan.md:66-68` + `architecture/report.md:109`: all five `passes_corpus_mark=true`, zero-drop, GF-9 pivotal claims quoted (`eval-gates.md:35`), archive manifest + owner ack, rollback prior baseline.
- `grilling.md:391` (M2): "controlled risk boundary" vs `plan.md:319`: absent trigger → no code, adapter contract, migration/rollback restore point.
- M3-M8 similarly generic ("short message", "improve copy", "document policy").
- **Fix:** Replace vague recommendations with gate-faithful acceptance copied from `plan.md:66-196` + `architecture/report.md:109-116`. Mark HOLD until gate opens — no "outline minimal feature" before trigger.

**Finding T3 — R16-R18 testability shallow** `grilling.md:285-324`
- R16 `grilling.md:287` lists "structured log token" but omits `plan.md:261` checks: mock 402 → `[]` no throw + refusal propagated, `WARN` searchable, next scheduled `discovery harvest` green via seeds while quota exceeded, health degraded flag after 2 zero-hit runs, mock 429 still retries, `flow.spec.ts` green.
- R17 `grilling.md:304` omits `plan.md:272`: `node scripts/check-evidence-head.mjs` exit 0 when `commit==HEAD` & `generatedAt` fresh, fail with `evidence stale: commit 61c7475 != HEAD 70a519c — run: gh workflow run discovery-harvest`, `cmp -s` twin identical.
- R18 `grilling.md:321` omits `plan.md:285` verification matrix: `git ls-files --others` 0 jsx/js shadow, `npm run build` 13.9kB, lint 0, visual checks, `git diff main...feat/mission-control -- ui/` empty.
- **Fix:** Enumerate those exact checks; cite `plan.md:261,272,285`.

---

## 8. Scope / HITL / FOG — PARTIAL

- FOG gates correctly flagged `grilling.md:282,298,315,384,469` but escalation phrasing is boilerplate "escalate per E5" without owner/trigger name. Must name: `FOG_BRAVE_QUOTA_REPLENISHMENT_HITL` (R16 key rotation is HITL not code, `plan.md:260`), `R17 evidence-head` CI gate, `R18 verify-and-stop` no code.
- HITL gates: R4 `HITL_PRODUCTION_DAEMON_PROOF` (`plan.md:116`), R13 `HITL_EVAL_DOCTRINE_FROZEN` (`plan.md:224`) are named in plan; grilling collapses to "HITL_PRODUCTION_DAEMON_PROOF" once (`grilling.md:76`) but not for R13/M3. Add explicit `external_gates: [...]` per `plan.md:61`.
- Scope guard (frozen thresholds, judge prompts, E5, ODD) mentioned once (`grilling.md:28`) but not repeated for M1/M4 where risk of threshold mutation is highest. Add doctrine citation `docs/validation/eval-gates.md:28-36` + `plan.md:60` to M1/M4 challenges.

---

## 9. Per-ticket findings matrix

| Ticket | Status in grill | Self-Q | Rec | Challenge | Citation OK | Verdict per ticket |
|---|---|---|---|---|---|---|
| R1 `grilling.md:9` | BLOCKED | 4 questions — good depth | Minimal lock with fallback — directionally correct, needs TTL/fallback ceiling note | Mentions TTL drift — too thin | Partial (lock table missing, MAP ok) | **NEEDS FIX** (D1, A1, A3) |
| R2 `grilling.md:34` | BLOCKED | 2 questions — shallow (needs heal idempotency, sort stability) | Dedup+trim — correct, needs orphan heal writeback mention | Perf cost only — misses latency bound | Partial | **NEEDS FIX** (T1, A1) |
| R3 `grilling.md:54` | BLOCKED | 2 questions — ok | MemoryStore regression tests — correct | Drift note — ok | Partial | **PASS with notes** |
| R4 `grilling.md:73` | BLOCKED HITL | 1 question — shallow | Dummy bundle — too vague | HITL timing only | No (omits plan 108-119) | **NEEDS FIX** (T1, A2) |
| R5 `grilling.md:91` | OPEN | 1 question — shallow | Cancel route + status — correct | Cross-node inconsistency — good | Partial (wrong plan line) | **NEEDS FIX** (C3, A1) |
| R6 `grilling.md:109` | OPEN | 1 question — ok | Stable slice — correct | Race only | Partial | **PASS with notes** |
| R7 `grilling.md:127` | OPEN | 1 question — shallow | Title tooltip — correct | Rerun interaction — ok | Partial (no plan cite) | **NEEDS FIX** (T1) |
| R8 `grilling.md:144` | OPEN | 1 — shallow | Pure aggregator — correct | Shallow data risk — ok | Partial | **PASS with notes** |
| R9 `grilling.md:161` | OPEN | 1 — shallow | JSON contract — correct | Shape compat — ok | Partial | **NEEDS FIX** (T1) |
| R10 `grilling.md:178` | OPEN | 1 — shallow | KV-first load — correct | Latency — ok | Partial (misses vault hazard) | **NEEDS FIX** (A2) |
| R11 `grilling.md:195` | OPEN | 1 — ok | Remove comments — correct | Hidden refs — ok | Partial (no hazard lock) | **NEEDS FIX** (C3, T1) |
| R12 `grilling.md:212` | OPEN | 1 — shallow | Staged policy — correct | Mismatch risk — ok | No (misses plan 204-211) | **NEEDS FIX** (C2, A2) |
| R13 `grilling.md:230` | OPEN HITL | 1 — good | Read-only automation — correct | HITL delay — ok | No (misses plan 216-223) | **NEEDS FIX** (C2, scope) |
| R14 `grilling.md:246` | OPEN | 1 — ok | Keep helper — correct | Drift creep — ok | Partial | **PASS with notes** |
| R15 `grilling.md:263` | OPEN | 1 — ok | Update docs — correct | Docs mismatch — ok | Partial | **PASS with notes** |
| R16 `grilling.md:281` | FOG | 1 — shallow | Log token — correct but incomplete (omits refusals + health) | Observability — ok | **FAIL** (MAP 25-26 wrong) | **NEEDS FIX** (C1, T3) |
| R17 `grilling.md:297` | FOG | 1 — shallow | Lightweight script — correct but omits atomic twin-write | Fragility — ok but misses ±24h | **FAIL** (MAP 25-28 wrong) | **NEEDS FIX** (C1, T3, A2) |
| R18 `grilling.md:314` | FOG | 1 — shallow | Conflict guard — vague vs verify-and-stop | False positives — weak | **FAIL** (MAP 28-29 wrong) | **NEEDS FIX** (C1, T3) |
| R19 `grilling.md:331` | OPEN | 1 — ok | Index remapping — correct | Drift — ok | Pass (MAP 58-59) | **PASS with notes** |
| T2 `grilling.md:348` | CLOSED | 1 — ok | Closure rationale — correct | Abstinence — ok | Partial (MAP:21 nuance correct via plan 24-25) | **PASS** |
| M1 `grilling.md:366` | BLOCKED | 1 — shallow, not gate-aware | Generic align — **too vague** | Generic risk — misses zero-drop | No (misses gate tokens) | **NEEDS FIX** (D2, T2) |
| M2 `grilling.md:384` | BLOCKED | 1 — shallow | Outline minimal — speculative | Leakage risk — ok | No | **NEEDS FIX** (D2, T2) |
| M3 `grilling.md:401` | BLOCKED | 1 — shallow, UX framing misses fail-closed | Micro-interactions — wrong seam (should be compiler diagnostics) | Obscures data — mis-aimed | No (misses trigger) | **NEEDS FIX** (D2, T2) |
| M4 `grilling.md:418` | BLOCKED | 1 — ok (reuse) | Extend templates — incomplete (OFF default, provenance) | Generic | No | **NEEDS FIX** (D2, T2) |
| M5 `grilling.md:435` | BLOCKED | 1 — shallow | Copy/error messaging — understates prov | Eval semantics — ok | No | **NEEDS FIX** (T2) |
| M6 `grilling.md:452` | BLOCKED | 1 — shallow | Document policy — correct but misses TTL/purge | Governance — ok | No | **NEEDS FIX** (T2) |
| M7 `grilling.md:469` | BLOCKED | 1 — shallow | Lightweight snapshot — correct | Entropy — ok | No (wrong lock context) | **NEEDS FIX** (T2) |
| M8 `grilling.md:486` | BLOCKED | 1 — shallow | Prototype adapter — correct | Overhead — ok | Partial | **NEEDS FIX** (T2, A1) |

Overall: **11 PASS/with-notes, 17 NEEDS FIX** — fixes are doc-only, no product code.

---

## 10. Ponytail least-privilege check

- Ladder referenced once per R1/R2 (`grilling.md:22,44`) but not systematically. For hygiene items (R7,R9,R11,R14,R15) grilling correctly proposes stdlib/docs/title/comment-only — **PASS**.
- No new dependency proposed — **PASS**.
- Deliberate ceilings not tagged with `ponytail:` comment (e.g., R1 fallback `WARN`, R2 `KEYS` 500-trim bound, R10 file fallback). Architecture expects `ponytail: global fallback, per-account locks if throughput matters` style tags (`architecture/report.md:169-173`). Add where ceiling is kept.
- Smallest diff wins observed: R5 cancel is surgical, R6 pagination stable slice, R8 pure aggregate — all consistent with ladder; no over-building detected.

---

## 11. Required fixes — actionable checklist (doc patches only)

Patch `.autoforge/requirements/grilling.md` (and staged mirror) with these edits — each cites target file:line:

- [ ] **R16-R18 MAP citations:** `grilling.md:283` → `MAP.md:56`, `grilling.md:302` → `MAP.md:57`, `grilling.md:318` → `MAP.md:58` (ops-residual `workflow/wayfinder/maps/ops-residual/MAP.md:56-58`). Verify `wc -l MAP.md` = 59 to prevent future impossible cites.
- [ ] **R12-R15 plan citations:** Append `plan.md:204-211` (R12), `plan.md:216-223` (R13), `plan.md:229-235` (R14), `plan.md:240-243` (R15) and `docs/validation/eval-gates.md:14-25` (§2 triggers) to their Established facts/Blocking edges.
- [ ] **M1-M8 plan ranges:** Expand to full ranges `plan.md:66-68,81-90,105-106,123-130,135-146,150-164,165-178,180-196` and copy gate token names (`OWNER_GF_SOURCE_AND_ACCEPTANCE`, `BLOB_LIMIT_TRIGGER`, etc.) into each Blocking edges.
- [ ] **D1 dependency correction:** Rewrite `grilling.md:15,39,58` to `blocked_by: []` + hazard `persistence-single-writer` (cite `plan.md:393-395` + `plan.md:399-404`). Move ordering rationale to policy note, not DAG.
- [ ] **A1 locks per ticket:** Add `Lock:` line to R1,R2,R5,R6,R8,R10,R7,R12,R13,R14,R17 and M1-M8 per `plan.md:399-404` + `architecture/report.md:124-129`. Specifically: R5 dual `persistence+page-workspace`, R7 `page-workspace`, R12/R13/R17 `vault-state-single-writer` (+ R10 dual), R14 `eval-canonical-report`.
- [ ] **A2 invariants:** Add vault determinism (`plan.md:55-56`, `architecture/report.md:145-148`, `scripts/vault-sync.mjs --check`) to R10/R12/R13/R17; add evidence `cmp -s` + atomic twin-write (`plan.md:269,56`) to R17; add `plan.md:117-119` acceptance to R4.
- [ ] **T1 OPEN acceptance:** Fill concrete checks per `plan.md:149-249` for R7,R9,R11,R12,R13,R15 (DOM title assert, `--live --json` single JSON, `rg getGitHead` 0, `git status` clean, threshold sourcing, docs match `discovery-harvest.yml`).
- [ ] **T2 M-series:** Replace generic recommendations with gate-faithful acceptance from `plan.md:66-196` + `architecture/report.md:109-116` (M1 five projects `passes_corpus_mark`, M2 no code until trigger, M3 compiler diagnostics fail-closed, M4 OFF default + provenance/budget, etc.). Tag as HOLD.
- [ ] **T3 FOG depth:** Expand R16 to `plan.md:261` checks, R17 to `plan.md:272` checks, R18 to `plan.md:285` verify-only matrix.
- [ ] **Scope/FOG naming:** Add `external_gates: [HITL_PRODUCTION_DAEMON_PROOF, HITL_EVAL_DOCTRINE_FROZEN, FOG_BRAVE_QUOTA_REPLENISHMENT_HITL, ...]` to R4,R13,R16 per `plan.md:61`.
- [ ] **Ponytail tags:** One-line `ponytail:` comment note per ceiling (R1 fallback, R2 500-trim, R10 EROFS WARN).

No product mutation, no tracker/map/ADR/state mutation. After patch: re-run `diff .autoforge/requirements/grilling.md stages/02_grill/output/grilling.md` must stay empty (re-mirror), and `node scripts/vault-sync.mjs --check` + `npm run typecheck` green per `plan.md:418`.

---

## 12. Acceptance for this review

- Verdict justified: CHANGES_REQUIRED — gaps tied to `grilling.md:*`, `plan.md:*`, `MAP.md:*`, `tracker-index.md:*`, `architecture/report.md:*`, `eval-gates.md:*` above; no vague "looks good".
- Every tracker-index entry verified with triad present (`§2`).
- BLOCKED/FOG/HITL gates cited correctly check performed (`MAP.md:41-59`, `plan.md:66-196`, `plan.md:204-243`) — failures listed as C1-C4, D1-D2.
- Ponytail least-privilege checked (`§10`).
- Artifact path for orchestrator: `.autoforge/reviews/grilling-review.md` ↔ `stages/02_grill/output/review.md` (canonical is `.autoforge/reviews/grilling-review.md`).

---

*Reviewer notes: independent, read-only; did not mutate product; searched callers/seams via `store.ts`, `harvest.ts:99-104`, `ledger.ts`, `brave-search.ts:58-83`, `provider-health.tsx:135-144`, `vault-sync.mjs`; grill-with-docs rigor applied; domain terms (`DataStore`, `harvest lock`, `legality vs safety` kept distinct) per `domain-modeling`.*
