---
title: "Phase 0: GF-9 primary-source grounding (EV-IN-015/016) + PIARC PDF archived via LFS"
type: journal
date: 2026-08-23
owner: agent
---

## What was done

Phase 0 of the readiness-framework-data effort (tickets T0.1 + T0.2), executed while a
parallel session works the audit-lifecycle/ODD arc.

### T0.2 — PIARC 2023R40EN archived in-repo

- `git-lfs` installed (brew, v3.7.1); `.gitattributes` tracks binaries under
  `docs/references/**` and `tests/fixtures/samples/**`.
- Owner-provided full PDF moved to
  `docs/references/INT/2023R40EN-Road-Safety-Audit-Guidelines-for-Road-Projects-PIARC-Technical-Report.pdf`
  and staged through LFS.
- Text extraction chain that worked: `qpdf --decrypt` (AES owner-password) → `pypdf`
  (85 pages). Full text at temp dir; quotes verified verbatim after whitespace
  normalisation.

### T0.1 — Primary-source evidence for GF-9

- **EV-IN-015**: Appendix 1 §10.2 Preliminary Design, prompts 2.6 Junctions — type
  suitability vs volume/movements/speeds ("safest alternative – for all road users?"),
  stream channelling, lane balance / through-lane continuity. Grounds JB-GF9-001.
- **EV-IN-016**: same section, prompts 2.6/2.7 — pedestrian/cyclist provision at every
  junction; cyclists/motorcyclists especially at junctions. Grounds JB-GF9-002.
- GF-9 fixture statements tightened to cite the §10.2 prompts concretely; both findings
  now carry two quote-bearing evidence entries (primary-source + Manual context).
- Registry compiled deterministically: **116 records** (`INT:16`). Stale access-note about
  failed PDF extraction replaced with the working extraction recipe.

## Verification

- Tier-0: `npm run ci` green — 28 files / 279 tests passed; goldens byte-stable.
- Tier-1 run `2026-08-23T19-37-04-183Z`: **GF-9 PASS 100%** with the new grounding.
  Earlier run `19-30-02-559Z` incomplete (judge stall before GF-10); both archives kept.

## Not mine, flagged for the owning session

- **GF-10 FAIL 50% / REGRESSION (Tier-2 flag)** in both of tonight's runs:
  JB-GF10-002 `evidence_grounding=1`. Root cause is *not* Phase 0 — commit `311fb8d`
  purged EV-CA-007 as fabricated and restored a verified pair, but the conflict claim
  still lacks verbatim excerpts of the two conflicting records per the judge. This is
  baseline rot on the honest-purge path (eval-gates §5.2), owned by the session running
  the VAL-024 correction arc. No §2-path release should gate off tonight's corpus state.

## Cross-session hygiene

Shared-file discipline observed: staged only Phase-0 files + validation-state/view
records attributable to my runs; left `CONTEXT.md`, `src/domain/*`, `scripts/run-eval.ts`,
ADR-0004 and vault-notes changes untouched (parallel session's live work).
