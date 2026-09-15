---
id: T1
title: brave-edge-tests
type: task
hitl: false
status: open
assignee: 
blocked_by: [T4]
blocks: []
created: 2026-09-14
resolved: 
grill: 
lane_gate: 
reviewer: 
self-approve: true
---
Category: Edge tests (R16)
Summary: Real-provider 402/429/throw paths + pipeline refusal negatives in tests/domain/brave-quota.test.ts.
Current: Only FakeBraveProvider positive (refusal surfaces) + 2x zero-hit degraded + order; zero fetch mocks for 402/429 (brave-quota.test.ts:32-74).
Desired: 402->[] + degraded set no-throw; 429->skip no-throw; USAGE_LIMIT_EXCEEDED body w/o 402->degraded []; non-402 error + zero-hits->throw; degraded+with-hits->no refusal; non-degraded+zero-hits->no refusal.
Contract (grill A/HIGH+A/MED): absolute mkdtemp AUDITORAI_LEDGER_MIRROR + mtime guard; reset degraded AND zeroHitCounters in beforeEach (add resetHealthState export); extensionless @/ imports only; explicit stores, no sleeps.
