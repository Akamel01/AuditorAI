# M-A1 Final — shadowing closure verification (2026-09-14)

**Verdict: APPROVED_WITH_NOTES** (blocking row 5 closed; prior notes carry over)

## Closure check (single line + surroundings, .ts only)

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | No shadowing — single binding flows gate→KV→proof | `src/discovery/harvest.ts:215` outer `let persistedEntries = []`; `:231` `persistedEntries = appendedEntries;` (assignment, no `const`); `:235` `appendLedgerKV(persistedEntries…)`; `:258` `createHarvestProofBundle(persistedEntries…)` | PASS — blocker closed |
| 2 | Nothing else changed since last review | Read `:211-271`: gate `:216`, slices `:218-229`, `appendLedgerRun :230`, coverage `:238-245`, gate close `:246`, dedupe `:247-254` all match prior review; only `:231` differs (const dropped) | PASS |
| 3 | Typecheck | Orchestrator reports exit 0; shadowing not a type error so manual read above is the proof | PASS (via read) |

## Notes (carried, non-blocking)

- `ledger.ts:95` early-return over-blocks KV for non-override under VITEST; narrow to FS-only as follow-up.
- Double KV write (`ledger.ts:113` + `harvest.ts:235`) idempotent but wasteful.
- Stale `src/**/*.js` twins out of scope — `.ts` only.
