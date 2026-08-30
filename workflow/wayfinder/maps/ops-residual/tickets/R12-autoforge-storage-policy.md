---
id: R12
title: AutoForge staging — exclude `.autoforge/` from committed tree
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
**Summary:** Decide whether `.autoforge/` should be committed as part of the repository or whether its state lives outside the worktree.

**Current behavior:** `.autoforge/` shows up as `??` (untracked) under `git status`. Agents dump discovery, plans, evidence and reviews into it during runs, but nothing commits those files. The very map file describing what just ran is untracked. Future runs in fresh clones lose historical context.

**Desired behavior:** Either (a) commit a curated subset (`.autoforge/state.json`, decision docs, completed plans/reviews) and continue treating extracted evidence as untracked, or (b) add `.autoforge/` to `.gitignore` and lean on `artifacts/` only. Pick one of the two as a deliberate policy and write it into `.autoforge/AGENTS.md`.

**Key interfaces:**
- `.gitignore`: existing; just add or remove the ignore line.
- `.autoforge/AGENTS.md`: existing; add a "Storage policy" section.

**Acceptance criteria:**
- [ ] Document the chosen path in `.autoforge/AGENTS.md`.
- [ ] `git status` shows no spurious listings after a typical call to the AutoForge pipeline.

**Out of scope:**
- Migrating historical runs.

