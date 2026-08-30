---
id: R15
title: README + CONTRIBUTING refresh Production deploy section
type: task
hitl: false
status: open
assignee:
blocked_by: []
blocks: []
created: 2026-08-30
resolved:
---

## Agent Brief

**Category:** enhancement
**Summary:** Update the README and CONTRIBUTING docs so the Production deploy section reflects the new flow: merge to `main` triggers the discovery-harvest schedule and Vercel auto-deploys.

**Current behavior:** The Production deploy section in the README/CONTRIBUTING mentions manual Vercel CLI invocations. Since `discovery-harvest.yml` already runs after every push, mentioning manual deploy calls is misleading.

**Desired behavior:** Update both docs to describe: `main` is production; Vercel auto-deploys from main; the `discovery-harvest.yml` schedule runs separately and refreshes state. Reference the AGENTS.md `Eval gates` block for the freshness window.

**Key interfaces:**
- `README.md` and `CONTRIBUTING.md` — text-only edits.
- `docs/ops/deploy.md` (if present) — sync.

**Acceptance criteria:**
- [ ] README/CONTRIBUTING match the actual workflow.
- [ ] No commands reorder.

**Out of scope:**
- Migrating old tutorials.

