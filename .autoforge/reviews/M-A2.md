# M-A2 review — verdict: APPROVED_WITH_NOTES (final)

Scope (read-only, .ts only): `src/discovery/harvest-stream.ts` dry-run branch, `.autoforge/execution/M-A2.md`. Evidence: `git show HEAD:...` vs tree, `git diff HEAD -- src/discovery/harvest-stream.ts`, `rg acquireDocs|fixtureDocsFor|return []`. No `.js` contact, no vitest, no mutations. Typecheck: orchestrator-claimed exit 0 (prior review re-ran exit 0; not re-run here per tight budget).

## R1 — CLOSED
- HEAD `harvest-stream.ts:170-174` = tree `harvest-stream.ts:168-172`: lazy `await import("@/discovery/harvest").fixtureDocsFor` + minimal stub + `.slice(0,1)`, line-identical. Diff hunk is context-only (unchanged).
- `rg "return []" src/discovery/harvest-stream.ts` → no hit. `return []` neuter gone.
- Dry-run ticks can yield packages again; `verifyStream` DONE path unblocked.

## Brief — ACCURATE
- R2 ownership: `M-A2.md:19-20` attributes dedupe-threading hunks to M-A3 lane, out of M-A2 scope. Satisfies prior R2 demand.
- N1 wording: `M-A2.md:13-14` states derivation moved out of `harvest()` body, `executeJob` signature unchanged. Prior "from executeJob" imprecision fixed.

## Note (non-blocking)
- Brief names the hunk `stream.dedupeIndex = outcome.dedupeIndex`; tree identifier is `if (dedupeIndex) { stream.dedupeIndex = dedupeIndex; }` from `const { state, dedupeIndex }` (`harvest-stream.ts:182,217-219`). Ownership correct, identifier shorthand — align wording on next touch, no re-review needed.

Verdict rationale: R1 byte-equivalent restore verified + brief ownership/wording fixes present → all blocking rows closed.
