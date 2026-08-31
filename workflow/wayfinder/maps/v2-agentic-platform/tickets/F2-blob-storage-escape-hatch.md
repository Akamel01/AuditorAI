---
id: F2
title: Blob-storage escape hatch for image attachments
type: task
hitl: false
status: open
assignee:
blocked_by: []
blocks: []
created: 2026-08-30
resolved:
---

## Question

If Upstash value limits make data-URL images untenable, add a second attachment implementation behind the stable `Attachment`/Repository seam. Currently fog until a fresh limit probe crosses policy margin.

Source: workflow/wayfinder/maps/v2-agentic-platform/MAP.md:68; workflow/wayfinder/maps/v3-architecture-deepening/MAP.md:68; .autoforge/discovery/tracker-index.md:7-11; .autoforge/plans/plan.md:75-92 (M2)

## Resolution

*Pending gates `BLOB_LIMIT_TRIGGER` and `BLOB_OWNER_SECURITY_AND_ROLLBACK`. Absent trigger means no code. If opened, add `src/lib/persistence/attachments/**` adapter behind `Repository`, prove migration/rollback, authorization/expiry/cleanup, and acquire `persistence-single-writer` lock. See M2 in plan.*

