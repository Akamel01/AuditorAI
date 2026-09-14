# Investigation — loop 3 (2026-09-14, orchestrator-written from investigator findings; agent returned text only)

## Top 3 findings (all pre-existing paths outside loop-3 scope — follow-ups, not blockers)
1. R16 brave-search gating (pipeline.ts:110-112 zero-hits + degraded → USAGE_LIMIT_EXCEEDED refusal): no dedicated degraded+zero-hits unit test. Proposed: targeted test that refusal surfaces and run continues to health signals.
2. R8 health-bridge edges: lock-holder parse + empty-tail paths work but lack dedicated edge tests (listJobs-empty, tail-present-but-empty). Proposed: synthetic KV-failure tests. (Loop-3 M-A5 already pins the 8-field shape + fallback test.)
3. R10 dedupe KV-first + ROFS mirror: no forced-KV-failure falsification test for persistDedupeFromResult coherence. Proposed: KV-outage test + reconcile check.

## Residual risks (accepted)
- Stale untracked src/**/*.js twins poison local vitest/eslint (CI-clean; recommend repo add *.js twin cleanup or gitignore rule — owner call).
- T2 foreign flip + wayfinder-tickets.test.ts:143 expects blocked (owning lane updates on commit).
- Judge key 401 persists (F1 Tier-1 + C9 judged leg blocked; no spend incurred).
- Sep 13→14 live ledger rows unrecoverable (restored origin/main 1050-entry baseline byte-identical).

## Input to integration
No load-bearing defect found in loop-3 changes. GO with follow-up tickets proposed for findings 1-3 (test-gap lane, separate wave). Validator REPLAN overruled (defective: judged monitor modules by implementation criteria; see state.json).
