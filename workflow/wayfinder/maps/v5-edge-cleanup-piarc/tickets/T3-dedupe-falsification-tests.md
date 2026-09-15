---
id: T3
title: dedupe-falsification-tests
type: task
hitl: false
status: closed
assignee: 
blocked_by: [T4]
blocks: []
created: 2026-09-14
resolved: 2026-09-14
grill: 
lane_gate: 
reviewer: 
self-approve: true
---
Category: Edge tests (R10)
Summary: Forced-KV-failure falsification + KV-load-failure fallback in tests/domain/discovery-dedupe.test.ts.
Current: KV-ok+file-ok order + chmod-ROFS covered; no put-throws case; coverage file tests pure fns only (discovery-dedupe.test.ts:38-82).
Desired: put throws->still file-mirrors + returns non-null index; KV load failure->file seed fallback.
Contract: tmp cwd (never process.cwd()), poll-not-sleep for mirror flush, afterEach restoreAllMocks; chmod-ROFS trick no-ops as root so use throwing-put fake instead.

## Resolution

Implemented + reviewed APPROVED_WITH_NOTES, merged f0d0f19: 2 falsification tests in discovery-dedupe.test.ts (put-throws, load-failure fallback); ROFS-chmod test dropped (bound to foreign dedupe-persist rewrite, belongs to that lane).
