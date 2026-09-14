---
map: v4-harvest-deepening
label: Harvest Deepening Map (v4)
created: 2026-09-14
Destination:
  path: workflow/wayfinder/maps/v4-harvest-deepening/
Notes: |
  This map encodes the v4 harvest-deepening ticket plan (A1–A5).
  It references the decisions in AD-A1..AD-A5 and the plan in decisions.md.
Decisions:
  - AD-A1: ledger-run-persist behind the ledger seam (Self-approve: true)
  - AD-A2: harvest ctx builder for discoveryCtx (Self-approve: true)
  - AD-A3: pipeline dedupe index return (Self-approve: true)
  - AD-A4: d04Acquire via provider.fetch seam (Self-approve: false)
  - AD-A5: health bridge consolidation (Self-approve: false)
Not-yet-specified: |
  A4 grill pre-resolved by planner (guard caller-side, fetch unwidened; revisit on 2nd content-type). A5 executes only after foreign bridge lane resolves (implement / verify-only / dup-close).
Out-of-scope: |
  Any code changes outside workflow/wayfinder/maps/v4-harvest-deepening/.
Edges:
  - from: A1
    blocked_by: [A3]
  - from: A4
    blocked_by: [A3]
  - from: A2
    blocked_by: [A3, A1]
  - from: A3
    blocked_by: []
  - from: A5
    blocked_by: []
---

This map documents the v4 harvest-deepening task set and the ticket interdependencies.
