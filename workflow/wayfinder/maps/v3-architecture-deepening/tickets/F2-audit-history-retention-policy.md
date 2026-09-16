---
id: F2
title: Audit-history retention policy (Flag #1)
type: task
hitl: true
status: closed
assignee:
blocked_by: []
blocks: []
created: 2026-08-30
resolved: 2026-09-16
---

## Question

Define/enforce narrowly scoped retention for drafts, issued issues, artifacts, and outcomes as distinct records. NOTE: ADR-0004 lifecycle is already implemented (write-once sequential revisions via `ws:{ws}:issue:{p}:{a}:{rev}`). This ticket is policy/enforcement only, not lifecycle implementation. Blocked on Flag #1 authority.

Source: workflow/wayfinder/maps/v3-architecture-deepening/MAP.md:178; .autoforge/discovery/tracker-index.md:31-35; .autoforge/plans/plan.md:148-163 (M6)

## Resolution

*Pending `FLAG_1_RETENTION_AUTHORITY`. Requires TTL/purge/export/legal rules, authorization, rollback backup/restore, and tests proving immutable issued issues survive. Use `persistence-single-writer` lock. See M6.*

## Resolution

Mechanism implemented 2026-09-16 per owner approval (+176/-0): RETENTION_POLICY table, TTL enforce (outcomes 730d, drafts ephemeral, issued NEVER purged by construction), export/restore envelopes with conflict abort, 8/8 tests. Legal-hold + purge-on-request identity DELIBERATELY unimplemented (flagged OWED Flag #1 follow-up in outcomes.ts:30-34). Reviewed PASS.
