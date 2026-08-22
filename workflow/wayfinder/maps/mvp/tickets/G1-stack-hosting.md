---
id: G1
title: Stack + free hosting choice
type: grilling
hitl: true
status: closed
assignee: orchestrator (HITL with project owner)
blocked_by: []
blocks: [T1, G3]
created: 2026-08-22
resolved: 2026-08-22
---

## Question

Which web stack and free hosting platform for the MVP? Candidates include Next.js on
Vercel free tier, Astro/React on Netlify, Cloudflare Pages+Workers. Evaluate current
free-tier reality, server-side functions for AI-key isolation, env vars, upload limits,
CI fit, and simplicity. Constraint: deployment choice must not dictate the domain model.
No Docker this phase.

## Resolution

Decided HITL with the project owner (2026-08-22):

1. **Next.js (App Router) + TypeScript on Vercel free tier.**
2. **AI: provider-agnostic adapter, OFF by default** — deterministic engine fully functional
   without it; adapters emit only bounded artifact types.
3. **Persistence: free-tier hosted KV behind a Persistence seam** (owner's explicit choice
   over browser-local; security surface acknowledged → Security node must cover endpoint
   protection and input validation before deploy).

Recorded as [ADR-0001](../../../../../docs/adr/0001-platform-baseline.md). Unblocks T1 and G3.
