# Harvest round 2 report — ODD coverage, harvest precision, source yield and remaining gaps

Ticket: `Akamel01/AuditorAI#60` — Harvest round 2: free, wide search for public Canadian RSAs.
Parent map: `#41`. Predecessor: `#40` (PR #58, merged) — its report is `docs/RSA-Documents/track-a-harvest-report.md`.

Inputs (committed, read-only, no network and no model call):
- `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` — the operator's checkout: 304 inventoried rows
- `docs/RSA-Documents/canada-intake-manifest.jsonl` — the intake manifest: 33 rows (3 from round 1, 30 from round 2)
- `docs/RSA-Documents/track-a-round2-candidates.json` — the committed candidate list: 108 candidate URLs
- `docs/RSA-Documents/track-a-round2-candidate-log.tsv` — the per-candidate outcome log: 108 rows
- `docs/RSA-Documents/track-a-round2-sources.json` — the round-2 source list of record
- `state/odd-coverage.json` — the ODD targets and priorities
- `docs/RSA-Documents/LICENSE-REGISTER.md` — the per-directory licence verdicts
- `docs/RSA-Documents/track-a-round2-bytes.json` — the byte accounting for the 5 GB cap

This report carries no timestamp: `npx tsx scripts/harvest-track-a-round2-report.ts` regenerates it byte-identically.

The counting rules are the round-1 rules, unchanged, so before and after are comparable:
- a document is identified by its **sha256**; a sha256 in both the inventory and the manifest is counted **once** and attributed to the **fetched** column;
- a **coverage candidate** is Canadian (one of the 13 `ca_province` codes, or `CAN-GOV`), tier **T3/T4**, and its stage maps to a canonical cell; **T0 and T1 never count as coverage**;
- a manifest-only row is classified from its tier (T3/T4 -> `rsa-sample`, T1 -> `methodology`, T0 -> `unusable`);
- a candidate whose licence is not **CLEAR** is counted but is **not usable** for train or test until the owner signs off.

## 0. What round 2 did

- **108** candidate URLs were examined; **108** of them were reached by the harvester (robots-permitted, at most 1 request per second per host).
- **30** documents were ingested (bytes written to the gitignored corpus shelf, rows appended to the intake manifest).
- **0** new coverage candidate(s) were created.
- The free-model pool was **not** used for triage. The free-model pool (http://ollama-gen-lb:11434) does not resolve from the runner, and the box runner's two concurrent run slots were occupied by other runs, so no pool probe could complete. Tier, stage, class and every coverage count are decided by the deterministic rules.

## 1. AC1 — ODD coverage versus the targets, before and after

"Before" is the corpus at the round-1 state (the manifest rows without `round: "2"`); "after" is the same corpus with the round-2 rows added. The rule set is identical, so the two are comparable.

| ODD cell | target | priority | before have | after have | before usable (CLEAR) | after usable (CLEAR) | gap before | gap after | moved |
|---|---|---|---|---|---|---|---|---|---|
| `canada:FEASIBILITY_CONCEPT` | 13 | 0.9231 | 1 | 1 | 1 | 1 | 12 | 12 | unchanged |
| `canada:PRELIMINARY_DESIGN` | 41 | 3 | 0 | 0 | 0 | 0 | 41 | 41 | unchanged |
| `canada:DETAILED_DESIGN` | 41 | 3 | 1 | 1 | 0 | 0 | 40 | 40 | unchanged |

**Priority cells** (from `state/odd-coverage.json`):

- `canada:DETAILED_DESIGN` — priority 3, target 41: 1 before, 1 after — **unchanged**.
- `canada:PRELIMINARY_DESIGN` — priority 3, target 41: 0 before, 0 after — **unchanged**.
- `canada:FEASIBILITY_CONCEPT` — priority 0.9231, target 13: 1 before, 1 after — **unchanged**.

`have` counts **documents**; the server-side `have_total` of `state/odd-coverage.json` counts ODD **packages** (`have_total` / `have_full_package`). The two counters measure different things and can disagree for the same cell — the round-1 report carries the same caveat.

> **Honest zero.** Round 2 ingested documents but created **0 new coverage candidates**. The coverage table above is **unchanged**: no cell gap closed. The deliverable of this round is the precision, yield and gaps evidence below, not a coverage gain.

### Near misses — Canadian T3/T4 documents that did not become coverage

A document is fetched and classified T3/T4 but still misses a cell. The reason is stated for each, because it says where the bottleneck is — the search, the classifier, the stage vocabulary or the licence.

| document | tier | stage | province | why it is not coverage |
|---|---|---|---|---|
| Transitway Station Design | T3 | `UNSTAGED` | ON | stage `UNSTAGED` maps to no canonical cell |
| Annex 6 – Road Safety Audit | T3 | `MULTI_STAGE` | — | not Canadian (province `unknown`) |
| A795 Ambridge Bypass | T3 | `PRELIMINARY_DESIGN` | — | not Canadian (province `unknown`) |
| Stage 1 Road Safety Audit | T3 | `FEASIBILITY_CONCEPT` | — | not Canadian (province `unknown`) |
| VOLUME 4: ROAD SAFETY AUDITS Final Draft: 25 May 1999 6-1 | T3 | `MULTI_STAGE` | — | not Canadian (province `unknown`) |
| OCTOBER 2024 FINAL | T3 | `MULTI_STAGE` | — | not Canadian (province `unknown`) |
| Proceedings of the 18th Canadian Multidisciplinary Road Safe | T3 | `PRE_OPENING` | NB | stage `PRE_OPENING` maps to no canonical cell |
| 23-160-006.01 | T3 | `FEASIBILITY_CONCEPT` | — | not Canadian (province `unknown`) |

## 2. AC2 — Harvest precision per class

Two denominators, never mixed. **|A|** = every row on record (inventory rows + manifest rows whose sha256 the inventory does not hold): **305** before, **335** after (**+30**). **|B|** = the Canadian subset: **147** before, **156** after (**+9**).

### 2a — all rows (denominator |A'|)

| class | count | share |
|---|---|---|
| rsa-sample | 67 | 20.0% |
| methodology | 50 | 14.9% |
| out-of-scope | 125 | 37.3% |
| duplicate | 36 | 10.7% |
| unusable | 57 | 17.0% |

Round 1 held 59 `rsa-sample` rows of 305; round 2 holds 67 of 335.

### 2b — Canadian in-scope rows (denominator |B'|)

| class | count | share |
|---|---|---|
| rsa-sample | 56 | 35.9% |
| methodology | 32 | 20.5% |
| duplicate | 11 | 7.1% |
| unusable | 57 | 36.5% |

`out-of-scope` exists only outside the Canadian subset, so it appears in 2a and not in 2b. A T0/T1 row is never a coverage candidate, and a methodology report is never an RSA sample.

### 2c — the round-2 funnel (denominator: candidate URLs examined)

Precision for a harvest round is measured over the candidates examined, not over the corpus. The classes below are the funnel classes of this round; they are NOT the corpus class taxonomy of 2a/2b.

| funnel class | count | share of candidates examined |
|---|---|---|
| rsa-sample (ingested, Canadian, T3/T4, stage mapped) | 0 | 0.0% |
| rsa-sample (ingested, T3/T4 — not Canadian, or stage unmapped) | 8 | 7.4% |
| methodology | 22 | 20.4% |
| unusable (T0) | 0 | 0.0% |
| out-of-scope | 39 | 36.1% |
| duplicate (fetch-time hash skip) | 18 | 16.7% |
| not-fetched | 21 | 19.4% |
| **total** | **108** | 100.0% |

A **fetch-time hash skip** is a document whose bytes were downloaded in full and then discarded: the known-hash gate runs after the response arrives, so the corpus never re-ingests it and never writes it to disk. It is a different mechanism from the round-1 `duplicate` class (an inventory copy) and the two numbers are never summed.

Every candidate that was not ingested, by reason:

| reason | candidates |
|---|---|
| hash-already-present | 18 |
| http 403 | 1 |
| not RSA | 39 |
| not a pdf | 7 |
| robots (robots.txt HTTP 403) | 7 |
| robots (robots.txt HTTP 429) | 1 |
| robots (robots.txt HTTP 503) | 4 |
| robots (robots.txt fetch failed: fetch failed) | 1 |

## 3. AC3 — Source yield

Source **type** is the closed taxonomy of the round-2 source list. Every ingested document maps to exactly one type; no document is counted under two types and no sha256 is counted under two cells.

| source type | hosts tried | candidate URLs seen | candidates rejected | docs ingested | in-scope Canadian RSA T3/T4 | licence state of ingested | yield % |
|---|---|---|---|---|---|---|---|
| `municipal-agenda-package` | 4 | 11 | 6 | 5 | 0 | RESTRICTED | 0.0% |
| `ea-class-ea-study` | 22 | 26 | 12 | 14 | 0 | RESTRICTED | 0.0% |
| `university-repository` | 2 | 4 | 3 | 1 | 0 | RESTRICTED | 0.0% |
| `conference-proceedings` | 1 | 7 | 5 | 2 | 0 | RESTRICTED | 0.0% |
| `provincial-ministry-report` | 7 | 49 | 46 | 3 | 0 | RESTRICTED | 0.0% |
| `open-data-portal` | 1 | 3 | 3 | 0 | 0 | — | 0.0% |
| `direct-known-document` | 8 | 8 | 3 | 5 | 0 | RESTRICTED | 0.0% |

A source type that produced nothing still appears above with explicit zeros; a type that was never reached is named in the list above rather than given a fabricated row.

## 4. AC4 — The gaps free sources cannot fill (input for the ATIP fallback)

Each row names the family, the mechanism that still blocks it, how it was verified this round, the cells it costs, and the Track B (ATIP) ask. The Track B ask names a province, a stage and a document type, because the ODD cells are stage-keyed — an ask without a stage is not actionable.

| family | host | why still unfillable (mechanism) | how it was verified this round | cells affected | Track B (ATIP) ask: province + stage + document type + issuing body |
|---|---|---|---|---|---|
| Quebec provincial (Ville de Quebec / Quebec government) | www.quebec.ca | HTTP 403 bot protection on both robots.txt and the landing page for our neutral UA; no public listing reachable without a browser session. The ministry's CDN host (cdn-contenu.quebec.ca) and its document library (www.bv.transports.gouv.qc.ca) stay reachable and are harvested as part of r2-ministry. | re-attempted: `bv.transports.gouv.qc.ca/mono/` (the ministry's own document library) answered and was harvested as part of r2-ministry; `www.quebec.ca` still answers 403 to a neutral UA | canada:PRELIMINARY_DESIGN | Quebec — all stages (planning, preliminary design, detailed design, pre-opening) — completed road safety audit reports (audit de sécurité routière) including the designer/owner response appendix, for every project in the MTQ road network: Ministere des Transports et de la Mobilite. |
| Ottawa (open data portal) | open.ottawa.ca | JavaScript-only single page application; robots.txt returns 404; no server-rendered listing to read. Round 2 searches for Ottawa documents through the search channel instead, which reaches document URLs directly. | re-attempted: the portal is still a JS-only single page application with a 404 robots.txt, but Ottawa documents were reached through `documents.ottawa.ca` (r2-municipal) and four Ottawa council documents were fetched | canada:PRELIMINARY_DESIGN | Ontario — all stages — completed road safety audit reports for City of Ottawa road projects, with the designer/owner response appendix: City of Ottawa, Clerk's office. |
| Ottawa (eSCRIBE meeting documents) | pub-ottawa.escribemeetings.com | Listing is a JS bundle (/bundles/MeetingList); no server-rendered document index | re-attempted: the meeting list is still a JS bundle with no server-rendered index; the Granicus and eSCRIBE candidates in the round-2 list were fetched and their robots decisions recorded | canada:PRELIMINARY_DESIGN | Ontario — all stages — completed road safety audit reports filed as council agenda appendices: City of Ottawa. |
| Manitoba open data portal | data.gov.mb.ca | DNS NXDOMAIN - portal retired | not re-attempted: `data.gov.mb.ca` is a retired portal (DNS NXDOMAIN) and Manitoba is a candidate held-out geography, so it is left to the split rule | canada:PRELIMINARY_DESIGN | Manitoba — all stages — completed road safety audit reports for provincial highway and municipal road projects, with the designer/owner response appendix: Manitoba Transportation and Infrastructure. |
| Manitoba government | www.gov.mb.ca | robots.txt disallows / for GPTBot, ClaudeBot, CCBot and Scrapy; neutral UA is permitted, but Manitoba is also a candidate held-out test geography, so it is left to the split rule and NOT harvested in round 2 | not re-attempted: Manitoba is a candidate held-out test geography, so it is deliberately left to the split rule rather than harvested into train | canada:PRELIMINARY_DESIGN | Manitoba — all stages — completed road safety audit reports for provincial highway and municipal road projects, with the designer/owner response appendix: Manitoba Transportation and Infrastructure. |
| Saskatchewan open data | open.saskatchewan.ca | DNS NXDOMAIN | not re-attempted: the portal is retired (DNS NXDOMAIN) and no replacement index is published | canada:PRELIMINARY_DESIGN | Saskatchewan — all stages — completed road safety audit reports for provincial highway and municipal road projects, with the designer/owner response appendix: Saskatchewan Ministry of Government and Public Services / Ministry of Transportation. |
| Saskatchewan government | www.saskatchewan.ca | Reachable, but the open-data listing path returns 404 and no document index is published | re-attempted: the ministry and open-data paths were queried; no document index is published and no RSA document was reachable | canada:PRELIMINARY_DESIGN | Saskatchewan — all stages — completed road safety audit reports for provincial highway and municipal road projects, with the designer/owner response appendix: Saskatchewan Ministry of Transportation. |
| MRDC / MUNIAC (University of Manitoba transportation research) | www.muniac.ca | DNS NXDOMAIN; the entity is not referenced anywhere in the repo corpus | not re-attempted: the host does not resolve (DNS NXDOMAIN) and the entity appears nowhere in the corpus | canada:PRELIMINARY_DESIGN | Manitoba — all stages — completed road safety audit reports and the studies that carry them: Manitoba Transportation and Infrastructure, and the University of Manitoba transportation research group (MRDC/MUNIAC). |
| Prince Edward Island, Newfoundland and Labrador, and the territories | — | No public, no-login document listing identified for PE, NL, Yukon, NWT or Nunavut; the ODD matrix has no native stage for them either | re-attempted: no provincial index for PE, NL, YT, NWT or NU was reachable; the search channel returned no candidate from those hosts | canada:PRELIMINARY_DESIGN | PE, NL, YT, NT, NU — all stages — completed road safety audit reports for provincial highway and municipal road projects, with the designer/owner response appendix: the respective provincial Departments of Transportation. |
| Pre-opening stage audits (all provinces) | — | ca-tac:pre-opening has no canonical stage in policies/odd.json, so a pre-opening RSA can never enter a coverage cell even when found. This is a structural gap, not a search failure. | re-attempted: one pre-opening RSA was found and fetched (`waitemata-greenways-pre-opening-road-safety-audit.pdf`, New Zealand — out of scope) and one Canadian pre-opening document was ingested, but `ca-tac:pre-opening` has no canonical stage, so neither can enter a cell. This is a structural gap, not a search failure | canada:PRELIMINARY_DESIGN | All provinces — pre-opening stage — completed pre-opening road safety audit reports (including the designer/owner response appendix) for every project opened to traffic, plus the ODD cell definition for the pre-opening stage, which does not exist yet. |
| Montreal open data (Ville de Montreal) | donnees.montreal.ca | The portal publishes data (CSV/GeoJSON), not audit reports; the full catalogue is client-rendered and the CKAN API is robots-disallowed. Round 2 reaches Montreal document URLs through the search channel instead. | re-attempted: the CKAN API is still robots-disallowed and the catalogue is still client-rendered; the open-data enumeration over `open.alberta.ca` was tried and the Montreal candidates were still reached by URL | canada:PRELIMINARY_DESIGN | Quebec — all stages — completed road safety audit reports for City of Montreal street projects, with the designer/owner response appendix: Ville de Montreal, Service des transports. |
| City of Toronto | www.toronto.ca | www.toronto.ca/sitemap.xml is a sitemap index whose sub-sitemaps cover only the WordPress tree (no PDF URLs). The City's road safety audit reports live under /legdocs/mmis/<year>/<committee_code>/bgrd/backgroundfile-<id>.pdf; the directory has no listing, the ids are opaque and the council agenda service answers 403 to a neutral UA. Round 2 reaches Toronto document URLs through the search channel instead. | re-attempted: the sitemap index still covers only the WordPress tree and the agenda service still answers 403; no Toronto candidate was reachable | canada:PRELIMINARY_DESIGN | Ontario — all stages — completed road safety audit reports filed as city council agenda appendices (the /legdocs/mmis/ background files), with the designer/owner response appendix: City of Toronto, City Clerk. |
| UNB Transportation Group / MRDC | www.unb.ca | The host answers every request with a 'UNB.ca temporarily unavailable' page to public-facing UAs. The single known PDF (rsa-guidelines.pdf) was fetched by the first Track A run and is already in the manifest. | re-attempted: `unb.ca` answered this round (two UNB documents were fetched, one of them a hash skip) — the earlier "temporarily unavailable" page was transient | canada:PRELIMINARY_DESIGN | New Brunswick — all stages — completed road safety audit reports published by the UNB Transportation Group: University of New Brunswick. |

## 5. Provenance, limits and what round 2 could not do

### Discovery channels

| discovery channel | candidates |
|---|---|
| enumeration | 33 |
| operator-discovery-pass | 75 |

**A general web search was not available to a robots-compliant, keyless, free runner from this environment.** Every engine either disallows `/search` for generic agents in its robots.txt (`www.bing.com`, `www.ecosia.org`), answers with a CAPTCHA or an anti-bot challenge (`html.duckduckgo.com`, `www.startpage.com`, `www.mojeek.com`, `searx.be`), or needs a paid API key (agent-reach's Exa backend). The full channel table is in `.autoforge/execution/M1.md`. The `operator-discovery-pass` candidates were therefore located during the operator's discovery pass and are **not reproducible by the committed script**; every one of them is fetched by the harvester from its origin host under the robots, rate, hash and licence gates. Closing that gap needs one thing: a free `EXA_API_KEY`, which enables the repo's existing `agent-reach-search` provider with no new code.

### The 5 GB cap

- cap 5368709120 bytes (5 GiB) over the whole corpus on the runner, per document at most 104857600 bytes (100 MiB); the corpus held 149080 bytes before this round and 51326572 after; 51177492 bytes were downloaded; 0 candidate(s) were refused with reason `byte-cap`.

### What this round could not do

- It could not run a general web search (see above), so the search space is the two channels, not the whole web.
- It could not filter the MTQ document library by title: `bv.transports.gouv.qc.ca/mono/` publishes 6511 PDFs under opaque numeric names with no index, so a sweep of it is a budget question, not a search question.
- It did not use a model for triage: the free-model pool does not resolve from the runner.
- It did not harvest Manitoba, and it did not change the split rule: the code holds QC + AB as the test geography, and Manitoba is left to the split rule.
- It did not extend the English stage vocabulary. Two Canadian T3 documents (the OC Transpo `Transitway Station Design Safety Audit` and the UNB conference paper) name no stage word the classifier recognises, so they land in `UNSTAGED` / `PRE_OPENING` and never reach a cell. The stage vocabulary — not the search — is the bottleneck for those documents. Mapping `Station Design Safety Audit` to a stage is ambiguous between preliminary and detailed design, and changing the rule set would invalidate the before/after comparison of this report, so it belongs in its own ticket.

The manifest, the inventory, the licence register and the candidate list are the inputs; nothing in this report is computed from an uncommitted file, and regenerating it leaves the committed file byte-identical.
