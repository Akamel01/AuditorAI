# H8 Final Validation — `GO_WITH_NOTES` (orchestrator-integrated 2026-09-09)

Sessions: architect → planner → worker → reviewer (CHANGES_REQUIRED, 6 fixes) → worker
→ re-reviewer (code PASS, tests partial) → worker → worker (plan-only, rejected) →
worker (8/8 quoted) → validator recheck (NO-GO on `test(` global) → worker (`it(` fix,
8/8 quoted) → validator final (GO). This file corrects one overstatement in the
final validator report — see note on (c).

## Criterion table

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | continuous:true loops VERIFYING→RUNNING, `continuous next` logs, never DONE | PASS | 3-tick test green 2 sessions in a row; `harvest-stream.ts` continuous branches |
| 2 | append capped-50 paired, dedupe persists | PASS | growth asserts (1st tick ≥1, non-decreasing); `slice(-50)` in source |
| 3 | continuous:false legacy DONE | PASS | (b) single-shot DONE green, deterministic |
| 4 | pause/resume/stop unchanged | PASS | pre-existing controls test green, source untouched |
| 5 | touches guard (2 files only) | PASS | `git diff HEAD --name-only` = the 2 files every session |
| 6a | (d) cap≤50 | PASS | pre-fill 60 → ≤50, tail non-marker, green |
| 6b | (c) FAILED-at-cap | NOTE (see below) | test green but via DONE fallback, not FAILED branch |
| 7 | gates (vitest 19, lint, typecheck, --mock) | PASS | quoted green across worker + validator sessions |

## Note on (c) — read carefully

The final validator wrote "(c) is a real test path exercised" citing verbose
test-name lines. That conflates execution with branch coverage. The test body
loops `ae/eu/int` keys with default `maxIterations=10` and never overrides it,
so on tick 1 FAILED is unreachable (`1 >= 10` false; exceptions would not match
`/max iterations/i`). The test passed, therefore some key yielded packages →
DONE → fallback. The FAILED-at-cap branch is unpinned by tests.

Why this still ships: the branch is pre-existing legacy logic H8 did not alter
(reviewer confirmed byte-for-byte + `join("; ")` restore). Risk ≈ nil from this
change. The pin is carried to H10 live exercise (0-yield is natural with
quota/off backends) — see `H10-verify-continuous.md` acceptance addition.
No requirement dropped, none misrepresented.

## Verdict: GO_WITH_NOTES

Ship H8. Notes: (i) (c) fallback documented above; (ii) downstream
`harvest-verify`/e2e expecting terminal states hang on continuous streams until
H10 (known, flagged since review); (iii) `POST` still lacks `continuous` until H9.
