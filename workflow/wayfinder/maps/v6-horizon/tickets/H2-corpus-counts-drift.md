---
id: H2
title: corpus-counts-drift
type: task
hitl: false
status: closed
assignee: 
blocked_by: []
blocks: [H3]
created: 2026-09-15
resolved: 2026-09-15
grill: 
lane_gate: 
reviewer: 
self-approve: true
---
Category: Consistency
Summary: counts.total 78 vs samples[] 83 (us-034..038 promotion never updated counts).
Current: engine 6 + judge 26 + reserve 41 + unassigned 5 = 78; array holds 83.
Desired: Reconcile counts to array truth (or vice versa with provenance), pin with a test or build-script assertion so promotion path cannot drift again.

## Resolution

Fixed + reviewed APPROVED_WITH_NOTES, merged 963f66b: counts recomputed from samples[] census (total 83, reserve 46); 2-line diff (original formatter preserved); readiness-report verified samples-driven.
