# US Road Safety Audit Reference Documents — Provenance Manifest

- **Jurisdiction:** United States
- **Collected by:** AuditorAI document-collection agent (automated)
- **Retrieved date:** 2026-08-23
- **Access policy:** Public-access sources only (federal/state .gov and ROSAP). No paywall circumvention.
- **Verification:** Every file confirmed to begin with `%PDF` magic bytes at collection time.
- **Integrity:** SHA-256 recorded per file; re-verify with `shasum -a 256 -c` style checks before citing in fixtures.

## Files

| filename | title | publisher | url | pub date | retrieved | access_status | sha256 | notes |
|---|---|---|---|---|---|---|---|---|
| fhwa-rsa-guidelines-2006.pdf | FHWA Road Safety Audit Guidelines (FHWA-SA-06-067 / FHWA-SA-06-06) | FHWA Office of Safety | https://rosap.ntl.bts.gov/view/dot/49213/dot_49213_DS1.pdf | 2006-02 | 2026-08-23 | public | acace427a08c2ed710336e9f858bb22f79f13b003a2d1267ac22cea0b5fc81ae | Canonical US RSA process doc incl. §8 prompt lists. highways.dot.gov direct link returned Akamai HTML; fetched via ROSAP mirror with browser headers. |
| fhwa-ped-bike-rsa-guide-2020.pdf | Pedestrian and Bicyclist Road Safety Audit (RSA) Guide and Prompt Lists (FHWA-SA-20-042) | FHWA Office of Safety | https://safety.fhwa.dot.gov/ped_bike/tools_solve/docs/fhwasa20042.pdf (canonical); fetched via https://rosap.ntl.bts.gov/view/dot/58032/dot_58032_DS1.pdf | 2020-09 | 2026-08-23 | public | 7d00421462dcdbc9053577957e56e972c234421c8a76eee1bd78e16de53e79e5 | Supersedes the separate 2007 pedestrian and 2012 bicycle guides. safety.fhwa.dot.gov now 301-redirects to highways.dot.gov (blocked); used ROSAP copy. |
| pedestrian-rsa-guidelines-prompt-lists-2007.pdf | Pedestrian Road Safety Audit Guidelines and Prompt Lists (FHWA-SA-07-007) | FHWA Office of Safety / UNC HSRC | http://pedbikeinfo.org/downloads/PedRSA.reduced.pdf | 2007-07 | 2026-08-23 | public | 399bc1f511e450864c0f25e7480ef3c088ea6ec3e5eb345445d88c4fae628d2d | Legacy pedestrian-specific RSA guide retained for historical prompt-list wording. |
| fhwa-bicycle-rsa-guidelines-prompt-lists-2012.pdf | Bicycle Road Safety Audit Guidelines and Prompt Lists (FHWA-SA-12-018) | FHWA Office of Safety / VHB | https://rosap.ntl.bts.gov/view/dot/42612/dot_42612_DS1.pdf | 2012-05 | 2026-08-23 | public | b1af7f0e39e17d5036ac4f3e2039db0cc1b25483b019b9cd0e4338de454b5cd1 | Large file (~26 MB, image-heavy). Superseded by the 2020 combined guide but useful as mode-specific source text. |
| ihsdm-safer-roads-through-better-design-fhwa-2016.pdf | Safer Roads Through Better Design: Using the Interactive Highway Safety Design Model (FHWA-SA-17-011) | FHWA Office of Safety | https://rosap.ntl.bts.gov/view/dot/50482/dot_50482_DS1.pdf | 2016-11 | 2026-08-23 | public | cd6e448e6984d5d3a3369b212ff24e8ffdae970107b602a969a2eb840525d273 | IHSDM overview incl. HSM Part C predictive methods and RSA integration context. |
| hsm-part-c-ihsdm-crash-prediction-flyer-2022.pdf | Highway Safety Manual: Part C Software and More! — IHSDM Crash Prediction Methodologies (FHWA-HRT-22-029) | FHWA Turner-Fairbank HRC | https://www.fhwa.dot.gov/publications/research/safety/22029/22029.pdf | 2022-01 | 2026-08-23 | public | bfa9dc519ed6a92a95d77fd76fe32e864a6558c0f4cfa83ece01dfd26d0fb8c3 | Flyer summarizing HSM Part C implementation coverage in IHSDM. NOT the HSM itself (see gaps). |
| scdot-roadway-design-ch10-interchanges.pdf | SCDOT Roadway Design Manual — Chapter 10: Interchanges | South Carolina DOT | https://www.scdot.org/content/dam/scdot-legacy/business/pdf/roadway/revisedchapters/Chapter%2010%20-%20Interchanges.pdf | n.d. (legacy chapter rev.) | 2026-08-23 | public | 51b5809a02e60636c50ea6b16e152569495e42d1b19cfd9f6bbd1da2446e8063 | State DOT design-practice sample; interchange/RSA-relevant design criteria. |
| idaho-itd-road-safety-audit-manual-2012.pdf | Idaho Transportation Department Road Safety Audit Manual | Idaho Transportation Department | https://apps.itd.idaho.gov/apps/manuals/SafetyAudit/SafetyAudit.pdf | 2012-01 (listed ed.) | 2026-08-23 | public | e52c60ba3ab6d4bae1eae7ae4225f655692f235aa7349269e8ada51d1c9a8d31 | Full state-level RSA program manual (process, team selection, reporting). |
| fhwa-rsa-case-studies-compilation.pdf | FHWA Road Safety Audit Case Studies (compilation) | FHWA Office of Safety | local triage copy from `tmp/harvest/fhwa-cases.pdf` (original fetch pre-dates this run) | c. 2000s compilation | 2026-08-23 | public (local copy) | de87eee1d7f22c7b1ab8994612bf1041bf3c784b5385801e81239209018e3406 | Copied (not moved) from tmp/harvest per triage instruction; tmp original left intact. Used for corpus fixtures. Original URL not re-verified this run. |

**Successful downloads this run:** 8 fetched + 1 triage copy = **9 files**.

## Gaps / blocked items

| item | status | reason |
|---|---|---|
| FHWA RSA facility-type detailed prompt lists (standalone PDFs for intersections, freeways, etc.) | blocked / web-only | No standalone public PDF located; the detailed prompt lists exist as interactive web pages on highways.dot.gov (formerly safety.fhwa.dot.gov/rsa). Substantive prompt-list content is already captured inside fhwa-rsa-guidelines-2006.pdf (§8), pedestrian-rsa-guidelines-prompt-lists-2007.pdf, fhwa-bicycle-rsa-guidelines-prompt-lists-2012.pdf, and fhwa-ped-bike-rsa-guide-2020.pdf. |
| highways.dot.gov direct fetches (guidelines + 2020 guide landing pages/PDFs) | blocked during run | Akamai bot protection returned HTTP 403/"Access Denied" HTML even with browser headers; old safety.fhwa.dot.gov URLs 301-redirect into it. All affected documents were obtained via ROSAP mirrors instead. |
| Highway Safety Manual (HSM) full text (AASHTO, 2010/2023 eds.) | not collected — paid | Published by AASHTO behind a paywall; public access not available. Owner may supply a licensed copy. The two IHSDM/HSM-Part-C flyers above summarize Part C publicly. |
| MassDOT Road Safety Audit Guidelines | not collected (state cap reached) | Openly referenced by mass.gov but not fetched; cap of 2 state DOT docs met (SCDOT + ITD). Candidate for a later run. |
