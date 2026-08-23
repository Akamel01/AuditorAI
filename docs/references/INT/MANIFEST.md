---
jurisdiction: INT
updated: 2026-08-23
scope: Official PIARC (World Road Association) road-safety-audit reference documents
collection_policy: PUBLIC ACCESS ONLY — no login circumvention, no DRM removal
---

# INT Reference Manifest — PIARC

Provenance record for official PIARC road-safety-audit material collected for AuditorAI.
Retrieved 2026-08-23. Access statuses reflect what an anonymous visitor could obtain on
that date.

**Key finding:** PIARC has moved its entire publication store (`www.piarc.org/ressources/publications/…`,
order-library full texts) behind a **free visitor login** (302 → `/en/log-in.htm`; direct GET returns an
HTML "Identification" page). The Road Safety Manual site (`roadsafety.piarc.org`) wraps all chapter-PDF
routes through `/en/user/login` and returns HTTP 403 anonymously. Only the legacy Paris 2007 congress
proceedings subdomain still serves files openly. All blocked targets below were verified individually,
never bypassed.

## Archived documents

| filename | title | publisher | url | publication_date | retrieved_date | access_status | sha256 | notes |
|---|---|---|---|---|---|---|---|---|
| `2023R40EN-Road-Safety-Audit-Guidelines-for-Road-Projects-PIARC-Technical-Report.pdf` | Road Safety Audits Guidelines for Road Projects — A PIARC Technical Report (2023R40EN) | PIARC Technical Committee 3.1 Road Safety (2020–2023 cycle) | listing: https://www.piarc.org/en/order-library/43787-en-Road%20Safety%20Audits%20Guidelines%20for%20Road%20Projects%20-%20A%20PIARC%20Technical%20Report · canonical file: https://www.piarc.org/ressources/publications/source/1/10b79047-43796-2023R40EN-Road-Safety-Audit-Guidelines-for-Road-Projects-PIARC-Technical-Report.pdf | 2023 (ISBN 978-2-84060-828-1, 79 pp.) | owner-provided (pre-existing) | owner-provided (in-repo LFS) | `a2518aa20d160b533fe13743c562a934c465a3d5e030ef48c90cdbd28a70c430` | Supersedes 2011R01 as current RSA guideline. Appendices contain auditor prompt lists per stage + RSA report template. File is AESv2-encrypted (opens normally; protection left intact per policy). 85 pp. as bound. Canonical URL itself is now login-gated — do not re-fetch without account. |
| `piarc-congress2007-paris-sp20-rsa-guidelines-presentation-fournier.pdf` | PIARC Guidelines for Road Safety Audits (Special Project session SP20, paper 3) — Lise Fournier, MTQ / TC 3.1 | PIARC — XXIIIrd World Road Congress, Paris 2007 proceedings | https://proceedings-paris2007.piarc.org/ressources/files/1/Presentation-SP20-3-FOURNIER.pdf | 2007-10 | 2026-08-23 | open | `966795095c4e6a54375800d1586f818dcdce2284da77e4cdb424d557a4c8db64` | 25 slides, PDF 1.4, not encrypted (qpdf: linearized; benign hint-table warnings only). Contemporaneous official summary of the RSA process, costs/benefits, stage structure, and the checklist framework (8 sections: Function / Cross Section / Alignment / Intersections / Public & Private Services / VRU / Signing & Marking / Roadside Features) later formalized in 2011R01 and mirrored by the 2009 Catalogue. |

## Blocked targets (verified, not fetched)

| intended filename | title | publisher | url | publication_date | retrieved_date | access_status | sha256 | notes |
|---|---|---|---|---|---|---|---|---|
| `piarc-rsm-ch10-risks-issue-identification.pdf` | Road Safety Manual — Ch. 10 Risks & Issue Identification (entire chapter, incl. Appendix 10.4 checklists) | PIARC — Road Safety Manual (online ed., part-PDF v2025-05-28) | chapter: https://roadsafety.piarc.org/en/planning-design-operation/risks-issue-identification · pdf routes: `/en/node/403/pdf/current-page.pdf`, `/system/files/pdf/piarc_planning_design_operation_2025_05_28_v2025_en.pdf` | online (v2025) | 2026-08-23 | blocked:requires PIARC visitor login (HTTP 403 anonymous; both PDF routes login-wrapped) | — | "Entire chapter" asset is a single combined Planning-Design-Operation volume (chapters 7–12), not per-chapter files. Open HTML version of the chapter exists on the site (see harvest note below). |
| `piarc-rsm-ch11-intervention-selection.pdf` | Road Safety Manual — Ch. 11 Intervention Selection and Prioritisation | PIARC — Road Safety Manual | https://roadsafety.piarc.org/en/planning-design-operation/intervention-selection/intervention-selection | online (v2025) | 2026-08-23 | blocked:requires PIARC visitor login (same gated combined PDF as Ch. 10) | — | |
| `piarc-rsm-ch8-designing-for-road-users.pdf` | Road Safety Manual — Ch. 8 Designing for Road Users | PIARC — Road Safety Manual | https://roadsafety.piarc.org/en/planning-design-operation/designing-for-road-users | online (v2025) | 2026-08-23 | blocked:requires PIARC visitor login (same gated combined PDF as Ch. 10) | — | Chapter landing verified reachable as open HTML; PDF download gated. |
| `piarc-rsa-guideline-2011r01-safety-checks-new-road-projects.pdf` | Road safety audit guidelines for safety checks of new road projects (2011R01, bilingual FR/EN) | PIARC Technical Committee 3.1 Road Safety | listing: https://www.piarc.org/en/order-library/6851-en-… · full text: https://www.piarc.org/ressources/publications/7/6857,2011R01FR-EN-Securite-Routiere-Road-Safety-World-Road-Association-Mondiale-Route.pdf (1.7 MB) · ToC: https://www.piarc.org/ressources/publications/7/6852,WEB-2011R01-TM.pdf | 2011 (ISBN 2-84060-199-0, 385 pp.) | 2026-08-23 | blocked:requires PIARC visitor login (GET returns "Identification" HTML; HEAD shows 302 → `/en/log-in.htm`) | — | Old detail URL `publications.piarc.org/en/search/detail.htm?publication=7629` is dead (404) — content moved to order-library id 6851. Historically important for stage checklists/prompt lists even though superseded by 2023R40EN. |
| `piarc-catalogue-design-safety-problems-countermeasures-2009r07.pdf` | PIARC catalogue of design safety problems and potential countermeasures (2009R07) | PIARC Technical Committee 3.1 Road Safety | listing: https://www.piarc.org/en/order-library/6458-en-PIARC%20Catalogue%20of%20design%20safety%20problems%20and%20potential%20countermeasures · full text: https://www.piarc.org/ressources/publications/5/6464,2009R07.pdf (4.1 MB) · ToC: https://www.piarc.org/ressources/publications/5/6459,TM2009R07.pdf | 2009 (ISBN 2-84060-227-X, 169 pp.) | 2026-08-23 | blocked:requires PIARC visitor login (GET returns "Identification" HTML) | — | 8 problem groups match 2011R01 checklist sections. A control probe of another `/ressources/publications/` file (2016R34EN, publicly linked from TRB slides since 2018) also returns the login page — gating is store-wide, not per-title. |
| — | XXVI World Road Congress (Abu Dhabi 2019), session S-1983 "Barriers to effective road safety audit": IP0104 Feasibility of RSAs & Inspections in Chile · IP0208 Efforts in Mexico to Implement an RSA System (+ poster) · IP0248 Multifactorial driver-distraction model · IP0500 Proposal for a road safety approach, Algerian network | PIARC congress proceedings | https://proceedings-abudhabi2019.piarc.org/en/documents/individual-papers/s-1983.htm (files under `/ressources/files/{3,4,6}/…`) | 2019 | 2026-08-23 | blocked:requires congress-proceedings site login ("XXVI World Road Congress — Identification"; file GETs return login HTML) | — | Listing page is open; full texts gated. IP0208 is the journal-version sibling of the Routes/Roads article "Efforts in Mexico to Implement a Road Safety Audit System". |
| — | XXVII World Road Congress (Prague 2023) individual papers (RSA-related topics) | PIARC congress proceedings | e.g. https://proceedings-prague2023.piarc.org/en/documents/Challenges-and-solutions-for-rural-roads-13709 → `/ressources/files/source/…pdf` | 2023 | 2026-08-23 | blocked:requires site identification (cookie-consent/login gate before downloads) | — | |

## Related-blocked (adjacent PIARC RSA toolkit, same wall)

- **Road safety inspection guidelines for safety checks of existing roads (2012R27EN)** — companion to 2011R01; order-library full text login-gated.
- **Vulnerable road users: Diagnosis of design and operational safety problems and potential countermeasures (2016R34EN)** — catalogue-style VRU supplement; login-gated (control probe confirmed).

## Gaps & how to close them

Wanted-but-blocked, in priority order:

1. **RSM Ch. 10 / 11 / 8 chapter PDFs** — blocked: requires PIARC visitor login.
2. **RSA Guideline 2011R01 (full bilingual text)** — blocked: requires PIARC visitor login.
3. **Catalogue of Design Safety Problems 2009R07 (full text)** — blocked: requires PIARC visitor login.
4. **Abu Dhabi 2019 S-1983 RSA papers** — blocked: separate congress-proceedings login.

**Remedy for all:** PIARC accounts are free. Register at the Road Safety Manual's "Register"
page (<https://roadsafety.piarc.org/node/3> — self-service form; footer CTA "Create your free
account to access the additional media materials"). The same credentials log in at
<https://www.piarc.org/en/log-in.htm>, unlocking `/ressources/publications/…` downloads
(order-library ids 6851, 6458, 43796…) and the RSM chapter PDF routes. There is **no**
self-service registration on `www.piarc.org` itself (only organizational membership).

**Owner-discretion alternative (not used by this run):** the Internet Archive Wayback Machine
holds snapshots of several of these PDFs from before the paywall went up (e.g. older
Road Safety Manual chapter PDFs, `publications.piarc.org` era files). Fetching third-party
archives of currently-gated publisher content was judged outside this run's public-access-only
rule; left to owner judgment.

## Notes

- **Harvest scratch triage:** `tmp/harvest/piarc-ch10.txt` and `tmp/harvest/piarc.txt` contain
  extracted plain text of the RSM Ch. 10 web pages (open HTML edition, incl. RSA, RSI,
  impact-assessment, iRAP sections). They correspond to the gated chapter PDF above and remain
  a usable interim text source for Ch. 10 until the owner registers and fetches the official
  chapter PDF. Not copied into `docs/references/` by this run.
- **Surprises / drift found during collection:**
  - `publications.piarc.org` detail URLs (`publication=7629`, `=6047`) now 404; the virtual
    library lives at `www.piarc.org/en/order-library/<id>-en-<slug>`.
  - RSM "Entire chapter" downloads resolve to one combined part-volume
    (`piarc_planning_design_operation_2025_05_28_v2025_en.pdf`, stamped 2025-05-28), so
    Ch. 7–12 arrive as a single file once unlocked.
  - A successor catalogue ("Catalogue of design, operations and maintenance safety problems
    and potential countermeasures for LMICs") was announced in PIIRC strategic plans; worth
    checking the library after registration.
- **Integrity method:** every archived file checked to start with `%PDF` (`head -c 4`) and
  passed through `qpdf --check`. Encryption reported where present; no protection removed.
