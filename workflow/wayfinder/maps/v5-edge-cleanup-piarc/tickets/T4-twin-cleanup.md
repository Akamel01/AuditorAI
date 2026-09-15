---
id: T4
title: twin-cleanup
type: task
hitl: false
status: closed
assignee: 
blocked_by: []
blocks: [T1, T2, T3]
created: 2026-09-14
resolved: 2026-09-14
grill: 
lane_gate: 
reviewer: 
self-approve: true
---
Category: Cleanup
Summary: Delete 196 untracked src/**/*.js + tests/**/*.js twins (all verified same-basename .ts twin, zero orphans) + scoped .gitignore rule.
Current: 196 untracked .js shadow .ts under local vitest/eslint; CI-clean, local-poisoned. Zero tracked .js in src/tests. Zero relative .js imports (only ajv/dist node_modules-safe).
Desired: rm all 196; .gitignore gains src/**/*.js + tests/**/*.js (NOT blanket **/*.js: next.config.js/playwright.config.js/scripts must stay visible); git check-ignore verifies; full lint+typecheck+test+build green.
Contract (grill B/HIGH): before delete, diff route twin pairs (esp. app/api/dev/health + discovery) for .js-only drift; port drift to .ts or record none. Land FIRST (unblocks T1-T3 shadow risk).

## Resolution

Executed by orchestrator, merged f0d0f19: 196 untracked .js twins deleted (all twin-paired, drift check showed .js=older logic) + scoped gitignore (src/tests only); lint/typecheck/test/build green. Leftover: 35 untracked .jsx (foreign, untouched) + ignored coverage route.js.
