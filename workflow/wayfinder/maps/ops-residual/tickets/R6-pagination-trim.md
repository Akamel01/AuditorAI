---
id: R6
title: Pagination across large job index
type: task
hitl: false
status: open
assignee:
blocked_by: []
blocks: []
created: 2028-08-30
resolved:
---

## Agent Brief

**Category:** bug
**Summary:** The list route uses `index.indexOf(cursor)` over an in-memory array that is trimmed to 20 entries. Once the index trims past the cursor, callers see an empty page that suggests a lost cursor.

**Current behavior:** After the 21st job is created, the oldest `jobId` falls off the index. A stale cursor pointing to that id then returns `jobs: []` and a `nextCursor: null` even if many more jobs exist beyond. The schema isn't violated but pagination becomes lossy.

**Desired behavior:** Use the KV index scan or a stable sorted scan as the source for the page rather than a static `index.indexOf`. When the cursor is not in the current scan window, reset by returning the latest page and a `nextCursor` set to the last returned `jobId`. Document the truncation behavior in the route comment.

**Key interfaces:**
- The list endpoint API shape stays `{ jobs, nextCursor, total }`.
- The page-size cap remains `[1, 20]`; default 10.

**Acceptance criteria:**
- [ ] When a stale cursor is requested and trimmed past, the response is the latest page with a `nextCursor` and `total`, never an unexpected `nextCursor: null` until the last page is reached.
- [ ] Tests cover: cursor present, cursor missing, cursor trimmed past.

**Out of scope:**
- Storing job bodies outside the index (storage ticket).

