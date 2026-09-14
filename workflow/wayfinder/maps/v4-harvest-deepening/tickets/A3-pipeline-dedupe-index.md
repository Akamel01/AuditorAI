---
id: A3
title: pipeline-dedupe-index-return
type: task
hitl: false
status: open
assignee: 
blocked_by: []
blocks: [A1, A4, A2]
created: 2026-09-14
resolved: 
grill: 
lane_gate: 
reviewer: 
self-approve: true
---
Category: De-dupe Index
Summary: Pipeline returns dedupe index; single claim site (Strong, DO FIRST)
Current: DiscoveryRunOutcome gains dedupeIndex; existing stream re-claim loop remains unchanged in scope.
Desired: Include dedupeIndex in outcome; ensure two runs with identical docs produce different dedupe statuses; ensure no hard-coded fingerprints remain.
Key-interfaces: DiscoveryRunOutcome, dedupeIndex, pipeline.ts, harvest-stream.ts
Acceptance: (1) outcome includes dedupeIndex; (2) test: two runs yield different quality.dedupe_status; (3) rg claimFingerprints in harvest-stream.ts returns 0 hits; (4) related suites green.
Out-of-scope: Any non-dedupe-related features.
