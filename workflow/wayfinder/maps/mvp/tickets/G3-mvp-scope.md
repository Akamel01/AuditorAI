---
id: G3
title: MVP scope boundary
type: grilling
hitl: true
status: closed
assignee: orchestrator (HITL with project owner)
blocked_by: [G1]
blocks: []
created: 2026-08-22
resolved: 2026-08-22
---

## Question

What is in and out of the MVP slice? Decide: file upload handling vs structured form/
paste inputs; persistence model (browser-local vs server KV) behind the persistence seam;
whether AI-assisted reasoning ships in MVP or deterministic-only first with AI behind a
flag; report export format(s); authentication (none/single-user?); which golden fixtures
are required for launch.

## Resolution

Decided HITL with the project owner (2026-08-22):

1. **Input intake: structured forms + file upload WITH server-side text extraction**
   (owner chose the ambitious option). Consequences: `InputSource` seam mandatory; upload
   endpoints require strict size/type validation and sanitization before deploy (Security
   node gate); extraction failures must surface as explicit input states, never silent.
2. **Report output: schema-valid JSON artifact + rendered Markdown; PDF via browser print.**
3. **Access: anonymous workspace keys** — auto-provisioned key per workspace, storable/
   shareable by the user; no accounts, no PII. Ties into hosted-KV persistence (ADR-0001).
4. AI adapter OFF by default already settled in ADR-0001; deterministic engine must ship
   complete regardless.
5. Golden fixtures: all five §32 fixtures are required for launch (brief-mandated, not a
   scope variable).

Registered as DEC-0002 in `state/decision-registry.json`.
