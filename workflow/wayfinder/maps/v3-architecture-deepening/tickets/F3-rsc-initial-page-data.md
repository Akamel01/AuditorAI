---
id: F3
title: RSC/server-render initial page data from Repository
type: task
hitl: false
status: closed
assignee:
blocked_by: []
blocks: []
created: 2026-08-30
resolved: 2026-09-16
---

## Question

Only with measurable SEO/TTFB/loading target, spike a serializable server initial snapshot while retaining API mutations and `WorkspaceApiAdapter`. Idiomatic shift; value < risk now — fog until target + risk acceptance.

Source: workflow/wayfinder/maps/v3-architecture-deepening/MAP.md:179; .autoforge/discovery/tracker-index.md:37-41; .autoforge/plans/plan.md:165-178 (M7)

## Resolution

*Pending `RSC_MEASURABLE_TARGET_AND_RISK_ACCEPTANCE`. Probe must show before/after TTFB/loading/SEO and no Repository divergence. Sequential with M5 via lock. See M7.*

## Progress (2026-09-15)

H5 probe landed (see v6 H5): baseline numbers recorded, P1-P5 targets PROPOSED. No src changes. Awaiting owner numeric confirmation + risk acceptance before spike.

## Resolution

Answered 2026-09-16: loading-UX probe + isolated spike proved P2 unreachable without shell-weight work in production src (out of spike scope). Closed without landing; revisit as new proposal if shell diet is approved.
