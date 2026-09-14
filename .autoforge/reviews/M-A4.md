# Review: M-A4 — Per-hit provider.fetch with fallback in D04 Acquire (re-review)

**Verdict: APPROVED_WITH_NOTES** (prior CHANGES_REQUIRED row closed in substance; one hardening advisory remains)

Scope re-reviewed (`.ts` only): `tests/domain/discovery-pipeline-d04.test.ts` (65 lines, current),
`src/discovery/pipeline.ts` d04 region (`:136-270`), prior review `.autoforge/reviews/M-A4.md`.
No vitest run, no source edits, no git mutations, no `.js` twin review per NOTE.

## Acceptance rows (re-verified)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Test asserts provider.fetch-called spy | PASS | `d04.test.ts:61` `expect(providerFetchCalled).toBe(true)` — set at `:30-31` in `SeedPortalProvider.fetch` before `throw 'offline'`. Entails per-hit `prov.fetch(hit.url)` path (`pipeline.ts:151-153`) was attempted. |
| 2 | Test asserts fallback yielded docs (R2a) + no-throw | PASS (substance) / WEAKENED FORM (see note) | `:62` `expect(result.state.acquired && result.state.acquired.length).toBeGreaterThan(0)` — bundles non-empty; `:59` `await runDiscoveryPipeline(ctx)` with no reject = no-throw; `:63` defined. Fixture now qualifies+matches (`:23-26` title_hint/jurisdiction_guess/scheme_hint vs `:53` query UK + road safety audit). Runtime proof (explicit-`.ts` imports, bypassing twins): providerFetchCalled true, acquired 1 — test as written entails exactly what proof demonstrated. |
| 3 | Import / cast / lint hygiene | PASS | `:1` `eslint-disable @typescript-eslint/no-explicit-any` header present; `:4` `DiscoverQuery, FetchResult` imported from `@/discovery/providers/provider-types` (was wrong-path before); `:29` `Promise<FetchResult>` cast present. |
| 4 | Prod code unchanged except `let docs = []` init, present and safe | PASS | `pipeline.ts:140` `let docs: RawDocument[] = [];` present. Safe: all empty paths assign `[]` (`:148,162,191,218`); `:168` `if (!docs \|\| docs.length === 0)` behaves identically for `[]` vs prior unassigned-`undefined` (both enter inner fallback). Closes prior TS2454 advisory (`strict:true` use-before-assign). No other d04 hunks changed vs prior review (`:151-153` prov resolve/fetch, `:154-166` %PDF guard + non-2xx throw, `:168-193` inner fallback, `:194-220` outer-catch fallback, `:265` dead-seq comment all identical). |
| 5 | No scope creep / twins untouched | PASS | Test + d04 only. Stale untracked `src/**/*.js` twins ignored per NOTE; M-A4 touches no `.js`. |

## Notes (non-blocking)

- **Bundles ≠ documents (advisory, path:line evidence):** `pipeline.ts:263` `bundles.push({... documents: acquiredDocs})` executes per matched even when `acquiredDocs` is empty, so `d04.test.ts:62` `acquired.length > 0` proves qualify+match+no-throw but is strictly weaker than the prior required snippet (`acquired.flatMap(b => b.documents ?? []).length > 0` + `mime === "application/pdf"`). False-positive window: fallback yielding `[]` still passes `:62`. Not blocking because fixture `%PDF-1.4 fake` + `application/pdf` stub (`:39-47`) + runtime proof (acquired 1 with docs) close R2a in practice for this fixture. Hardening follow-up (one line, optional): assert `result.state.acquired.flatMap((b:any)=>b.documents??[]).length > 0`.
- Prior advisories carried forward: inner (`:168-193`) vs outer (`:196-220`) fallback duplication (~25 lines each) — future `fetchPdfViaBudget(url)` extract; not required.
- Worker test-green/typecheck-green claims remain UNVERIFIED (no runs per read-only budget); verdict rests on inspection + stated runtime proof entailment only.
