# Loop-6 investigation contract (investigator role)

Role: autoforge-investigator — final adversarial, read-only, system-level investigation. Verdict:
`NO_ISSUE_FOUND` / `ISSUES_FOUND` (with severity per issue) / `INCONCLUSIVE`.

## Mandate

Assume the loop-6 work on branch `oc/40` is wrong somewhere and find it. Do not repeat the
reviewer's checks — go after what a reviewer would miss.

## Where to look

- `.autoforge/execution/loop6-brief.md` — the hazards H1..H7 and the operator's four asks.
- The branch commits since `913b4ba`: `8c026c3` (M6a), `076739d` (M6b), `83ae5c9` + `bfddf85` (M7),
  `cc0fcd6` (M7 fixes). Read-only git (`git show`, `git log`, `git diff`) is allowed.
- The code: `scripts/harvest-track-a.ts`, `scripts/harvest-track-a-report.ts`,
  `src/discovery/robots.ts`, the tests under `tests/discovery/`.
- The registers: `docs/RSA-Documents/canada-intake-manifest.jsonl`,
  `canadian-download-log.tsv`, `track-a-split.json`, `track-a-duplicates.json`, `dedupe-index.json`,
  `LICENSE-REGISTER.md`, `QUARANTINE.md`, `track-a-coverage.md`, `track-a-harvest-report.md`,
  `track-a-ondisk-inventory.jsonl`, `track-a-ondisk-summary.json`, `track-a-reconciliation.md`,
  `track-a-sources.json`, `corpus-catalog.json`, `corpus-inventory.json`.

## Attack surfaces (pick the ones that matter; a finding needs evidence)

1. **Silent loss.** Did any run lose or overwrite committed rows — the 3 manifest rows, the 3 log
   rows, the 336 dedupe rows, the split rows, the licence rows? Compare each file against
   `git show 913b4ba:<path>` and against what `git show 8c026c3` / `076739d` / `83ae5c9` claim.
2. **Double counting.** Can one sha256 be counted twice (inventory + manifest), or one document
   appear in two splits, or a document counted in a cell it does not belong to?
3. **Self-deception in the numbers.** Recompute the report's headline numbers from the committed
   inputs and check every claim in the report and in the briefs. Is any number "true" only because
   of a self-referential rule?
4. **The label drift.** The inventory labels are rule-derived and 134 of 304 rows are
   `needs_review`. Does the report overstate what it knows? Does it present a rule-derived label as
   an audited fact?
5. **The classifier.** `isRsaDocument` / `detectTier` / `detectStage` are regexes. Can they accept a
   document that is not an RSA (false positive), and what happens to the corpus if they do? Is the
   T1/T3 boundary consistent with the corpus anchors?
6. **The dedupe gate.** Can a document whose sha256 is already in the corpus enter the manifest?
   Can a document be fetched twice with two different project IDs?
7. **The robot gate.** `src/discovery/robots.ts` — can a URL that robots disallows be fetched?
   Is the crawl delay applied before EVERY request on a delayed host, or only the first?
8. **The git surface.** Is any binary, extracted text or secret tracked? Is `.autoforge/` curated
   policy followed? Did the branch touch a file outside its lane (`state/production-harvest-proof.json`)?
9. **The gap the operator actually cares about.** The coverage is 1/13, 0/41, 1/41. Is there a
   documented, legal, robots-permitted source that would move a cell, and was it missed? Or is the
   "unfillable" list wrong anywhere?
10. **Honesty of the PR body.** If the PR body is written from the artefacts as they stand, would
    it mislead a human reviewer about what was fetched, what was already on the operator's Mac,
    and what remains open for Track B/C?

## Constraints

Read-only: no edits, no commits, no push, no network. Local test runs allowed (say so). Cite
`file:line` (or the exact command output) for every finding. If you assert a number, show how you
computed it.

## Output

`.autoforge/validation/loop6-investigation.md` — verdict line, then findings ordered by severity
(critical / major / minor) with evidence and the concrete fix, then what you checked and found
clean, then what you could not check in this container. Write nothing else.
