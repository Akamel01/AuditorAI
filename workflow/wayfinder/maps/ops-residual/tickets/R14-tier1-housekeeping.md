---
id: R14
title: Tier-1 archive script housekeeping
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

**Category:** bug
**Summary:** The Tier-1 archive helper currently has drifted commentary that no longer reflects how the script is invoked. Recomment the entry points and reference the doctrine by path only.

**Current behavior:** The script's help comments reference path components and flags that have been renamed. New operators follow outdated guidance.

**Desired behavior:** Keep top-of-file comments strictly what the script does; reference doctrine via relative paths. No behaviour change. Ensure `--topup <runId>` is documented next to `--rebase` so future flakes take the cheaper path.

**Key interfaces:**
- Header comment block of `scripts/tier1-archive.mjs` (or whichever script the doctrine names).

**Acceptance criteria:**
- [ ] Header comment contains only operationally relevant flags.
- [ ] Typecheck still passes.

**Out of scope:**
- Backfilling previous comments.

