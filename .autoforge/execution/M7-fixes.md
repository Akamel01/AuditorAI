# M7 fixes — review notes applied (ticket #40, branch `oc/40`)

Inputs: `.autoforge/reviews/M6.md` (N4) and `.autoforge/reviews/M7.md` (notes 1, 2, 4).
Reviewed commits `8c026c3`, `076739d`, `83ae5c9`, `bfddf85` were left in place; nothing was redone.
No network, no model/LLM call, no fetch. One local commit on `oc/40`; no push, no PR.

## Fix 1 — M6 N4: `sourceEntryProblem` must not throw on a `null`/`undefined` entry

`scripts/harvest-track-a.ts:137-148` dereferenced `source.id` immediately, so a hand-edited
`null` element in `manifest.sources` threw `TypeError: Cannot read properties of null` — the exact
crash class the guard was added to prevent.

- `sourceEntryProblem(source: Partial<Source> | null | undefined)` now returns `"missing entry"`
  for a non-object entry, before any field is read.
- The two places that consume the guard's result were made null-safe with it:
  `runFetch` (`scripts/harvest-track-a.ts:511-515`, the skip log) and the selftest's
  "every source entry is complete" / "every source id is unique" checks
  (`scripts/harvest-track-a.ts:928-937`).
- New offline test (`tests/discovery/harvest-track-a.test.ts:441-444`):
  `sourceEntryProblem(null)` and `sourceEntryProblem(undefined)` both return `"missing entry"`.

Red proof (guard line removed, everything else in place):

```
$ npx vitest run tests/discovery/harvest-track-a.test.ts
× sourceEntryProblem (...) > reports a missing entry instead of throwing on a null or undefined source
TypeError: Cannot read properties of null (reading 'id')
 Test Files  1 failed (1)
      Tests  1 failed | 49 passed (50)
```

With the guard restored: 50/50 green.

**Not done (outside the requested fix):** N4 also asks for `strategy` / `licence_default.verdict`
enum validation. That is not implemented here — it changes which entries are accepted, not just
that a crash is avoided, and no enum test was requested.

## Fix 2 — M7 note 2: the coverage "Have" column vs the server-side `have_total`

`state/odd-coverage.json` reports `have_total: 0` for `canada:DETAILED_DESIGN` while the report's
own table says `Have 1`. The two counters measure different things and the report never said so.

- The section-1 column header is now `Have (documents)` (was `Have`).
- A new paragraph after the table states the difference: `Have (documents)` counts the
  coverage-candidate **documents** of this corpus (a duplicate copy never carries a count); it is
  **not** the server-side `have_total` / `have_full_package` of `state/odd-coverage.json`, which
  count ODD **packages** — two different measures that can disagree for the same cell. This is the
  distinction the repo already makes in `scripts/harvest-track-a.ts:828`.
- Section 5's table already reads `Have (coverage candidates)`; it was left as it is.

## Fix 3 — M7 notes 1 and 4: rows are not documents, and the stage counts are label-reconciled

- Note 1 — the row-set line now says "every **row** on record" instead of "every document on
  record" and adds that the inventory holds repeated copies of the same sha256, so 36 of the rows
  are duplicate copies of another row. A row is an inventory row (or a manifest-only row); a
  *document* is a sha256, as the rules section still defines it.
- Note 4 — section 2 now carries a reconciliation note: the counts use the **reconciled** label
  (the manifest wins for tier and stage, as in the rules above), so a row the manifest re-labels
  leaves its inventory stage column. The note lists the two re-labelled rows by sha
  (`555848f6…` inventory `unknown` → manifest `UNSTAGED`, `0af7ea58…` inventory `planning` →
  manifest `FEASIBILITY_CONCEPT`), which is what makes the inventory's own `unknown` count higher
  than the table's (the inventory's `unknown` is one row above the table's `unknown`, and the
  inventory's `planning` rows are counted under their reconciled label instead). Section 7's
  inventory-only stage counts stay untouched.

**Every number in the report is unchanged.** Only labels and wording changed: the committed file
diff is 6 insertions / 2 deletions (the `|A|` prose line, the section-1 header, and two added
paragraphs), and the class / stage / tier / coverage tables are byte-identical. Proof by
digit-frequency diff of the
old and new report: no number was removed, and the only added digit runs are the sha256 fragments
of the two re-labelled rows (repeated from the reconciliation block) and the `36` that already
appears in the class table.

## Verify (all green, offline)

```
$ npx vitest run tests/discovery/harvest-track-a.test.ts tests/discovery/harvest-track-a-report.test.ts
 ✓ tests/discovery/harvest-track-a-report.test.ts (23 tests)
 ✓ tests/discovery/harvest-track-a.test.ts (50 tests)
 Test Files  2 passed (2)
      Tests  73 passed (73)

$ npx tsx scripts/harvest-track-a-report.ts
wrote docs/RSA-Documents/track-a-harvest-report.md (11267 bytes)
$ git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md
(no output — byte-identical)

$ npm run typecheck
> tsc --noEmit
(clean)

$ npm run lint
> eslint .
(clean)

$ npx tsx scripts/harvest-track-a.ts selftest
...
ok   every source entry is complete (none invalid)
selftest passed
```

Report size before/after: 10176 → 11267 characters (10240 → 11339 bytes), no timestamp in either.

## Files

- `scripts/harvest-track-a.ts` (guard + its two null-safe call sites)
- `tests/discovery/harvest-track-a.test.ts` (one new offline test)
- `scripts/harvest-track-a-report.ts` (labels + wording)
- `tests/discovery/harvest-track-a-report.test.ts` (three new labelling assertions)
- `docs/RSA-Documents/track-a-harvest-report.md` (regenerated)

`state/production-harvest-proof.json` and `.autoforge/state.json` were **not** staged (foreign
lanes). No `vault/` file, no `state/vault-notes.json`, no binary.
