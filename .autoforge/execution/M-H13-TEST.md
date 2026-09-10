Module: M-H13-TEST
Goal: temp-dir leniency unit test for indexWayfinderTickets (H13 acceptance)

What happened (summary):
- Ran targeted vitest for testNamePattern "M-H13-TEST".
- Output showed a single test executed with one good ticket and one bad ticket in a temp dir tree.
- The bad ticket triggered a status validation error (as designed), resulting in one skipped ticket, and one served ticket.

Evidence (quoted):
- stderr | tests/domain/wayfinder-tickets.test.ts > M-H13-TEST: temp-dir leniency > indexes one good ticket and one bad ticket using a temp dir without mutating cwd
- workflow/wayfinder/maps/mvp/tickets/R4.md: workflow/wayfinder/maps/mvp/tickets/R4.md: status must be one of open|claimed|blocked|closed|resolved|out-of-scope (got "in_progress")
- ✓ tests/domain/wayfinder-tickets.test.ts (9 tests | 8 skipped) 9ms

Final status: PASSED (1 test, with 1 skipped as designed)

Artifacts touched:
- tests/domain/wayfinder-tickets.test.ts (updated)
- .autoforge/execution/M-H13-TEST.md (execution evidence)
