# Loop-6 review contract — M6a + M6b

Role: autoforge-reviewer (read-only). Verdict: `APPROVED` / `APPROVED_WITH_NOTES` /
`CHANGES_REQUIRED` / `REJECTED` / `ESCALATE`.

## What to read

- `.autoforge/execution/loop6-brief.md` — the facts, the gaps, the hazards (H1..H7) and the
  orchestrator decisions. Binding.
- `.autoforge/execution/loop6-m6-split.md` — the M6a and M6b worker contracts. Binding.
- `.autoforge/execution/M6a.md`, `.autoforge/execution/M6b.md` — the workers' own briefs with the
  pasted verify output.
- The diff of the two commits: `git show 8c026c3` (M6a) and `git show 076739d` (M6b). Read-only git
  commands are fine (`git show`, `git log`, `git diff`); do NOT commit, push, reset or checkout.
- The files themselves: `scripts/harvest-track-a.ts`, `tests/discovery/harvest-track-a.test.ts`,
  `docs/RSA-Documents/track-a-sources.json`, `docs/RSA-Documents/track-a-coverage.md`.

## Checks you must make

1. **H1 really fixed.** The split map must be derived from the FULL intake manifest, not the fresh
   batch (`scripts/harvest-track-a.ts`, `runIntake`). Verify by reading the code, not by trusting
   the brief. Confirm the committed `docs/RSA-Documents/track-a-split.json` rows (AB -> test, BC ->
   restricted) cannot be lost by an intake run whose staging holds only duplicates.
2. **RC-3 regression test is real.** It must set up a staging file PRESENT holding records whose
   sha256 values are already in `dedupe-index.json` and then assert the log, the manifest and the
   split file are byte-identical. An early-return path that never reaches the write guards does not
   satisfy the AC. Say so if the test is vacuous.
3. **The new source entry is safe.** `ab-publications-listing` in `track-a-sources.json`: no
   existing entry's `known_document_urls` was mutated; the entry is complete; `sourceEntryProblem`
   rejects an incomplete entry with a reason instead of crashing `runFetch`; the selftest asserts
   the committed manifest has no invalid entry.
4. **The fetch-round record is honest.** Compare `.autoforge/execution/M6b.md` against what the
   manifest outcome block and the committed outputs say. Flag any number that cannot be traced.
5. **No binary, no secret, no foreign lane.** No PDF/binary/text path is tracked by git
   (`git ls-files docs/RSA-Documents | grep -iE '\.pdf|canada/track-a|quarantine/track-a'` must be
   empty); `state/production-harvest-proof.json` was not committed; no `.env*`/secret.
6. **Test quality.** The new tests must be offline (no network), must fail without the fix, and
   must not assert tautologies.
7. **Regression risk.** Does the M6a/M6b change alter behaviour for the existing committed outputs
   (the 3 manifest rows, the 3 log rows, the 336 dedupe rows, the licence register, the split
   file)? Diff the committed files against the pre-M6 commit and explain every difference.

## Constraints

Read-only: no edits, no commits, no network, no test runs unless a specific check needs one (say
so). Cite `file:line` for every finding.

## Output

`.autoforge/reviews/M6.md` — verdict line, then findings ranked blocking / non-blocking with
`file:line` evidence and the concrete fix, then the residual risks. Write nothing else.
