---
id: H7
title: judge-model-migration
type: decision
hitl: true
status: closed
assignee: 
blocked_by: []
blocks: [H4]
created: 2026-09-15
resolved: 2026-09-15
grill: 
lane_gate: OWNER_DECISION
reviewer: 
self-approve: false
---
Category: Eval doctrine
Summary: x-preview-f-free is dead (401); decide the pinned judge successor + re-baseline rule.
Current: run-eval.ts defaults to dead model, no fallback; switching judges breaks score comparability with 09-08 archive.
Desired: Owner picks successor (free-tier) + re-baseline protocol (parallel-calibration run or clean-break note); then pin default + document.

## Resolution

Decided + implemented 2026-09-15, DEVIATING from grill pick: deepseek-v4-flash-free is retired (400 Model unavailable) along with all chat -free IDs; pinned muse-spark-1.3-contributor-free via NEW /responses transport (chat path 500s by design). No parallel calibration possible (no prior working judge) — clean-break baseline recorded, future runs compare. See ADR-0019 update.
