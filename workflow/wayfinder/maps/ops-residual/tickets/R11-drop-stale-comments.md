---
id: R11
title: Hardening — drop speculative source comments
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
**Summary:** Several comments in `harvest.ts` narrate removed code paths and historical hesitations; they no longer match the current source and add noise.

**Current behavior:** `harvest.ts` contains comments referencing a prior `getGitHead()` helper that has been removed and the deleted global hook. These comments are confusing.

**Desired behavior:** Remove the now-stale comments. Keep only comments that explain an explicit ceiling, an upgrade path, or a contract. New comments should pass the "explains a ceiling or contract" test.

**Key interfaces:**
- `harvest.ts` source comment removal only. No behaviour change.

**Acceptance criteria:**
- [ ] No comment references a helper or behaviour that no longer exists in the file.
- [ ] Typecheck and tests still pass.

**Out of scope:**
- Documentation refactors outside `harvest.ts`.

