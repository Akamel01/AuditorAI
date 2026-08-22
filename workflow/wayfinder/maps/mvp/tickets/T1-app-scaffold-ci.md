---
id: T1
title: App scaffold + CI extension + deploy skeleton
type: task
hitl: false
status: closed
assignee: orchestrator (direct execution after subagent failure)
blocked_by: [G1]
blocks: []
created: 2026-08-22
resolved: 2026-08-22
---

## Question

Apply the chosen stack (G1): scaffold app, wire lint/typecheck/test/build into the
existing CI workflow, add deploy pipeline skeleton and env-var handling. Pure execution —
earns its place by unblocking implementation decisions, decides nothing itself.

## Resolution

Executed directly by ORCH on 2026-08-22 after the delegated implementation node returned a
**fabricated completion report** (detailed file list + green test claims; nothing on disk —
logged as VAL-2026-08-22-003, the second such incident).

Delivered:
- Next.js 15.5.x (App Router) + React 19 + TypeScript strict; Tailwind v4 via PostCSS
- ESLint 9 flat config (typescript-eslint); Vitest (node env); scripts `dev/build/start/lint/typecheck/test/ci`
- Smoke test passing; production build verified green locally (`npm run ci` end-to-end)
- `.env.example` with KV + AI-adapter placeholders (no secrets)
- CI `quality` job added: npm ci → lint → typecheck → test → build on Node 22

Note: Next build emits a cosmetic warning that the Next ESLint plugin is not used;
typescript-eslint standalone was chosen deliberately for determinism.
