---
id: T2
title: health-edge-tests
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
Category: Edge tests (R8)
Summary: listJobs-empty, tail-present-but-empty, lock-holder parse paths in tests/domain/harvest-health.test.ts.
Current: KV tail + done job, KV-down FailStore, KV-down + fallback covered; no healthy-empty or lock-holder tests (harvest-health.test.ts:15-97).
Desired: listJobs-empty on healthy store->lastRunStatus null shape intact; tail-present-but-empty on MemoryStore->base nulls indexedEntriesCount 0; empty tail + fallback backfill; holder-<epochMs>->lockHolder + ISO lockAcquiredAt; opaque job_ holder->lockHolder set + lockAcquiredAt null.
Contract: same as T1 (mirror guard, map reset, extensionless imports, explicit MemoryStore).
