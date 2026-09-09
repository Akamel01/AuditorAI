# H8 Re-review — `CHANGES_REQUIRED`

*Re-reviewed 2026-09-09 by autoforge-reviewer (read-only; no source files edited, no tests run; evidence from `git diff HEAD -- src/discovery/harvest-stream.ts tests/domain/harvest-stream.test.ts`, current file reads, `.autoforge/reviews/H8.md`, `.autoforge/execution/H8.md`). Worker test/lint/typecheck claims are worker-attested, not independently verified. Code-review skill applied: Spec vs Standards reported separately (§Spec / §Standards).*

## Verdict: `CHANGES_REQUIRED`

Source fixes (1)–(5) are functionally complete and correct — 5 of 6 required fixes verified PASS on inspection. The remaining gap is required fix (6): the test pass adds one weak smoke test and leaves the explicitly-required coverage (append growth, single-shot DONE, FAILED-at-cap, cap≤50) unproven, plus one trivial missing invariant comment. One more small, precisely-scoped pass closes it — not a rejection.

## §Spec — per-fix verification (6 required fixes)

| # | Required fix | Verdict | Evidence |
|---|--------------|---------|----------|
| 1 | `loadStream` migration (`??= false` + comment) | **PASS** | `src/discovery/harvest-stream.ts:85-92` — `typeof st.continuous !== "boolean"` → set `false`, with migration comments `:86-87` and `:91` ("legacy streams stay single-shot unless explicitly upgraded"). `typeof`-guard is strictly stronger than `??=` (covers `undefined` and any non-boolean); accepted as meeting intent. Persists via `tickStream` → `saveStream` (`:227`). |
| 2 | Append cap-50 paired packages/quality replacing overwrite | **PASS** | `harvest-stream.ts:180-184` — `newPkgs`/`newQuals` extracted, then `stream.packages = [...(stream.packages ?? []), ...newPkgs].slice(-50)` and identical for `quality`. Overwrite gone. Dedupe persist unchanged (`:187-189`). Note: dedupe-guarding relies on upstream `dedupeIndex`/pipeline filtering, same as plan assumption — acceptable, see residual note (b). |
| 3 | Per-iteration delta verify + comment | **PASS** | `harvest-stream.ts:194-200` — comment `:194` ("delta verify: cumulative evidence kept; transition uses per-iteration verdict") + `verifyStream({ ...stream, packages: newPkgs, quality: newQuals, coverage: stream.coverage })`. Cumulative arrays retained for evidence; transition uses delta verdict. Correct. |
| 4 | `continuous next <label>` both branches + creation log `continuous=` + invariant comment | **PASS w/ note** | `logLabel` derived `:175-176` as `stream.cellKey ?? ctx.query.jurisdictions[0]` (exact required semantics). Pass branch `:202-204` → ``continuous next ${logLabel}``; fail branch `:209-211` → `verification failed: … — continuous next ${logLabel}`. Creation log `:65` appends `continuous=${continuous}`. **Missing:** the required invariant comment (`// continuous:true → DONE unreachable, maxIterations ignored`) is nowhere in the file — behavior is structurally correct (`:201-211` continuous branches never touch DONE/FAILED/cap), but the comment is absent. Trivial one-liner, bundled into required changes. |
| 5 | Legacy `join("; ")` restored | **PASS** | All three joins use `"; "`: continuous-fail `:211`, FAILED-at-cap `:214`, single-shot retry `:218`. Byte-for-byte legacy strings otherwise intact (`verified — DONE` `:207`, `FAILED: …` `:215`, `— retry …` `:218`). |
| 6 | Tests (M-H8-2) | **FAIL (partial)** | `tests/domain/harvest-stream.test.ts:93-111` adds one test: 3 ticks, iteration counts (`:102`), `continuous next` log presence (`:106-108`), final `RUNNING` (`:110`). What it does **not** cover — see Test adequacy below. |

## Test adequacy — explicitly judged

Covered by the new test: 3-tick iteration counting (never-DONE is *implicitly* proven — a mid-run DONE would early-return at `harvest-stream.ts:134` and break the `:102` iteration assertions), `continuous next` log presence on the union of logs, final-state RUNNING.

**STILL-missing coverage:**

- (a) **Append growth — BLOCKING.** `:104` asserts `packages.length >= 0`, which is vacuously true and proves nothing about append semantics. No assertion that package/quality counts grow (or at least never shrink) across the 3 ticks. Fix (2) is therefore unproven by tests.
- (b) **Single-shot DONE via `tickStream(continuous=false)` — BLOCKING.** Zero `tickStream` coverage of the `continuous=false` path. Worse, all pre-existing `tickStream` tests (`test.ts:14,42`) now construct streams with the flipped default (`continuous=true`), so the byte-for-byte legacy guarantee of fix (5) has *no* regression test at all.
- (c) **FAILED-at-cap (`maxIterations`) — BLOCKING.** The `:212-215` branch is untested; nothing proves the cap still fires when `continuous=false`, nor that it is correctly ignored when `continuous=true`.
- (d) **Cap ≤50 newest-retained — BLOCKING.** No test seeds >50 packages and ticks to prove `.slice(-50)` keeps the newest 50. Pure unit-level, no pipeline needed.
- (e) **Dedupe persistence across ticks — NOTE (non-blocking).** Explicitly requested in fix (6) but pipeline-index behavior; H10 live exercise will cover it. Assert `dedupeIndex` survives/advances across the 3-tick test if cheap, otherwise defer to H10.
- (f) **Per-tick (not just final) status assertions — NOTE.** Implicitly covered (see above); explicit per-tick `RUNNING` asserts are nice-to-have only.

Classification rationale: (a)–(d) were explicitly demanded by required fix (6) and guard the core H8 semantics (append vs overwrite, legacy preservation, cap behavior). Their absence leaves the just-landed implementation without regression protection — that is the same M-H8-2 gap the first review blocked on, only smaller. (e)–(f) are observability/convenience and may defer (H10 live exercise covers (e)).

## §Standards

- No new imports/deps; smallest-diff discipline holds (interface field + comment `:29-30`, default param `:48`, creation log `:65`, migration `:85-92`, `logLabel` `:175-176`, append `:180-184`, delta verify `:194-200`, branched logs `:201-218`). No scope creep.
- Smells (judgement calls, non-blocking): (i) `(st as any).continuous = false` cast (`:90`) — pragmatically fine for a migration of a persisted shape, eslint-suppressed inline; (ii) `{...stream, packages: newPkgs, …} as HarvestStream` (`:195-200`) — acceptable delta-view construction, could be a named helper if reused, YAGNI for now; (iii) vacuous `>= 0` test assertion (`test.ts:104`) — the one test-quality smell that matters, fixed by required change (a).
- pause/resume/stop untouched (`:231-267` absent from diff) — constraint holds.

## Cross-module risk (re-checked)

- `src/app/api/dev/harvest-stream/route.ts:24` `createStream(cellKey, live)` now infinite-by-default — intended, H9 owns the param; unchanged since first review.
- Legacy persisted streams normalize to `continuous=false` on load and persist on next save — safe direction, confirmed.
- `tests/domain/ai-harvest.test.ts` pure-`verifyStream` unit unaffected (no `tickStream`, no `createStream` default reliance for terminal states).

## Required changes (precise, minimal — tests + one comment)

1. `harvest-stream.ts` (~`:191`, next to the delta-verify comment): add the invariant comment, e.g. `// invariant: continuous:true → DONE/FAILED unreachable here, maxIterations ignored; single-shot falls through to DONE/FAILED-at-cap`.
2. `tests/domain/harvest-stream.test.ts` — strengthen the existing 3-tick test and add three small tests (all offline-capable, no new deps):
   - (a) In the 3-tick test: record `packages.length`/`quality.length` after each tick; assert monotonic non-decreasing **and** final length ≥ 1 (fixtures yield ≥1 pkg on tick 1); assert `status === "RUNNING"` after *each* tick, not only the last.
   - (b) Single-shot DONE: `createStream(key, false, false)`, `RUNNING`, `saveStream`, one `tickStream` → expect `DONE` and `verified — DONE` log. (Proves legacy path byte-for-byte.)
   - (c) FAILED-at-cap: `createStream(key, false, false)`, set `maxIterations = 1` and force verify failure (e.g. empty the quality array post-tick is not possible — instead use a cellKey/fixture combo yielding 0 packages, or set `stream.packages = []` / stub by ticking a stream whose pipeline yields nothing; simplest deterministic option: construct stream with `continuous=false`, `maxIterations=1`, manually clear `packages` after save is racy — prefer driving `verifyStream` failure by deleting `quality` via a pre-seeded stream with `packages` left empty and `live=false` on a cellKey with no fixture). If fixture always yields ≥1 pkg, achieve failure by setting `maxIterations = 0`? No — `iteration(1) >= 0` is true, but that corrupts intent. Cleaner: unit-test the branch decision by seeding `stream.packages = [{completeness:"excerpt"}]`, `stream.quality = [{quality_score: 0, …}]` (failing verdict) with `iteration = maxIterations`, `continuous=false`, then `tickStream`… but tick overwrites packages. Deterministic alternative: temporarily break quality post-pipeline is impossible without hooks — so instead assert via two ticks on a forced-empty pipeline: document the chosen seeding in the test name. Implementer picks the least-hacky deterministic seed; reviewer accepts any deterministic FAILED-at-cap proof.
   - (d) Cap ≤50: seed `stream.packages`/`quality` with 50 distinct sentinels, `continuous=true`, one `tickStream` → expect `length <= 50` and newest-retained (`slice(-50)` keeps tail: assert last sentinel(s) present, oldest evicted).
3. Re-run: `vitest tests/domain/harvest-stream.test.ts`, `tsc`, `lint` (worker runs; reviewer will re-verify from diff + attestations).

## Method note

Read-only re-review: `git diff HEAD`, full reads of both changed files, H8 review + execution log. No test runs, no edits, no commits. Worker evidence bundle (5 harvest-stream tests green, lint/typecheck green) taken as attested, pending the strengthened suite above.
