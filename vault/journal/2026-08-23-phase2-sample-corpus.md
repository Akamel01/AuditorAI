---
title: "Phase 2 complete: 37 sample audits cataloged across four jurisdictions"
type: journal
date: 2026-08-23
owner: agent
---

## What was done

Four parallel sample-hunt agents (one per jurisdiction) collected completed road-safety-audit
examples into `tests/fixtures/samples/<JJ>/` with per-dir `index.md` provenance tables and a
top-level `tests/fixtures/samples/README.md` aggregator.

**37 cataloged · 27 PDFs downloaded (128 MB, LFS) · ~13 full-package.**

Highlights:
- **CA-001** NE Edmonton Ring Road planning-stage RSA (2009) — earliest-stage provincial
  RSA found publicly in Canada.
- **CA-002/3/4** Glenmore Trail DDI functional-plan RSA + typical sections + plan/profile
  sheets — the only complete municipal input→output package found anywhere.
- **INT-008** Welwyn Hatfield Great North Road Stage 1 RSA — end-to-end single-file package:
  brief, independence declarations, findings, designer response, authority sign-off.
- **INT-004..007** Transport Scotland A9 programme slice: two combined Stage 1&2 reports +
  Stage 1/Stage 2 response reports.
- **US-008** Hingham Derby St @ Rt 3 ramps — the only true US design-phase full package.
- **AE**: honest near-null — jawdah CDX mining proved all ~30 captured ISGL codes are
  normative manuals; ADG-18 worked-example annexes survive only behind Scribd.

## Structural findings

1. Public publishing skews heavily to **in-service/existing-road RSAs**; design-stage
   full packages are rare everywhere (US: 1 of 18; INT: ~2 of 9).
2. **Designer response reports** are the scarcest artifact class (UK A9 slice is the
   exception that proves the rule).
3. Growth paths documented precisely in each index + README: PIARC visitor account,
   TAC purchase, MassDOT GIS attachment vein, QCC portal, Wayback candidates.

## Hygiene

All writes confined to `tests/fixtures/samples/**`; binaries LFS-tracked via existing
.gitattributes patterns; %PDF magic verified on all 27 downloads; no code touched;
parallel ODD-session workstream untouched.
