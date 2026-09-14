---
id: A5
title: health-bridge-consolidation
type: task
hitl: false
status: open
assignee: 
blocked_by: []
blocks: []
created: 2026-09-14
resolved: 
grill: 
lane_gate: foreign-bridge-lane
reviewer: lane-owner
self-approve: false
---
Category: Health Bridge Consolidation
Summary: Health fallback consolidation + shape freeze, bridge lane coordination
Current: Health bridge harvesting uses a separate health path; currently bridging to bridgeHarvestHealth exists but is not consolidated.
Desired: Freeze HarvestHealthBridge as single served interface; route through KV + file-backed sources; tests for shape ensure fields exist; avoid duplicate read patterns.
Key-interfaces: HarvestHealthBridge, bridgeHarvestHealth, KV store, file-ledger
Acceptance: (1) Route has no readFileSync fallback; (2) New test: 8-field shape; (3) existing harvest-health suite green; (4) no HEAD-duplication.
Out-of-scope: Any deeper health integration changes.
