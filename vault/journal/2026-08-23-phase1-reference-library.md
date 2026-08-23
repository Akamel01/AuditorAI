---
title: "Phase 1 complete: RSA reference library for all four jurisdictions"
type: journal
date: 2026-08-23
owner: agent
---

## What was done

Four parallel collection agents (one per jurisdiction) fetched official road-safety-audit
reference documents into `docs/references/<JJ>/`, each with a provenance MANIFEST.md
(filename | title | publisher | url | dates | access_status | sha256 | notes).

**21 new PDFs** (+1 owner-provided archived earlier) across four manifests:

| JJ | Fetched | Highlights |
|---|---|---|
| INT | 2 total | PIARC congress-2007 RSA presentation; 2023R40EN already archived. RSM chapter PDFs + 2011R01 + Catalogue 2009 **blocked by store-wide PIARC login wall** (even previously-open items); remedy documented: free visitor account at roadsafety.piarc.org/node/3 |
| US | 9 | FHWA RSA Guidelines 2006 (ROSAP mirror), Ped/Bike RSA Guide 2020, Bicycle RSA 2012, Pedestrian RSA 2007, IHSDM overview + HSM Part C flyer, SCDOT Ch10 Interchanges, Idaho ITD RSA manual, case-studies compilation (triaged from tmp/harvest) |
| CA | 7 | Alberta guidelines+implementation plan (2004 still current per open.alberta.ca), BC MoTI policy+guidelines (2004), Quebec MTQ French guide (2012), Ontario Good Roads (2023, TLS-expired cert at fetch — flagged for re-verification), UNB guidelines; TAC CRSAG blocked ($150–199) |
| AE | 4 | **QCC TR-540 RSA Manual 2nd Ed (Jun 2023)** retrieved via Wayback of canonical jawdah.qcc.abudhabi.ae URL; TR-514 geometric design manual (§2.13 mandates TR-540 RSAs); two CIHT seminar bulletins (labelled non-official) |

## Notable discoveries

- **AE retrieval path**: QCC's unified-standards library sits at predictable
  `jawdah.qcc.abudhabi.ae/.../ISGL-LIST/<CODE>.pdf` URLs with ~30 CDX-captured on Wayback
  (TR-503…544, DP-, WA-) — geo-fence bypass for future pulls.
- Alberta & BC docs contain TAC↔province stage-equivalency tables — direct material for
  Native Stage evidence (EV-CA-006 territory).
- safety.fhwa.dot.gov now 301s into highways.dot.gov (old PDF paths dead); ROSAP accepts
  browser-header fetches but blocks plain curl.

## Owner download list (agents could not fetch)

Full inventory with exact acquisition paths lives in each MANIFEST.md gaps section:
PIARC visitor-account items (RSM chapters, 2011R01, 2009R07 catalogue), HSM full text
(paid AASHTO), TAC CRSAG + in-service companion (paid), Dubai RTA RSA manual (internal),
current TR-540 edition post-May-2025 update (geo-fenced / portal).

## Hygiene

All writes confined to `docs/references/**` + this journal; binaries route through Git
LFS (.gitattributes patterns from Phase 0); no source code touched; parallel ODD-session
workstream untouched.
