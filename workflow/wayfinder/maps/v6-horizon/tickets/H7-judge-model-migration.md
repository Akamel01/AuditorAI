---
id: H7
title: judge-model-migration
type: decision
hitl: true
status: open
assignee: 
blocked_by: []
blocks: [H4]
created: 2026-09-15
resolved: 
grill: 
lane_gate: OWNER_DECISION
reviewer: 
self-approve: false
---
Category: Eval doctrine
Summary: x-preview-f-free is dead (401); decide the pinned judge successor + re-baseline rule.
Current: run-eval.ts defaults to dead model, no fallback; switching judges breaks score comparability with 09-08 archive.
Desired: Owner picks successor (free-tier) + re-baseline protocol (parallel-calibration run or clean-break note); then pin default + document.
