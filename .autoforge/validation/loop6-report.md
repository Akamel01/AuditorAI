# Loop-6 validation report — ticket #40 (Harvest Track A), branch `oc/40`

- **Role:** autoforge-validator (read-only). No product code was edited, nothing committed, nothing pushed, no network used.
- **Worktree:** `/home/oc/.opencode-runs/Akamel01-AuditorAI/40/worktree`, branch `oc/40`, **HEAD `cc0fcd6`** ("fix(harvest): apply M6 N4 and M7 notes 1, 2, 4 review fixes (#40)").
- **Contract:** `.autoforge/execution/loop6-validation-contract.md` (read first, followed exactly).
- **Inputs used:** `.autoforge/execution/loop6-brief.md`, `work-order-loop6.json`, `plan-loop6.md`, `.autoforge/execution/M6a.md` / `M6b.md` / `M7.md` / `M7-fixes.md`, `.autoforge/reviews/M6.md` / `M7.md` / `plan-loop6-critique.md`, the committed artefacts, and the code.
- **The ticket itself (`gh issue view 40`) was not fetched** (no network in this run). The four ACs and the operator's 2026-10-21 addition are taken verbatim from `.autoforge/execution/loop6-brief.md:8-31`.

## 0. Headline, stated plainly

The honest coverage is **1/13 (`canada:FEASIBILITY_CONCEPT`), 0/41 (`canada:PRELIMINARY_DESIGN`), 1/41 (`canada:DETAILED_DESIGN`)** — a pass on *"the table and the evidence exist"*, **not** a pass on *"the cells are filled"*. The three unfillable-cell families (13 named source families, each with a reason and a Track B/C input) explain why the cells are empty; that is a fact about the reachable public web, not a defect in the branch.

---

## 1. Criterion → evidence table

| # | Criterion | Verdict | Evidence (file:line / command) |
|---|---|---|---|
| **AC1** | Coverage table per Canadian ODD cell vs the `state/odd-coverage.json` target; priority cells called out; per-document `cell_key` ledger; targets read from `state/odd-coverage.json` (13/41/41); fetched counts from the manifest, **never** the server-side `have_total` | **PARTIAL** | Table exists and is correct: `docs/RSA-Documents/track-a-harvest-report.md:26-30` (targets 13/41/41 + priorities 0.9231/3/3), fetch-round view `docs/RSA-Documents/track-a-coverage.md:10-14`. Targets are **read**, not typed: `scripts/harvest-track-a-report.ts:430` (`JSON.parse(readFileSync("state/odd-coverage.json"))`), `:233-239` (`cellState.target`, `cellState.priority`); the legacy generator does the same (`scripts/harvest-track-a.ts:820` + `:828` "never the server-side have_total"). `have_total` is explicitly *not* used as the have-count and the report says why (`track-a-harvest-report.md:34`; `state/odd-coverage.json:212-227` has `have_total: 0` for `canada:DETAILED_DESIGN` while the report shows `Have (documents) 1` — two different measures, stated). Priority cells called out: `track-a-harvest-report.md:28-30` (Priority column) and `track-a-coverage.md:16-26` (the four free-text priority cell families). Ledger: per-`cell_key` per document for the fetched set `docs/RSA-Documents/canada-intake-manifest.jsonl:1-3` (`cell_key` field) and `track-a-harvest-report.md:99-105` (all 3 manifest rows with tier/stage/cell_key/split/licence), plus the coverage-candidate ledger `:36-42`. **Two gaps: (a)** there is **no PR body** — the branch is 5 commits ahead of `origin/oc/40` (`git log --oneline origin/oc/40..HEAD` → `8c026c3 076739d 83ae5c9 bfddf85 cc0fcd6`); writing the PR body is the orchestrator's step (`loop6-brief.md:104-106`), the evidence it needs is committed. **(b)** there is **no per-document `cell_key` ledger row for the 304 inventory documents** — the mapping is derived on the fly (`STAGE_TO_CELL` in `scripts/harvest-track-a-report.ts:17-28`); only the 2 coverage candidates get an explicit per-document line (`:36-42`). |
| **AC2** | Every fetched document in the download log, the licence register and the dedupe index, with a project ID and a split; row counts; 14 TSV columns; `sha256 == bytes` spot-check; `dedupe-index.json` only grew (the 333 pre-existing rows unchanged) | **PROVEN** (the `sha256 == bytes` spot-check is scoped — see note) | 3 fetched docs ↔ 3 manifest rows ↔ 3 log rows ↔ 3 dedupe rows: field-by-field identical (my own recompute over the TSV vs the JSONL: `diffs: none` for all three rows, all 14 columns present: `project_id sha256 tier stage cell_key ca_province lang split doc_type source_url licence_verdict fetched_at bytes local_path`). Log = `docs/RSA-Documents/canadian-download-log.tsv` (header + 3 rows), manifest = `docs/RSA-Documents/canada-intake-manifest.jsonl` (3 rows), dedupe rows carry `project_id` + `split` + `bytes` (`dedupe-index.json` appended rows: `PRJ-d8c82b96d74c1c92/test/35444`, `PRJ-667d360379e0181e/restricted/17093`, `PRJ-667d360379e0181e/restricted/22003`). Licence register: `docs/RSA-Documents/LICENSE-REGISTER.md` (last two rows) covers both fetched source dirs `canada/track-a/ab-open` (CLEAR) and `canada/track-a/bc-moti` (RESTRICTED). **Dedupe index only grew:** 336 rows now vs 333 at `ee2c9d4`; my byte-compare of the first 333 rows against `ee2c9d4` → `first 333 rows byte-equal to cur prefix: true`, 3 appended rows, none of the 333 mutated. **Spot-check scope:** `git-lfs` pointers in this container carry `oid sha256:` + `size`; of the 304 inventory rows, **99** exist here as LFS pointers and **99/99 match the inventory's `sha256` and `bytes`**; 2 of the 3 *fetched* documents are independently confirmed this way (`tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf` → `oid sha256:0af7ea584ae04908…`, `size 35444` = manifest bytes; `docs/references/CA/bct-moti-rsa-policy-tc-t02-04-2004.pdf` → `oid sha256:555848f63c690810…`, `size 22003` = manifest bytes). The third fetched doc (`84a70638…`) and the 202 corpus-root documents are **not in this container** (see §4 R11). |
| **AC3** | No document in both train and test geography; QC/AB are test-only | **PROVEN** | `docs/RSA-Documents/track-a-split.json:8-11` → `test_provinces: ["QC","AB"]`, rule at `:12`. Rule code `scripts/harvest-track-a.ts:357-359` (`splitFor`: CLEAR + QC/AB → `test`, CLEAR + other → `train`, non-CLEAR → `restricted`/`quarantine`), the province map `:369-384`, the invariant check `:966-976` (`:973` rejects a test province in train). Executed: `npx tsx scripts/harvest-track-a.ts selftest` → `ok   no document is in both train and test`. Per-document check in `docs/RSA-Documents/track-a-harvest-report.md:105` → `Split disjointness check (per document: sha256 -> split): PASS — 3 document(s) checked, 0 with two splits.` Committed split: AB → test (1 doc), BC → restricted (2 docs) — no train document exists, and no QC/AB document is anywhere but `test`. |
| **AC4** | The cells Track A cannot fill are listed with a reason and a named source family (input for Track B/C) | **PROVEN** | `docs/RSA-Documents/track-a-harvest-report.md:109-125` — **13** unfillable families, each with family / host / reason / Track input; `:127-133` — the three Canadian cells with target, have-count, zero flag and Track input. Source of truth `docs/RSA-Documents/track-a-sources.json` → `unfillable` array = **13** (verified by count and by family name). The fetch-round view carries the same list: `docs/RSA-Documents/track-a-coverage.md:33-49` (13 rows). |
| **OP1** | Inventory of every PDF/DOC/XLSX of the operator checkout with path, sha256, title, jurisdiction, stage, tier, language, real-RSA-sample vs methodology | **PROVEN** | `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` — **304 rows**; every row carries all 9 requested fields (`path, abs_path, sha256, bytes, ext, title, jurisdiction, stage, tier, lang, class, label_confidence, evidence, dup_of, source_group`); `class` is the real-RSA-vs-methodology label (`rsa-sample 59, methodology 27, unusable 57, duplicate 36, out-of-scope 125`). The builder is extension-inclusive, not PDF-only: `docs/RSA-Documents/scripts/build-ondisk-inventory.py:32` `DOC_EXTS = (".pdf", ".doc", ".docx", ".xls", ".xlsx")`, walk at `:211` — the committed result contains **0** non-PDF rows, i.e. the checkout held no DOC/XLSX. Counts also published in `docs/RSA-Documents/track-a-ondisk-summary.json` and `docs/RSA-Documents/track-a-reconciliation.md:10-76`. Cannot be re-run here (it runs against the operator's Mac — `loop6-brief.md:56-58`). |
| **OP2** | Reconciliation of the inventory against `corpus-inventory.json`, `corpus-catalog.json`, `dedupe-index.json`, `canadian-download-log.tsv`, with the drift listed | **PROVEN** | `docs/RSA-Documents/track-a-reconciliation.md:7` (the four registers named), `:77-91` (drift-count table), `:93-99` (per-source coverage: catalog 333 rows / 202 on-disk docs / 202 present / 0 missing; corpus-inventory 376; dedupe-index 336; download-log 3 rows), `:101-224` (D1 outside-corpus-root groups), `:226-238` (D2/D3/D4 = none), `:240-304` (D5 mirrors table), `:306-317` (D6 download-log rows + the note that the log's `stage` vocabulary differs from the inventory ladder). I re-derived the source-row counts from the registers themselves: `corpus-catalog.json` → **333** records / **202** `.pdf` rows; `corpus-inventory.json` → **376**; `dedupe-index.json` → **336**; `canadian-download-log.tsv` → **3** rows. All match the reconciliation. |
| **OP3** | Coverage built from the inventory **first**, then fetch only to fill the gaps; no known hash re-ingested | **PROVEN** (with a disclosed caveat) | The table is inventory-first by construction: the `On disk` column is derived from the inventory and the `Fetched` column from the manifest, with the precedence rule stated (`track-a-harvest-report.md:14-18`, `:26-42`; script `scripts/harvest-track-a-report.ts:191-248`). The loop-6 fetch round honoured the known-hash rule: `docs/RSA-Documents/track-a-sources.json` → `ab-publications-listing.outcome` = `m6_new_documents: 0`, `m6_skipped_hash_already_present: 3`, `m6_skipped_not_rsa: 9`; the round log (`.autoforge/execution/M6b-fetch-round.md`, verbatim copy of the container-local `.autoforge/tmp/m6b-fetch.log`) shows every hash hit as `skip (hash-already-present)` and **no binary written** (`docs/RSA-Documents/canada/track-a/` does not exist in this container). **Caveat (disclosed, not hidden):** the known-hash gate runs **after** the bytes arrive (`scripts/harvest-track-a.ts:547-567`), so a document whose hash the corpus already holds IS downloaded and then discarded — 10 such downloads in the round log, 3 of them in the M6b round. No known document was ever re-**ingested**. The 3 documents in the intake manifest were fetched in an **earlier** session (`fetched_at 2026-10-21T15:14–15:15Z`, committed at `913b4ba`), i.e. *before* the inventory existed for the fetcher, and 2 of their hashes were already in the operator's checkout at other paths — this is stated in `docs/RSA-Documents/track-a-reconciliation.md:312-314` ("present at logged path: **no** / sha256 found on disk: `tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf`", same for `docs/references/CA/bct-moti-rsa-policy-tc-t02-04-2004.pdf`). |
| **OP4** | Harvest precision: counts per class — true in-scope Canadian RSAs at T3/T4 vs methodology vs out-of-scope vs duplicates vs T0/T1 | **PROVEN** | `docs/RSA-Documents/track-a-harvest-report.md:59-95`: 3a all-rows over **\|A\| = 305** (`duplicate 36, methodology 27, out-of-scope 125, rsa-sample 60, unusable 57`); 3b Canadian subset over **\|B\| = 147** (`duplicate 11, methodology 24, rsa-sample 55, unusable 57`; `out-of-scope` explicitly absent, `:82`); the T0/T1 cut of B (`:86-93`: `T0 89, T1 28, T3 23, T4 7`); the in-scope share `:84` → "2 of 147 Canadian rows are coverage candidates (1.4% of \|B\|)"; T0/T1 excluded from coverage by rule `:14` and `:95`. **I recomputed every one of these independently from the raw committed files** (my own script, not the repo's): `\|A\| = 305`, `\|B\| = 147`, 3a `{methodology:27, rsa-sample:60, unusable:57, duplicate:36, out-of-scope:125}`, 3b `{methodology:24, rsa-sample:55, unusable:57, duplicate:11}`, tier B `{T0:89, T3:23, T1:28, T4:7}`, cells `FEASIBILITY 1 / PRELIMINARY 0 / DETAILED 1`, unmapped A `{existing:78, unknown:175, pre-opening:5, UNSTAGED:2}`, unmapped B `{existing:59, unknown:56, pre-opening:4, UNSTAGED:2}`, inventory-only Canadian subset `146 rows / {methodology 24, rsa-sample 54, unusable 57, duplicate 11} / {detailed 15, existing 59, planning 3, pre-opening 4, preliminary 8, unknown 57} / {T0 91, T1 26, T3 22, T4 7}` — **identical to the report and to `track-a-ondisk-summary.json:64-92`**. |

### "Also verify" items from the contract

| Item | Verdict | Evidence |
|---|---|---|
| `npm run lint` green | **PROVEN** | exit 0 (`eslint .`, no output). |
| `npm run typecheck` green | **PROVEN** | exit 0 (`tsc --noEmit`, no output). |
| `npm test` green | **PROVEN (vault-compile excluded by instruction)** | `npx vitest run --exclude '**/node_modules/**' --exclude '**/tests/domain/vault-compile.test.ts'` → **69 files passed, 711 passed / 2 skipped (713)**. `tests/domain/vault-compile.test.ts` (8 `it()` blocks) was **not run** because it rewrites `state/vault-notes.json` (contract §"Also verify"). `state/vault-notes.json` is unchanged (`git status --porcelain -- state/vault-notes.json` → empty) before and after every command I ran. |
| `npx tsx scripts/harvest-track-a.ts selftest` | **PROVEN** | 16 `ok` lines, `selftest passed`, exit 0 (incl. `ok no document is in both train and test`, `ok no manifest row carries a hash the corpus already held (0 stray)`, `ok no Track A corpus binary is tracked by git`). |
| `npx vitest run tests/discovery/{robots,harvest-track-a,harvest-track-a-report}.test.ts` | **PROVEN** | 3 files / **85 tests passed**, exit 0 (12 + 50 + 23). |
| `git status --porcelain`: no binary path, no foreign-lane file staged | **PROVEN** | ` M .autoforge/state.json` and ` M state/production-harvest-proof.json` — both **unstaged** (foreign lane, `loop6-brief.md:45-46`); `git diff --cached --name-only` → empty. |
| `git ls-files docs/RSA-Documents`: no `.pdf`, no `canada/track-a`, no `quarantine/track-a` | **PROVEN** | both greps → `(none)`. |
| Report is byte-reproducible | **PROVEN** | `sha256sum` before = after = `03627d671e0d0872120710260aa8d90fab2340575ead29343e54fc845e8d9906`; `npx tsx scripts/harvest-track-a-report.ts` → `wrote docs/RSA-Documents/track-a-harvest-report.md (11267 bytes)`; `git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md` → exit 0. |
| No unlabelled claim about documents the operator holds but the container does not | **PROVEN** | `docs/RSA-Documents/track-a-coverage.md:8` ("Binaries fetched by this run live in the box-runner container … **not** in the operator's checkout"); `docs/RSA-Documents/track-a-harvest-report.md:137` ("The inventoried documents live in the operator's checkout, not in this container … the committed stand-in … Binaries fetched by Track A live in the box-runner container … and no binary entered git"); `.autoforge/execution/M6b.md:70` ("nothing was re-fetched for them"). The contract's literal phrase "on the operator's Mac, not re-fetched" is not used verbatim; the substance is present and accurate. |
| The honest coverage is stated as 1/13, 0/41, 1/41 | **PROVEN** | `track-a-harvest-report.md:28-30` (Gap 12 / 41 / 40) and `:131-133`; `track-a-coverage.md:12-14`. No artefact claims more than the corpus holds. |

---

## 2. Verdict: **GO**

**Reasoning.**

1. **Every criterion has committed, reproducible evidence, and I recomputed the hard numbers independently.** The 8 criterion rows above are PROVEN except AC1, which is PARTIAL for two reasons that are *not* defects of the branch: there is no PR body yet (the orchestrator owns the PR — `loop6-brief.md:104-106`; the table it must quote is committed and byte-reproducible), and the per-document `cell_key` ledger is materialised for the fetched set and the coverage candidates but not as 304 explicit inventory rows.
2. **The suite is green at HEAD** and the report regenerates byte-identically, so the artefacts are not stale or hand-edited.
3. **The module reviews' blocking findings are closed.** `M6 N4` (null-safe `sourceEntryProblem`) and `M7 notes 1, 2, 4` are fixed in `cc0fcd6`; the M7 reviewer verified the same numbers and the M6 reviewer proved the H1 regression test non-vacuous. The remaining review notes are non-blocking (R9).
4. **The work does not overstate itself.** The branch says 1/13, 0/41, 1/41 and lists 13 unfillable source families with reasons — the correct answer, not a favourable one. The one place where a number could have flattered the work (`Have (documents) 1` for `canada:DETAILED_DESIGN` against `state/odd-coverage.json`'s `have_total: 0`) is explicitly reconciled in the report text (`:34`) rather than hidden.
5. **The safety rails held:** no binary in git, no secret, no foreign-lane file staged, the split invariant holds per document, the dedupe index only grew (333 pre-existing rows byte-identical), the 14-column log matches the manifest field-for-field.

**Two conditions on the GO (the orchestrator must not skip them):**
- **C1 — write the PR body from `plan-loop6.md:457-490` and state the honest numbers in it**, including "the fetch round produced **0** new documents — every candidate hash was already present" (`plan-loop6.md:487-489` still has that placeholder). AC1's "in the PR body" is only satisfied once that text exists.
- **C2 — the vault-determinism gate must be confirmed in CI.** `node scripts/vault-sync.mjs --check` **cannot run in this container** (`git-lfs` is absent; the `post-checkout` hook aborts the temporary worktree — output in §4). The branch touches no `vault/` file and no `state/vault-notes.json`, so the risk is low, but the gate is unverified here and CI is the only place it can be verified.

**Not REPLAN**, because every REPLAN trigger I can find is a defect in the *artefacts* or a *missing PR*, not in the implementation: no criterion regressed, no artefact contradicts another, no number is wrong.

---

## 3. Residual risks

| # | Risk | Severity |
|---|---|---|
| **R1** | **Vault determinism NOT VERIFIED in this container.** `node scripts/vault-sync.mjs --check` → exit 1: `This repository is configured for Git LFS but 'git-lfs' was not found on your path`. Same limitation as M6b/M7. The branch changes no `vault/` or `state/vault-notes.json` file, so CI is the only gate that can close this. | Medium (gate unproven) |
| **R2** | **The fetch round's per-skip evidence is not in git.** The durable record is the aggregate `outcome` block in `track-a-sources.json`; the 12 candidate/skip lines live only in container-local, gitignored logs (`/tmp/m6b-fetch.log`, `.autoforge/tmp/m6b-fetch.log`). Worse, the committed brief (`.autoforge/execution/M6b.md:26-28`) documents **only** the `ab-publications-listing` section, while the fuller local log shows the round also attempted `ab-open`, `ab-publications`, `bc-moti` (38 candidates), `qc-montreal-open`, `qc-mtl-transports`, `qc-montreal-city`, `toronto-legdocs`, `unb-transport` — **0 fetched in every source**. The PR body must not let a reader attribute the other `m6_*` counters to that one section (M6 review N1/N2). | Medium (accuracy of the record) |
| **R3** | One of the nine "not RSA" skips in the AB listing followed a PDF text-extraction warning (`UnknownErrorException: Ensure that the standardFontDataUrl API parameter is provided.`, `.autoforge/tmp/m6b-fetch.log:17-18`). That verdict may be an extraction artefact rather than a content judgement — a false negative that would silently shrink every future round (M6 review N3). | Low-medium |
| **R4** | **Nothing regenerates or gates the report in CI.** No workflow references `scripts/harvest-track-a-report.ts`; the only guards are the local `npx tsx … && git diff --exit-code` and a self-referential byte-equality test. If the inventory, the manifest or `state/odd-coverage.json` changes, the committed report silently goes stale (M7 review residual 1). | Medium |
| **R5** | The report inherits the operator's inventory verbatim. Its precision numbers are only as good as `track-a-ondisk-inventory.jsonl`, which cannot be re-run or audited from this container — the report is a faithful recomputation, not an independent audit of the corpus (M7 review residual 2). | Medium |
| **R6** | The single T3 coverage candidate in the whole Canadian corpus (`0af7ea58…`, AB) carries `missing_side_note: "missing: no designer/owner response section detected"` (`canada-intake-manifest.jsonl:1`; tier rule `scripts/harvest-track-a.ts:474-479`). It counts as an in-scope T3 RSA, but it has no designer/owner response section — worth stating in the PR body next to the 1/13. | Low |
| **R7** | Two of the three manifest documents already existed in the operator's checkout at different paths (reconciliation `:312-314`). The "Fetched" column therefore does not mean "new to the operator" for those rows. Disclosed in the artefacts, but easy to misread. | Low |
| **R8** | The report's class/stage/tier tables are sorted with `localeCompare` (`scripts/harvest-track-a-report.ts:107`); byte-identity holds under the locales the M7 reviewer tested, but a different ICU build/default locale could reorder the tables and break the byte-equality gate (M7 review residual 4). | Low |
| **R9** | **Open review notes (all non-blocking).** M7: note 3 (the licence-verdict breakdown the plan asked for at `plan-loop6.md:139` is still only implicit — the per-row `licence` column exists, the aggregate line does not), note 5 (the committed headline have-counts are not pinned by a test), note 6 (stage maps hand-copied instead of read from `policies/canada/pack.json`), note 7 (`mergeRows` does not deduplicate inventory rows sharing a sha — safe today only because every repeated sha has exactly one `rsa-sample` primary), note 8 (CLI resolves paths from `cwd`). M6: N1, N2, N3, N5 (`readIntakeManifest` still crashes on a malformed manifest line), N6 (province-level split map vs per-document split), N7 (`track-a-duplicates.json` is a per-run snapshot that can drop older rows), N8 (inert source fields), N9 ("this run" wording in the permanent H3 line — a regeneration on the operator's Mac would mislabel the provenance), N10/N11 (test hygiene and the selftest's three-way split classification). N4's **enum validation was explicitly not implemented** (`.autoforge/execution/M7-fixes.md:34-36`). | Low |
| **R10** | The repo's own curated record still contradicts the artefacts: `.autoforge/state.json` (uncommitted, foreign lane) says `phase: plan-loop6`, `loop: 5`, with the three loop-6 gaps still listed as open — including "coverage table counted only the 3 Track A fetches" and "no precision report", both now closed. It must be refreshed before the PR. | Medium (perception) |
| **R11** | **202 of the 304 inventoried documents (the whole corpus root) are absent from this container** — only the 99 `docs/references` / `tests/fixtures` rows exist here (as LFS pointers, 99/99 hash+size verified). The 202 corpus rows' labels (`stage`, `tier`, `class`, `label_confidence`) therefore cannot be independently re-derived here; the `a24707c6…` on-disk DETAILED_DESIGN candidate (the one document that lifts `canada:DETAILED_DESIGN` from 0 to 1) is one of them. | Medium (coverage of my verification) |
| **R12** | `track-a-duplicates.json` is a per-run snapshot (M6 review N7): the next intake that finds duplicates will overwrite the two rows committed today. Same data-loss class as H1, on an operator-facing register. | Low-medium |
| **R13** | `docs/RSA-Documents/track-a-coverage.md` carries a `Generated:` timestamp (`:3`), so it is **not** byte-reproducible — only the harvest report is. The contract's byte-reproducibility check covers the harvest report only, which passes. | Informational |
| **R14** | Cosmetic data-quality defect in the register: manifest row 2's `title` is `"Date: March 17, 2004"` (a mis-extracted title for the BC technical circular `t02-04b`). The document's tier/stage/split are correct (T1/UNSTAGED/restricted), so no coverage number moves. | Informational |
| **R15** | `gh issue view 40` could not be run (no network). The four ACs and the operator addition are taken verbatim from `loop6-brief.md:8-31`; if the ticket text has moved since the brief was written, this validation is against the brief's transcription, not the live issue. | Low |

### What could **not** be verified in this container

- `node scripts/vault-sync.mjs --check` (vault determinism) — `git-lfs` absent; the temporary `git worktree add` aborts in the `post-checkout` hook. Command output in §4.
- `tests/domain/vault-compile.test.ts` — deliberately not run (it rewrites `state/vault-notes.json`, per the contract). The file has 8 tests; the full suite would be 70 files / 719 passed / 2 skipped.
- The operator's checkout itself (`/Users/akamel/Documents/AuditorAI`) and the 202 corpus-root documents it holds — absent here; `docs/RSA-Documents/scripts/build-ondisk-inventory.py` cannot be re-run.
- The three fetched binaries as bytes — `docs/RSA-Documents/canada/track-a/**` does not exist in this container; 2 of the 3 were hash-verified indirectly through committed LFS pointer oids.
- Any network behaviour of the harvester — no network was used; the robots/crawl-delay/1-req-per-sec gates are attested by `src/discovery/robots.ts` (+ its 12 passing tests) and by the fetch log's 1-req/s behaviour, not re-exercised live.
- The PR body itself — does not exist yet (branch is 5 commits ahead of `origin/oc/40`).

---

## 4. Evidence log (verbatim command output)

```
$ npm run lint
> auditorai@0.1.0 lint
> eslint .

lint exit=0

$ npm run typecheck
> auditorai@0.1.0 typecheck
> tsc --noEmit

typecheck exit=0

$ npx vitest run --exclude '**/node_modules/**' --exclude '**/tests/domain/vault-compile.test.ts'
 Test Files  69 passed (69)
      Tests  711 passed | 2 skipped (713)
   Duration  5.27s
exit=0

$ npx vitest run tests/discovery/robots.test.ts tests/discovery/harvest-track-a.test.ts tests/discovery/harvest-track-a-report.test.ts
 ✓ tests/discovery/robots.test.ts (12 tests) 9ms
 ✓ tests/discovery/harvest-track-a-report.test.ts (23 tests) 12ms
 ✓ tests/discovery/harvest-track-a.test.ts (50 tests) 404ms
 Test Files  3 passed (3)
      Tests  85 passed (85)
exit=0

$ npx tsx scripts/harvest-track-a.ts selftest
ok   manifest lists allowlisted sources
ok   no listing_url points at a robots-disallowed /api/ path or a root-relative path
ok   no source uses a robots-disallowed /api/ listing
ok   every source id is unique
ok   every source entry is complete (none invalid)
ok   unfillable source families are listed
ok   Quebec provincial is listed as unfillable (403)
ok   the known-hash set is not empty
ok   an unknown sha256 is not skipped
ok   a sha256 already on disk is skipped with hash-already-present
ok   the on-disk inventory sha256 is in the known-hash set
ok   no document is in both train and test
ok   no document is tier T2
ok   every record has project_id, split and stage
ok   no manifest row carries a hash the corpus already held (0 stray)
ok   no Track A corpus binary is tracked by git

selftest passed
exit=0

$ sha256sum docs/RSA-Documents/track-a-harvest-report.md
03627d671e0d0872120710260aa8d90fab2340575ead29343e54fc845e8d9906  docs/RSA-Documents/track-a-harvest-report.md
$ npx tsx scripts/harvest-track-a-report.ts
wrote docs/RSA-Documents/track-a-harvest-report.md (11267 bytes)
exit=0
$ git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md
diff exit=0
$ sha256sum docs/RSA-Documents/track-a-harvest-report.md
03627d671e0d0872120710260aa8d90fab2340575ead29343e54fc845e8d9906  docs/RSA-Documents/track-a-harvest-report.md

$ git status --porcelain
 M .autoforge/state.json
 M state/production-harvest-proof.json
$ git diff --cached --name-only
(nothing staged)

$ git ls-files docs/RSA-Documents | grep -E '\.pdf$'
(none)
$ git ls-files docs/RSA-Documents | grep -E 'canada/track-a|quarantine/track-a'
(none)

$ awk -F'\t' '{print NR": "NF}' docs/RSA-Documents/canadian-download-log.tsv
1: 14
2: 14
3: 14
4: 14

# dedupe-index growth (my own comparison against the pre-Track-A commit ee2c9d4)
old(ee2c9d4) len 333 cur len 336
first 333 rows byte-equal to cur prefix: true
appended: 3 rows, each with sha256 / bytes / project_id / split

# download log vs intake manifest, field by field
0af7ea584ae0 diffs: none
84a70638ba60 diffs: none
555848f63c69 diffs: none
log rows: 3  manifest rows: 3  all match: true

# sha256 / bytes spot-check via the committed git-lfs pointers
checked 99  lfs pointers parsed: 99  sha256 match: 99/99  bytes match: 99/99  mismatches: 0
tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf -> oid sha256:0af7ea584ae04908…  size 35444  (manifest bytes 35444)
docs/references/CA/bct-moti-rsa-policy-tc-t02-04-2004.pdf    -> oid sha256:555848f63c690810…  size 22003  (manifest bytes 22003)
inventory rows under docs/RSA-Documents: 202   of which present in this container: 0

# independent recompute of the report's numbers from the raw committed files
|A| = 305 |B| = 147
3a {"methodology":27,"rsa-sample":60,"unusable":57,"duplicate":36,"out-of-scope":125}
3b {"methodology":24,"rsa-sample":55,"unusable":57,"duplicate":11}
tier B {"T0":89,"T3":23,"T1":28,"T4":7}
canada:FEASIBILITY_CONCEPT -> 1  [ '0af7ea584ae0' ]
canada:PRELIMINARY_DESIGN  -> 0  []
canada:DETAILED_DESIGN     -> 1  [ 'a24707c6081a' ]
unmapped A {"existing":78,"unknown":175,"pre-opening":5,"UNSTAGED":2}
unmapped B {"existing":59,"unknown":56,"pre-opening":4,"UNSTAGED":2}
inv-only CA rows 146 {"methodology":24,"rsa-sample":54,"unusable":57,"duplicate":11}
inv stage {"existing":59,"planning":3,"preliminary":8,"detailed":15,"unknown":57,"pre-opening":4}
inv tier {"T0":91,"T1":26,"T3":22,"T4":7}

# registers behind the reconciliation
corpus-catalog.json    -> 333 records, 202 .pdf rows
corpus-inventory.json  -> 376 files
dedupe-index.json      -> 336 rows
canadian-download-log.tsv -> 3 rows
track-a-sources.json   -> 9 sources, 13 unfillable families

$ node scripts/vault-sync.mjs --check
Error: Command failed: git worktree add --detach /tmp/vault-head-XXXX HEAD
Preparing worktree (detached HEAD cc0fcd6)
This repository is configured for Git LFS but 'git-lfs' was not found on your path.
exit=1
# (the working tree was unchanged by this run: `git status --porcelain` still shows only the two foreign-lane files)

$ git log --oneline origin/oc/40..HEAD
cc0fcd6 fix(harvest): apply M6 N4 and M7 notes 1, 2, 4 review fixes (#40)
bfddf85 docs(autoforge): M7 execution brief and verify evidence
83ae5c9 feat(harvest): inventory-first ODD coverage and harvest precision report
076739d feat(harvest): M6b - bounded Track A fetch round, source guard and coverage refresh (#40)
8c026c3 fix(discovery): derive the Track A split map from the full intake manifest (#40)
```

---

*Validation performed read-only at HEAD `cc0fcd6` on branch `oc/40`. No product file was edited, nothing was committed, nothing was pushed, no network call was made. The vault-compile test was not run, by contract instruction.*

*Staging note for the orchestrator: `.autoforge/` is excluded by the local `.git/info/exclude:7`, so this report is untracked-and-ignored — it needs `git add -f .autoforge/validation/loop6-report.md` (curated set, per `.autoforge/AGENTS.md`).*
