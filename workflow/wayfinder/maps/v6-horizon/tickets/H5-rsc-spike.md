---
id: H5
title: rsc-spike
type: task
hitl: true
status: open
assignee: 
blocked_by: []
blocks: []
created: 2026-09-15
resolved: 
grill: 
lane_gate: RSC_MEASURABLE_TARGET
reviewer: 
self-approve: false
---
Category: Perf (v3-F3)
Summary: Serializable server snapshot spike with before/after TTFB/loading/SEO proof, no Repository divergence.
Current: Blocked on RSC_MEASURABLE_TARGET_AND_RISK_ACCEPTANCE (owner states target).
Desired: Probe-only spike; land only if target met.

## Progress (2026-09-15)

Probe implemented (5 new files, zero src edits): baseline M1-M7 measured (skeleton p50 ~1s, complete ~2.2s, CLS 0, server text ~0). Targets P1-P5 PROPOSED in docs/probe/h5-rsc-spike-report.md — numeric confirmation still owed before any spike/land. v3-F3 updated same.
