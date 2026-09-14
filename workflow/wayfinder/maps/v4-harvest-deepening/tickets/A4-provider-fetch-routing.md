---
id: A4
title: d04-provider-fetch-routing
type: task
hitl: false
status: closed
assignee: 
blocked_by: [A3]
blocks: []
created: 2026-09-14
resolved: 2026-09-14
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

## Resolution

Implemented + reviewed APPROVED_WITH_NOTES (loop 3, merged 0e71b69): per-hit provider.fetch with direct-fetch fallback (seed-safe), budget inside impls only, %PDF guard caller-side, dead seq removed. Proof: fetch-called + acquired 1, typecheck green.
