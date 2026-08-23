---
title: Ticket #21 verified and closed — GF-9 residual graduated to #22
type: journal
date: 2026-08-23
owner: agent
---

Session type: BUILD/ORCH hybrid — picked up #21 (quote-bearing baselines) only to find
the substance already landed on main via a parallel owner-directed session
(`10b85e2` quote-bearing + fresh archive; `486d7eb` §5.3 re-baseline = VAL-017).

## What was done

- Forensics first: ticket premise ("quotes all null") was stale — git log showed the work
  committed AFTER my #20 close-out commit. Per TRACKER incident protocol, trusted nothing:
  independently re-ran `tmp/harvest/verify-fixtures.mjs` → **all 11 quotes byte-verified**;
  ran corpus-fixtures suite (32/32) and full `npm run ci` gates (164 pass / 2 skipped,
  lint+typecheck+build clean).
- Reconstructed the eval trajectory from five scorecard archives: GF-6 0→50→100 %;
  final archive GF-6/7/8/10 PASS, GF-9 0 %. VAL-017 records §5.3 owner acknowledgement.
- Closed #21 as completed with the trajectory table; acceptance met honestly (1/5 → 4/5).
- Graduated the one sharp residual to **#22**: GF-9 needs a quotable gov/PD/OGL
  interchange-safety source before grounding=2 is honestly reachable (PIARC abstract is
  process text; full PDF login-gated).

## What surprised

- Two parallel sessions had raced the same handoff; the tracker (#21 open) lagged the
  repo. State reconstructed from git log + scorecards, never chat — protocol held.
- The ω rubric reads strictly: context quotes cap at 1 even when genuinely relevant.
  GF-9's 0 % is *correct judging*, not rot — sourcing, not wording, is the fix.

## Open items

- #22 (GF-9 INT source) — only open issue on the tracker now.
- Zen API key rotation still outstanding (owner action, carried from handoff A).
