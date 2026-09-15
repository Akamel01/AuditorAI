---
map: v6-horizon
label: Long-Horizon Plan (v6, DRAFT — grill reshapes)
created: 2026-09-15
Destination:
  path: workflow/wayfinder/maps/v6-horizon/
Notes: |
  DRAFT long-horizon plan post loop-4 + GF-9-DIRECT ratification.
  Frontier: 8 open tickets, all owner/trigger-gated. This map holds the
  next executable program: DIRECT integration, corpus growth to 100,
  judge recovery/migration. GRILLED 2026-09-15 (ADR-0019): two parallel
  lanes — Lane A H1, Lane B H2→H3 (two ~8-9 batches); H7 pins
  deepseek-v4-flash-free + calibration; H5 direction loading-UX
  (numeric targets still owed); H6 follows H4 + schema.
Decisions:
  - AD-H1: C8/C9 DIRECT integration, pairs PROPOSED until ratified (Self-approve: false, hitl: true)
  - AD-H2: counts-vs-samples drift fix first (Self-approve: true)
  - AD-H3: corpus growth +17 from CLEAR shelves in ratifiable batches (Self-approve: false, hitl: true)
  - AD-H4: F1 close on judge recovery (Self-approve: true)
  - AD-H5: RSC spike once owner states measurable target (Self-approve: false, hitl: true)
  - AD-H6: assists pilot after F1 + schema (Self-approve: false, hitl: true)
  - AD-H7: judge-model successor deepseek-v4-flash-free + calibration run (Self-approve: false, hitl: true)
Not-yet-specified: |
  H3 batch shelf allocation (Lane B execution decides usa/ mix).
  H5 numeric loading-UX targets (owner owes; lane_gate holds).
Out-of-scope: |
  Owner-gated v3 backlog (Flag #1/#2, Phase-3 Postgres) — listed, never started unilaterally.
  Foreign lanes (T2 flip, dedupe-persist rewrite) — converge, don't touch.
Edges:
  - from: H1
    blocked_by: []
  - from: H2
    blocked_by: []
  - from: H3
    blocked_by: [H2]
  - from: H4
    blocked_by: [H7]
  - from: H5
    blocked_by: []
  - from: H6
    blocked_by: [H4]
  - from: H7
    blocked_by: []
---

Long-horizon destination: GF-9 DIRECTs live in C8/C9, corpus at 100 with release-test awake, F1 closed on a pinned judge, assists piloted behind schema.
