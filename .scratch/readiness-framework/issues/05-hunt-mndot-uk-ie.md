# 05 — Round-3 hunt: MnDOT batch + UK FOI + Ardee Main Street

Type: research · Status: resolved · Blocked by: —

## Question

Harvest the proven round-3 veins toward the 100+ threshold: (a) the six deferred
curl-fetchable MnDOT RSAs + post-audit presentations; (b) UK FOI/EIR continuation
(Transport Scotland / National Highways disclosure logs, Stage 2/3-class reports and —
scarce class priority — designer response reports); (c) extract Ardee Main Street Stage 2
RSA from inside its parent Quality Audit PDF (flagged in INT index gaps). Target ≥15 new
cataloged samples. Rules: ACQUISITION-BRIEF.md (public only, licence verbatim, %PDF +
sha256 into owning index.md, dedupe, gaps documented).

## Answer

**18 new samples cataloged** (INT-018…028 → tests/fixtures/samples/INT/, 11 files;
US-021…027 → tests/fixtures/samples/US/, 7 files). All %PDF-magic verified, sha256 +
licence wording recorded per entry, kebab-case, deduped (no sha256 or scheme overlap with
rounds 1–2). Corpus arithmetic: INT 17→28 files, US 20→27 files ⇒ total cataloged **78**
(from 60; release-test tier at 100+).

### Added

| id | title (short) | native stage | completeness |
|---|---|---|---|
| int-018-ie-abp-ardee-mainstreet-stage2-rsa | Ardee Main Street Stage 2 RSA (+Oct addendum, TII approval email) — extracted from parent Quality Audit PDF pp. 27–84 | Stage 2 | outputs-only |
| int-019-ts-a975-foveran-link-stage3-rsa-report | A975/Foveran Link Rd Stage 3 RSA (TS EIR/202500483574 Annex A) | Stage 3 (scan) | outputs-only |
| int-020-ts-a975-foveran-link-stage4-rsa-report | same scheme, Stage 4 monitoring RSA (Annex B) | Stage 4 (scan) | outputs-only |
| int-021-ts-a975-foveran-link-stage5-rsa-report | same scheme, Stage 5 RSA (Annex C) | Stage 5 (native label; scan) | outputs-only |
| int-022-ts-a90-swallow-hotel-roundabout-rsa-info | A90 Swallow Hotel roundabout RSA info (EIR/202500464778 Annex A) | n/v pending OCR (scan) | outputs-only |
| int-023-uk-he-a14-barhill-stage3-rsa-report | A14 C2H Bar Hill Junction Stage 3 RSA, MMSJV/Highways England, Oct 2020 | Stage 3 | outputs-only (full report) |
| int-024-uk-tfl-elephant-castle-stage3-rsa | Elephant & Castle Stage 3 RSA vC final (TfL FOI-1053-1718) | Stage 3 (scan, redacted) | outputs-only |
| int-025-uk-tfl-stgeorges-circus-stage3-rsa | St George's Circus/Westminster Bridge Rd Stage 3 RSA (same FOI) | Stage 3 (scan, redacted) | outputs-only |
| int-026-uk-oxfordshire-iffley-road-stage2-rsa | Iffley Rd ATT2 Quickways Stage 2 RSA, May 2022 (OCC via WDTK/Wayback) | Stage 2 | outputs-only |
| int-027-uk-oxfordshire-iffley-road-stage3-rsa | Iffley Rd RSA0214 Stage 3 post-implementation RSA | Stage 3 | outputs-only |
| int-028-uk-oxfordshire-iffley-road-stage1-response | Iffley Rd Stage 1 Response Report, signed authorisation sheet (Dec 2021) | Stage 1 response | outputs-only (**response report**) |
| us-021-mn-us8-i35-wi-border-rsa | US 8 (TH 8) I-35→MN/WI border RSA Technical Report, Feb 2014 | existing-road | full-package |
| us-022-mn-th3-farmington-empire-rsa | TH 3 Farmington/Empire Twp RSA, Dec 2006 | existing-road | full-package |
| us-023-mn-hwy5-lake-elmo-rsar | TH 5 Jamaca–Manning (Lake Elmo) RSAR Tech Report, Feb 2013 | existing-road | full-package |
| us-024-mn-us14-owatonna-dodge-center-rsar | US 14 Owatonna–Dodge Center RSAR Tech Report, Sep 2013 | existing-road | full-package |
| us-025-mn-us14-mankato-new-ulm-rsar | US 14 Mankato–New Ulm RSAR Tech Report, Apr 2012 | existing-road | full-package |
| us-026-mn-us12-post-audit-presentation | US 12 RSA Post-Audit Presentation deck (HDR), Aug 6 2015 | post-audit artifact | outputs-only (52-slide deck) |
| us-027-mn-hwy7-slp-hollywoodtownship-rsa-report | Hwy 7 SLP–Hollywood Twp RSA Report Jul 2022 + Appendix A comment letters — extracted from Minnetonka council packet | existing-road | full-package extracted |

### Best conversion candidates

1. **int-028** — signed designer-response report w/ populated Design Organisation +
   Overseeing Organisation sign-off blocks: the scarcest class, direct fixture material
   for Promotion/response threading.
2. **int-018** — Ardee Main Street Stage 2: repeat/update problem annotations across a
   June→October rerun on one scheme = real carry-over semantics for Run replacement; plus
   a TII non-standard-approval email (exception handling evidence).
3. **int-026 + int-027** — county Stage 2→Stage 3 pair with explicit previous-items
   register; clean text layers.
4. **us-010 + us-011 + us-026** — completed three-artifact lifecycle (input packet →
   report → post-audit deck) on one programme.
5. **int-023** — GG 119-era National Highways Stage 3 with departures section and signed
   statement; cleanest major-scheme text layer.
6. **us-027** — agency comment letters answering draft findings: nearest US analogue to
   response culture; critical-index crash-ranking reusable as screening logic.

### Gaps / shortfalls

- **Concurrent-run coordination note**: while this ticket executed, sibling downloads
  appeared uncataloged in both fixture dirs (`carec-manual3/manual4`, `irap-gdci`,
  `ma-boston/northborough/worcester`, `nchrp-synthesis-336`, `sc-greenville`,
  `us-fhwa-sa-16-120`, and `ie-abp-ardee-main-street-stage2-rsa-2024.pdf`). Left
  untouched. The last one is an **off-by-one near-duplicate of int-018** (same parent
  PDF; theirs starts at the Appendix-B divider p.26 → 59 pp, mine at the RSA title
  p.27 → 58 pp): keep one, drop the other, when reconciling.

- **Welsh Government**: no resolvable RSA-bearing ATISN found; "FOI release 26689: A487
  at Pentrwyn Garnedd" (~Mar 2026) flagged by aggregator but gov.wales slug unresolved
  this run — needs manual publications search. Logged in INT gaps table.
- **Scan-grade artifacts**: int-019…022, 024, 025 have no text layer (no OCR rasterizer
  in fetch environment); identity anchored to their FOI release pages, OCR flagged per
  entry before machine use.
- **Twin Ports presentation does not exist** — round-2 gaps guess corrected: docId
  26401632 is the *US 12* deck (now US-026); MnDOT RSA page lists no Twin Ports
  presentation. MnDOT vein now exhausted for curl-fetchable artifacts.
- **TfL licence ambiguity**: FOI pages state no open licence ("Copyright TfL" footer);
  reuse rights for int-024/025 unverified — recorded verbatim, not assumed.
- **WhatDoTheyKnow bot-wall**: live 403 to curl; worked via Wayback attachment captures
  (technique documented in INT Round-3 notes).
- Unchanged standing gaps: PIARC login-wrapped case studies, Te Ara Tupua truncation,
  MassDOT metadata-only, MA near-duplicate trio held for diversity.

No git operations; no source-code changes; scratch work confined to temp dir.


## Driver reconciliation note (2026-08-25)

18 samples verified %PDF, ids sequential, index format conformant. Sibling-run duplicate
(Ardee) resolved in favor of this ticket's int-018. Corpus now 78 cataloged; roles
assigned per R1–R4 into state/sample-corpus.json. Status: RESOLVED.
