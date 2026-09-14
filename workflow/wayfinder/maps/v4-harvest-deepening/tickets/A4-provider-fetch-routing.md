---
id: A4
title: d04-provider-fetch-routing
type: task
hitl: false
status: open
assignee: 
blocked_by: [A3]
blocks: []
created: 2026-09-14
resolved: 
grill: resolved-by-planner
lane_gate: 
reviewer: 
self-approve: true
---
Category: Provider Fetch Routing
Summary: d04Acquire via the provider.fetch seam (grill first)
Current: Route d04Acquire live fallback through provider.fetch; grill FIRST: PDF guard, host-budget, mapping.
Desired: Implement provider.fetch-based hits and prune dead seq usage; ensure the minimum adapter surface remains stable.
Key-interfaces: provider.fetch, fetch contract, acquire module
Acceptance: (1) No bare fetch calls in pipeline.ts; (2) New test: provider.fetch returns non-PDF bytes; empty bundle + warn; (3) removed dead seq usage; (4) pipelines green.
Out-of-scope: Any UI changes.
