---
title: "GF-9/GF-10 baseline rot resolution complete — all 5 corpus projects pass 100%"
type: journal
date: 2026-08-23
owner: agent
---

## Summary

Completed the baseline rot resolution for GF-9 and GF-10 per eval-gates §5.2/§5.3 with owner acknowledgement (2026-08-23 directive).

## What was done

1. **Diagnosed the root cause**: Judge scorecards showed GF-9-001/002 and GF-10-002 failing `evidence_grounding=1` because:
   - GF-9: PIARC 2023R40EN order-library abstract (login-gated PDF) had no interchange/weaving/VRU-specific content
   - GF-10-002: Conflict claim relied on recorded input state ("conflicting") with no verbatim quote of actual conflicting records

2. **Sourced new verbatim quotes**:
   - **EV-IN-004** (PIARC Manual Ch.10.4): Motorway checklists at preliminary design, HSM Part C crash prediction models, IHSDM geometric design evaluation
   - **EV-IN-005** (PIARC Manual Ch.10.4): All road users (motorized/non-motorized), Austroads thematic audits for pedestrians/cyclists, Walkability Checklist + CQSI, vulnerable road user needs in RSI
   - **EV-CA-007** (Alberta Appendix B): Verbatim conflicting network continuity records for Highway 401 corridor

3. **Updated fixtures with tightened claims**:
   - GF-9-001: Claim tightened to "apply PIARC preliminary-design motorway checklists to verify weaving adequacy"
   - GF-9-002: Claim tightened to "PIARC requires all road users considered + thematic audits for pedestrians/cyclists"
   - GF-10-002: Replaced EV-CA-006/003 with EV-CA-007 verbatim conflicting records

4. **Added evidence records to source research files** (deterministic compilation):
   - `docs/research/international-rsa-research.md`: EV-IN-004, EV-IN-005
   - `docs/research/canada-rsa-research.md`: EV-CA-007
   - Ran `scripts/compile-evidence.mjs` → deterministic `state/evidence-registry.json`
   - Ran `scripts/vault-export.mjs` → regenerated views

## Results

**Final eval run (2026-08-23T09-48-50-504Z): ALL 5 PROJECTS PASS 100%**

| Project | Pass Rate | Mean | Status |
|---------|-----------|------|--------|
| GF-6 | 100% | 9 | PASS |
| GF-7 | 100% | 9 | PASS |
| GF-8 | 100% | 10 | PASS |
| GF-9 | 100% | 9 | **PASS (was 0%)** |
| GF-10 | 100% | 9 | **PASS (was 0%)** |

All 10 baseline findings now have `evidence_grounding=2` with verbatim quotes from cited sources.

## Compliance

- Zero threshold/golden/judge-prompt edits (eval-gates §3 DO-NOTs)
- All quotes byte-verified against extracted source text
- Registry deterministically compiled from research files (CI determinism gate passes)
- Vault protocol MUST-WRITEs satisfied (journal + regenerated views)

## Commits

- `e049369`: Evidence registry + research files + views
- `ed2a16d`: Fixture updates + eval archive (GF-9/GF-10 resolution)
- CI + Deploy green on `e049369`

## Follow-ups

- GF-6/GF-7 minor judge variability observed (fixtures unchanged) — monitor if pattern persists
- GF-9 geometry quotes from PIARC Manual Ch.10.4 checklists are process-level; could be strengthened if PIARC 2023R40EN full PDF becomes accessible
- Fog items 3-5 remain NOT-FIRED per Handoff D review (hold-notes in vault/journal/)