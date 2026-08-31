---
id: F3
title: Vault sync-conflict UX
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

Once real human+agent edit patterns accumulate and a qualifying vault divergence occurs, add deterministic path/hash/diff diagnostics at `scripts/vault-sync.mjs`/`vault-import.mjs` and fail closed to human resolution. Currently owner/HITL-gated until real trigger.

Source: workflow/wayfinder/maps/v2-agentic-platform/MAP.md:69; workflow/wayfinder/maps/v3-architecture-deepening/MAP.md:69; .autoforge/discovery/tracker-index.md:13-17; .autoforge/plans/plan.md:94-109 (M3)

## Resolution

*Pending `VAULT_CONFLICT_TRIGGER_AND_OWNER`. Provide deterministic divergent-path fixture, byte-identical compile, fail-closed instructions, and `node scripts/vault-sync.mjs --check`. Acquire `vault-state-single-writer` lock. See M3.*

