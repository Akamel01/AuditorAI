---
title: Quote-bearing baselines for GF-6..10 + first corpus re-run after ω rubric
type: journal
date: 2026-08-22
owner: agent
---

Session type: BUILD (handoff `handoff-next-effort-fog.md`, work item 1).

## What was done

1. Harvested 10 verbatim quotes for all `expected_findings_baseline[].evidence[].quote`
   fields across `tests/fixtures/gf6..gf10`. Sources: TR010063 App 9.54 M5 J10 Stage 1 RSA
   response report (OGL), FHWA-SA-06-017 case studies via ROSA-P (PD), PIARC 2023R40EN
   order-library abstract (= EV-IN-001's cited source page), Alberta Transportation RSA
   Guidelines PDF (= EV-CA-003/EV-CA-006 cited source). Every quote byte-verified against
   extracted PDF text (newline joins only); the M5 doc's own typo "refuge vehicle"
   preserved verbatim.
2. Ratified contingency applied: Wikimedia provenance pages for GF-9/GF-10 proved too thin
   ("line art drawing of a cloverleaf."), so those entries quote their evidence_ids'
   registry-cited sources instead (PIARC page / Alberta guidelines).
3. Fresh Tier-1 run archived: `state/eval-scorecards/2026-08-23T01-56-26-208Z`
   (+ validation-state record). Judge ox-alpha @ max via Zen, key supplied at invocation
   from macOS Keychain (see gotchas).

## Results and classification

- GF-6: 0%→50%, both groundings now 2. GF6-002 fails solely on vru_coverage=0
  (empty road_users, no acknowledgment).
- GF-7/GF-8 regressed −0.5 each (zero-drop flags recorded); GF-9 flat; GF-10 improved +0.5.
- Dominant failure class is **baseline rot** (§5.2): several baselines name scheme
  specifics ("Main Street", "Oak Avenue", school-fronting sites) that do not exist in their
  cited sources, so NO verbatim quote can support their pivotal claims. The ω clarification
  made this visible — the procedure working as designed.

## What surprised / open items

- First eval attempt failed all judge calls HTTP 401: the Keychain entry held a 10-char
  placeholder (owner re-stored full key via `security add-generic-password -U … -w
  "$(pbpaste | tr -d '[:space:]')"`).
- `tsx` is NOT a pinned dependency; `npm run eval` fails locally with command-not-found.
  CI itself uses `npx tsx scripts/run-eval.ts` (eval.yml:29) — that invocation works.
- PIARC full PDF is login-gated; the order-library abstract page (the registered
  source_url) carries quotable text.
- **Owner decision needed:** baselines need re-authoring against their true sources (or a
  different resolution) under §5.3 — ORCH review + owner acknowledgement required;
  nothing changed silently here beyond quote fields. Tier-2 review flags on GF-7/GF-8
  stand until then. Fog items 3–5 untouched per handoff.
