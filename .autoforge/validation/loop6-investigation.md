# Loop-6 investigation — ticket #40, branch `oc/40`, HEAD `cc0fcd6`

Role: autoforge-investigator (read-only, adversarial, system level). Method: read the branch commits
(`8c026c3`, `076739d`, `83ae5c9`, `bfddf85`, `cc0fcd6`) against `913b4ba`, re-derived every headline
number from the committed inputs with independent scripts, and ran the local gates. No edits to
tracked files, no commits, no push, no network. The only file written is this report.

**VERDICT: `ISSUES_FOUND` — 0 critical, 8 major, 4 minor.**
**RECOMMENDATION: REPLAN (partial) — loop back to M7 (report script + report) and to the M6b
execution brief / PR-body skeleton. No new fetch round, no re-run of M6a.**

Why partial: the H1 split fix (M6a) is sound and the registers are intact (see *Checked clean*).
Every major finding lives in the M7 report layer or in wording that the PR body inherits, and each
one is a small, local, offline change. The one thing a replan must **not** do is another live fetch
round: the coverage gap is not a discovery problem (see M6b's own unfillable list, and finding M8).

---

## Findings — major

### M1 — The coverage table counts a `RESTRICTED` (Crown-copyright) document as coverage

`canada:DETAILED_DESIGN` "Have 1" is `a24707c6081a…` =
`docs/RSA-Documents/canada/canadian/OC_Transpo_Transitway_RSA.pdf`
(`docs/RSA-Documents/track-a-harvest-report.md:37`). The licence register puts source dir
`canadian` at **RESTRICTED** — "Provincial/municipal RSAs; Crown copyright, no blanket PD"
(`docs/RSA-Documents/LICENSE-REGISTER.md:12`), and the register's header says the verdicts
"gate C7/C8/C9 inputs (**CLEAR only**)" (`docs/RSA-Documents/LICENSE-REGISTER.md:2-4`).

The report's coverage rule has no licence dimension at all: `InventoryRow` carries no licence field
(`scripts/harvest-track-a-report.ts:36-45`), and the candidate test is
`canadian && (T3|T4) && cell !== null && klass === "rsa-sample" && !duplicate && !blocked`
(`scripts/harvest-track-a-report.ts:167-175`). Only `BLOCKED` is excluded
(`scripts/harvest-track-a-report.ts:126-128`, `:217`). So the report's rule line
"A `BLOCKED` manifest row never counts as coverage; `RESTRICTED` rows stay in the corpus"
(`docs/RSA-Documents/track-a-harvest-report.md:18`) leaves a Crown-copyright document counted as
*coverage* — i.e. as a document that fills a 41-document target.

Why it matters: the ticket's AC1 is a coverage table against the section-3 target. A cell "filled"
by a document that cannot enter the pipeline without owner sign-off is not filled.

**Fix.** Add the licence verdict to the coverage rule and to the report table (e.g. a
`Have (usable)` column = CLEAR-only, or mark the candidate row `RESTRICTED — sign-off required`).
The licence is derivable: `docs/RSA-Documents/LICENSE-REGISTER.md` maps a source dir to a verdict,
and `track-a-ondisk-inventory.jsonl` carries the source dir in `path`/`source_group`.

### M2 — The other coverage candidate is a **test fixture** outside the corpus root, and the table hides it

`canada:FEASIBILITY_CONCEPT` "Have 1" is `0af7ea584ae0…`. In the inventory that sha is
`tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf` — i.e. a **test fixture**, not a
corpus document (`docs/RSA-Documents/track-a-ondisk-inventory.jsonl:31` region; verified by
`path` field). The committed reconciliation confirms the population split: of the 304 inventoried
rows, **102 are outside the corpus root** (`docs/references` 22, `tests/fixtures` 77,
`tmp/harvest` 3) and only **202 are corpus documents**
(`docs/RSA-Documents/track-a-reconciliation.md:77-101`, drift row `on_disk_outside_corpus_root: 102`,
and the D1 section listing `tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf`).

The report hides this: a sha present in both sources is attributed to the **fetched** column
(`scripts/harvest-track-a-report.ts:145`, rule at `docs/RSA-Documents/track-a-harvest-report.md:16`),
so the table reads `On disk 0 | Fetched 1` (`docs/RSA-Documents/track-a-harvest-report.md:28`) even
though the operator's disk holds the file — as a fixture. And the "new" corpus copy
(`docs/RSA-Documents/canada/track-a/ab-open/neahdappendixc.pdf`, manifest row 1,
`local_path` in `docs/RSA-Documents/canada-intake-manifest.jsonl:1`) is **byte-identical to the
fixture** (same sha256).

The report also calls all 304 rows "the operator's on-disk corpus"
(`docs/RSA-Documents/track-a-harvest-report.md:4`) — the committed reconciliation says only 202 are
corpus documents.

Population sensitivity (my computation, sources below): on the corpus-root population the
Canadian rows are **127** (146 − 19 outside), so `|B|` would be 128 (127 + 1 manifest-only row) and
the in-scope share would be 2/128 = 1.6 %, not "2 of 147 … 1.4 %"
(`docs/RSA-Documents/track-a-harvest-report.md:84`). The FEASIBILITY cell would be **0** (its only
candidate is the fixture) and DETAILED would stay 1 (its candidate is in
`docs/RSA-Documents/canada/canadian/`).

**Fix.** State the population next to each number and report both cuts, e.g. add a
`source_group` dimension (corpus root vs `docs/references` / `tests/fixtures` / `tmp/harvest`) to
section 3 and to the coverage table, or restrict coverage to `source_group` starting with
`docs/RSA-Documents/` and say so in the rules block.

### M3 — The precision table hard-codes every manifest-only row as class `rsa-sample`, which mis-classifies a methodology document

`scripts/harvest-track-a-report.ts:151-165` creates the row for a manifest sha that is not in the
inventory with `klass: "rsa-sample"` (line 155) and no class evidence. Exactly one manifest row is
manifest-only: `84a70638ba60…` = `t02-04b.pdf`
(`docs/RSA-Documents/canada-intake-manifest.jsonl:2`).

That row's own manifest record says it is **not** an audit: `tier: "T1"`, `stage: "UNSTAGED"`,
`doc_type: "guide"`, `title: "Date: March 17, 2004"`. The harvester's own tier rule says T1 means
"a policy or guidelines document states the process; it is not an audit package"
(`scripts/harvest-track-a.ts:475-479`). Its sibling from the same source, `t02-04a.pdf`
(`555848f63c69…`), **is** in the inventory, so it inherits the inventory class `methodology`
(inventory row: class `methodology`, tier T0, stage `unknown`) and is counted as methodology.

So the two halves of one BC technical circular are counted in different classes purely because of
which file happens to be in the operator's checkout. Effect on the headline table (my computation
below): `rsa-sample` is overstated by 1 and `methodology` understated by 1 in both 3a
(60/27 → 59/28) and 3b (55/24 → 54/25).

The report's justification (`docs/RSA-Documents/track-a-harvest-report.md:15` — "a manifest row
qualifies on tier + cell_key alone … it already passed the RSA classifier") conflates two
questions: `isRsaDocument` decides *is this about road safety audit*; the class taxonomy decides
*is this a sample of a completed audit vs methodology* (`docs/RSA-Documents/track-a-reconciliation.md:10-24`
lists `methodology` and `rsa-sample` as distinct classes).

**Fix.** Derive the class for manifest-only rows from the row's own fields (T3/T4 + mapped stage →
`rsa-sample`; T1/T0 → `methodology`), and keep the manifest's `doc_type`/`tier` as the evidence.
Re-run the report; the precision shares move.

### M4 — The report states unaudited rule-derived labels as coverage facts, with no confidence disclosure

The inventory's own labelling quality is `anchor 4 / rule 166 / needs_review 134` of 304 rows
(44 % flagged `needs_review`) — committed in the inventory summary and the reconciliation
(`docs/RSA-Documents/track-a-reconciliation.md:68-73`, `label_confidence` table). **The word
`needs_review`, `label_confidence` and `rule` appear nowhere in
`docs/RSA-Documents/track-a-harvest-report.md`.** The report gives precision shares to 0.1 %
(`docs/RSA-Documents/track-a-harvest-report.md:67-93`) with no statement that the underlying labels
are machine-derived and 44 % unverified.

Both coverage candidates rest on such labels:

* `0af7ea584ae0…` — inventory label: `class rsa-sample`, **`tier T0`**, `label_confidence
  needs_review`; the report promotes it to T3 because "the manifest wins for tier"
  (`docs/RSA-Documents/track-a-harvest-report.md:42`). The manifest's T3 is itself source-derived
  (M5 below).
* `a24707c6081a…` — `label_confidence: anchor`, and the anchor is a **hard-coded 4-row table** in
  the builder script (`docs/RSA-Documents/scripts/build-ondisk-inventory.py:40-51`:
  `"OC_Transpo_Transitway_RSA.pdf" → class rsa-sample, tier T3, stage detailed, jurisdiction ON`),
  whose cited provenance `HARVESTING_PLAN.md#s1` is **not in the repo** (the harvester itself notes
  the file is absent, `scripts/harvest-track-a.ts:13-14`; `find` returns no such file). The same
  row's own text signal says `stage:text:in- service` (inventory `evidence` field), and `in- service`
  maps to `existing` for other rows (e.g. `6177283b6103…`, `existing`). Per the report's own rule
  `existing` is unmapped and never coverage (`docs/RSA-Documents/track-a-harvest-report.md:55`), so
  if the text signal is right, `canada:DETAILED_DESIGN` is 0 and the whole "Have 1" disappears.

**Fix.** Add a label-confidence block to the report (counts by `label_confidence`, and a per-candidate
`confidence` next to each coverage candidate), and qualify the coverage claim as
"rule/anchor-derived labels, N rows still `needs_review`". If the operator wants audited labels,
that is the M8/M9 input for the next loop.

### M5 — Tier and stage can be decided by the *source manifest*, not by the document, and the record does not say which happened

* `detectStage(text, hint)` falls back to the **source's** `stage_hint` when no stage rule matches
  (`scripts/harvest-track-a.ts:400-408`).
* `detectTier(text, docType)` returns **T3** whenever the *source* declares
  `doc_type_hint: "complete-RSA"` — `if (REPORT_SIGNAL.test(head) || docType === "complete-RSA")
  return "T3"` (`scripts/harvest-track-a.ts:478`), and `docType` is `source.doc_type_hint`
  (`scripts/harvest-track-a.ts:610`).

5 of the 9 committed sources declare `doc_type_hint: "complete-RSA"` and
`ab-publications-listing` declares `stage_hint: "FEASIBILITY_CONCEPT"`
(`docs/RSA-Documents/track-a-sources.json` — `ab-open`, `ab-publications-listing`,
`qc-montreal-open`, `toronto-legdocs`, `unb-transport`). Consequence: **every** RSA document
fetched from `ab-open` or `ab-publications-listing` is stamped `T3 / FEASIBILITY_CONCEPT`
regardless of its content. The manifest row for the only FEASIBILITY candidate has exactly that
shape: source `ab-open` (`stage_hint FEASIBILITY_CONCEPT`, `doc_type_hint complete-RSA`), manifest
`tier T3`, `stage FEASIBILITY_CONCEPT` (`docs/RSA-Documents/canada-intake-manifest.jsonl:1`).

Nothing in the manifest or the report records *provenance* of the tier/stage label, so a reader
cannot tell a document-derived label from a source-hint-derived one — and the report presents both
as audited facts.

**Fix.** Record `stage_source` / `tier_source` (`rule|hint|anchor`) in the intake record and in the
report, and exclude hint-derived rows from coverage (or count them in a separate column). This
matters for the *next* round, not only for the report.

### M6 — The PR body will claim "no hash re-downloaded"; the code downloads first and hashes after

The known-hash gate is **post-download**: the bytes are fetched, then hashed, then skipped
(`scripts/harvest-track-a.ts:547-561` fetch → `:561` `sha256Hex` → `:562-567` `hashSkipReason`
→ `continue`). The plan's PR-body skeleton will therefore publish a false claim:

> "- [x] 3. coverage table built from the inventory first, then fetch only to fill the gaps; **no
> hash re-downloaded**" — `.autoforge/plans/plan-loop6.md:473-475`

and `.autoforge/execution/M6b.md:34` repeats it: "already in the corpus (`hash-already-present`
→ **never re-downloaded**, never ingested)".

The truth, per the committed per-source outcome blocks
(`docs/RSA-Documents/track-a-sources.json`, `outcome.m6_skipped_hash_already_present`):
`ab-open` 1 + `ab-publications` 2 + `ab-publications-listing` 3 + `bc-moti` 4 = **10 documents
already in the corpus were downloaded in full and then discarded** (the count is the worker's; the
M6 review verified 3 of them against the container log, e.g. `neahdappendixc.pdf`,
`2004-rsa-guidelines-final-report.pdf`, `2004-rsa-implementation-plan-final-report.pdf`, whose shas
are all in the committed inventory — `0af7ea58…`, `8b12c2b4…`, `6177283…`). A sha256 gate cannot
avoid the transfer: the hash is only known after the bytes arrive.

**Fix.** Reword the PR-body line and M6b.md:34 to what the code does: "a document whose sha256 is
already in the corpus is never written to disk, never staged and never ingested (the bytes are
still transferred once, because the hash is only known after the download)". Keep the operator's
intent ("never re-ingested, never re-downloaded *into the corpus*") but do not claim the transfer
does not happen.

### M7 — `track-a-duplicates.json` can no longer record a duplicate, and the M6b round's three are in no register

The fetch path skips a known hash **before staging** (`scripts/harvest-track-a.ts:560-567`), so a
duplicate never reaches the staging file; the intake duplicate branch
(`scripts/harvest-track-a.ts:671-689`) is therefore unreachable for any duplicate the current
fetcher sees. `docs/RSA-Documents/track-a-duplicates.json` still holds only the **2** rows from the
pre-rule round (`t02-04c.pdf`, `rsa-guidelines.pdf`), while the committed outcome blocks record
**10** hash-already-present skips (M6) and M6b alone reports **3** more
(`.autoforge/execution/M6b.md:26-39`). The register's own note says it lists "Documents fetched by
Track A that were not ingested because their sha256 is already in the corpus" — so it is now
under-recording by design.

AC2 ("every fetched document in the download log, licence register and dedupe index") is therefore
not satisfied for the documents that were actually transferred and dropped in the M6 rounds.

**Fix.** Either record fetch-time duplicate skips (append to the register at fetch time, or stage a
"duplicate" record the intake can pick up), or change the register's `note` to state that it only
lists duplicates caught at intake, and move the M6/M6b skip counts into a committed round log (which
also closes the M6 review's N2). Do not overwrite the register per run either (M6 review N7).

### M8 — Two committed coverage tables disagree for the same cell, and the M6b brief is now stale

* `docs/RSA-Documents/track-a-coverage.md:13` — `canada:DETAILED_DESIGN | 41 | 0 | 0 | 3`
  (fetched-only view, regenerated by `report`).
* `docs/RSA-Documents/track-a-harvest-report.md:30` — `canada:DETAILED_DESIGN | 41 | 3 | Have 1 | On disk 1 | Fetched 0 | Gap 40`.

Both files are committed, both are cited by the plan's PR-body skeleton
(`.autoforge/plans/plan-loop6.md:452-455` points AC1 at the harvest report and mentions the
coverage file as the "fetch-round-only view"), and the two "have" numbers for the same cell are 0
and 1 with no cross-reference. `.autoforge/execution/M6b.md:51-53` also still states
"`canada:DETAILED_DESIGN` 0 / 41", which the M7 report contradicts.

**Fix.** Add one line under the coverage table pointing at the report and its population
("fetched-only; the inventory-first table is `track-a-harvest-report.md` §1"), and correct the
M6b.md line (or add a delta note pointing at M7).

---

## Findings — minor

### m1 — the `pack.json` citation supports only one of the three unmapped stages

The report cites "`existing`, `pre-opening` and `unknown` … have no canonical cell
(`policies/canada/pack.json:76-83`)" (`docs/RSA-Documents/track-a-harvest-report.md:55`).
`policies/canada/pack.json` defines exactly four native stages (planning, preliminary-design,
detailed-design, pre-opening); lines 76-83 are the **pre-opening** entry, whose
`canonical_stages` is `[]` (line 80). `existing` and `unknown` are inventory vocabulary with **no
entry at all** in `pack.json`. The claim is right, the citation is partial.
**Fix:** cite `policies/canada/pack.json:22-83` and say "the four native stages; only
pre-opening has an empty `canonical_stages`; `existing`/`unknown` are inventory vocabulary with no
native stage".

### m2 — province → split is a first-mention guess, and the "PASS" check cannot detect a wrong split

`detectProvince` scans the **whole** text for the first province name/alias that appears and never
cross-checks the source's `ca_province_hint` (`scripts/harvest-track-a.ts:416-432`); the province
then drives the train/test hold-out (`scripts/harvest-track-a.ts:357-360`, `TEST_PROVINCES =
["QC","AB"]`). A document that merely mentions "Alberta" in a comparison sentence before its own
province would land in the **test** geography (or, conversely, a QC document detected as ON would
land in **train**, contaminating the held-out geography). The report's only guarantee is
"Split disjointness check (per document: sha256 → split): PASS — 3 document(s) checked, 0 with two
splits" (`docs/RSA-Documents/track-a-harvest-report.md:105`), which proves only that no sha has two
labels — it cannot detect a mis-detected province.
**Fix:** prefer the source's `ca_province_hint` when the detected province disagrees, record the
detected vs hinted province in the manifest, and have the report show the disagreement (currently
the manifest shows no such column).

### m3 — the precision denominators silently include non-corpus material

`|A| = 305` / `|B| = 147` (`docs/RSA-Documents/track-a-harvest-report.md:21-22`) include **102** of
the 304 rows that live outside the corpus root (22 `docs/references`, 77 `tests/fixtures`,
3 `tmp/harvest`) and **19** of the 147 Canadian rows (7 + 11 + 1) — including 7 of them classed
`rsa-sample` and 5 of them T3/T4. My computation: `source_group` counts over the inventory are
`docs/RSA-Documents/{canada 54, intl 6, quarantine 74, usa 68}` + `docs/references 22 +
tests/fixtures 77 + tmp/harvest 3` = 304; the Canadian subset is 146 rows = 127 corpus-root + 19
outside. The committed reconciliation discloses the split
(`docs/RSA-Documents/track-a-reconciliation.md:77-101`), but the report does not, and 24 of the 36
"duplicate" rows in the precision table are fixture mirrors.
**Fix:** add a `source_group` (or corpus-root / not) dimension to section 3.

### m4 — the headline in-scope share is population-sensitive and the population is not stated

"In-scope share: 2 of 147 Canadian rows are coverage candidates (1.4 % of |B|)"
(`docs/RSA-Documents/track-a-harvest-report.md:84`) becomes 2/128 = 1.6 % on the corpus-root
population (M2/m3), and 0/13 for the FEASIBILITY cell on that population. The report's rules block
is careful about many things but never says which population "the corpus" is.
**Fix:** one sentence in the rules block: "rows = documents inventoried anywhere under the operator
checkout, including `docs/references`, `tests/fixtures` and `tmp/harvest` (102 of 304); the corpus
root holds 202 of them".

---

## Checked and found clean

* **No silent loss (attack surface 1).** Every register is **byte-identical** to `913b4ba`:
  `canada-intake-manifest.jsonl`, `canadian-download-log.tsv`, `track-a-split.json`,
  `track-a-duplicates.json`, `dedupe-index.json`, `LICENSE-REGISTER.md`, `QUARANTINE.md`,
  `corpus-catalog.json`, `corpus-inventory.json`, `track-a-ondisk-inventory.jsonl`,
  `track-a-ondisk-summary.json`, `track-a-reconciliation.md` — compared with
  `git show 913b4ba:<path> | sha256sum` vs `sha256sum <path>`; all 12 pairs identical.
  `dedupe-index.json` = 336 rows / 321 distinct shas, unchanged from `913b4ba` (verified by parsing
  both revisions); the 3 manifest shas are present exactly once each, with `project_id` and
  `split`. `LICENSE-REGISTER.md` has the two `canada/track-a/{ab-open,bc-moti}` rows; `QUARANTINE.md`
  unchanged (no BLOCKED doc).
* **H1 fix is real.** `runIntake` derives the split from the **full** manifest
  (`scripts/harvest-track-a.ts:668` `existingRecords = readIntakeManifest()`, `:729`
  `splitByProvince([...existingRecords, ...fresh])`). I re-derived the committed
  `track-a-split.json` from the 3 committed manifest rows with the shipped helper: identical
  (`JSON.stringify(committed.by_province) === JSON.stringify(splitByProvince(manifest))` → true).
  The empty-batch guards are present (`:706`, `:716`).
* **AC2 linkage is intact** for the 3 ingested documents: manifest ↔ download log (3 rows, same
  shas/project ids) ↔ dedupe index (3 rows with `project_id` + `split`) ↔ licence register rows.
* **AC3 disjointness holds** for what is recorded: AB → `test`, BC → `restricted`, no sha with two
  splits; the CLI selftest and the report both check it.
* **The report is byte-reproducible.** `tests/discovery/harvest-track-a-report.test.ts:178-180`
  asserts the committed file equals a fresh `buildReport(...)`; `npm test` at HEAD = **70 files,
  719 passed / 2 skipped (721)**, including that test, the 50 harvest-track-a tests and the 12
  robots tests.
* **Local gates green:** `npx tsx scripts/harvest-track-a.ts selftest` → "selftest passed";
  `npm run typecheck` → clean; `npm run lint` → clean.
* **No double counting of a sha** (attack surface 2): 304 inventory rows / 268 distinct shas; 36
  rows have `dup_of != null` and there is **no** sha with more than one `dup_of == null` row
  (checked over all 268 sha groups), so at most one row per sha can carry the `rsa-sample` class;
  a sha in both sources is merged into one row (`scripts/harvest-track-a-report.ts:132-165`) and
  counted once (verified by running the shipped `mergeRows` on the committed inputs: exactly **2**
  coverage candidates, one per cell).
* **The inventory's duplicate semantics are consistent**: `dup_of` is a *path*, and for all 36
  duplicate rows the sha of the copy equals the sha of the referenced primary (e.g.
  `a24707c6…` appears twice: `canada/canadian/OC_Transpo_Transitway_RSA.pdf` = primary
  (`rsa-sample`), `quarantine/…/OC_Transpo_Transitway_Road_Safety_Audit.pdf` = copy
  (`duplicate`, `dup_of` → the primary)).
* **Robots gate (attack surface 7).** The crawl delay is applied **before every request**, not
  only the first: `fetchText` (`scripts/harvest-track-a.ts:241-244`) and the fetch loop
  (`:529-536`) both compute `crawlDelayMs(robots)` and sleep per request; `robotsFor` caches per
  origin (`src/discovery/robots.ts:152-175`); `isAllowed` fails closed on unreadable robots
  (`:164-167`); the host budget enforces ≥1 request/s and ≤2 concurrent per host
  (`src/discovery/ratelimit.ts:4-5`, `:34-52`); the selftest asserts no source uses a
  robots-disallowed `/api/` listing (`scripts/harvest-track-a.ts:920-927`). The one gap I found
  here is cosmetic: the robots.txt request itself is not preceded by the crawl delay.
* **Git surface (attack surface 8).** `git diff --name-only 913b4ba..cc0fcd6` = 11 files, all
  text (2 briefs, 2 reports, 1 sources json, 2 scripts, 2 test files, 4 `.autoforge/execution/M-*.md`
  — all inside the curated set of `.autoforge/AGENTS.md`). No binary: `git ls-files
  docs/RSA-Documents | grep -icE "\.pdf$|track-a/"` → **0**; the binary paths are ignored
  (`.gitignore:76-79`). No secret-shaped string in the diff. `state/production-harvest-proof.json`
  is **not** in the branch diff (`git diff --stat 913b4ba..cc0fcd6 -- state/production-harvest-proof.json`
  → empty); it is dirty in the working tree by a foreign process, and
  `.autoforge/state.json` likewise (both uncommitted, unstageable — keep them out of any commit).
* **The unfillable list (attack surface 9) is not contradicted by the artefacts**: 13 families in
  `docs/RSA-Documents/track-a-sources.json`, reproduced verbatim in the report
  (`docs/RSA-Documents/track-a-harvest-report.md:109-125`) and in `track-a-coverage.md:33-49`; the
  report's section-5 cell table matches section 1. The genuine gap is not a missing source but
  M4/M5: the corpus already holds Canadian RSA samples (17 CA rows at T3/T4 `rsa-sample` in the
  `existing` stage, 5 in `unknown`) that the ODD taxonomy cannot express — the report quantifies
  them in section 2 (78/5/175 unmapped rows) but the coverage table never says "we already hold
  X Canadian T3/T4 RSA samples, they are simply unmapped".
* **Known from the M6/M7 reviews and re-verified here** (not new, listed so the orchestrator knows
  they stand): N1 (the M6b round covered 1 of 9 sources; the other `m6_*` counters are inherited),
  N2 (the per-skip evidence lives only in a container-local `/tmp` log — still true: no committed
  round log), N3 (PDF extraction warning folded into the "not RSA" reason — still true,
  `scripts/harvest-track-a.ts:569-585`), N7 (the duplicates register is a per-run snapshot — still
  true and now worse, see M7), N9 (the H3 note says "this run" in a permanent artefact — still true,
  `scripts/harvest-track-a.ts:791-792`), N11 (the selftest files `restricted`/`quarantine` under
  "test", `scripts/harvest-track-a.ts:970-975`).

---

## Could not be checked in this container

1. **Anything that needs the network** (explicitly forbidden here): the live robots posture and
   crawl delay of `open.alberta.ca`, `www2.gov.bc.ca`, `donnees.montreal.ca`, `ville.montreal.qc.ca`,
   `www.toronto.ca`, `cdn-contenu.quebec.ca`; the M6b round's 12 candidate URLs and their per-skip
   reasons (only the aggregate counters survive, in `track-a-sources.json`); the "DNS NXDOMAIN" and
   "HTTP 403" claims in the unfillable list; whether `www.muniac.ca` / `open.saskatchewan.ca` /
   `data.gov.mb.ca` really are gone.
2. **The M6b round's raw log** (`/tmp/m6b-fetch.log`, container-local, not committed) and the
   per-document skip reasons in it — so the "12 candidates / 9 not RSA / 3 hash-already-present"
   table in `.autoforge/execution/M6b.md:26-39` is unverified here (the M6 review verified it
   against that log while it existed).
3. **The operator's ~300 documents** (absent here) and the inventory builder
   `docs/RSA-Documents/scripts/build-ondisk-inventory.py` in its original form: the builder ran on
   the operator's Mac and cannot be re-run in this container, so the 304 rows, the 134
   `needs_review` labels and the 4-row anchor table can only be inspected, not re-derived. The
   builder's own self-check (its `problems` list, `build-ondisk-inventory.py:1089-1099`) was not
   re-run.
4. **`HARVESTING_PLAN.md` §1** (the anchor source cited by every `anchor` label, and the source of
   the T0–T4 ladder and of "section 3 targets" in the ticket) is **absent from the repo** — so the
   meaning of T3, of `complete-RSA`, and of the `anchor:HARVESTING_PLAN.md#s1` provenance cannot be
   verified here. This is why M1 and M4 are reported as "must be qualified", not "is wrong".
5. **`node scripts/vault-sync.mjs --check`** cannot run here (the script creates a temporary
   `git worktree`; `git-lfs` is not installed in this container — environmental, per
   `.autoforge/execution/M6a.md:88-93`). No `vault/` or `state/vault-notes.json` change is part of
   the branch, so CI must be the judge. I did not run it.
6. **The PR body itself** (the orchestrator opens the PR). I audited the skeleton in
   `.autoforge/plans/plan-loop6.md:442-490`; M6 and M8 are claims that skeleton will publish.
7. **The GitHub issue/PR state** (no network): I could not check whether #40 has earlier Track A
   PRs whose claims these artefacts contradict.

---

## Recommended loop-back (for the orchestrator)

| Order | Module | Action | Files |
|---|---|---|---|
| 1 | M7 | Add licence to the coverage rule/table (M1); state the population and add a corpus-root cut (M2, m3, m4); derive the class of manifest-only rows from tier/stage (M3); add a label-confidence block and per-candidate confidence (M4); record `stage_source`/`tier_source` and exclude hint-derived rows from coverage (M5) | `scripts/harvest-track-a-report.ts`, `tests/discovery/harvest-track-a-report.test.ts`, `docs/RSA-Documents/track-a-harvest-report.md` |
| 2 | M6b (doc only) | Correct "never re-downloaded" (M6); correct the stale `DETAILED_DESIGN 0/41` line (M8); record the duplicate skips in a committed round log (M7, and the M6 review's N2) | `.autoforge/execution/M6b.md`, `docs/RSA-Documents/track-a-sources.json` |
| 3 | M6a (doc/code, optional) | Prefer the recorded `split` when `licence_verdict` is absent; cross-check the detected province against the source hint (m2) | `scripts/harvest-track-a.ts` |
| 4 | PR body | Apply M6/M8 wording fixes to the skeleton before the PR is opened | `.autoforge/plans/plan-loop6.md` |

No new fetch round, no re-run of M6a, no change to the committed registers (they are correct).
