# Track A coverage (ticket #40)

Generated: 2026-10-21T22:55:03.532Z

Targets come from `state/odd-coverage.json` (cells[].target).
Fetched = documents in `canada-intake-manifest.jsonl` whose cell_key matches, never the server-side have_total.

Binaries fetched by this run live in the box-runner container (`docs/RSA-Documents/canada/track-a/**`, gitignored) - they are **not** in the operator's checkout (`/Users/akamel/Documents/AuditorAI`).

| ODD cell | target | fetched | complete (T3) | priority |
| --- | --- | --- | --- | --- |
| canada:FEASIBILITY_CONCEPT | 13 | 1 | 1 | 0.9231 |
| canada:DETAILED_DESIGN | 41 | 0 | 0 | 3 |
| canada:PRELIMINARY_DESIGN | 41 | 0 | 0 | 3 |

## Priority cells (ticket #40)

- rural + existing + complete + French
- transit + urban + complete
- pre-opening + complete
- PE, NL and the territories

The rural/urban, existing/new and language axes do not exist in the corpus taxonomy
(`docs/RSA-Documents/corpus-schema.md`), so these cells are reported as free-text notes
against the ODD cells above; see `track-a-sources.json` -> `unfillable` for the
source families that Track A cannot reach.

## Cells Track A could not fill

- `canada:DETAILED_DESIGN` — 0 documents fetched. Sources that cannot fill it: see the unfillable list below.
- `canada:PRELIMINARY_DESIGN` — 0 documents fetched. Sources that cannot fill it: see the unfillable list below.

## Unfillable source families (input for Track B and Track C)

| family | host | reason | track input |
| --- | --- | --- | --- |
| Quebec provincial (Ville de Quebec / Quebec government) | www.quebec.ca | HTTP 403 bot protection on both robots.txt and the landing page for our neutral UA; no public listing reachable without a browser session. The ministry's CDN host (cdn-contenu.quebec.ca) and its document library (www.bv.transports.gouv.qc.ca) stay reachable and are harvested as source qc-mtl-transports. | Track B (operator) or Track C |
| Ottawa (open data portal) | open.ottawa.ca | JavaScript-only single page application; robots.txt returns 404; no server-rendered listing to read | Track C (headless browse) |
| Ottawa (eScribe meeting documents) | pub-ottawa.escribemeetings.com | Listing is a JS bundle (/bundles/MeetingList); no server-rendered document index | Track C (headless browse) |
| Manitoba open data portal | data.gov.mb.ca | DNS NXDOMAIN - portal retired | Track B (operator) or Track C |
| Manitoba government | www.gov.mb.ca | robots.txt disallows / for GPTBot, ClaudeBot, CCBot and Scrapy; neutral UA is permitted but the province is also the candidate held-out test geography, so Track A leaves it to the split rule rather than harvesting it | Track B (operator) or Track C |
| Saskatchewan open data | open.saskatchewan.ca | DNS NXDOMAIN | Track B (operator) or Track C |
| Saskatchewan government | www.saskatchewan.ca | Reachable, but the open-data listing path returns 404 and no document index is published | Track B (operator) or Track C |
| MRDC / MUNIAC (University of Manitoba transportation research) | www.muniac.ca | DNS NXDOMAIN; the entity is not referenced anywhere in the repo corpus | Track B (operator) or Track C |
| Prince Edward Island, Newfoundland and Labrador, and the territories | - | No public, no-login document listing identified for PE, NL, Yukon, NWT or Nunavut; the ODD matrix has no native stage for them either | Track B (operator) or Track C |
| Pre-opening stage audits (all provinces) | - | No public pre-opening RSA report found in the allowlisted portals; ca-tac:pre-opening has no canonical stage in policies/odd.json, so it cannot be mapped to a coverage cell | Track B (operator) or Track C |
| Montreal open data (Ville de Montreal) | donnees.montreal.ca | The portal publishes data (CSV/GeoJSON), not audit reports: the 20-dataset atom feed and the readable /group/transport listing carry no road safety audit document. The full catalogue is client-rendered and the CKAN API (/api/3/action/package_search) is robots-disallowed, so Track A can only reach known document URLs. The City's own policy documents are harvested as source qc-montreal-city instead. | Track C (headless browse) |
| City of Toronto | www.toronto.ca | www.toronto.ca/sitemap.xml is a sitemap index whose sub-sitemaps cover only the WordPress tree (no PDF URLs). The City's road safety audit reports live under /legdocs/mmis/<year>/<committee_code>/bgrd/backgroundfile-<id>.pdf; the directory has no listing, the ids are opaque and the council agenda service (secure.toronto.ca) answers 403 to a neutral UA. The reachable Vision Zero documents are road safety plans, not audits. | Track C (search engine) or Track B (operator) |
| UNB Transportation Group / MRDC | www.unb.ca | The host answers every request with a "UNB.ca temporarily unavailable" page: public-facing unb.ca sites are restricted to users inside the university network. The single known PDF (rsa-guidelines.pdf) was fetched by the first Track A run and is already in the manifest. | Track C (university agreement) |

## Documents not mapped to a single ODD cell

| stage | tier | documents |
| --- | --- | --- |
| UNSTAGED | T1, T1 | 2 |

These documents are policy, guideline or multi-stage material: they state the RSA
process rather than report one audit, so they are not counted as cell coverage.

## Fetched but not ingested (duplicates)

| document | sha256 | reason | already in corpus |
| --- | --- | --- | --- |
| t02-04c.pdf | `75645c0e6de990fb…` | sha256 already in the corpus dedupe index | `quarantine/canadian-html-quarantine/t02-04c.pdf` |
| rsa-guidelines.pdf | `a04c48f4ef339e7d…` | sha256 already in the corpus dedupe index | `quarantine/canadian-html-quarantine/rsa-guidelines.pdf` |

## Split summary

| split | documents |
| --- | --- |
| test | 1 |
| restricted | 2 |

Test geography: QC, AB. No document appears in both train and test.
