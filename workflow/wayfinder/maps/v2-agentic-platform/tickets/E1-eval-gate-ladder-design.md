---
id: E1
title: Eval gate ladder design
type: grilling
hitl: true
status: resolved
issue: #7
assignee: Akamel01
blocked_by: []
blocks: [E3]
created: 2026-08-22
resolved: 2026-08-22
---

## Question

Three tiers proposed: Tier0 CI deterministic (goldens+schemas, exists); Tier1 corpus eval scored by ox-alpha-as-judge with rubrics per finding dimension; Tier2 owner sign-off for AI-on changes. Judge output = versioned validation record. HITL: thresholds owner sets.

## Resolution

Owner live session 2026-08-22 (Checkpoint α). Pass gate: **all dims ≥1 AND substance=2 AND evidence-grounding=2**; corpus pass mark **90 %**; regression tolerance **zero-drop** (any mean decline ⇒ Tier-2 review); Tier-2 triggers confirmed (adapter/prompt/engine-semantics/jurisdiction-pack). Judge effort=max. Dry-run on GF-1..GF-5 pre-corpus. Full table: GitHub issue #7 resolution comment.
