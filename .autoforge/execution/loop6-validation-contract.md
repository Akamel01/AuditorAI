# Loop-6 validation contract (validator role)

Role: autoforge-validator (read-only). Verdict: `GO` / `REPLAN`, plus a criterion→evidence table.

## Objective

Decide whether the branch `oc/40` satisfies the ticket's acceptance criteria and the operator's
2026-10-21 addition, on evidence, with no claim taken on trust.

## Inputs

- The ticket: `gh issue view 40 --repo Akamel01/AuditorAI --comments` (four ACs + the operator
  addition).
- `.autoforge/execution/loop6-brief.md` — the facts, the gaps, the hazards.
- The artefacts on the branch: `docs/RSA-Documents/track-a-coverage.md`,
  `docs/RSA-Documents/track-a-harvest-report.md`, `docs/RSA-Documents/canada-intake-manifest.jsonl`,
  `docs/RSA-Documents/canadian-download-log.tsv`, `docs/RSA-Documents/track-a-split.json`,
  `docs/RSA-Documents/track-a-duplicates.json`, `docs/RSA-Documents/dedupe-index.json`,
  `docs/RSA-Documents/LICENSE-REGISTER.md`, `docs/RSA-Documents/QUARANTINE.md`,
  `docs/RSA-Documents/track-a-ondisk-inventory.jsonl`, `docs/RSA-Documents/track-a-ondisk-summary.json`,
  `docs/RSA-Documents/track-a-reconciliation.md`, `docs/RSA-Documents/track-a-sources.json`.
- The briefs: `.autoforge/execution/M6a.md`, `.autoforge/execution/M6b.md`, `.autoforge/execution/M7.md`,
  `.autoforge/execution/M7-fixes.md`; the reviews `.autoforge/reviews/M6.md`, `.autoforge/reviews/M7.md`,
  `.autoforge/reviews/plan-loop6-critique.md`.
- The code: `scripts/harvest-track-a.ts`, `scripts/harvest-track-a-report.ts`,
  `src/discovery/robots.ts`, `tests/discovery/*.test.ts`.

## Checks (one row per criterion, with the command or file:line that proves it)

Ticket ACs:
1. **AC1 coverage table** — per Canadian ODD cell, documents vs the `state/odd-coverage.json`
   target, priority cells called out, per-document `cell_key` ledger. Verify the targets are read
   from `state/odd-coverage.json` (13 / 41 / 41) and the fetched counts from the manifest, never
   the server-side `have_total`.
2. **AC2 registers** — every fetched document is in the download log, the licence register and the
   dedupe index, with a project ID and a split. Verify row counts, the 14 TSV columns, the
   sha256 == bytes spot-check, and that `dedupe-index.json` only grew (the 333 pre-existing rows
   unchanged).
3. **AC3 split** — no document is in both train and test geography; QC/AB are test-only.
4. **AC4 unfillable cells** — the cells Track A cannot fill are listed with a reason and a named
   source family.

Operator addition:
5. **inventory** — every PDF/DOC/XLSX of the operator checkout is inventoried with path, sha256,
   title, jurisdiction, stage, tier, language and real-RSA-sample vs methodology.
6. **reconciliation** — the inventory is reconciled against `corpus-inventory.json`,
   `corpus-catalog.json`, `dedupe-index.json` and `canadian-download-log.tsv`, drift listed.
7. **coverage from the inventory FIRST**, then fetch only to fill the gaps; no known hash
   re-ingested (the known-hash gate runs after the bytes arrive, so a known document is
   downloaded and discarded).
8. **harvest precision** — counts per class: true in-scope Canadian RSAs at T3/T4 vs methodology,
   out of scope, duplicates, T0/T1.

Also verify:
- The suite is green at HEAD: `npm run lint`, `npm run typecheck`, `npm test` (the vault-compile
  test rewrites `state/vault-notes.json` — do NOT run it; run the rest and say so),
  `npx tsx scripts/harvest-track-a.ts selftest`,
  `npx vitest run tests/discovery/robots.test.ts tests/discovery/harvest-track-a.test.ts tests/discovery/harvest-track-a-report.test.ts`.
- `git status --porcelain` shows no binary path and no foreign-lane file staged;
  `git ls-files docs/RSA-Documents` contains no `.pdf` and no `canada/track-a`/`quarantine/track-a` path.
- The report is byte-reproducible: `npx tsx scripts/harvest-track-a-report.ts` then
  `git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md`.
- Nothing in the branch claims a document the operator's checkout holds but the container does not
  — every such document must be labelled "on the operator's Mac, not re-fetched" or "fetched in the
  box-runner container, not in the operator's checkout".
- The four acceptance criteria of the ticket and the operator's four items are each either PROVEN
  or explicitly NOT MET with the reason. Say so plainly: the honest coverage is 1/13, 0/41, 1/41 —
  a pass on "the table and the evidence exist", not a pass on "the cells are filled".

## Constraints

Read-only: no edits, no commits, no network (local test runs are fine). Cite `file:line` and paste
the exact command output that proves each criterion.

## Output

`.autoforge/validation/loop6-report.md` — the criterion→evidence table with PROVEN / NOT PROVEN /
PARTIAL per row, then `GO` or `REPLAN` with the reasoning, then the residual risks (including what
could not be verified in this container). Write nothing else.
