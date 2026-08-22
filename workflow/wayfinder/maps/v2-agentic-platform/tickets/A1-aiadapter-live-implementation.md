---
id: A1
title: AiAdapter live implementation
type: task
hitl: false
status: resolved
issue: #12
assignee:
blocked_by: [R7, N2]
blocks: [A2, M3, E4]
created: 2026-08-22
resolved: 2026-08-22
---

## Question

Implement a real AiAdapter behind src/lib/ai.ts seam: fetch-based client (zero-dep like KvRestStore), env-configured (AI_BASE_URL/AI_API_KEY/AI_MODEL/AI_EFFORT), prompt assembly from Audit Context, response parsed into CandidateFinding[] validated against finding schema subset. OffAiAdapter remains default-off.

## Resolution

*(appended on resolution; assets linked, not pasted)*
