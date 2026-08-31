---
id: F1
title: Real candidate-findings review UX — roadmap commitment
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

Make the smallest UX improvement to the existing candidate-findings review page/workspace. Roadmap commitment (Flag #2 decision) — candidates become auditor-reviewable work items before adjudication. Blocked until Flag #2 product decision and live usage bottleneck evidence.

Source: workflow/wayfinder/maps/v3-architecture-deepening/MAP.md:175-177; .autoforge/discovery/tracker-index.md:25-29; .autoforge/plans/plan.md:133-146 (M5)

## Resolution

*Pending `FLAG_2_PRODUCT_COMMITMENT` and `LIVE_REVIEW_BOTTLENECK`. When opened, patch `src/app/projects/[projectId]/audits/[auditId]/page.tsx` and `src/domain/audit-workspace.ts` preserving validation/whitelist/consent/provenance. Acquire `page-workspace-single-writer` lock. See M5.*

