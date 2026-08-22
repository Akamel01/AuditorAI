---
id: N2
title: Step-mode pipeline executor refactor
type: task
hitl: false
status: resolved
issue: #8
assignee: Akamel01
blocked_by: [N1]
blocks: [N3, D3, A1, E4]
created: 2026-08-22
resolved: 2026-08-22
---

## Question

Refactor engine.ts runAudit monolith into an explicit node pipeline matching audit_graph. New interface: runAll() (behavior-identical; golden fixtures GF-1..5 byte-stable = regression gate) and runNode(id, sharedState) for stepping. Every node emits versioned Audit Artifacts {producer, version, validation_status} per CONTEXT.md.

## Resolution

*(appended on resolution; assets linked, not pasted)*
