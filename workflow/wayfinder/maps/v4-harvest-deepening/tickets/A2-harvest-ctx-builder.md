---
id: A2
title: harvest-ctx-builder
type: task
hitl: false
status: open
assignee: 
blocked_by: [A3, A1]
blocks: []
created: 2026-09-14
resolved: 
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
