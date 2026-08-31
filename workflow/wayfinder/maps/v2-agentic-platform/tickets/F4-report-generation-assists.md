---
id: F4
title: Report-generation and recommendation-drafting LLM assists
type: task
hitl: true
status: open
assignee:
blocked_by: [F1]
blocks: []
created: 2026-08-30
resolved:
---

## Question

After M1's quality gate and owner approval, pilot typed draft-only report/recommendation assistance pending quality baseline from the eval corpus. Must preserve OFF default, provenance, and deterministic canonical report.

Source: workflow/wayfinder/maps/v2-agentic-platform/MAP.md:70-71; workflow/wayfinder/maps/v3-architecture-deepening/MAP.md:70-71; .autoforge/discovery/tracker-index.md:19-23; .autoforge/plans/plan.md:111-131 (M4)

## Resolution

*Pending `OWNER_ASSIST_SCHEMA_AND_QUALITY_INTERPRETATION` and `FRESH_TIER_1_ARCHIVE`, plus F1. Writes `src/lib/ai.ts`, `src/lib/inference.ts`, `src/domain/candidate-review.ts`; must not edit `renderReportMarkdown` or pipeline contracts. Prompt/engine/schema changes require newer Tier-1. See M4.*

