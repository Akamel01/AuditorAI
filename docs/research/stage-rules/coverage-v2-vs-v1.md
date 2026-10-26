# Stage coverage under rule set v2 versus v1

Ticket: `Akamel01/AuditorAI#62` — versioned stage rule set v2, corpus re-run, v2-vs-v1 coverage table, ambiguity list.

Inputs (committed, read-only, no network and no model call):
- `docs/research/stage-rules/stage-rules.v1.json` — the frozen v1 rule set (sha256 `28bffafa5a68936b34de4f054ff01f813c3cb9298239cc6768e05d3f5f081a3e`)
- `docs/research/stage-rules/stage-rules.v2.json` — the v2 rule set (sha256 `347bd328d910a924cc2b54b41a1c2dcce9b755942cc811377565712f3d920d8a`)
- `docs/RSA-Documents/canada-intake-manifest.jsonl` — the corpus of record: 33 rows (sha256 `74cd84dd4ccf7de15fe4741745f416a46c908f036a3dcdce2bbc5e9f8a98b391`)
- `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` — the operator's on-disk inventory: 304 rows
- `state/odd-coverage.json` — the ODD targets and priorities

This report carries no timestamp: `npx tsx scripts/harvest-stage-rules-v2.ts render --from docs/research/stage-rules/coverage-v2-vs-v1.json --out docs/research/stage-rules/coverage-v2-vs-v1.md` regenerates it byte-identically.

## 1. Scope and denominators

- The corpus of record is the **33** committed manifest rows: **9** tier T3, **24** tier T1, **12** rows carry a `ca_province`.
- Bodies: **32 of 33** rows have a cached body; **1** rows are title-only (no body text was fetched) and are classified from their title alone — they are never counted as if they had body evidence.
- **Two denominators, never mixed.** Table A's 10 / 3 / 0 are CELL OCCUPANCY over the 33 manifest rows; Table B's 1 / 0 / 1 are COVERAGE CANDIDATES over the merged 335 rows. Two different populations — never mixed.
- The v1 column is the **v1 rule file's verdict recomputed over the same text**, not a copy of the committed manifest stage; the committed value is recorded alongside (`stage_v1_committed`) and the per-row agreement (`v1_agreement`) is a finding, not a bug.

## 2. Table A — the re-classified corpus (denominator: the 33 manifest rows)

| ODD cell | target | priority | have (v1, committed) | have (v1, recomputed) | have (v2) | usable CLEAR (v1) | usable CLEAR (v2) | moved in | moved out | ambiguous (unadjudicated) | title-only rows |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `canada:FEASIBILITY_CONCEPT` | 13 | 0.9231 | 10 | 10 | 3 | 1 | 1 | 0 | 7 | 0 | 0 |
| `canada:PRELIMINARY_DESIGN` | 41 | 3 | 3 | 3 | 1 | 0 | 0 | 0 | 2 | 0 | 0 |
| `canada:DETAILED_DESIGN` | 41 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| (no cell) | — | — | 20 | 20 | 29 | 0 | 0 | 9 | 0 | 25 | 1 |

"moved" is **cell-level**: a row moved when its cell under v2 differs from its committed v1 cell. The ambiguous count and the title-only count sit on the `(no cell)` row, because an ambiguous row has no cell by construction.

## 3. Table B — merged corpus-of-record coverage (denominator: `mergeRows(inventory, manifest)` = 335 rows, counted with the repo's `coverage_candidate` predicate)

| ODD cell | target | priority | before have | after have | before usable (CLEAR) | after usable (CLEAR) | gap before | gap after | moved |
|---|---|---|---|---|---|---|---|---|---|
| `canada:FEASIBILITY_CONCEPT` | 13 | 0.9231 | 1 | 1 | 1 | 1 | 12 | 12 | unchanged |
| `canada:PRELIMINARY_DESIGN` | 41 | 3 | 0 | 0 | 0 | 0 | 41 | 41 | unchanged |
| `canada:DETAILED_DESIGN` | 41 | 3 | 1 | 1 | 0 | 0 | 40 | 40 | unchanged |

**No new document was fetched for v2 — every v2 cell is a re-labelling of an already-ingested document (newly fetched rows: 0).** 33 of 335 merged rows carry a v2 verdict; the other 302 inventory-only rows have no body in this repo, are not re-fetched, and keep their v1 stage and cell.
- The 2 coverage candidates are `0af7ea584ae0`, `a24707c6081a`; the "before have" column is the committed round-2 "after have" (1 / 0 / 1).

## 4. Movement detail (33 rows)

| sha256 (12) | tier | province | title | v1 committed | v1 recomputed | v1 agree? | body available | v2 kind | v2 primary stage | v2 candidates | v2 cell | moved | reason |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `0421ca4b9d06` | T1 | ON | APPENDIX H | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); DETAILED_DESIGN(inferred, CA-DETAIL, body); EXISTING(inferred, CA-EXISTING, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `0af7ea584ae0` | T3 | AB | PLANNING STAGE | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | agree | yes | single-stage | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT(authoritative, CA-FEAS, title) | `canada:FEASIBILITY_CONCEPT` | no | no cell change |
| `0d9a76ff4e71` | T3 | ON | Transitway Station Design | UNSTAGED | UNSTAGED | agree | yes | multi-stage | MULTI_STAGE | DETAILED_DESIGN(inferred, CA-AMBIG-PCT, body); PRELIMINARY_DESIGN(inferred, CA-AMBIG-PCT, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `1530d327c4c3` | T1 | QC | MINISTÈRE DES TRANSPORTS ET DE LA MOBILITÉ DURABLE | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); PRE_OPENING(inferred, CA-PREOPEN, body); EXISTING(inferred, CA-EXISTING, body); CONSTRUCTION(inferred, CA-CONSTR, body); PRELIMINARY_DESIGN(inferred, CA-PRELIM-FR, body); DETAILED_DESIGN(inferred, CA-DETAIL-FR, body) | — | yes | re-labelled by rule set v2: canada:FEASIBILITY_CONCEPT → (no cell) |
| `1d5879a68c55` | T1 | — | ROAD SAFETY AUDIT STAGE 1: SPRINT SCHEME | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, title); PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); DETAILED_DESIGN(inferred, CA-DETAIL, body); CONSTRUCTION(inferred, CA-CONSTR, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `299ac961228e` | T1 | — | A795 Ambridge Bypass | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); PRELIMINARY_DESIGN(inferred, CA-PRELIM, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `2b3115c3438b` | T1 | — | CCTT Briefing Note on Stage 3 Road Safety Audit for Trams to Newhaven Project | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); DETAILED_DESIGN(inferred, CA-DETAIL, title) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `2d4322f39383` | T1 | — | COMBINED STAGE 1 AND 2 ROAD SAFETY AUDIT DESIGNERS’ RESPONSE | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | agree | yes | single-stage | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT(interpreted, CA-FEAS, title) | `canada:FEASIBILITY_CONCEPT` | no | no cell change |
| `2d8e41b8631a` | T1 | — | DBFL Consulting Engineers | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); DETAILED_DESIGN(inferred, CA-DETAIL, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `2ea94190b6df` | T3 | NB | Proceedings of the 18th Canadian Multidisciplinary Road Safety Conference, Whistler, BC June 8-11, 2008 | PRE_OPENING | PRE_OPENING | agree | yes | multi-stage | MULTI_STAGE | DETAILED_DESIGN(inferred, CA-DETAIL, body); PRE_OPENING(inferred, CA-PREOPEN, body); EXISTING(inferred, CA-EXISTING, body); CONSTRUCTION(inferred, CA-CONSTR, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `3048eccbe2de` | T1 | NB | Transportation Association of Canada | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); DETAILED_DESIGN(inferred, CA-DETAIL, body); PRE_OPENING(inferred, CA-PREOPEN, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `32bced315fcd` | T1 | — | UNION ECONOMIQUE ET MONETAIRE | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); DETAILED_DESIGN(inferred, CA-DETAIL-FR, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `37863ef8e713` | T3 | — | VOLUME 4: ROAD SAFETY AUDITS Final Draft: 25 May 1999 6-1 | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); DETAILED_DESIGN(inferred, CA-DETAIL, body); PRE_OPENING(inferred, CA-PREOPEN, body); EXISTING(inferred, CA-EXISTING, body); CONSTRUCTION(inferred, CA-CONSTR, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `3b987d48a116` | T1 | — | DESIGNER’S RESPONSE | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | agree | yes | single-stage | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT(interpreted, CA-FEAS, body) | `canada:FEASIBILITY_CONCEPT` | no | no cell change |
| `478f0847ff25` | T1 | AB | A Process Management Approach to | UNSTAGED | UNSTAGED | agree | yes | multi-stage | MULTI_STAGE | DETAILED_DESIGN(inferred, CA-DETAIL, body); EXISTING(inferred, CA-EXISTING, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `555848f63c69` | T1 | BC | Technical Circular T-02/04 | UNSTAGED | UNSTAGED | agree | yes | no-stage | UNSTAGED | — | — | no | no cell change |
| `5d29a43bb076` | T1 | ON | City of Ottawa Project Agreement - Schedule 15-2 Part 2 | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); PRELIMINARY_DESIGN(inferred, CA-PRELIM, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `603f3f01f781` | T1 | — | Proposed Lidl Store: Mottingham Road Bromley | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); DETAILED_DESIGN(inferred, CA-DETAIL, body); EXISTING(inferred, CA-EXISTING, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `60d10b708b62` | T1 | — | Bessborough Housing Development Road Safety Audit – Stage 1 | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, title); DETAILED_DESIGN(inferred, CA-DETAIL, body) | — | yes | re-labelled by rule set v2: canada:FEASIBILITY_CONCEPT → (no cell) |
| `6c0ffc7cd483` | T1 | ON | M E M O / N O T E D E S E R V I C E | PRELIMINARY_DESIGN | PRELIMINARY_DESIGN | agree | yes | multi-stage | MULTI_STAGE | PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); EXISTING(inferred, CA-EXISTING, body) | — | yes | re-labelled by rule set v2: canada:PRELIMINARY_DESIGN → (no cell) |
| `7b9715f0d030` | T3 | — | Annex 6 – Road Safety Audit | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); DETAILED_DESIGN(inferred, CA-DETAIL, body); EXISTING(inferred, CA-EXISTING, body); CONSTRUCTION(inferred, CA-CONSTR, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `84a70638ba60` | T1 | BC | Date: March 17, 2004 | UNSTAGED | UNSTAGED | agree | yes | no-stage | UNSTAGED | — | — | no | no cell change |
| `a6e1a1e96a0b` | T1 | — | Road Safety Audit Stage 1 - | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, title); DETAILED_DESIGN(inferred, CA-DETAIL, body); EXISTING(inferred, CA-EXISTING, body) | — | yes | re-labelled by rule set v2: canada:FEASIBILITY_CONCEPT → (no cell) |
| `a7d0fc4ae596` | T1 | — | PROPOSED WORKS IN KILLORGLIN | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); EXISTING(inferred, CA-EXISTING, body) | — | yes | re-labelled by rule set v2: canada:FEASIBILITY_CONCEPT → (no cell) |
| `a8020b20b358` | T1 | ON | M E M O / N O T E D E S E R V I C E | PRELIMINARY_DESIGN | PRELIMINARY_DESIGN | agree | yes | multi-stage | MULTI_STAGE | PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); EXISTING(inferred, CA-EXISTING, body) | — | yes | re-labelled by rule set v2: canada:PRELIMINARY_DESIGN → (no cell) |
| `babe092a5473` | T1 | — | WAITEMATA GREENWAYS PRE-OPENING | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); DETAILED_DESIGN(inferred, CA-DETAIL, body); PRE_OPENING(inferred, CA-PREOPEN, title); CONSTRUCTION(inferred, CA-CONSTR, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `bc5880b404bd` | T1 | — | CONFIDENTIAL | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); DETAILED_DESIGN(inferred, CA-DETAIL, body) | — | yes | re-labelled by rule set v2: canada:FEASIBILITY_CONCEPT → (no cell) |
| `d16763daf5d4` | T1 | — | Note Méthodologique : audit de sécurité routière asr | UNSTAGED | UNSTAGED | agree | yes | no-stage | UNSTAGED | — | — | no | no cell change |
| `d4a57774fc55` | T3 | — | 23-160-006.01 | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); DETAILED_DESIGN(inferred, CA-DETAIL, body) | — | yes | re-labelled by rule set v2: canada:FEASIBILITY_CONCEPT → (no cell) |
| `e8810b8a08ac` | T3 | — | A795 Ambridge Bypass | PRELIMINARY_DESIGN | PRELIMINARY_DESIGN | agree | yes | single-stage | PRELIMINARY_DESIGN | PRELIMINARY_DESIGN(interpreted, CA-PRELIM, body) | `canada:PRELIMINARY_DESIGN` | no | no cell change |
| `ececad097781` | T3 | — | OCTOBER 2024 FINAL | MULTI_STAGE | MULTI_STAGE | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, body); PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); DETAILED_DESIGN(inferred, CA-DETAIL, body) | — | no | ambiguous: two or more candidates, no cell (never forced) |
| `ed2c0d694461` | T3 | — | Stage 1 Road Safety Audit | FEASIBILITY_CONCEPT | FEASIBILITY_CONCEPT | agree | yes | multi-stage | MULTI_STAGE | FEASIBILITY_CONCEPT(inferred, CA-FEAS, title); PRELIMINARY_DESIGN(inferred, CA-PRELIM, body); DETAILED_DESIGN(inferred, CA-DETAIL, body); EXISTING(inferred, CA-EXISTING, body) | — | yes | re-labelled by rule set v2: canada:FEASIBILITY_CONCEPT → (no cell) |
| `f5b7f30aa814` | T1 | — | FULL DAYS | UNSTAGED | UNSTAGED | agree | no (title-only) | no-stage | UNSTAGED | — | — | no | title-only row: no body text to scan, so the v1 verdict is the neutral fallback — a missing corpus, not a classifier finding |

**v1 findings.** 0 row(s) carry `v1_agreement: "disagree"` — the v1 rule file's verdict over the same text differs from the committed manifest stage. A disagreement is a finding, not a bug: it is itemised above and never silently reconciled. 0 row(s) differ from the LIVE harvester's `detectStage` (the frozen v1 rule file must reproduce it exactly).

## 5. Ambiguity (AC3)

**25** of 33 rows are ambiguous. The full list is `docs/research/stage-rules/ambiguous-v2.md`, byte-derivable from the committed sidecar alone.

| document (sha256) | real title | candidate 1 (stage · confidence · rule ids) | candidate 2 (stage · confidence · rule ids) | n candidates | scope_basis | cell if adjudicated at candidate 1 |
|---|---|---|---|---|---|---|
| `0421ca4b9d06` | APPENDIX H | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 4 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `0d9a76ff4e71` | Transitway Station Design | `DETAILED_DESIGN` · inferred · CA-AMBIG-PCT | `PRELIMINARY_DESIGN` · inferred · CA-AMBIG-PCT | 2 | own_scope | `canada:DETAILED_DESIGN` |
| `1530d327c4c3` | MINISTÈRE DES TRANSPORTS ET DE LA MOBILITÉ DURABLE | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRE_OPENING` · inferred · CA-PREOPEN | 6 | taxonomy_reference | `canada:FEASIBILITY_CONCEPT` |
| `1d5879a68c55` | ROAD SAFETY AUDIT STAGE 1: SPRINT SCHEME | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 4 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `299ac961228e` | A795 Ambridge Bypass | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `2b3115c3438b` | CCTT Briefing Note on Stage 3 Road Safety Audit for Trams to Newhaven Project | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | `DETAILED_DESIGN` · inferred · CA-DETAIL | 2 | own_scope | `canada:PRELIMINARY_DESIGN` |
| `2d8e41b8631a` | DBFL Consulting Engineers | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 3 | taxonomy_reference | `canada:FEASIBILITY_CONCEPT` |
| `2ea94190b6df` | Proceedings of the 18th Canadian Multidisciplinary Road Safety Conference, Whistler, BC June 8-11, 2008 | `DETAILED_DESIGN` · inferred · CA-DETAIL | `PRE_OPENING` · inferred · CA-PREOPEN | 4 | taxonomy_reference | `canada:DETAILED_DESIGN` |
| `3048eccbe2de` | Transportation Association of Canada | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | `DETAILED_DESIGN` · inferred · CA-DETAIL | 3 | taxonomy_reference | `canada:PRELIMINARY_DESIGN` |
| `32bced315fcd` | UNION ECONOMIQUE ET MONETAIRE | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `DETAILED_DESIGN` · inferred · CA-DETAIL-FR | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `37863ef8e713` | VOLUME 4: ROAD SAFETY AUDITS Final Draft: 25 May 1999 6-1 | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 6 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `478f0847ff25` | A Process Management Approach to | `DETAILED_DESIGN` · inferred · CA-DETAIL | `EXISTING` · inferred · CA-EXISTING | 2 | own_scope | `canada:DETAILED_DESIGN` |
| `5d29a43bb076` | City of Ottawa Project Agreement - Schedule 15-2 Part 2 | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `603f3f01f781` | Proposed Lidl Store: Mottingham Road Bromley | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 4 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `60d10b708b62` | Bessborough Housing Development Road Safety Audit – Stage 1 | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `DETAILED_DESIGN` · inferred · CA-DETAIL | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `6c0ffc7cd483` | M E M O / N O T E D E S E R V I C E | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | `EXISTING` · inferred · CA-EXISTING | 2 | own_scope | `canada:PRELIMINARY_DESIGN` |
| `7b9715f0d030` | Annex 6 – Road Safety Audit | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 5 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `a6e1a1e96a0b` | Road Safety Audit Stage 1 - | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `DETAILED_DESIGN` · inferred · CA-DETAIL | 3 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `a7d0fc4ae596` | PROPOSED WORKS IN KILLORGLIN | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `EXISTING` · inferred · CA-EXISTING | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `a8020b20b358` | M E M O / N O T E D E S E R V I C E | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | `EXISTING` · inferred · CA-EXISTING | 2 | own_scope | `canada:PRELIMINARY_DESIGN` |
| `babe092a5473` | WAITEMATA GREENWAYS PRE-OPENING | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | `DETAILED_DESIGN` · inferred · CA-DETAIL | 4 | own_scope | `canada:PRELIMINARY_DESIGN` |
| `bc5880b404bd` | CONFIDENTIAL | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `DETAILED_DESIGN` · inferred · CA-DETAIL | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `d4a57774fc55` | 23-160-006.01 | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `DETAILED_DESIGN` · inferred · CA-DETAIL | 2 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `ececad097781` | OCTOBER 2024 FINAL | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 3 | own_scope | `canada:FEASIBILITY_CONCEPT` |
| `ed2c0d694461` | Stage 1 Road Safety Audit | `FEASIBILITY_CONCEPT` · inferred · CA-FEAS | `PRELIMINARY_DESIGN` · inferred · CA-PRELIM | 4 | own_scope | `canada:FEASIBILITY_CONCEPT` |

## 6. No-cell buckets

| bucket | rows | note |
|---|---|---|
| `PRE_OPENING` | 0 | no Canadian cell (D12); `policies/canada/pack.json:75-89` defines no cell for it. |
| `EXISTING` | 0 | no Canadian cell (D12); an in-service audit has nowhere to move into. |
| `CONSTRUCTION` | 0 | no Canadian cell (D12); `policies/canada/pack.json:75-89` defines no cell for it. |
| `AMBIGUOUS` | 25 | two or more stage candidates: recorded with every candidate and assigned no cell (never forced). |
| `UNSTAGED` | 4 | no rule fired: the document names no stage (an asset cue alone never yields a stage). |
| `MULTI_STAGE` | 13 | v1's opaque token: every multi-stage document collapsed into one label with no cell. |

## 7. Caveats

> **Caveat 1 — this is a re-labelling, not new coverage.** The corpus of record is the 33 committed manifest rows (`docs/RSA-Documents/canada-intake-manifest.jsonl`): 9 tier-T3, 24 tier-T1, and only **12 rows carry a `ca_province`**. Only tier T3/T4 counts as coverage (`scripts/harvest-track-a-report.ts:363`), and only **3 of the 33 rows are Canadian and T3**. Every number below is a change to how an *existing* document is labelled, not a document that entered the corpus. The largest Canadian pool — 22 of the 30 Canadian T3/T4 documents on the operator's inventory — is in-service/`existing` audits, and `policies/canada/pack.json:75-89` defines no canonical cell for `existing` or `construction`, so a correct classifier still yields **zero** new coverage for them.

> **Caveat 2 — an ambiguous document has no cell, and is counted both ways.** A document that names two stages is recorded with **both** candidates and a confidence and is assigned no cell. The "v2 (primary)" column excludes such documents; the "v2 (incl. ambiguous)" column counts each at its primary candidate's cell. The gap between the two columns is exactly the set of documents a human must adjudicate.

> **Caveat 3 — a row can lose a cell.** v1 collapsed every multi-stage document to `MULTI_STAGE` (no cell). Under v2 some of those resolve to a single stage and gain a cell; others resolve to a genuinely ambiguous pair, or to a document that enumerates the stage taxonomy, and keep no cell. Both directions are itemised in §4. Rows also carry a licence state of 32 `RESTRICTED` / 1 `CLEAR`; a RESTRICTED document is counted but is **not usable for train or test** until the owner signs off (`scripts/harvest-track-a-report.ts:374`).

> **Licence.** 32 `RESTRICTED` / 1 `CLEAR`. No corpus body text is committed: the sidecar carries rule ids, short term quotes and source references only.

## 8. Reproduction and the reproducibility boundary

The exact commands:

- `npx tsx scripts/harvest-stage-rules-v2.ts selftest`
- `npx tsx scripts/harvest-stage-rules-v2.ts fetch --manifest docs/RSA-Documents/canada-intake-manifest.jsonl --cache .autoforge/tmp/stage-rules-v2-cache/`
- `npx tsx scripts/harvest-stage-rules-v2.ts compare --cache .autoforge/tmp/stage-rules-v2-cache/`
- `npx tsx scripts/harvest-stage-rules-v2.ts render --from docs/research/stage-rules/coverage-v2-vs-v1.json --out docs/research/stage-rules/coverage-v2-vs-v1.md`
- `npx tsx scripts/harvest-stage-rules-v2.ts render --from docs/research/stage-rules/classifications-v2.jsonl --ambiguous-out docs/research/stage-rules/ambiguous-v2.md`

- v1 rule set sha256: `28bffafa5a68936b34de4f054ff01f813c3cb9298239cc6768e05d3f5f081a3e`
- v2 rule set sha256: `347bd328d910a924cc2b54b41a1c2dcce9b755942cc811377565712f3d920d8a`
- manifest sha256: `74cd84dd4ccf7de15fe4741745f416a46c908f036a3dcdce2bbc5e9f8a98b391`

**The boundary, stated plainly:** the committed `coverage-v2-vs-v1.json`, `classifications-v2.jsonl` and `coverage-v2-vs-v1.md` are reproducible **offline** from the committed rule files and the committed manifest — no corpus and no network; only **re-deriving** them from scratch needs the gitignored corpus cache, which requires a network fetch. The md is byte-derivable from the json; the ambiguity list is byte-derivable from the committed sidecar alone (`render --from classifications-v2.jsonl --ambiguous-out ambiguous-v2.md`).

`render --from` accepts two forms, distinguished by the file's extension and, failing that, by its content shape: a `.json` companion is re-rendered into the coverage md (`--out`), a `.jsonl` sidecar is re-rendered into the ambiguity list (`--ambiguous-out`).
