# M-A5 Review — Health fallback consolidation (orchestrator-implemented; re-review)

Verdict: **APPROVED_WITH_NOTES**

Prior `CHANGES_REQUIRED` (dup-close rejection) is resolved on all three code
criteria (1)–(3). Criterion (4) commit hygiene is orchestrator-side at
integration per scope — explicitly not judged here. Lane still uncommitted
(`M` both src files, `??` test + brief), which is the expected pre-integration
state, not a defect. Do not re-litigate dup-close; judged on implementation.

## Evidence rows

| # | Required change | Finding | Paths |
|---|-----------------|---------|-------|
| 1 | Fallback inside bridge + thin harvest path | PASS — `bridgeHarvestHealth(store?, limit?, fallbackEntries?)` prefers KV tail, backfills base fields from caller-supplied fallback when KV tail empty (`:91`), bridge does no FS reads (`:81-82`); `indexedEntriesCount` = KV total else fallback length (`:106`). Route reads file ledger once (`:138-145`) and makes a SINGLE bridge call (`:146`); inline merge block deleted (no `aggregateHarvestHealth` import/call remains in route; only `bridgeHarvestHealth` imported at `:10`). | `src/discovery/health-aggregate.ts:83,91,106`; `src/app/api/dev/health/route.ts:10,138-146` |
| 2 | 8-field pin | PASS (exceeds: 3 pins, not 2) — sorted 8-key equality in happy (`:36-38`), KV-down (`:63-65`), and NEW fallback test (`:94-96`); values pinned: `lastRunStatus done` (`:40`), count 1 (`:42`), KV-down null/0 (`:66-70`), fallback backfill `lastRunAt` + count 1 (`:92-93`). | `tests/domain/harvest-health.test.ts:36-42,63-70,89-96` |
| 3 | Stale comments | PASS — "8-field" (`health-aggregate.ts:79-80`), "four extra" (`:18-21`), "(bridge → 8 fields)" (`route.ts:134-135`), test header "8-field bridge shape" (`:1`) + "8-field shape pinned: 4 base + 4 bridge" (`:35`). All four sites from the required list fixed. | `src/discovery/health-aggregate.ts:18-21,79-80`; `src/app/api/dev/health/route.ts:134`; `tests/domain/harvest-health.test.ts:1,15,35` |
| 4 | Commit hygiene | OUT OF SCOPE — orchestrator-side at integration (per task note). Current `M` + `??` state matches pre-integration expectation. | `git status --porcelain` |

## Correctness / regression notes

- Backward compat: optional 3rd param — existing 2-arg callers intact (test `:34`, `:61`); sole prod caller passes 3 args (`route.ts:146`). No other callers in `.ts` (grep).
- Precedence correct: KV non-empty wins (`:91`, `:106`); KV-down + fallback backfills; KV-down alone stays null/0 — matches orchestrator runtime proof (fallback → lastRunAt+count 1+8 keys; no-fallback → null/0).
- Purity preserved: FS read stays in route (`:140`), bridge keeps no-side-effects header (`:1-3`).
- Stale `.js` twins (`health-aggregate.js:52`, `route.js:134`, `harvest-health.test.js`) untouched per scope — no `.js` contact, correct.

## Notes (non-blocking)

- Test `describe` tag `(M-R8)` (`test:8`) is provenance from the originating loop, not a field-count comment — left as-is, fine.
- `FailStore` is duplicated across the two KV-down tests (`:46-59`, `:74-87`); extraction would shrink it but the minimal-diff choice is acceptable.
- Pre-existing `route.ts:12-13` double blank line untouched (flagged in M-R8 review) — out of scope, fine.
- Verification accepted from orchestrator (typecheck exit 0; explicit-`.ts` runtime proof); this review is static + caller analysis only (no vitest, `.ts`-only per scope).

## Scope respected

Read-only except this artifact; no source/test/config edits; no git mutations; no vitest; no `.js` contact.
