# Loop-6 re-review contract — M7b (investigator fixes F1-F7)

Role: autoforge-reviewer (read-only). Verdict: `APPROVED` / `APPROVED_WITH_NOTES` /
`CHANGES_REQUIRED` / `REJECTED` / `ESCALATE`.

## What to read

- `.autoforge/execution/loop6-m7b-contract.md` — the fixes F1..F7 that were requested.
- `.autoforge/validation/loop6-investigation.md` — the findings M1..M8 they answer.
- `.autoforge/execution/M7b.md` — the worker's brief with the pasted verify output.
- The commits `git show af4489f` and `git show a89efcf` (read-only git; no commit/push).
- The files: `scripts/harvest-track-a-report.ts`,
  `tests/discovery/harvest-track-a-report.test.ts`, `docs/RSA-Documents/track-a-harvest-report.md`,
  `docs/RSA-Documents/track-a-sources.json` (outcome wording), `.autoforge/execution/M6b.md`.

## Checks

1. **F1** — per-candidate licence state is read from `docs/RSA-Documents/LICENSE-REGISTER.md`, a
   non-CLEAR candidate is disclosed as not usable for train/test, and an unlisted directory is
   reported as `unknown`. The counts themselves must not have been silently zeroed.
2. **F2** — label-confidence breakdown present, corpus-root vs outside split present, the test
   fixture `0af7ea58…` named and its byte-identical ingested copy disclosed.
3. **F3** — manifest-only rows are classified from the manifest's own tier, not hard-coded
   `rsa-sample`; the four changed class numbers must be the consequence of that and nothing else.
4. **F4** — the `stage from` / `tier from` columns and the hint-derived counts are present and
   correct.
5. **F5** — every "never re-downloaded" claim in the report, the outcome blocks and `M6b.md` is
   gone; the corrected wording says "never re-ingested" and gives the download-and-discard count
   (3 this round, 10 total). Grep for the false claim.
6. **F6** — the duplicates register is disclosed as partial.
7. **F7** — the report states the difference between `track-a-coverage.md` (fetched-only) and the
   inventory-derived report, and `M6b.md` no longer contradicts the committed artefacts.
8. **Numbers** — recompute the report's numbers from the committed inputs yourself (python in
   /tmp). Every number must reproduce; flag any that does not. The only intended changes are the
   four class counts (F3) and the new disclosures.
9. **Reproducibility** — `npx tsx scripts/harvest-track-a-report.ts` then
   `git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md` is clean; no timestamp.
10. **Containment** — no network/model call, no file outside the allowed set was changed in the
    commits, the inventory/summary/odd-coverage.json are untouched, `state/production-harvest-proof.json`
    is not committed.
11. **Tests** — the 39 tests stay offline and would fail if F1-F7 were reverted; flag vacuous ones.

## Constraints

Read-only: no edits, no commits, no push, no network. Local test runs allowed (say so). Cite
`file:line` and show how you computed every number.

## Output

`.autoforge/reviews/M7b.md` — verdict line, findings ranked blocking / non-blocking with evidence
and fix, then residual risks. Write nothing else.
