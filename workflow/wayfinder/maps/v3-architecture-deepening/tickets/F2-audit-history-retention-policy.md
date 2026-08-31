---
id: F2
title: Audit-history retention policy (Flag #1)
type: task
hitl: true
status: open
assignee:
blocked_by: []
blocks: []
created: 2026-08-30
resolved:
---

## Question

Define/enforce narrowly scoped retention for drafts, issued issues, artifacts, and outcomes as distinct records. NOTE: ADR-0004 lifecycle is already implemented (write-once sequential revisions via `ws:{ws}:issue:{p}:{a}:{rev}`). This ticket is policy/enforcement only, not lifecycle implementation. Blocked on Flag #1 authority.

Source: workflow/wayfinder/maps/v3-architecture-deepening/MAP.md:178; .autoforge/discovery/tracker-index.md:31-35; .autoforge/plans/plan.md:148-163 (M6)

## Resolution

*Pending `FLAG_1_RETENTION_AUTHORITY`. Requires TTL/purge/export/legal rules, authorization, rollback backup/restore, and tests proving immutable issued issues survive. Use `persistence-single-writer` lock. See M6.*

