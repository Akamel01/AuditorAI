---
title: "AFK wave: ODD Phase-1/2 landed, GF-10 re-baselined, corpus extended to 8 real+synthetic fixtures"
type: journal
date: 2026-08-24
owner: agent
---

## Owner order

Work all nine remaining items AFK; no grilling needed (all carried prior ratified
decisions or direct orders).

## Landed

1. **ODD Phase-1 committed** (`4625b72`, `2d49716`): the other session's staged-ready
   declaration + schema + 8 invariant tests, committed on owner word.
2. **GF-10 §5 swap+re-test** (`b52d3b3`, VAL-2026-08-22-027): JB-GF10-002 re-authored on
   authentic EV-CA-038 (Alberta §5.6.1–5.6.2, verbatim-verified); CA pack completeness rule
   R-CA-NETWORK-CONTINUITY-RESOLVED makes the 'conflicting' MI path deterministic
   (`tests/domain/gf10-mi-path.test.ts`); fresh archive all-100%; **CA incident flag
   cleared**, declaration v1.0.1.
3. **ODD Phase-2 wiring** (`b184a72`): `src/domain/odd.ts` (ajv loader, multiset cell
   matching, default-refuse), intake refusal via `OddOutsideDomainError` → 422,
   result stamping (`odd_*` fields + limitations per three-zone discipline),
   floor-satisfaction gating of claims; declaration **v1.1.0** — full pack surface
   declared (16 cells: 5 IN / 10 mapped-unproven / 1 absent).
4. **Claims copy**: report renderer capability-status block (three zones) + README ODD
   paragraph.
5. **T3.2 conversions** — three REAL audits joined the judged corpus:
   - **GF-11** A9 Ballinluig Stage 1&2 (Transport Scotland, OGL v3.0) — decision-log
     problems verbatim; WelHat sample dropped honestly (no explicit licence).
   - **GF-12** Hingham Derby St @ Rt 3 ramps (design-phase full package) — new EV-US-033
     grounds the pivotal lane-drop claim after first-run judge feedback.
   - **GF-13** NEAHD Ring Road planning RSA — new EV-CA-039 grounds the pivotal spacing
     claim likewise.
6. **Gate runs**: registry 152→156; runner extended GF-6..13; canonical archive
   `2026-08-24T08-08-49-444Z` shows GF-11/12/13 fully scored at **100% PASS**;
   odd.json fixture_ids deepened (**v1.1.1**). Zero-drop REGRESSION flags on untouched
   fixtures across tonight's runs are mean-total jitter only (pass rates stable) — same
   documented pattern as Phase 0.

## Honest notes

- First conversion pass failed grounding=1 exactly as designed: sample-recorded pivotal
  facts needed their own quote-bearing records. The fix (registering sample-fact evidence)
  is the reusable pattern for future conversions.
- Judge transport flakes (HTTP 503 / abort) produced `unscored` baselines scattered
  across runs; unscored never fails the mark but a release gate wants a fully-scored
  archive — the canonical run above has zero unscored on all NEW fixtures.
- Subagent provider flaked (network_error ×4) during GF-11 authoring; done inline instead.

## Remaining from the nine

- #7 handoff doc for the dedicated readiness-framework session — next.
- #9 owner download queue unchanged.

## Round 2 addendum (same day)

- Two hunter subagents landed after one provider flake: **23 new samples** — corpus
  **60 cataloged**. INT+10..17, CA-009..011, US-009..020; all %PDF/sha256 verified,
  role-assigned per ADR-0007 rules into sample-corpus.json.
- T4.x harness landed: `scripts/readiness-report.mjs` → `state/readiness-report.json`
  (fixtures × ODD cells × latest archive + role census).
- Conversion pattern industrialized: docs/validation/sample-conversion-checklist.md.
- Owner download queue formalized with evidence of attempts:
  docs/references/ACQUISITION-BRIEF.md. Dead ends recorded honestly (MassDOT GIS
  metadata-only, Alberta CKAN exhausted, Kamloops citation rot).

## Wayfinder wave (Aug 25)

Map charted: .scratch/readiness-framework/ (destination: self-sustaining corpus).
Tickets 01+03 resolved inline after provider spawn outage:
- **01 conversions wave 1**: GF-14 Somerville / GF-15 Strathcona pair / GF-16 Milltown
  (rejection-analogue provenance). Judge feedback drove two honest re-authorings
  (compliance-question recast; Problem-3.2 quote grounding). Canonical archive
  2026-08-25T07-34-03-343Z — all three fully scored 100%. Registry 161. odd.json v1.1.2.
- **03 judge-retry**: 4-attempt transport backoff + --topup mode (never mutates scored
  verdicts; sibling -completed dir + manifest). Proven live during the flake storm.

Corpus now **11 judged fixtures** (GF-6..16), all real-scheme except golden GF-1..5.
