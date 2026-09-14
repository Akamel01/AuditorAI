# Plan — Loop 3: 8 gated tripwires (monitor-only) + v4-harvest-deepening A1–A5 + ticket creation

Date: 2026-09-14. Scope: `/Users/akamel/Documents/AuditorAI`.
Sources: `.autoforge/discovery/tracker-index.md` (8 open, all gated), `.autoforge/discovery/report.md`
(loop-3 refresh), `.autoforge/requirements/grilling.md` (all 8 non-executable, ungating conditions),
`.autoforge/architecture/report.md` + `decisions.md` (A1–A5, map `v4-harvest-deepening`).
Skills: `codebase-design` (module/interface/seam/adapter/depth vocabulary; hypothetical-seam rule used for A4).
Worktree (read-only `git status --porcelain` 2026-09-14): dirty — foreign parallel-session edits in
`src/discovery/harvest.ts`, `dedupe-persist.ts`, `health-aggregate.ts`, `pipeline.ts`,
`src/app/api/dev/health/route.ts`, `tests/domain/discovery-harvest.test.ts`,
`tests/domain/wayfinder-tickets.test.ts`, `scripts/tier1-archive.mjs`, plus `.autoforge/*` staging.
Every code module carries collision guards below. No child touches `state/vault-notes.json`, runs git
mutations, or edits foreign regions. Stdlib only, no new deps.

## Coverage — every tracker-index open entry → module

| # | Tracker entry | Gate | Module | Action |
|---|---|---|---|---|
| 1 | v2 F1-quote-bearing-baselines (blocks F4; judge 401) | owner GF source + Tier-1 + key | M-GATED-V2 | monitor-only |
| 2 | v2 F2-blob-storage-escape-hatch | BLOB_LIMIT_TRIGGER absent | M-GATED-V2 | monitor-only |
| 3 | v2 F3-vault-sync-conflict-ux | VAULT_CONFLICT_TRIGGER absent | M-GATED-V2 | monitor-only |
| 4 | v2 F4-report-generation-assists (blocked_by F1) | assist schema + fresh Tier-1 | M-GATED-V2 | monitor-only |
| 5 | v3 F1-candidate-findings-review-ux | FLAG_2 decision | M-GATED-V3 | monitor-only |
| 6 | v3 F2-audit-history-retention-policy | FLAG_1 authority | M-GATED-V3 | monitor-only |
| 7 | v3 F3-rsc-initial-page-data | measurable target absent | M-GATED-V3 | monitor-only |
| 8 | v3 F4-postgres-adapter | PHASE_3 authority | M-GATED-V3 | monitor-only |
| — | T2 note (worktree-resolved vs HEAD-blocked) | foreign lane owns | — | explicitly deferred: owning session commits + updates `wayfinder-tickets.test.ts:143`; no module touches it |
| — | A1 ledger-run-persist (Strong) | — | M-A1 | implement |
| — | A2 ctx-builder (Strong) | — | M-A2 | implement |
| — | A3 dedupe-index-return (Strong, DO FIRST) | — | M-A3 | implement |
| — | A4 provider-fetch-routing (Worth-exploring) | grill pre-decided below | M-A4 | implement |
| — | A5 health-bridge-consolidation (Worth-exploring) | foreign bridge lane | M-A5 | lane-gated implement-or-dup-close |
| — | 5 ticket files + MAP.md for v4-harvest-deepening | orchestrator-side, post-approval | M-TICKETS | docs-only |

## Modules

### M-GATED-V2 — monitor v2 F1–F4 (zero code)
- Objective: re-verify each v2 ticket still gated; record evidence; change nothing.
- Scope: read ticket front-matter + gate signals only (judge key still 401? BLOB trigger absent?
  `vault-sync --check` exit? F1→F4 edge intact?). Output brief `.autoforge/execution/M-GATED-V2.md`.
- touches: `["workflow/wayfinder/maps/v2-agentic-platform/tickets/*", ".autoforge/execution/M-GATED-V2.md"]`
- blocked_by: `[]`. Type: verify-only. Role: executor, zero questions.
- Acceptance: brief lists F1–F4 with gate state + one evidence line each; zero prod-file diffs
  (`git status --porcelain` shows no new src/tests modifications by this worker).
- Reviewer: orchestrator read-only (brief + empty diff).

### M-GATED-V3 — monitor v3 F1–F4 (zero code)
- Objective/scope: same as M-GATED-V2 for v3 map (FLAG_1/FLAG_2/target/PHASE_3 still absent?).
  Output `.autoforge/execution/M-GATED-V3.md`.
- touches: `["workflow/wayfinder/maps/v3-architecture-deepening/tickets/*", ".autoforge/execution/M-GATED-V3.md"]`
- blocked_by: `[]`. Type: verify-only. Role: executor, zero questions.
- Acceptance: brief lists F1–F4 with gate state + evidence; zero prod-file diffs.
- Reviewer: orchestrator read-only.

### M-A3 — pipeline returns claimed dedupe index (DO FIRST)
- Objective: single claim site — `DiscoveryRunOutcome` carries `dedupeIndex`; delete stream re-claim.
- Scope: `pipeline.ts:285-313` (d08 clone becomes returned index; outcome type `:342-346`);
  delete `harvest-stream.ts:220-233` loop AND rewire the consumer: replace the `:216-233` block with
  `stream.dedupeIndex = outcome.dedupeIndex` (destructure outcome at `:182`, not just `{state}`).
  A loop deletion without this rewiring freezes `stream.dedupeIndex` and replays H10 (cross-tick dupes).
  Orchestrators persist via `dedupe-persist` only (R10 untouched,
  do not edit `dedupe-persist.ts` — foreign lane dirty there); `harvest.ts:227-234` call-site only if
  needed, prefer no edit. Collision: `pipeline.ts` + `harvest.ts` dirty in worktree → verify-before-edit:
  `git diff` own regions first; if foreign edits overlap the d08/outcome lines, stop and report, do not overwrite.
- touches: `["src/discovery/pipeline.ts", "src/discovery/harvest-stream.ts", "src/discovery/harvest.ts", "tests/domain/discovery-pipeline-dedupe-index.test.ts", ".autoforge/execution/M-A3.md"]`
- blocked_by: `[]`. Skills: codebase-design (claim rule locality in d08). Tests: new through-interface test
  (pipeline twice, same docs, MemoryStore → second `dedupe_status != unique`, threading the returned index:
  run2 `ctx.dedupeIndex = run1 outcome.dedupeIndex`); stream test asserting `stream.dedupeIndex` advances
  across two ticks with zero `claimFingerprints` in stream; `rg claimFingerprints
  src/discovery/harvest-stream.ts` → 0; dedupe/pipeline suites + typecheck green.
- Acceptance: per decisions.md AD-A3 §Acceptance (4 checks).
- Reviewer: read-only diff review (outcome shape + loop deletion) + suite greens.

### M-A1 — ledger run-persist behind the ledger seam
- Objective: `appendLedgerRun(slices, ranAtIso, store?) → LedgerEntry[]` in `ledger.ts` owns
  seq + file mirror + KV append + trim; `executeJob` call site becomes one call; zero seq/INDEX_KEY
  arithmetic left in `harvest.ts`. Guard stays put: VITEST/NODE_ENV gate at `harvest.ts:214` keeps
  wrapping the one call (moved fn writes unconditionally); coverage-mirror write (`:346-353`) does NOT
  move — ledger must not own coverage files, move ledger slices only. Collision: `harvest.ts` dirty → verify-before-edit, same protocol as M-A3.
- touches: `["src/discovery/harvest.ts", "src/discovery/ledger.ts", "tests/domain/discovery-ledger-run.test.ts", ".autoforge/execution/M-A1.md"]`
- blocked_by: `["M-A3"]` (serializes shared `harvest.ts`; A3 shrinks file first).
- Skills: codebase-design (KV+file = two adapters, real seam). Tests: adjunct `appendLedgerRun` runs on a
  shared MemoryStore continue disjoint seqs (r1 max < r2 min, KV tail total 4); mirror confined to tmp via
  `AUDITORAI_LEDGER_MIRROR` with live-ledger mtime assertion;
  `rg 'nextSeq|lastSeq|INDEX_KEY' src/discovery/harvest.ts` → 0; ledger-r2 + harvest suites + typecheck.
  (Deviations recorded: simultaneity not asserted — allocation is read-tail-then-assign inherited from the
  original; single-writer throws on contention; values ride inline in slices, side-channel module deleted.)
- Acceptance: per AD-A1 (4 checks). Reviewer: read-only (seam placement + twin-write locality).

### M-A4 — d04Acquire via provider.fetch (%PDF-guard home PRE-DECIDED)
- Planner grill decision (worker asks zero questions): **%PDF guard stays in `d04Acquire`
  (caller-side); `provider.fetch` remains byte-transport, unwidened.** Rationale: one consumer's PDF need =
  hypothetical seam — widening the fetch contract for one adapter fails the two-adapter test and expands
  blast radius to every provider. Revisit if a second content-type appears.
- Objective: route d04 live fallback through originating provider's `fetch`; index hits/quals once;
  remove dead `seq` (`:218`); keep guard in d04. Fallback rule: per-hit try `provider.fetch` → on throw
  (offline/non-fetching provider, e.g. `seed-portals.fetch` throws by design) fall back to the current
  direct-fetch path (preserves seed behavior). Budget rule: `withHostBudget` lives INSIDE `provider.fetch`
  impls — d04 must NOT wrap `provider.fetch` calls (keep wrapper only around the legacy fallback).
  `provider-types.ts` is READ-ONLY reference for the guard-home check; any diff there fails review.
  Collision: `pipeline.ts` dirty → verify-before-edit.
- touches: `["src/discovery/pipeline.ts", "src/discovery/providers/provider-types.ts", "tests/domain/discovery-pipeline-d04.test.ts", ".autoforge/execution/M-A4.md"]`
- blocked_by: `["M-A3"]` (shared `pipeline.ts`, disjoint nodes d04 vs d08; A3 lands first).
  Parallel-safe with M-A1 (touches disjoint).
- Skills: codebase-design. Tests: fake `provider.fetch` non-PDF bytes → empty bundle + warn, zero network;
  seed-originated-hit test (`provider_id: "seed-portals"` → non-empty bundle via fallback, stubbed global
  fetch); spy test asserting `provider.fetch` was actually called (not just output shape);
  bare-fetch `rg` → 0; pipeline suites + typecheck.
- Acceptance: per AD-A4 (4 checks) + guard-home check (guard present in d04 region, fetch contract unwidened).
- Reviewer: read-only (transport routing + guard placement).

### M-A2 — single DiscoveryCtx builder
- Objective: `buildDiscoveryCtx({live, cellKey}, deps?)` in `harvest.ts`; both callers use it;
  filter policy (incl. agent-reach-search + DEPRECATED) in one place; preserve `UnknownCellKeyError`.
  Null-cellKey semantics PINNED: builder adopts harvest gaps-aware derivation (`harvest.ts:396-413`) +
  static fallback; stream no-cellKey ticks thereby gain gaps-awareness (intended — record in M-A2.md brief);
  `deps?` carries `read`/`cwd` so the tick path stays injectable and the parity test runs hermetic (stub deps).
- touches: `["src/discovery/harvest.ts", "src/discovery/harvest-stream.ts", "tests/domain/discovery-ctx-builder.test.ts", ".autoforge/execution/M-A2.md"]`
- blocked_by: `["M-A3", "M-A1"]` (shared files with both; A1 shrinks `harvest.ts` first, A3 edits stream first).
- Skills: codebase-design (two callers = real seam). Tests: same input both paths → identical
  providerIds/query; null-cellKey case asserts gaps-aware derivation, NOT the legacy static default;
  unknown cellKey throws; deprecated excluded live; stream + harvest suites green.
- Acceptance: per AD-A2 (3 checks). Reviewer: read-only (no inline JUR_MAP/filter left in stream).

### M-A5 — health fallback consolidation (LANE-GATED)
- Objective: move file-ledger fallback inside `bridgeHarvestHealth`; freeze `HarvestHealthBridge`;
  thin route to auth + delegate; shape-pinning test. **Step 0: diff against HEAD** — bridge files dirty
  in worktree (foreign in-flight lane). If lane uncommitted/overlapping: verify-only, record dup-check,
  change nothing. If lane committed and fallback still in route: implement. If lane covered it: close as dup.
- touches: `["src/discovery/health-aggregate.ts", "src/app/api/dev/health/route.ts", "tests/domain/harvest-health-bridge.test.ts", ".autoforge/execution/M-A5.md"]`
- blocked_by: `[]` + lane gate in acceptance (in-ticket, not an edge). Schedulable wave 2.
- Skills: codebase-design (one served interface). Tests: KV-down + file-present → full 8-field shape;
  KV-down + no-file → nulls, shape intact; harvest-health suite green. Fix stale field-count comments in
  passing (`health-aggregate.ts:79-80,:18-21`; `route.ts:134`: "6-field" → 8-field).
- Acceptance: per AD-A5 (4 checks) + lane verdict recorded. Reviewer: read-only + lane-owner confirm.

### M-TICKETS — create v4-harvest-deepening tickets + MAP.md (docs-only, orchestrator-side, post-approval)
- Objective: write 5 ticket files (A1–A5, front-matter per decisions.md: id/title/map/blocked_by/self-approve)
  + map MAP.md under `workflow/wayfinder/maps/v4-harvest-deepening/**`. Front-matter encodes grill outcomes:
  A4 records `grill: resolved-by-planner (guard caller-side, fetch unwidened; revisit on 2nd content-type)`
  + `self-approve: true` (NOT FALSE — planner already grilled it); A5 records `lane-gate: foreign bridge
  lane, reviewer = lane owner`. No code, no gate changes.
- touches: `["workflow/wayfinder/maps/v4-harvest-deepening/**", ".autoforge/execution/M-TICKETS.md"]`
- blocked_by: `[]`. Type: docs-only. Role: executor, zero questions.
- Acceptance: 5 files + MAP.md exist with correct front-matter; `to-tickets` edge syntax valid;
  zero diffs outside the map dir + own brief.
- Reviewer: orchestrator read-only (front-matter + edges).

## Execution DAG + parallel groups
- Wave 0 (parallel, disjoint touches): M-GATED-V2, M-GATED-V3, M-TICKETS, M-A3.
- Wave 1 (parallel, disjoint): M-A1 (←M-A3), M-A4 (←M-A3).
- Wave 2 (parallel, disjoint): M-A2 (←M-A3, M-A1), M-A5 (lane-gated).
- Edges: M-A1←M-A3; M-A4←M-A3; M-A2←M-A3,M-A1. All else root.
- Shared-file serialization: `harvest-stream.ts` A3→A2; `harvest.ts` A3→A1→A2; `pipeline.ts` A3→A4.
- Global guards: explicit touches allow-lists; no git add/commit/push; never `state/vault-notes.json`;
  never edit `tests/domain/wayfinder-tickets.test.ts` or foreign regions; verify-before-edit on all 5 dirty
  source files; workers EXECUTE (no plans/questions), reviewers read-only.
- Rollback: GATED/TICKETS/A5-verify-only → nothing to revert (no prod diff). A3/A4/A1/A2 → single-commit
  `git revert` each (additive outcome field, loop deletion, seam moves — no migrations, no schema/data
  moves); Wave-2 A2 re-runs stream+harvest suites as its own gate. No irreversible step exists in this plan.
