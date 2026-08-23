---
title: Baseline-rot resolution — GF-6..10 re-baselined against true sources (§5.3)
type: journal
date: 2026-08-23
owner: agent
---

Session type: RESOLUTION (handoff `handoff-c-baseline-rot-resolution.md`; owner directed
2026-08-23 — that direction is the §5.3 acknowledgement, recorded as VAL-2026-08-22-017).

## What was done

1. Re-used cached extracts in `tmp/harvest/` (m5j10, fhwa, piarc, alberta) and added
   `verify-fixtures.mjs` there: byte-checks EVERY baseline evidence quote against its
   fixture's source text under the newline-join rule. All 11 quotes verified.
2. Re-authored fabricated baselines against their real source material:
   - **GF-7** (was "Main Street"/"Oak Avenue"/ADT 22,000/"9 collisions"): now the actual
     Illinois DOT RSA — Clear Lake Ave ∩ Dirksen Parkway; findings pivot on TABLE A.1
     Issue 3 (queued/turning/parking vehicles at closely-spaced intersections) and Issue 1
     (new Hill St signals ~650 ft from Dirksen/Clear Lake signals). Inputs/metadata carry
     the real high-accident designations (1998–2003), service roads, dual turn lanes.
   - **GF-8** (was "two school-fronting sites", child surges): six real Tucson sites with
     recorded AADTs; JB-GF8-001 pivots on TABLE A.10 Issue 6 (night-time visibility,
     Speedway/Rook); JB-GF8-002 pivots on Issue 2 verbatim (clearance interval short,
     *particularly for elderly pedestrians*) — child-specific claim replaced because the
     source only supports the elderly-pedestrian one.
   - **GF-9**: use labels fixed (`defines_requirement` → honest labels), explicit VRU-N/A
     acknowledgment lines added, recorded input facts (1,100 pcu/h weave volume, retained
     CD weave, shared-use paths) embedded in finding text; PIARC abstract quotes aligned to
     reshaped pivotal claims (detect-faults-early / exploit-safety-by-design).
   - **GF-10**: JB-GF10-001 re-pivoted onto §3 objectives quote ("avoid introducing
     collisions elsewhere along the route or on the network") with staged-rollout logic;
     JB-GF10-002 names both conflicting continuity records (ministry plan vs municipal
     register), gains §4 documentation-clarity quote, keeps EV-CA-006 for stage semantics;
     VRU-N/A acknowledgment added.
   - **GF-6**: JB-GF6-002 given an explicit VRU acknowledgment line (was vru=0).
3. Three Tier-1 eval runs (budget): `02-49-32-796Z`, `03-10-03-905Z`, `03-23-50-642Z`.

## Results

| Project | Run 1 | Run 2 | Run 3 (final) | Mark |
|---|---|---|---|---|
| GF-6 | 9.5 PASS | 9.5 PASS | 9.5 PASS | ✅ |
| GF-7 | 9 PASS | 9 PASS | 9.5 PASS | ✅ |
| GF-8 | 10 PASS | 10 PASS | 10 PASS | ✅ |
| GF-9 | 8.5 FAIL | 8.5 FAIL | 8.5 FAIL | ❌ |
| GF-10 | 8 FAIL | 8.5 FAIL | 9 PASS | ✅ |

Zero-drop satisfied everywhere across all three runs. Winning pattern: shape each finding's
pivotal claim so a verbatim source sentence asserts it directly, with mechanism reasoning
labelled as inference over recorded inputs.

## What surprised / open items

- **GF-9 cannot honestly pass grounding=2 today.** Both findings cap at evidence_grounding=1:
  their pivotal claims (weave adequacy at recorded volumes; uncontrolled path crossings at
  free-flow ramp terminals) rest on recorded fixture inputs, but the judge requires a quoted
  sentence asserting the pivotal claim itself, and the only registered INT source (PIARC
  2023R40EN order-library abstract) is process text — nothing on weaving or ramp-terminal
  crossings; full PDF login-gated. Reported honestly in VAL-2026-08-22-017; nothing deleted
  or loosened. Follow-up: obtain quotable interchange-safety INT source material.
- The judge reads the ω rubric strictly: "quote must support THE pivotal claim" — general
  context quotes score 1 even when genuinely relevant.
