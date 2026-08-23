---
title: "T3.1 complete: registry expanded to 152 records via quote extraction from reference library"
type: journal
date: 2026-08-23
owner: agent
---

## What was done

Four parallel extraction agents (exclusive one-file ownership each — zero merge surface)
mined the Phase-1/Phase-2 PDFs for verbatim normative quotes. Every quote passed a
whitespace-normalized substring verification against pypdf-extracted text; original
typos preserved inside quotes.

**+36 records → registry at 152** (INT 24 · UK 24 · US 32 · CA 36 · AE 36):

| JJ | ids | anchors |
|---|---|---|
| US | EV-US-023..032 | FHWA stage % anchors (30–40/60–80), independence-functional-not-organizational, team≥3, prompt≠checklist philosophy, wording discipline ("unsafe/sub-standard… avoided" — US analogue of UK 'consider' ban), VRU space-or-time separation, ITD "shall", SCDOT ramp-terminal VRU items |
| CA | EV-CA-028..037 | BC four-stage ladder + construction/in-service exclusion, response taxonomy (accept/conditional/reject), first French-native MTQ definitions + QC team floor (3 people / ≥2 auditors), Good Roads auditor code w/ explicit VRU duty + thematic audits, P3/DB procurement rule, UNB worked-example columns |
| AE | EV-AE-029..036 | TR-540 2nd Ed full-text proofs: mandatory scope, Stage 0 definition, permitted Stage 1/2 combination, independence mandate, DTR acronym resolved (= Design Team Response), VRU continuity + Safe System 30 kph direction; TR-514 §2.13 RSA-gate-before-IFC |
| INT | EV-IN-017..024 | CAREC six-stage vocabulary + checklist Yes/No semantics + recommendation quality criteria; AfDB five-stage merge rule + sample-report skeleton (C.1–C.6 finding pattern → AG-REPORT template); iRAP SR4D documented design-stage chain (86%→2% outcome); PIARC 2007 five-moment framing |

## Why this matters downstream

- Stage-definition quotes now exist per jurisdiction from PRIMARY sources — grounds ODD
  cell mappings (ADR-0005) beyond Manual-level descriptions.
- Response-report taxonomies (BC trio, UNB columns, DTR) + report skeletons (AfDB C.1–C.6)
  are direct inputs when AG-REPORT/rec-draft assists get designed.
- Wording-discipline pairs now span jurisdictions (UK 'consider' ban ↔ US "unsafe…avoided"
  ↔ CAREC specificity criteria).

## Verification

- `compile-evidence.mjs`: 152 records, deterministic.
- Tier-1 eval NOT triggered: no §2 path touched (engine/prompts/packs/baselines unchanged).
- Local `npm run ci` blocked only by parallel session's untracked WIP (evidence-ref.tsx
  lint, odd-declaration test fixture-id naming) — remote CI unaffected; not touched.

## Hygiene

Each agent wrote exactly its own research file; shared artifacts limited to registry +
views compiled centrally here.
