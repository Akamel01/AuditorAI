---
id: R5
title: Stop/Cancel server endpoint
type: task
hitl: false
status: open
assignee:
blocked_by: []
blocks: []
created: 2026-08-30
resolved:
---

## Agent Brief

**Category:** enhancement
**Summary:** Add a server-side cancel endpoint so the UI Stop button is honest about whether the in-flight harvest has actually paused or is still running server-side.

**Current behavior:** The current `Stop` button clears the polling interval but the job continues server-side until `executeJob` completes D01–D10 or hits the Vercel `maxDuration`. The button label says `paused` while the server is still active, which is misleading.

**Desired behavior:** A new server route accepts a POST to tear down the running job for a given `jobId`. The route marks the job as `cancelled` if `queued` or `running`, and `executeJob` checks the status before each node and short-circuits via `setJobError('cancelled by user')`. The local `appendLog` records the cancel point. The route must require the same admin-key header as the existing routes.

**Key interfaces:**
- `src/discovery/jobs.ts:updateJob(jobId, patch, store?)` already exists and supports status patches; use it.
- `executeJob` reads `getJob(jobId, store?)` between `DISCOVERY_NODE_IDS` iterations; bail using a known sentinel status before appending `setJobError`.
- Front-End: `provider-health.tsx` `handleStop` should call the new endpoint when the server hasn't already auto-marked done.

**Acceptance criteria:**
- [ ] A test confirms the cancel endpoint flips a `running` job to `cancelled` (or to `error/cancelled by user`) in MemoryStore and the next `executeJob` iteration bails.
- [ ] A run that completed a node already logs a `cancelled` message at the start of the next node and stops the loop.
- [ ] UI label becomes `cancelling…`, then `paused · cancelled by user` when the server marks it cancelled; the polling continues until terminal.

**Out of scope:**
- Mid-process abort signals through pipeline nodes (caller can simply not call them).

