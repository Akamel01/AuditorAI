---
id: F4
title: Postgres adapter as third DataStore
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

After Phase 3 key-scheme ownership and provider/runtime/schema/transaction/cutover authority, add a third `DataStore` adapter and remove silent KV-to-memory split-brain. Unlocked by Phase 3 key-scheme ownership.

Source: workflow/wayfinder/maps/v3-architecture-deepening/MAP.md:180; .autoforge/discovery/tracker-index.md:43-47; .autoforge/plans/plan.md:180-195 (M8)

## Resolution

*Pending `PHASE_3_KEY_SCHEME_AND_POSTGRES_AUTHORITY`. Must prove Memory/KV/Postgres contract matrix, schema/index/transaction, backup/restore, and no ORM/silent fallback. Use `persistence-single-writer` lock. See M8.*

