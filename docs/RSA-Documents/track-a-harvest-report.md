# Track A harvest report — ODD coverage and harvest precision

Inputs (committed, read-only, no network and no model call):
- `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` — the operator's checkout: 304 inventoried rows (202 under the corpus root `docs/RSA-Documents/`, 102 elsewhere)
- `docs/RSA-Documents/canada-intake-manifest.jsonl` — the fetched Track A records: 3 rows
- `state/odd-coverage.json` — the ODD targets and priorities
- `docs/RSA-Documents/track-a-sources.json` — the source outcomes and the unfillable families
- `docs/RSA-Documents/LICENSE-REGISTER.md` — the per-directory licence verdicts

This report carries no timestamp: `npx tsx scripts/harvest-track-a-report.ts` regenerates it byte-identically.

## Rules applied

- A document is identified by its **sha256**.
- A **coverage candidate** is Canadian (one of the 13 `ca_province` codes, or `CAN-GOV`), tier **T3/T4**, and its stage maps to a canonical cell. **T0 and T1 never count as coverage.**
- An **inventory** row must additionally be `class == "rsa-sample"`. A **manifest-only** row (a sha256 the inventory does not hold) has no `class` field: it is classified from the fields the manifest carries — tier **T3/T4** -> `rsa-sample`, **T1** -> `methodology`, **T0** -> `unusable` — and qualifies on tier + cell_key alone (it already passed the RSA classifier).
- A sha256 present in **both** sources is counted **once** and attributed to the **fetched** column: the manifest wins for tier/stage, the inventory wins for class.
- A duplicate inventory row never carries a count; the primary row does.
- A `BLOCKED` manifest row never counts as coverage.
- **Licence.** A counted candidate carries the licence state of its source: the manifest's `licence_verdict` for a fetched document, else the verdict for its directory in `docs/RSA-Documents/LICENSE-REGISTER.md` (a directory the register does not list is `unknown`). A candidate whose licence is not **CLEAR** is **not usable for train or test until the owner signs off** — it is still counted, because the corpus's `canada/` shelf is RESTRICTED pending owner sign-off and dropping those candidates would zero every cell.
- **Labels.** Every inventory label is machine-derived, not audited: anchor 4, needs_review 134, rule 166 of 304 rows (`label_confidence` in the inventory). A `needs_review` label has never been checked by a human, and the coverage counts below inherit that.
- **Population.** A row is any document inventoried anywhere under the operator's checkout, not only the corpus: the rows outside the corpus root `docs/RSA-Documents/` are docs/references (22), tests/fixtures (77), tmp/harvest (3). The corpus root holds the other 202 inventory rows.
- **Where a fetched label came from.** The manifest does not record whether a fetched row's tier/stage was read out of the document or taken from the source's fallback (`stage_hint`; `doc_type_hint: complete-RSA` -> T3). Section 4 counts the fetched rows whose value equals the source's fallback.

Row sets (never mixed):
- **|A| = 305** — every **row** on record: the 304 inventory rows plus the manifest rows whose sha256 is not in the inventory. These are rows, not documents: the inventory holds repeated copies of the same sha256, so 36 of the rows are duplicate copies of another row. Denominator of the all-rows table (3a). Split by corpus membership: **203** under the corpus root `docs/RSA-Documents/`, **102** outside it.
- **|B| = 147** — the Canadian subset of A. Denominator of the Canadian table (3b) and of the in-scope share. Split by corpus membership: **128** under the corpus root, **19** outside it.

## 1. ODD coverage — inventory first, then the fetched documents

| ODD cell | Target | Priority | Have (documents) | Have (usable, CLEAR only) | On disk | Fetched | Candidate labels | Gap |
|---|---|---|---|---|---|---|---|---|
| canada:FEASIBILITY_CONCEPT | 13 | 0.9231 | 1 | 1 | 0 | 1 | needs_review 1 | 12 |
| canada:PRELIMINARY_DESIGN | 41 | 3 | 0 | 0 | 0 | 0 | none | 41 |
| canada:DETAILED_DESIGN | 41 | 3 | 1 | 0 | 1 | 0 | anchor 1 | 40 |

Targets and priorities are read from `state/odd-coverage.json`; the counts are distinct coverage-candidate documents, split by the source that supplied the label.

`Have (documents)` counts the coverage-candidate **documents** of this corpus, under the rules above (a duplicate copy never carries a count). It is **not** the server-side `have_total` of `state/odd-coverage.json`, which counts ODD **packages** (`have_total` / `have_full_package`): the two counters measure different things and can disagree for the same cell.

`Have (usable, CLEAR only)` counts the candidates whose licence is CLEAR. A candidate whose licence is not CLEAR is **not usable for train or test until the owner signs off** — the register's verdicts gate the C7/C8/C9 inputs, CLEAR only (`docs/RSA-Documents/LICENSE-REGISTER.md`, header). Such candidates are counted rather than dropped: the corpus's `canada/` shelf is RESTRICTED pending owner sign-off, and dropping them would zero every cell.

`Candidate labels` is the label-confidence breakdown of that cell's candidates (`anchor` / `rule` / `needs_review` in `docs/RSA-Documents/track-a-ondisk-inventory.jsonl`). No inventory label is audited, so the counts above stand on machine-derived labels.

`docs/RSA-Documents/track-a-coverage.md` is the **fetched-only** view of these cells (it counts the documents in `canada-intake-manifest.jsonl` whose `cell_key` matches — never what is on the operator's disk); this report is the **inventory-first** view (it counts the inventoried corpus as well as the fetched records). For `canada:DETAILED_DESIGN` the fetched-only file reads 0 and this report reads 1, because the one candidate is an on-disk document the fetched-only view cannot see.

Coverage candidates:
- `a24707c6081a279fa899064bc95dba02d1664993f3b8c7b6491654f20b74789d` — on-disk — T3 — detailed — canada:DETAILED_DESIGN — class `rsa-sample` — label confidence `anchor` — licence `RESTRICTED` — corpus root: yes — path `docs/RSA-Documents/canada/canadian/OC_Transpo_Transitway_RSA.pdf`
- `0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95` — fetched — T3 — FEASIBILITY_CONCEPT — canada:FEASIBILITY_CONCEPT — class `rsa-sample` — label confidence `needs_review` — licence `CLEAR` — corpus root: no — path `tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf`
- `0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95` is inventoried **outside** the corpus root, at `tests/fixtures/samples/CA/ab-neahd-planning-stage-rsa-2009.pdf` — a test fixture — and is byte-identical to the ingested corpus copy `docs/RSA-Documents/canada/track-a/ab-open/neahdappendixc.pdf`. That is why the cell reads `On disk 0 | Fetched 1`: the sha256 is in both sources, so it is counted once and attributed to the fetched column.

Reconciliation — shas present in both sources (counted once, attributed to the fetched column):
- `555848f63c690810661d7837b766ccb611f97ebe313a942bd413704745e947aa` — inventory: BC unknown/T0/methodology; manifest: BC UNSTAGED/T1 — counted once in no cell, fetched column.
- `0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95` — inventory: AB planning/T0/rsa-sample; manifest: AB FEASIBILITY_CONCEPT/T3 — counted once in canada:FEASIBILITY_CONCEPT, fetched column.

## 2. Unmapped stages

| Stage | Canonical cell | Rows in A | Rows in B |
|---|---|---|---|
| existing | none (unmapped) | 78 | 59 |
| pre-opening | none (unmapped) | 5 | 4 |
| unknown | none (unmapped) | 175 | 56 |
| UNSTAGED | none (unmapped) | 2 | 2 |
| MULTI_STAGE | none (unmapped) | 0 | 0 |
| PRE_OPENING | none (unmapped) | 0 | 0 |

`existing`, `pre-opening` and `unknown` (and the manifest's `UNSTAGED` / `MULTI_STAGE` / `PRE_OPENING`) have no canonical cell (`policies/canada/pack.json:76-83`), so they are reported here and are never coverage.

These counts use the **reconciled** label — the manifest wins for tier and stage, as in the rules above — so a row the manifest re-labels leaves its inventory stage column. Re-labelled here: `555848f63c690810661d7837b766ccb611f97ebe313a942bd413704745e947aa` (inventory `unknown` → manifest `UNSTAGED`) and `0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95` (inventory `planning` → manifest `FEASIBILITY_CONCEPT`). Those rows are counted under their reconciled label above, so the inventory's own stage counts (section 7) are higher for the stages they left.

## 3. Harvest precision

Two denominators, never mixed: the all-rows table uses **|A|**, the Canadian table uses **|B|**. `out-of-scope` exists only outside the Canadian subset, so it appears in 3a and not in 3b.

### 3a — all rows (denominator |A| = 305)

| class | count | share of A |
|---|---|---|
| duplicate | 36 | 11.8% |
| methodology | 28 | 9.2% |
| out-of-scope | 125 | 41.0% |
| rsa-sample | 59 | 19.3% |
| unusable | 57 | 18.7% |

### 3b — Canadian in-scope rows (denominator |B| = 147)

| class | count | share of B |
|---|---|---|
| duplicate | 11 | 7.5% |
| methodology | 25 | 17.0% |
| rsa-sample | 54 | 36.7% |
| unusable | 57 | 38.8% |

`out-of-scope` is explicitly absent from this table — every `out-of-scope` row sits outside the Canadian subset and is counted in 3a only.

In-scope share: 2 of 147 Canadian rows are coverage candidates (1.4% of |B|).

Population sensitivity: on the corpus-root cut of |B| (128 rows under `docs/RSA-Documents/`) 1 row is a coverage candidate (0.8%). The other counted candidate is inventoried only outside the corpus root (a test fixture); the corpus copy is the ingested file, which the inventory does not hold.

Tier cross-tab of the Canadian subset (a tier cut of row set B, not a class):

| tier | count | share of B |
|---|---|---|
| T0 | 89 | 60.5% |
| T1 | 28 | 19.0% |
| T3 | 23 | 15.6% |
| T4 | 7 | 4.8% |

T0 and T1 rows are reported here and count as coverage nowhere; only T3/T4 rows with a mapped stage and a qualifying class enter section 1.

## 4. Fetched-only precision — every row of the intake manifest

| sha256 | tier | stage | stage from | tier from | cell_key | province | split | licence | title |
|---|---|---|---|---|---|---|---|---|---|
| `0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95` | T3 | FEASIBILITY_CONCEPT | hint | hint | canada:FEASIBILITY_CONCEPT | AB | test | CLEAR | PLANNING STAGE |
| `84a70638ba6077885b2c17f94b36554cea4e65f9f001f7d0f8e1c1d0632a245b` | T1 | UNSTAGED | hint | rule | — | BC | restricted | RESTRICTED | Date: March 17, 2004 |
| `555848f63c690810661d7837b766ccb611f97ebe313a942bd413704745e947aa` | T1 | UNSTAGED | hint | rule | — | BC | restricted | RESTRICTED | Technical Circular T-02/04 |

Split disjointness check (per document: sha256 -> split): PASS — 3 document(s) checked, 0 with two splits.

Licence verdict breakdown of the manifest rows: CLEAR 1, RESTRICTED 2.

Stage provenance of the fetched rows: **3 of 3** carry the source's `stage_hint` verbatim and **1 of 3** carry tier T3, the value their source's `doc_type_hint: complete-RSA` forces. The manifest does not record which path was taken, so `hint` marks a possible fallback, not a proven one: `stage from hint` = the stage equals the source's `stage_hint` (the harvester's fallback when no stage rule matches the text), `tier from hint` = tier T3 under a source that declares `doc_type_hint: complete-RSA`, which forces T3 (`scripts/harvest-track-a.ts:478`).

`docs/RSA-Documents/track-a-duplicates.json` holds only the **2** rows staged before the hash skip moved ahead of staging: the skip happens at fetch time, so a document whose sha256 the corpus already holds never reaches the intake stage and never reaches the register. The register is **partial** — it does not mean "only 2 duplicates ever existed". The committed outcome blocks in `docs/RSA-Documents/track-a-sources.json` record **10** fetch-time `hash-already-present` skips: those documents were downloaded in full and then discarded (never re-ingested, never written to disk), and none of them is in the register.

## 5. Cells Track A cannot fill

### Unfillable families (13)

| Family | Host | Reason | Track input |
|---|---|---|---|
| Quebec provincial (Ville de Quebec / Quebec government) | www.quebec.ca | HTTP 403 bot protection on both robots.txt and the landing page for our neutral UA; no public listing reachable without a browser session. The ministry's CDN host (cdn-contenu.quebec.ca) and its document library (www.bv.transports.gouv.qc.ca) stay reachable and are harvested as source qc-mtl-transports. | Track B (operator) or Track C |
| Ottawa (open data portal) | open.ottawa.ca | JavaScript-only single page application; robots.txt returns 404; no server-rendered listing to read | Track C (headless browse) |
| Ottawa (eScribe meeting documents) | pub-ottawa.escribemeetings.com | Listing is a JS bundle (/bundles/MeetingList); no server-rendered document index | Track C (headless browse) |
| Manitoba open data portal | data.gov.mb.ca | DNS NXDOMAIN - portal retired | Track B (operator) or Track C |
| Manitoba government | www.gov.mb.ca | robots.txt disallows / for GPTBot, ClaudeBot, CCBot and Scrapy; neutral UA is permitted but the province is also the candidate held-out test geography, so Track A leaves it to the split rule rather than harvesting it | Track B (operator) or Track C |
| Saskatchewan open data | open.saskatchewan.ca | DNS NXDOMAIN | Track B (operator) or Track C |
| Saskatchewan government | www.saskatchewan.ca | Reachable, but the open-data listing path returns 404 and no document index is published | Track B (operator) or Track C |
| MRDC / MUNIAC (University of Manitoba transportation research) | www.muniac.ca | DNS NXDOMAIN; the entity is not referenced anywhere in the repo corpus | Track B (operator) or Track C |
| Prince Edward Island, Newfoundland and Labrador, and the territories | — | No public, no-login document listing identified for PE, NL, Yukon, NWT or Nunavut; the ODD matrix has no native stage for them either | Track B (operator) or Track C |
| Pre-opening stage audits (all provinces) | — | No public pre-opening RSA report found in the allowlisted portals; ca-tac:pre-opening has no canonical stage in policies/odd.json, so it cannot be mapped to a coverage cell | Track B (operator) or Track C |
| Montreal open data (Ville de Montreal) | donnees.montreal.ca | The portal publishes data (CSV/GeoJSON), not audit reports: the 20-dataset atom feed and the readable /group/transport listing carry no road safety audit document. The full catalogue is client-rendered and the CKAN API (/api/3/action/package_search) is robots-disallowed, so Track A can only reach known document URLs. The City's own policy documents are harvested as source qc-montreal-city instead. | Track C (headless browse) |
| City of Toronto | www.toronto.ca | www.toronto.ca/sitemap.xml is a sitemap index whose sub-sitemaps cover only the WordPress tree (no PDF URLs). The City's road safety audit reports live under /legdocs/mmis/<year>/<committee_code>/bgrd/backgroundfile-<id>.pdf; the directory has no listing, the ids are opaque and the council agenda service (secure.toronto.ca) answers 403 to a neutral UA. The reachable Vision Zero documents are road safety plans, not audits. | Track C (search engine) or Track B (operator) |
| UNB Transportation Group / MRDC | www.unb.ca | The host answers every request with a "UNB.ca temporarily unavailable" page: public-facing unb.ca sites are restricted to users inside the university network. The single known PDF (rsa-guidelines.pdf) was fetched by the first Track A run and is already in the manifest. | Track C (university agreement) |

### Canadian cells

| ODD cell | Target | Have (coverage candidates) | Zero count | Track input |
|---|---|---|---|---|
| canada:FEASIBILITY_CONCEPT | 13 | 1 | no | Track B (operator) or Track C |
| canada:PRELIMINARY_DESIGN | 41 | 0 | yes | Track B (operator) or Track C |
| canada:DETAILED_DESIGN | 41 | 1 | no | Track B (operator) or Track C |

`Have (coverage candidates)` is the same count as section 1 (licence state aside): a candidate whose licence is not CLEAR is not usable for train or test until the owner signs off.

## 6. Provenance

The inventoried documents live in the operator's checkout, not in this container; `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` is the committed stand-in for them. Binaries fetched by Track A live in the box-runner container under `docs/RSA-Documents/canada/track-a/**`, not in the operator's checkout, and no binary entered git.

## 7. Cross-check — inventory-only Canadian subset

| dimension | counts |
|---|---|
| rows | 146 |
| class | duplicate 11, methodology 24, rsa-sample 54, unusable 57 |
| stage | detailed 15, existing 59, planning 3, pre-opening 4, preliminary 8, unknown 57 |
| tier | T0 91, T1 26, T3 22, T4 7 |

These must reproduce `docs/RSA-Documents/track-a-ondisk-summary.json` (`deep_subset.canadian_in_scope_documents` and `deep_subset.canadian_in_scope_counts`).
