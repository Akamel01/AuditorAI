---
id: H5
title: Verification loop never stop till verified (coverage quality provenance gates)
type: task
hitl: false
status: open
assignee:
blocked_by: [H2]
blocks: []
created: 2026-09-02
resolved:
---

## Question

How do we guarantee the AI harvesting stream never stops until results are verified via deterministic gates, and how is that proven in tests and live?

## Agent Brief

**Category:** enhancement
**Summary:** Implement verification gates in `HarvestStream` that loop until `computeCoverage` target, `checkDuplicate` unique, `quality_score==1`, and `provenance` valid, with tests via fixtures, samples, and live `gpt-5-nano` limit:5.

**Key interfaces:**
- `src/discovery/coverage.ts` `computeCoverage`, `src/discovery/dedupe.ts` `checkDuplicate`, `src/discovery/pipeline.ts:271` `d08Quality`, `src/discovery/provenance.ts`
- `HarvestStream.verify()` → `{passed, reasons}`

**Acceptance:**
- [ ] `VERIFYING` checks: `have_total >= target_total * 0.2` (or at least 1 package for demo), `quality.every(q=>q.quality_score===1)`, `dedupe_status===unique`, `provenance.length === package.length`, `licence !== unknown` for `full-package`
- [ ] If any gate fails, `VERIFYING → RUNNING` with next iteration (max 10), logs `verification failed: <reason> — retry <n>`
- [ ] If all pass, `VERIFYING → DONE`; if max iterations or `stop()`, `→ FAILED` with `reasons`
- [ ] Never stops early: `RUNNING` with 0 packages → `VERIFYING` → `RUNNING` (not `DONE`)
- [ ] Tests: `tests/domain/harvest-stream-verify.test.ts` with `MemoryStore` fixtures (0 packages → retry, 1 unique → done), live smoke `AE` limit:5 via real `gpt-5-nano` (owner key required, skipped in CI)

**Out of scope:** Per-jurisdiction prompt tuning, cost budget.
