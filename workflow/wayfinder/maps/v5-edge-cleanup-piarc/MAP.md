---
map: v5-edge-cleanup-piarc
label: Edge Tests + Twin Cleanup + PIARC GF-9 DIRECT (v5)
created: 2026-09-14
Destination:
  path: workflow/wayfinder/maps/v5-edge-cleanup-piarc/
Notes: |
  Loop-4 wave per owner word 2026-09-14: investigator top-3 edge-test gaps
  (R16/R8/R10), .js-twin cleanup, PIARC license clearance for GF-9 DIRECT.
  Discovery CONFIRMED all three gaps; grill mitigations are worker contract.
Decisions:
  - AD-T1: brave real-provider 402/429/throw + refusal negatives (Self-approve: true)
  - AD-T2: health-bridge empty/fallback/lock-holder edges (Self-approve: true)
  - AD-T3: dedupe forced-KV-failure falsification (Self-approve: true)
  - AD-T4: twin cleanup lands FIRST, scoped gitignore (Self-approve: true)
  - AD-T5: PIARC scoped-mining exception, PROPOSED pack, ratification-gated use (Self-approve: false, hitl: true)
Not-yet-specified: |
  T5 miner tooling (extend verify-quotes.py vs new script) chosen at execution.
  Paid muse-spark-1.3 judge try deferred; Zen 500 retry later per owner.
Out-of-scope: |
  Verdict flip on piarc-irf; bulk text to git; quarantined PIARC strays;
  F1 Tier-1 rerun (judge transport still 500); any code outside ticket touches.
Edges:
  - from: T1
    blocked_by: [T4]
  - from: T2
    blocked_by: [T4]
  - from: T3
    blocked_by: [T4]
  - from: T4
    blocked_by: []
  - from: T5
    blocked_by: []
---

This map documents the v5 wave task set and the ticket interdependencies.
