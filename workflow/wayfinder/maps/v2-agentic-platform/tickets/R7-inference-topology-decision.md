---
id: R7
title: Inference topology decision
type: grilling
hitl: true
status: resolved
issue: #5
assignee: Akamel01
blocked_by: [R6]
blocks: [A1]
created: 2026-08-22
resolved: 2026-08-22
---

## Question

Given R6 findings, pick the runtime plane: direct HTTP gateway vs opencode serve on reachable host vs queue+worker. Includes effort-level mapping ('appropriate effort' knob) and latency/cost budget per audit run. HITL: cost/hosting tradeoffs are owner's.

## Resolution

Owner live session 2026-08-22 (Checkpoint α). **Direct Zen fetch** from Vercel functions; effort map cand=high / sum=low / judge=max; budgets ≤60 s per call, ≤3 calls per audit, $0 free-tier cap, circuit-breaker ⇒ OffAiAdapter; chain Zen→OpenRouter→Groq→Off; 4-probe smoke gate precedes A1 build. Full record: GitHub issue #5 resolution comment.
