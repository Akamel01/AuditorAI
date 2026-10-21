# Track A harvest report — ODD coverage and harvest precision

Inputs (committed, read-only, no network and no model call):
- `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` — the operator's on-disk corpus: 304 rows
- `docs/RSA-Documents/canada-intake-manifest.jsonl` — the fetched Track A records: 3 rows
- `state/odd-coverage.json` — the ODD targets and priorities
- `docs/RSA-Documents/track-a-sources.json` — the unfillable families

This report carries no timestamp: `npx tsx scripts/harvest-track-a-report.ts` regenerates it byte-identically.

## Rules applied

- A document is identified by its **sha256**.
- A **coverage candidate** is Canadian (one of the 13 `ca_province` codes, or `CAN-GOV`), tier **T3/T4**, and its stage maps to a canonical cell. **T0 and T1 never count as coverage.**
- An **inventory** row must additionally be `class == "rsa-sample"`; a **manifest** row qualifies on tier + cell_key alone (it has no `class` field — it already passed the RSA classifier).
- A sha256 present in **both** sources is counted **once** and attributed to the **fetched** column: the manifest wins for tier/stage, the inventory wins for class.
- A duplicate inventory row never carries a count; the primary row does.
- A `BLOCKED` manifest row never counts as coverage; `RESTRICTED` rows stay in the corpus.

Row sets (never mixed):
- **|A| = 305** — every **row** on record: the 304 inventory rows plus the manifest rows whose sha256 is not in the inventory. These are rows, not documents: the inventory holds repeated copies of the same sha256, so 36 of the rows are duplicate copies of another row. Denominator of the all-rows table (3a).
- **|B| = 147** — the Canadian subset of A. Denominator of the Canadian table (3b) and of the in-scope share.

## 1. ODD coverage — inventory first, then the fetched documents

| ODD cell | Target | Priority | Have (documents) | On disk | Fetched | Gap |
|---|---|---|---|---|---|---|
| canada:FEASIBILITY_CONCEPT | 13 | 0.9231 | 1 | 0 | 1 | 12 |
| canada:PRELIMINARY_DESIGN | 41 | 3 | 0 | 0 | 0 | 41 |
| canada:DETAILED_DESIGN | 41 | 3 | 1 | 1 | 0 | 40 |

Targets and priorities are read from `state/odd-coverage.json`; the counts are distinct coverage-candidate documents, split by the source that supplied the label.

`Have (documents)` counts the coverage-candidate **documents** of this corpus, under the rules above (a duplicate copy never carries a count). It is **not** the server-side `have_total` of `state/odd-coverage.json`, which counts ODD **packages** (`have_total` / `have_full_package`): the two counters measure different things and can disagree for the same cell.

Coverage candidates:
- `a24707c6081a279fa899064bc95dba02d1664993f3b8c7b6491654f20b74789d` — on-disk — T3 — detailed — canada:DETAILED_DESIGN
- `0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95` — fetched — T3 — FEASIBILITY_CONCEPT — canada:FEASIBILITY_CONCEPT

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
| methodology | 27 | 8.9% |
| out-of-scope | 125 | 41.0% |
| rsa-sample | 60 | 19.7% |
| unusable | 57 | 18.7% |

### 3b — Canadian in-scope rows (denominator |B| = 147)

| class | count | share of B |
|---|---|---|
| duplicate | 11 | 7.5% |
| methodology | 24 | 16.3% |
| rsa-sample | 55 | 37.4% |
| unusable | 57 | 38.8% |

`out-of-scope` is explicitly absent from this table — every `out-of-scope` row sits outside the Canadian subset and is counted in 3a only.

In-scope share: 2 of 147 Canadian rows are coverage candidates (1.4% of |B|).

Tier cross-tab of the Canadian subset (a tier cut of row set B, not a class):

| tier | count | share of B |
|---|---|---|
| T0 | 89 | 60.5% |
| T1 | 28 | 19.0% |
| T3 | 23 | 15.6% |
| T4 | 7 | 4.8% |

T0 and T1 rows are reported here and count as coverage nowhere; only T3/T4 rows with a mapped stage and a qualifying class enter section 1.

## 4. Fetched-only precision — every row of the intake manifest

| sha256 | tier | stage | cell_key | province | split | licence | title |
|---|---|---|---|---|---|---|---|
| `0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95` | T3 | FEASIBILITY_CONCEPT | canada:FEASIBILITY_CONCEPT | AB | test | CLEAR | PLANNING STAGE |
| `84a70638ba6077885b2c17f94b36554cea4e65f9f001f7d0f8e1c1d0632a245b` | T1 | UNSTAGED | — | BC | restricted | RESTRICTED | Date: March 17, 2004 |
| `555848f63c690810661d7837b766ccb611f97ebe313a942bd413704745e947aa` | T1 | UNSTAGED | — | BC | restricted | RESTRICTED | Technical Circular T-02/04 |

Split disjointness check (per document: sha256 -> split): PASS — 3 document(s) checked, 0 with two splits.

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
