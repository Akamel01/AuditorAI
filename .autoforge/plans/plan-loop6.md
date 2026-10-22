# Plan loop 6 — ticket #40 (Harvest Track A), operator-addition close-out

- Ticket: `Akamel01/AuditorAI#40` · branch `oc/40` · HEAD `913b4ba` (`.autoforge/execution/loop6-brief.md:38-41`)
- Modules: **M6 → M7** (M7 `blocked_by` M6, `.autoforge/execution/loop6-brief.md:107-117`)
- Authority: the loop-6 brief is authoritative; this plan adds only the execution detail the brief asks for
  (`.autoforge/execution/loop6-brief.md:119-136`). Every number below cites a committed file.
- Planning only: this plan writes two files and nothing else.

## 1. Scope

| Module | Deliverable | Blocked by |
|---|---|---|
| M6 | one bounded gap-filling fetch round + the H1 split-file fix + output refresh | — |
| M7 | inventory-first ODD coverage table + harvest precision report (operator items 3 and 4) | M6 |

Operator items 1 and 2 are **done** (inventory + reconciliation, `.autoforge/execution/loop6-brief.md:48-72`).
Items 3 and 4 are M7. Gap 2 (`corpus-catalog.json` labels) is a recorded decision, not a task
(`.autoforge/execution/loop6-brief.md:80-84`).

## 2. Facts the worker may rely on (all committed)

**Corpus on the operator's Mac (inventoried, binaries not in this container)**

- 304 inventoried rows, 268 unique sha256, 36 duplicates, 4 anchors, 134 needing review
  (`docs/RSA-Documents/track-a-ondisk-summary.json:2-9`).
- class: duplicate 36, methodology 27, out-of-scope 125, rsa-sample 59, unusable 57
  (`docs/RSA-Documents/track-a-ondisk-summary.json:11-17`).
- tier: T0 244, T1 30, T3 23, T4 7 (`docs/RSA-Documents/track-a-ondisk-summary.json:18-23`).
- stage: detailed 32, existing 78, planning 3, pre-opening 5, preliminary 10, unknown 176
  (`docs/RSA-Documents/track-a-ondisk-summary.json:24-31`).
- Canadian in-scope subset: 146 rows / 135 selected; class unusable 57, rsa-sample 54, methodology 24,
  duplicate 11; stage existing 59, unknown 57, detailed 15, preliminary 8, pre-opening 4, planning 3
  (`docs/RSA-Documents/track-a-ondisk-summary.json:63-92`).
- Each inventory row carries path, abs_path, sha256, bytes, ext, title, jurisdiction, stage, tier, lang,
  class, label_confidence, evidence, dup_of, source_group (`docs/RSA-Documents/track-a-ondisk-inventory.jsonl:1-5`).
- Drift vs the four registers: 102 documents on disk outside the corpus root, 61 sha256 already claimed by
  `dedupe-index.json` under another path, 131 catalogued non-document entries missing on disk, 3 download-log
  rows of which 2 have their sha256 on disk and 3 are absent at their logged path
  (`docs/RSA-Documents/track-a-reconciliation.md:79-91`, `:306-320`).
- `dedupe-index.json` currently holds 336 rows (`docs/RSA-Documents/track-a-reconciliation.md:99`).

**Track A fetch state (committed)**

- The committed manifest holds **3 rows today** — more if M6 ingests any — all in
  `docs/RSA-Documents/canada-intake-manifest.jsonl:1-3`: 1 CLEAR T3 `canada:FEASIBILITY_CONCEPT` AB (test),
  2 RESTRICTED T1 `UNSTAGED` BC (restricted).
- Same rows in `docs/RSA-Documents/canadian-download-log.tsv:1-4`; split file
  `docs/RSA-Documents/track-a-split.json:9-24` (AB → test, BC → restricted).
- 2 fetched-but-not-ingested duplicates (`docs/RSA-Documents/track-a-duplicates.json:5-18`).
- Licence rows for `canada/track-a/ab-open` and `canada/track-a/bc-moti`
  (`docs/RSA-Documents/LICENSE-REGISTER.md:24-25`).
- Source list of record: 8 fetchable sources + 13 unfillable families
  (`docs/RSA-Documents/track-a-sources.json:34-286`, `:287-366`); per-source `outcome` blocks already
  record a previous round in which no source produced a new document (all 8 blocks:
  `docs/RSA-Documents/track-a-sources.json:57`, `:87`, `:120`, `:156`, `:186`, `:217`, `:250`, `:279`).

**sha256 overlap between the inventory and the manifest (needed by M7's precedence rule)**

- Manifest row 1 sha `0af7ea58…` is inventoried at `docs/RSA-Documents/track-a-ondisk-inventory.jsonl:231`
  (`tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf`, AB, stage `planning`, **T0**,
  class `rsa-sample`).
- Manifest row 3 sha `555848f6…` is inventoried at `docs/RSA-Documents/track-a-ondisk-inventory.jsonl:210`
  (`docs/references/CA/bct-moti-rsa-policy-tc-t02-04-2004.pdf`, BC, stage `unknown`, T0, class `methodology`).
- Manifest row 2 sha `84a70638…` is **not** in the inventory.
- All 3 manifest shas are already in `docs/RSA-Documents/dedupe-index.json` (336 rows,
  `docs/RSA-Documents/track-a-reconciliation.md:99`) — which is what makes the empty-batch scenario in §4
  reachable.

**ODD targets (authoritative, do not hand-edit)**

- `canada:FEASIBILITY_CONCEPT` target **13**, priority 0.9231 (`state/odd-coverage.json:108`, `:112`).
- `canada:DETAILED_DESIGN` target **41**, priority 3 (`state/odd-coverage.json:220`, `:224`).
- `canada:PRELIMINARY_DESIGN` target **41**, priority 3 (`state/odd-coverage.json:239`, `:243`).
- Canada's pack defines exactly three mappable native stages and one with no canonical stage:
  `ca-tac:planning` → `FEASIBILITY_CONCEPT` (`policies/canada/pack.json:22-31`),
  `ca-tac:preliminary-design` → `PRELIMINARY_DESIGN` (`policies/canada/pack.json:40-49`),
  `ca-tac:detailed-design` → `DETAILED_DESIGN` (`policies/canada/pack.json:58-67`),
  `ca-tac:pre-opening` → `canonical_stages: []` (`policies/canada/pack.json:76-83`).

**Repo mechanics**

- Split rule: QC + AB are test, every other province train, non-CLEAR never train nor test
  (`docs/RSA-Documents/track-a-sources.json:16-24`; `scripts/harvest-track-a.ts:338-341`).
- Known-hash rule: the union of the on-disk inventory, `dedupe-index.json` and `corpus-catalog.json` is
  never downloaded again (`scripts/harvest-track-a.ts:161-193`; `docs/RSA-Documents/track-a-sources.json:25-33`).
- Robots gate per URL path before every request, crawl-delay honoured
  (`scripts/harvest-track-a.ts:480-487`; `src/discovery/robots.ts`).
- Corpus binaries and staging are gitignored: `docs/RSA-Documents/canada/track-a/`,
  `docs/RSA-Documents/quarantine/track-a/`, `docs/RSA-Documents/.track-a/`, `docs/RSA-Documents/**/*.pdf`
  (`.gitignore:76-79`).
- Actual exports of the CLI: `TEST_PROVINCES`, `TSV_COLUMNS`, `serializeDedupeIndex`, `HASH_SKIP_REASON`,
  `knownHashes`, `hashSkipReason`, `splitFor`, `detectStage`, `detectLang`, `detectProvince`,
  `subjectRegion`, `isRsaDocument`, `detectTier`, `missingSideNote`, `projectKeyFor`, `LEGACY_SHA256`
  (`scripts/harvest-track-a.ts:38-446`, `:842-846`). The brief's list (`projectId`, `verifyPdf`, `dedupeClaim`,
  `coverage`) does **not** match the committed file — do not go looking for those exports.

## 3. ODD stage mapping rule (binding on M6 and M7)

The inventory stage vocabulary (`planning`, `preliminary`, `detailed`, `existing`, `pre-opening`, `unknown`;
`docs/RSA-Documents/scripts/build-ondisk-inventory.py:110-131`) maps to the canonical cells as follows:

| inventory stage | canonical cell | authority |
|---|---|---|
| `planning` | `canada:FEASIBILITY_CONCEPT` | `policies/canada/pack.json:22-31` |
| `preliminary` | `canada:PRELIMINARY_DESIGN` | `policies/canada/pack.json:40-49` |
| `detailed` | `canada:DETAILED_DESIGN` | `policies/canada/pack.json:58-67` |
| `existing` | **none — unmapped** | no native stage in `policies/canada/pack.json` |
| `pre-opening` | **none — unmapped** | `policies/canada/pack.json:76-83` (`canonical_stages: []`) |
| `unknown` | **none — unmapped** | no stage could be derived |

Rules:

1. `existing`, `pre-opening` and `unknown` are reported **as unmapped with their counts**. They are never
   folded into a cell and never silently dropped.
2. **T1 never counts as coverage.** Neither does T0. Only tier T3/T4 rows count. This is the requirement the
   grilling record already fixed for this ticket — "T1 never counts as §3 coverage"
   (`.autoforge/requirements/grilling.md:10`) and "Stop rule no numeric floor … T1 reported separately, never as
   §3 coverage" (`.autoforge/requirements/grilling.md:41`) — and it matches the inventory's tier ladder, where T2
   is never emitted (`docs/RSA-Documents/scripts/build-ondisk-inventory.py:12-13`).
3. **Coverage-candidate rule (RC-1).** A document is identified by its **sha256**. A row is a coverage
   candidate when the three conditions below hold **and** it passes the class test stated in the table that
   follows:
   - **Canadian**: an inventory row's `jurisdiction` is one of the 13 `ca_province` codes
     (`docs/RSA-Documents/corpus-schema.json:10-12`) or `CAN-GOV`
     (`docs/RSA-Documents/track-a-ondisk-summary.json:35`); `USA` and `INT` rows are out of Canada. A manifest
     row's `ca_province` must be one of the 13 codes.
   - **Tier T3 or T4** (rule 2).
   - **Stage maps to the cell** (the table above).

   The two sources label the same facts differently, so the class test is stated per source:

   | source | class test | tier/stage source | why |
   |---|---|---|---|
   | inventory row | `class == "rsa-sample"` | the row's `stage` | the inventory is the only file with a class label ("real RSA vs methodology", operator item 1); `duplicate`, `out-of-scope`, `methodology` and `unusable` rows never count |
   | manifest row | **no class test** — a manifest row is class-equivalent to `rsa-sample` | the row's `tier` and `cell_key` | the `IntakeRecord` interface has no `class` field (`scripts/harvest-track-a.ts:105-126`), and every manifest row already passed the RSA classifier (`scripts/harvest-track-a.ts:533-537`) |

   A manifest row with `licence_verdict == "BLOCKED"` is quarantined and never counts as coverage; `RESTRICTED`
   rows stay in the corpus (licence governs use, not presence) and the report states the verdict breakdown next
   to the counts.
4. **Precedence for a sha256 present in both sources (RC-1).** The **manifest wins for `tier` and `stage`/
   `cell_key`** (it is the intake record of record for that document); the **inventory wins for `class`** (it is
   the only class authority); the document is counted **once** and attributed to the **fetched** column.

   Numeric example, from the committed data: sha `0af7ea58…` is manifest row 1 (T3, `FEASIBILITY_CONCEPT`, AB,
   `cell_key: canada:FEASIBILITY_CONCEPT`) and inventory row 231 (`planning`, **T0**, class `rsa-sample`).
   Under the inventory labels alone it contributes nothing (T0); under the manifest labels it is a T3
   `canada:FEASIBILITY_CONCEPT` document. The precedence rule resolves the conflict to the manifest label, so the
   document counts **once**, in `canada:FEASIBILITY_CONCEPT`, in the **fetched** column — not twice, and not as an
   on-disk row.
5. A duplicate row (class `duplicate` / non-null `dup_of`) never counts twice; the primary row carries the count.
6. The manifest's own stage vocabulary (`FEASIBILITY_CONCEPT`, `PRELIMINARY_DESIGN`, `DETAILED_DESIGN`,
   `UNSTAGED`, `MULTI_STAGE`, `PRE_OPENING`) is already canonical
   (`scripts/harvest-track-a.ts:350-354`); `UNSTAGED`, `MULTI_STAGE` and `PRE_OPENING`
   (`scripts/harvest-track-a.ts:344`) map to no cell, exactly like `unknown` / `existing` / `pre-opening`.

### 3.1 Precision denominators (RC-2)

The report states **two** row sets and never mixes them:

- **Row set A — all documents on record**: every inventory row (304 today) **plus** every manifest row whose
  sha256 is not in the inventory (1 today: manifest row 2, sha `84a70638…`). A sha in both is one document
  (rule 4). Denominator = |A|. This is the denominator for the **all-rows** class shares.
- **Row set B — Canadian in-scope subset**: the rows of A whose jurisdiction is Canadian (rule 3). Today 146
  inventory rows + 1 manifest-only row = 147. Denominator = |B|. This is the denominator for the
  **in-scope share** (coverage candidates over |B|).
- **Cross-check**: the script's **inventory-only** Canadian subset (146 rows, with the class and stage breakdown
  of `docs/RSA-Documents/track-a-ondisk-summary.json:64-92`) must match the committed summary exactly. That
  block describes the inventory alone, so it is checked against the inventory part of B, not against B as a whole.

Class attribution inside A and B: the class comes from the inventory row when the sha is inventoried; a
manifest-only row is class-equivalent `rsa-sample` (rule 3).

Classes that exist **only outside** row set B: `out-of-scope` (125 rows, all of them outside the Canadian subset)
and the `USA` / `INT` jurisdictions. Classes that exist **inside** row set B: `duplicate`, `methodology`,
`rsa-sample`, `unusable` — there is **no** `out-of-scope` row in B
(`docs/RSA-Documents/track-a-ondisk-summary.json:64-92`). The all-rows table therefore shows
`out-of-scope`; the Canadian-only sub-table does not, and the report says so explicitly instead of showing a
zero.

## 4. Module M6 — bounded fetch round + H1 fix + output refresh

**Objective.** Fix the split-file bug, run one bounded gap-filling fetch round that never re-ingests a known
hash, and leave every tracked output consistent with the fixed code.

**Inputs** `scripts/harvest-track-a.ts`, `docs/RSA-Documents/track-a-sources.json`,
`docs/RSA-Documents/canada-intake-manifest.jsonl`, `docs/RSA-Documents/dedupe-index.json`,
`docs/RSA-Documents/canadian-download-log.tsv`, `docs/RSA-Documents/track-a-split.json`.

**Outputs / touches**

- `scripts/harvest-track-a.ts` (H1 fix + two write guards + one report line)
- `tests/discovery/harvest-track-a.test.ts` (regression test)
- `docs/RSA-Documents/track-a-sources.json` (outcome refresh; at most one new listing entry)
- `docs/RSA-Documents/canada-intake-manifest.jsonl`, `canadian-download-log.tsv`, `track-a-split.json`,
  `track-a-coverage.md`, `track-a-duplicates.json`, `dedupe-index.json` (append only),
  `LICENSE-REGISTER.md`, `QUARANTINE.md`
- (gitignored, never committed) `docs/RSA-Documents/canada/track-a/**`, `docs/RSA-Documents/.track-a/**`

**Work**

1. **H1 fix.** `runIntake()` builds `by_province` from the *fresh* records only
   (`scripts/harvest-track-a.ts:664-670`) and writes the split file from it
   (`scripts/harvest-track-a.ts:671-678`). A later intake whose staging holds only duplicates therefore
   rewrites `track-a-split.json` with an empty map. Fix: derive the split map from the **full intake manifest**
   (the records already in `canada-intake-manifest.jsonl` plus the fresh ones). Implement it as an exported pure
   helper (e.g. `splitManifest(records: IntakeRecord[])`) so it is testable without touching the filesystem, and
   call it from `runIntake` with the full record set. Do not add a second split algorithm.
2. **Regression test** (required): in `tests/discovery/harvest-track-a.test.ts`, assert that the split map
   built from a record list that contains a document *not* in the current batch still contains that document —
   i.e. the "staging holds only duplicates" case does not lose previously ingested documents. Add a second
   assertion that the committed `docs/RSA-Documents/track-a-split.json` equals the split derived from the
   committed `docs/RSA-Documents/canada-intake-manifest.jsonl` (the invariant that H1 broke). Compare the
   **parsed** split structure, not the file bytes (the committed file's formatting is not the helper's to own).
   The test file is offline (no network) — see `tests/discovery/harvest-track-a.test.ts:1-20`.
3. **Two write guards.** With no fresh records, `runIntake` still rewrites the download log with a trailing
   newline (`scripts/harvest-track-a.ts:646-647`) and the intake manifest with a trailing newline
   (`scripts/harvest-track-a.ts:656-662`). Guard both writes so an empty batch leaves both files byte-identical
   (the M6 refresh must not add a blank line to either file).
   **The guard must be exercised by the scenario in the acceptance criteria below** — running `intake` with no
   staging file does not reach these writes (`scripts/harvest-track-a.ts:596-600` returns early), so it cannot
   prove the guard.
4. **One bounded fetch round.** `npx tsx scripts/harvest-track-a.ts fetch` over the committed manifest
   (`scripts/harvest-track-a.ts:460-583`). Robots gate per URL path (`:480-484`), crawl-delay honoured (`:486-487`),
   ≤1 req/s per host (`:490-492`), known-hash skip before any write (`:511-518`), binaries land under
   `docs/RSA-Documents/canada/track-a/<source-id>/` (`:545-550`, gitignored). Run **one** round; if a source
   yields nothing, record it and move on — no retry loops. **Time bound (N-10):** the round is stopped after
   30 minutes and the partial outcome is recorded (the crawl delays alone make a full round tens of minutes:
   `docs/RSA-Documents/track-a-sources.json:10-13`, `:117`; `scripts/harvest-track-a.ts:264`, `:327`). A stopped
   round is a normal outcome, not a failure.
5. **Manifest extension: add a NEW source entry, or none (RC-5).** Extend `track-a-sources.json` only if a
   server-rendered listing that robots permits yields candidate PDFs. The one candidate in the committed file is
   the Alberta publications listing — the publication pages are server-rendered and carry the resource URL
   (`docs/RSA-Documents/track-a-sources.json:72`), and the page itself is already referenced as the licence ref
   (`:76`).
   - **Add a new entry** (new `id`, e.g. `ab-publications-listing`). **Do not modify the existing
     `ab-publications` entry**: its `strategy` is `known-document-url` (`docs/RSA-Documents/track-a-sources.json:70`)
     and it carries two `known_document_urls` (`:82-85`), and `candidatesFor` returns `known_document_urls` **only**
     for that strategy (`scripts/harvest-track-a.ts:245-246`) — changing the strategy would silently drop both
     Alberta URLs and invalidate that source's committed outcome block (`:87`).
   - The new entry must carry **every** field the `Source` interface needs
     (`scripts/harvest-track-a.ts:63-89`): `id`, `host`, `family`, `strategy` (`"html-listing-pdf"`, already in the
     strategy union, `:67-71`), `listing_url`, `robots_hint`, `licence_default{verdict, basis, licence_ref}`,
     `stage_hint`, `ca_province_hint`, `doc_type_hint`, `expected_yield_estimate`, plus `max_downloads`.
     `runFetch` dereferences `source.stage_hint` (`:539`), `source.ca_province_hint` (`:540`),
     `source.licence_default.verdict` (`:541`) and `source.doc_type_hint` (`:561`) — **a partial or invalid entry
     is rejected, not allowed to crash the fetch**: validate it against the interface's required fields before
     writing the file, and drop the entry (with the reason recorded) if anything is missing.
   - The `listing_url` must not be under `/api/` (the selftest rejects that, `scripts/harvest-track-a.ts:857-864`);
     verify the listing's robots.txt with `robotsFor` before adding it.
   - If the listing yields no candidate PDFs, **do not** extend the manifest and leave the file byte-identical.
6. **Refresh the outputs.** Re-run `intake` then `report` so `canada-intake-manifest.jsonl`,
   `canadian-download-log.tsv`, `track-a-split.json`, `track-a-coverage.md`, `track-a-duplicates.json`,
   `dedupe-index.json` (append only — the existing rows are the corpus's, never rewritten,
   `scripts/harvest-track-a.ts:680-695`), `LICENSE-REGISTER.md` and `QUARANTINE.md` agree with the fixed code.
   **Expect `track-a-coverage.md` to change (N-6):** the committed copy lists only 12 unfillable families
   (`docs/RSA-Documents/track-a-coverage.md:35-46`) while the manifest has 13
   (`docs/RSA-Documents/track-a-sources.json:360-365`), and `runReport` stamps a fresh `Generated:` line
   (`scripts/harvest-track-a.ts:765`). Commit the regenerated file — it is not byte-reproducible, unlike M7's
   report.
   With no staging file present (`scripts/harvest-track-a.ts:587-593`, `.gitignore:78`) `intake` exits early and
   touches nothing — that is the safe path, and the committed split file must then already satisfy the invariant
   from step 2.
7. **H3 label.** Put the H3 line into `runReport`'s markdown template so **every** regeneration carries it (the
   file is rewritten wholesale by `runReport`, `scripts/harvest-track-a.ts:762-830` — a hand edit to the
   generated file would be lost). The line states that binaries fetched by this run live in the box-runner
   container (`docs/RSA-Documents/canada/track-a/**`), **not** in the operator's checkout.
8. **Record the outcome.** Update each source's `outcome` block in `docs/RSA-Documents/track-a-sources.json` with
   the numbers this round produced (`m6_new_documents`, `m6_skipped_*`). If the round reproduces the numbers
   already committed (the 8 blocks at `docs/RSA-Documents/track-a-sources.json:57`, `:87`, `:120`, `:156`, `:186`,
   `:217`, `:250`, `:279`), leave the file byte-identical — do not add a timestamp for the sake of it.

**Acceptance criteria**

- [ ] `track-a-split.json` is derived from the full intake manifest; a staging batch of only duplicates cannot
      shrink it (H1).
- [ ] `tests/discovery/harvest-track-a.test.ts` has a regression test for H1 and an invariant test that the
      committed split file matches the committed manifest.
- [ ] **The empty-batch guard is exercised (RC-3).** Scenario: a staging file **exists** at
      `docs/RSA-Documents/.track-a/fetched.jsonl` (gitignored, `.gitignore:78`) and holds intake records whose
      sha256 values are **all already in `docs/RSA-Documents/dedupe-index.json`** — the three committed manifest
      rows qualify (`0af7ea58…`, `84a70638…`, `555848f6…`; `scripts/harvest-track-a.ts:612-618` puts them in
      `duplicates`, so `fresh` stays empty). Run `npx tsx scripts/harvest-track-a.ts intake` and show that
      `docs/RSA-Documents/canadian-download-log.tsv` and `docs/RSA-Documents/canada-intake-manifest.jsonl` are
      **byte-identical** to their committed content (no trailing blank line) and that `track-a-split.json` still
      contains the full manifest's provinces. Paste the byte comparison in the PR body.
      Running `intake` with **no** staging file does **not** satisfy this criterion: it returns early at
      `scripts/harvest-track-a.ts:596-600` and never reaches the writes at `:646-647` / `:656-662`.
      Side effect to undo: that run also rewrites `docs/RSA-Documents/track-a-duplicates.json`
      (`scripts/harvest-track-a.ts:630-642`) — restore it with
      `git checkout -- docs/RSA-Documents/track-a-duplicates.json` afterwards and confirm it is byte-identical to
      HEAD.
- [ ] The fetch round ran once (stopped at the 30-minute bound if it had not finished), honoured robots +
      crawl-delay + ≤1 req/s per host, and wrote no binary whose sha256 is in the known-hash set.
- [ ] `track-a-sources.json` gained **at most one new entry**, and only if a robots-permitted server-rendered
      listing yielded candidate PDFs; the new entry carries every required `Source` field; the existing
      `ab-publications` entry (strategy + `known_document_urls`) is **unchanged**; the selftest's `/api/` check
      still passes (RC-5).
- [ ] Every new document (if any) has a row in the download log, the licence register, the dedupe index and the
      intake manifest, with a `project_id` and a `split`; `dedupe-index.json` only grew.
- [ ] `git status --porcelain` shows no path under `docs/RSA-Documents/canada/`, `docs/RSA-Documents/quarantine/`
      or `docs/RSA-Documents/.track-a/`, and no `*.pdf`.
- [ ] `npx tsx scripts/harvest-track-a.ts selftest` exits 0.

**Out of scope**

- Any edit to `docs/RSA-Documents/corpus-catalog.json` (generated by `docs/RSA-Documents/scripts/build-catalog.py`
  on the operator's Mac; the labels now live in the inventory — `.autoforge/execution/loop6-brief.md:80-84`).
- Any edit to `state/odd-coverage.json`, `policies/odd.json`, `policies/canada/pack.json` or `corpus-schema.json`.
- Track B (ATIP/FOIA) and Track C (headless browse) — the 13 unfillable families stay unfillable
  (`docs/RSA-Documents/track-a-sources.json:287-366`).
- Login, paywall, CAPTCHA, ATIP/FOIA, UA rotation, proxies.
- Writing, moving or deleting anything outside this worktree; the operator checkout is read-only and absent here.
- Training packs, mining `usa/` or `quarantine/`.
- Merging, closing/labeling the issue, pushing another branch (H7).

**Verify**

```
npx vitest run tests/discovery/harvest-track-a.test.ts
npx tsx scripts/harvest-track-a.ts selftest
npm run lint && npm run typecheck
git status --porcelain
```

## 5. Module M7 — inventory-first ODD coverage + harvest precision report

**Objective.** Build the section-3 ODD coverage table **from the on-disk inventory first** and report harvest
precision per class, from committed inputs only, deterministically.

**Depends on** M6 (its numbers must reflect the final fetch state).

**Creates**

- `scripts/harvest-track-a-report.ts` — deterministic report builder + thin CLI
- `tests/discovery/harvest-track-a-report.test.ts`
- `docs/RSA-Documents/track-a-harvest-report.md` — the report

**Why TypeScript and not Python.** The corpus python scripts under `docs/RSA-Documents/scripts/` are not covered by
CI (no python step in `.github/workflows/`), while `npm run lint`, `npm run typecheck` and `npm test` are
(`package.json:6-14`). The report must be lint-clean, type-checked and unit-tested, so it is TS.

**Inputs (committed, read-only)**

- `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` (304 rows)
- `docs/RSA-Documents/canada-intake-manifest.jsonl` (fetched records)
- `state/odd-coverage.json` (targets)
- `docs/RSA-Documents/track-a-sources.json` (unfillable families, for the Track B/C section)

**Work**

1. One exported pure function, e.g. `buildReport(inventory, manifest, coverage, unfillable): string`, that returns
   the whole markdown. The CLI writes it to `docs/RSA-Documents/track-a-harvest-report.md`. **No timestamp in the
   output** — the file must be byte-reproducible so the test can assert it. Export the builder and guard `main()`
   with the same `process.argv[1]` basename check the existing CLI uses
   (`scripts/harvest-track-a.ts:957-958`), so importing the module in the vitest file does not execute the CLI.
2. **Section 1 — ODD coverage table (inventory first).** One row per Canadian canonical cell
   (`canada:FEASIBILITY_CONCEPT`, `canada:PRELIMINARY_DESIGN`, `canada:DETAILED_DESIGN`) with the target from
   `state/odd-coverage.json` (13 / 41 / 41 — `state/odd-coverage.json:108`, `:220`, `:239`), the priority, and the
   have-count computed under §3 rule 3 (the coverage-candidate rule) and §3 rule 4 (the precedence rule) of this
   plan. The count is the number of **distinct coverage-candidate documents** whose stage maps to that cell,
   across the inventory **and** the intake manifest. The table states **which of the two sources each count came
   from** (on-disk vs fetched) and follows the precedence rule: a sha256 present in both sources is counted
   **once** and attributed to the **fetched** column.
3. **Section 2 — unmapped stages.** Counts for `existing`, `pre-opening`, `unknown` (and the manifest's
   `UNSTAGED` / `MULTI_STAGE` / `PRE_OPENING`), with the note that they have no canonical cell
   (`policies/canada/pack.json:76-83`) and are therefore not coverage.
4. **Section 3 — harvest precision (operator item 4), with the denominators of §3.1.** Two tables, never mixed:
   - **3a — all rows (row set A)**: every class value over A, with the count and the share over |A|. This table
     contains `out-of-scope`, which exists only outside the Canadian subset.
   - **3b — Canadian in-scope (row set B)**: the class breakdown over B, with the count and the share over |B|,
     and the **in-scope share** stated as the coverage-candidate count over |B|. This table has **no**
     `out-of-scope` row, and the report says so explicitly instead of printing a zero.
   - Every class value present in the inventory appears in 3a; none may be dropped. The T0/T1 cut of the
     in-scope rows is a tier cross-tab of row set B, not a class.
5. **Section 4 — fetched-only precision (RC-4).** **All** rows of `docs/RSA-Documents/canada-intake-manifest.jsonl`
   (3 today; more if M6 ingested any — the count is derived from the file, never typed) with their
   tier/stage/split/licence verdict. The split disjointness check (AC3) is done **per document**: map each
   manifest row's sha256 to its `split` and assert that no sha256 appears with two different splits. Do **not**
   reuse the province-level map — the selftest's own check pushes every non-`train` province into the `test` set
   (`scripts/harvest-track-a.ts:900-906`), and a province-level map cannot represent a province holding both
   train and test documents.
6. **Section 5 — cells Track A cannot fill.** The 13 unfillable families from
   `docs/RSA-Documents/track-a-sources.json:287-366` and the Canadian cells with a zero count, as the Track B/C
   input (AC4).
7. **Section 6 — provenance.** One line stating that the ~300 documents live in the operator's checkout
   (not in this container) and that the inventory is the committed stand-in for them
   (`.autoforge/execution/loop6-brief.md:33-37`).
8. **Cross-check.** The script's **inventory-only** Canadian subset must reproduce the committed summary: 146
   rows, class unusable 57 / rsa-sample 54 / methodology 24 / duplicate 11, stage existing 59 / unknown 57 /
   detailed 15 / preliminary 8 / pre-opening 4 / planning 3
   (`docs/RSA-Documents/track-a-ondisk-summary.json:64-92`). If the script's numbers disagree with that block, the
   script is wrong — stop and report, do not "fix" the summary.

**Acceptance criteria**

- [ ] `docs/RSA-Documents/track-a-harvest-report.md` exists, is deterministic (no timestamp) and is regenerated
      byte-identically by `npx tsx scripts/harvest-track-a-report.ts`.
- [ ] The ODD coverage table lists all three Canadian cells with targets 13 / 41 / 41 taken from
      `state/odd-coverage.json`, never hand-typed.
- [ ] Every counted document satisfies the coverage-candidate rule (§3 rule 3): Canadian, tier T3/T4,
      stage-mapped — and for an **inventory** row additionally `class == "rsa-sample"`, while a **manifest** row
      qualifies on `tier` + `cell_key` alone (it has no `class` field,
      `scripts/harvest-track-a.ts:105-126`). **T1 appears in no cell count** (§3 rule 2).
- [ ] The two sources' labels are reconciled by the stated precedence rule (§3 rule 4): a sha256 present in both
      is counted **once** and attributed to the **fetched** column. The committed case is checked explicitly:
      sha `0af7ea58…` (manifest row 1, T3 `canada:FEASIBILITY_CONCEPT`; inventory row 231, `planning`, T0) counts
      **once**, in `canada:FEASIBILITY_CONCEPT`, in the fetched column.
- [ ] `existing`, `pre-opening` and `unknown` appear as unmapped with their counts.
- [ ] The precision section states both denominators explicitly (|A| for the all-rows table, |B| for the
      Canadian table) and never uses one as the other; `out-of-scope` appears in the all-rows table and is
      explicitly absent from the Canadian table.
- [ ] The Canadian subset cross-check matches `docs/RSA-Documents/track-a-ondisk-summary.json:64-92`.
- [ ] The unfillable-families section lists all 13 families and every Canadian cell with a zero count.
- [ ] The fetched-only section lists **every** manifest row and the per-document split disjointness check passes.
- [ ] `tests/discovery/harvest-track-a-report.test.ts` asserts: the mapping rule per stage; that a T1 row never
      lands in a cell; that a sha256 in both sources is counted once and attributed to the fetched column; that
      the committed report file equals the freshly computed report; and the summary cross-check.
- [ ] The new script exports its builder and guards `main()` with the same `process.argv[1]` check as the
      existing CLI (`scripts/harvest-track-a.ts:957-958`), so importing it in the test does not run the CLI.
- [ ] No network call, no LLM/model call, no write outside the three files above.

**Out of scope**

- Editing `state/odd-coverage.json` (targets are read-only inputs), `corpus-catalog.json`, `corpus-inventory.json`.
- Re-running `docs/RSA-Documents/scripts/build-ondisk-inventory.py` (it runs against the operator's Mac; its output
  is committed — `.autoforge/execution/loop6-brief.md:56-58`).
- Any ODD cell status flip, any new policy stage, any new corpus-schema field.
- Re-labelling inventory rows or "correcting" the inventory counts.
- Writing coverage into `state/odd-coverage.json` to make the numbers look better.

**Verify**

```
npx vitest run tests/discovery/harvest-track-a-report.test.ts
npx tsx scripts/harvest-track-a-report.ts
npm run lint && npm run typecheck
```

`git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md` is only meaningful **after** the file is
tracked (git does not diff untracked paths), so it belongs to the end-of-run sequence in §8, not here.

## 6. PR body skeleton

Title: `Harvest Track A: inventory-derived ODD coverage, harvest precision and the Track A close-out (#40)`

```
## What this PR does
Track A close-out for #40: one bounded fetch round, the split-file fix, and the operator's
requested inventory-first ODD coverage table + harvest precision report.

## Acceptance criteria
- [x] AC1 coverage table per ODD cell vs the section 3 target, priority cells called out
      -> docs/RSA-Documents/track-a-harvest-report.md (section 1) ; targets from state/odd-coverage.json
         (canada:FEASIBILITY_CONCEPT 13, canada:PRELIMINARY_DESIGN 41, canada:DETAILED_DESIGN 41)
         ; fetch-round-only view in docs/RSA-Documents/track-a-coverage.md
- [x] AC2 every fetched document in the download log, the licence register and the dedupe index, with a
      project ID and a split
      -> docs/RSA-Documents/canadian-download-log.tsv, docs/RSA-Documents/LICENSE-REGISTER.md,
         docs/RSA-Documents/dedupe-index.json, docs/RSA-Documents/canada-intake-manifest.jsonl
- [x] AC3 no document in both train and test geography
      -> docs/RSA-Documents/track-a-split.json ; invariant checked by
         `npx tsx scripts/harvest-track-a.ts selftest` (scripts/harvest-track-a.ts:896-909)
- [x] AC4 the cells Track A cannot fill, as input for Track B and C
      -> docs/RSA-Documents/track-a-harvest-report.md (section 5) and
         docs/RSA-Documents/track-a-sources.json -> unfillable (13 families)

## Operator addition (2026-10-21)
- [x] 1. inventory of the operator checkout (read-only): 304 rows
      -> docs/RSA-Documents/track-a-ondisk-inventory.jsonl, docs/RSA-Documents/track-a-ondisk-summary.json
- [x] 2. reconciliation against corpus-inventory.json / corpus-catalog.json / dedupe-index.json /
      canadian-download-log.tsv
      -> docs/RSA-Documents/track-a-reconciliation.md
- [x] 3. coverage table built from the inventory first, then fetch only to fill the gaps; no known hash
      re-ingested (the hash gate runs after the bytes arrive, so a known document is downloaded and
      discarded — 10 such downloads in total, 3 in the M6b round)
      -> docs/RSA-Documents/track-a-harvest-report.md (section 1) ; known-hash rule
         (scripts/harvest-track-a.ts:161-193)
- [x] 4. harvest precision per class
      -> docs/RSA-Documents/track-a-harvest-report.md (section 3)

## Provenance
The ~300 documents live in the operator's checkout, untracked by git. Binaries fetched by this run live in
the box-runner container (docs/RSA-Documents/canada/track-a/**), NOT in the operator's checkout. No binary
entered git.

## Decisions
- corpus-catalog.json is generated by docs/RSA-Documents/scripts/build-catalog.py on the operator's Mac and is
  NOT hand-edited here; the operator's labels live in docs/RSA-Documents/track-a-ondisk-inventory.jsonl.
- T1 never counts as coverage.
- A document present in both the inventory and the intake manifest is counted once, labelled by the manifest for
  tier/stage and by the inventory for class, and attributed to the fetched column.
- The precision report states two denominators (all rows; Canadian subset) and never mixes them.
- The fetch round produced N new documents: <state the number, or "0 — every candidate hash was already
  present">. Say it plainly; do not imply new material that was not fetched.

## Verification
<the verification sequence below, with its output>
```

## 7. Commit list (one concern per commit, explicit paths)

```
git add scripts/harvest-track-a.ts tests/discovery/harvest-track-a.test.ts
git commit -m "fix(harvest): derive the split manifest from the full intake manifest"

git add docs/RSA-Documents/track-a-sources.json docs/RSA-Documents/track-a-duplicates.json \
        docs/RSA-Documents/canada-intake-manifest.jsonl docs/RSA-Documents/canadian-download-log.tsv \
        docs/RSA-Documents/track-a-split.json docs/RSA-Documents/track-a-coverage.md \
        docs/RSA-Documents/dedupe-index.json docs/RSA-Documents/LICENSE-REGISTER.md \
        docs/RSA-Documents/QUARANTINE.md
git commit -m "chore(harvest): refresh the Track A outputs after the bounded fetch round"

git add scripts/harvest-track-a-report.ts tests/discovery/harvest-track-a-report.test.ts \
        docs/RSA-Documents/track-a-harvest-report.md
git commit -m "feat(harvest): inventory-first ODD coverage and harvest precision report"
```

Rules: explicit `git add <paths>`, never `git add -A` (`AGENTS.md`, repo root); stage only what the ticket owns;
never stage `state/production-harvest-proof.json` (foreign lane, `.autoforge/execution/loop6-brief.md:45-46`);
never stage `.env*`, secrets or `.autoforge/` internals beyond the curated set.

## 8. Verification sequence (in order, **after** the three commits of §7)

```
npm run lint
npm run typecheck
npm test
npx tsx scripts/harvest-track-a.ts selftest
npx vitest run tests/discovery/robots.test.ts tests/discovery/harvest-track-a.test.ts
npx vitest run tests/discovery/harvest-track-a-report.test.ts
npx tsx scripts/harvest-track-a-report.ts
git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md
git status --porcelain          # must show no binary path
node scripts/vault-sync.mjs --check
```

The `git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md` line is only meaningful **after** the
report file is committed (git does not diff untracked paths) — hence the ordering: commits first, verification
after. Before the commits, use `git add docs/RSA-Documents/track-a-harvest-report.md` followed by
`git diff --cached --exit-code -- docs/RSA-Documents/track-a-harvest-report.md` to prove the file matches a fresh
run.

`git status --porcelain` must show no path under `docs/RSA-Documents/canada/`, `docs/RSA-Documents/quarantine/`
or `docs/RSA-Documents/.track-a/`, and no `*.pdf` (`.gitignore:76-79`). The pre-commit hook runs lint +
typecheck + vault determinism + YAML parse (`AGENTS.md`, repo root).

## 9. Recorded decisions

- **Gap 2 is a decision, not a task.** `corpus-catalog.json` is regenerated by
  `docs/RSA-Documents/scripts/build-catalog.py` on the operator's Mac; hand-editing it here would be overwritten.
  The labels the operator asked for exist in `docs/RSA-Documents/track-a-ondisk-inventory.jsonl`
  (`.autoforge/execution/loop6-brief.md:80-84`). Do not edit `corpus-catalog.json`.
- **The ODD stage mapping is fixed by `policies/canada/pack.json`**, not by the inventory labels
  (§3). `existing` / `pre-opening` / `unknown` are unmapped and reported with counts.
- **T1 never counts as coverage** (`.autoforge/requirements/grilling.md:10`, `:41`; §3 rule 2).
- **A sha256 present in both the inventory and the manifest is one document**, labelled by the manifest for
  tier/stage and by the inventory for class, and attributed to the fetched column (§3 rule 4).
- **The precision report has two denominators** — |A| (all rows) and |B| (Canadian subset) — and never mixes
  them (§3.1).
- **Module boundary ≠ child-session boundary**: M6 and M7 are separate modules with a dependency edge; they are
  not two halves of one worker session, and M7 must not start before M6's outputs are final.

## 10. Hazards this plan carries forward

| # | Hazard | Handling |
|---|---|---|
| H1 | Split file written from fresh records only (`scripts/harvest-track-a.ts:664-678`) | M6 step 1 + regression test (step 2) |
| H2 | Staging file gitignored and absent (`.gitignore:78`, `scripts/harvest-track-a.ts:587-593`) | `intake` exits early and touches nothing; the committed split file must already satisfy the invariant |
| H3 | Binaries fetched here live in this container, not the operator's Mac | M6 step 7 label + PR body "Provenance" |
| H4 | Never write outside the worktree | M6 out-of-scope; the operator checkout is absent here |
| H5 | Binaries and extracted text never enter git | `.gitignore:76-79`; `git status --porcelain` check |
| H6 | Explicit `git add`, never `-A`; vault determinism must pass | §7 commit list; §8 `vault-sync --check` |
| H7 | Never merge, never close/label the issue, never push another branch | M6 out-of-scope; the orchestrator opens the PR |
| H8 (derived) | Empty-batch intake appends a stray newline to the log and the manifest (`scripts/harvest-track-a.ts:646-647`, `:656-662`) | M6 step 3 write guards, checked in the acceptance criteria |
