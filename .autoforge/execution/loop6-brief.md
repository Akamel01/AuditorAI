# Loop-6 brief — Ticket #40 (Harvest Track A), operator addition close-out

Author: orchestrator. Read this file fully before planning. Cite `file:line` for every fact you
assert. Do not invent anything that is not in this brief or in the repo.

## Ticket

`Akamel01/AuditorAI#40` — "Harvest Track A: fetch the public Canadian RSA documents named in the
harvesting plan". Acceptance criteria (ticket body):

- AC1 coverage table in the PR body: documents fetched per ODD cell vs the section 3 target, priority cells called out.
- AC2 every fetched document in the download log, licence register and dedupe index, with a project ID and a split.
- AC3 no document in both train and test geography.
- AC4 the cells Track A cannot fill are listed, as input for Track B and C.

## Operator addition (issue comment, 2026-10-21)

~300 already-downloaded documents sit on the operator's checkout `/Users/akamel/Documents/AuditorAI`
(untracked by git). The operator asked for four things:

1. inventory every PDF/DOC/XLSX there: path, sha256, title, jurisdiction, stage, tier, language,
   real-RSA-sample vs methodology;
2. reconcile that inventory against `corpus-inventory.json`, `corpus-catalog.json`,
   `dedupe-index.json` and `canadian-download-log.tsv`, and list the drift;
3. build the section 3 ODD coverage table **from that inventory first**, then fetch only to fill
   the gaps; never re-download a hash already present;
4. report **harvest precision**: share of true in-scope Canadian RSAs at T3/T4 vs methodology, out
   of scope, duplicates and T0/T1 — counts per class.

Keep documents untracked; commit only registers/logs/catalog/inventory changes; never move or
delete anything in the operator checkout.

## Environment facts (this run)

- Linux container (box runner). The operator's ~300 documents are NOT here — only the committed
  inventory/registers are. Any document the container cannot see is reported as
  "on the operator's Mac, not re-fetched".
- Worktree: branch `oc/40`, HEAD `913b4ba` ("WIP: session state saved when the run moved to the box
  runner (#40)"), already pushed to `origin/oc/40`. Tree green as of this run:
  `npm run lint` = 0, `npm run typecheck` = 0, `npm test` = 69 files / 683 passed / 2 skipped.
- `npm ci` has been run in this worktree (`node_modules/` present).
- Network egress works (`https://open.alberta.ca/robots.txt` → 200).
- No LLM/model calls are allowed or needed: labelling is deterministic rules only. The operator's
  Ollama pool is unreachable from here (see `.autoforge/state.json` → incidents).
- Foreign lane: `state/production-harvest-proof.json` is modified by another process. Do not stage,
  commit or revert it.

## What is already committed (do NOT redo)

- `src/discovery/robots.ts` + `tests/discovery/robots.test.ts` — robots.txt gate (parseRobots,
  isAllowed, crawlDelayMs, robotsFor).
- `scripts/harvest-track-a.ts` (959 lines) — CLI with `fetch` / `intake` / `report` / `selftest`,
  exports `projectId`, `splitFor`, `verifyPdf`, `dedupeClaim`, `coverage`, `knownHashes`,
  `hashSkipReason`. `tests/discovery/harvest-track-a.test.ts` (offline).
- `docs/RSA-Documents/track-a-sources.json` — 8 fetchable sources + 13 unfillable families.
- `docs/RSA-Documents/scripts/build-ondisk-inventory.py` (1168 lines) — the operator-addition
  inventory builder (runs against the operator checkout; **cannot be re-run here**, its output is
  committed).
- `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` — 304 inventoried rows
  (path, abs_path, sha256, bytes, ext, title, jurisdiction, stage, tier, lang, class,
  label_confidence, evidence, dup_of, source_group).
- `docs/RSA-Documents/track-a-ondisk-summary.json` — counts (class / tier / stage / jurisdiction /
  lang / source_group, plus a `deep_subset` block for the Canadian in-scope subset).
- `docs/RSA-Documents/track-a-reconciliation.md` — drift report vs the four registers (M5 output).
- `docs/RSA-Documents/track-a-coverage.md` — Track A fetch coverage vs `state/odd-coverage.json`
  targets (13 / 41 / 41), priority notes, unfillable families, duplicates, split summary.
- `docs/RSA-Documents/canada-intake-manifest.jsonl` (3 records), `canadian-download-log.tsv`
  (header + 3 rows), `track-a-split.json`, `track-a-duplicates.json` (2 duplicates),
  `dedupe-index.json` (333 pre-existing + 3 appended rows), `LICENSE-REGISTER.md` rows.

Operator-addition items 1 and 2 are therefore DONE (inventory + reconciliation). Items 3 and 4 are
NOT done. `.autoforge/state.json` → `known_gaps` says exactly this.

## Known gaps (verbatim from .autoforge/state.json)

1. "coverage table counted only the 3 Track A fetches, ignoring the ~300 on-disk corpus documents"
2. "corpus-catalog.json has stage=null for all 333 records and tier set for only 2 — the labels the
   operator asked for do not exist yet"
3. "no precision report"

Gap 2 is a scope decision, not a task: the labels the operator asked for now exist in
`track-a-ondisk-inventory.jsonl`; `corpus-catalog.json` is generated by `scripts/build-catalog.py`
on the operator's Mac and hand-editing it here would be overwritten by the next generation. Record
this as a decision; do not edit `corpus-catalog.json`.

## Hazards the plan must handle

- **H1 (real bug).** `scripts/harvest-track-a.ts` `runIntake()` writes `track-a-split.json` from the
  *fresh* records only (`by_province` built from `fresh`), so a later intake run whose staging holds
  only duplicates would overwrite the split file with empty/partial content. The split file must be
  derived from the full intake manifest, and the behaviour needs a regression test.
- **H2.** The staging file `docs/RSA-Documents/.track-a/fetched.jsonl` is gitignored, so it does not
  exist in this container. `intake` with empty staging exits early without touching outputs — safe.
- **H3.** Binaries fetched here land in `docs/RSA-Documents/canada/track-a/**` (gitignored) **in this
  container**, not on the operator's Mac. Any such document must be labelled
  "fetched in the box-runner container, not in the operator's checkout".
- **H4.** Never write to, move or delete anything outside this worktree. The operator checkout is
  read-only and absent here.
- **H5.** Corpus binaries and extracted text never enter git. Only registers, logs, manifests,
  inventory and reports ship.
- **H6.** `AGENTS.md` (repo root): explicit `git add <paths>`, never `git add -A`; the pre-commit
  hook runs lint + typecheck + vault determinism + YAML parse. `node scripts/vault-sync.mjs --check`
  must pass before push (no `vault/` or `state/vault-notes.json` change is expected).
- **H7.** Never merge, never close/label the issue, never push another branch, never commit secrets
  or `.env*`. The orchestrator opens the PR at the end.

## Orchestrator decisions for loop 6 (yours to plan, not to re-litigate)

- **M6 — one bounded gap-filling fetch round + the H1 fix + output refresh.** Extend the source
  manifest only if a server-rendered listing that robots permits yields candidate PDFs (the Alberta
  CKAN API is robots-disallowed; its HTML dataset pages are not). Fix H1 and add its regression test.
  Refresh `canada-intake-manifest.jsonl`, `canadian-download-log.tsv`, `track-a-split.json`,
  `track-a-coverage.md`, `track-a-duplicates.json`, `dedupe-index.json` (append only),
  `LICENSE-REGISTER.md`, `QUARANTINE.md`.
- **M7 — inventory-derived coverage + harvest precision report** (operator items 3 and 4), built by a
  deterministic committed script from the committed inventory + manifest + `state/odd-coverage.json`.
  M7 is `blocked_by` M6 so its numbers reflect the final fetch state.

## Deliverables for the plan

`.autoforge/plans/plan-loop6.md` and `.autoforge/execution/work-order-loop6.json` with, per module:
`id`, `title`, `goal`, `creates`, `modifies`, `touches` (globs), `blocked_by`, `context` (the worker's
full contract, with `file:line` citations), `acceptance`, `verify` (exact commands), `out_of_scope`.

The plan must also fix: the PR body skeleton (the ticket's four ACs, each with the file that carries
its evidence), the commit list (one concern per commit, explicit paths), and the verification
sequence (`npm run lint`, `npm run typecheck`, `npm test`,
`npx tsx scripts/harvest-track-a.ts selftest`,
`npx vitest run tests/discovery/robots.test.ts tests/discovery/harvest-track-a.test.ts`,
`git status --porcelain` shows no binary path, `node scripts/vault-sync.mjs --check`).

The plan must state the ODD stage mapping the worker must use: the inventory stage vocabulary
(`planning`, `preliminary`, `detailed`, `existing`, `pre-opening`, `unknown`) against the canonical
cells `canada:FEASIBILITY_CONCEPT` / `canada:PRELIMINARY_DESIGN` / `canada:DETAILED_DESIGN`
(`state/odd-coverage.json`), and that `existing` / `pre-opening` / `unknown` have no canonical cell
and are reported as unmapped with counts, and that T1 never counts as coverage.
