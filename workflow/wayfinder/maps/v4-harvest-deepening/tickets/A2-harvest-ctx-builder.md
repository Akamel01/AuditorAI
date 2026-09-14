---
id: A2
title: harvest-ctx-builder
type: task
hitl: false
status: closed
assignee: 
blocked_by: [A3, A1]
blocks: []
created: 2026-09-14
resolved: 2026-09-14
grill: 
lane_gate: 
reviewer: 
self-approve: true
---
Category: DiscoveryCtx Builder
Summary: Single DiscoveryCtx builder for harvest + stream (Strong)
Current: buildDiscoveryCtx lives in harvest.ts with live and dry-run modes; provider-filter policy exists in multiple modules.
Desired: Expose a single builder function buildDiscoveryCtx({live, cellKey}, deps?) without creating new files; unify provider-filter policy and ensure consistent derivation of Jurisdiction maps across paths.
Key-interfaces: harvest.ts, harvest-stream.ts, provider-filter policy, JUR_MAP/themeFor
Acceptance: (1) harvest-stream.ts imports builder instead of inline policy; (2) NEW ctx unit test: identical inputs from both paths; unknown cellKey throws UnknownCellKeyError; (3) pipelines green.
Out-of-scope: Any UI or external API changes.

## Resolution

Implemented + reviewed APPROVED_WITH_NOTES (loop 3, merged 0e71b69): buildDiscoveryCtx extracted verbatim from harvest(), both callers adopted; pins: gaps-aware null, union filter + carve-out, skippable validation. Worker scaffold replaced by orchestrator. Proof 10/10, typecheck green.
