---
id: R7
title: Refresh parity for parent reload on manual click
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
**Summary:** The manual `Refresh` button bypasses the `lastOnRunJobId` dedup path on purpose, but this behaviour should be surfaced as an explicit annotation rather than a JSX comment.

**Current behavior:** The provider-health Refresh button reloads the parent dashboard without going through `onRun`. The implementation is correct: Refresh is a deliberate user action. But the code annotation is a comment rather than a structured help tooltip, leaving future readers to discover the design intent only by reading source.

**Desired behavior:** Add a short tooltip or aria-label that explains why Refresh bypasses the dedup gate, without inventing a new abstraction. Keep the change minimal and respect the component's existing outline.

**Key interfaces:**
- Existing `provider-health.tsx` component; minimal additions to the existing tooltip mechanism if present, otherwise basic HTML `title` attributes on the Refresh control.

**Acceptance criteria:**
- [ ] Refresh button exposes a clear `title` (or equivalent) explaining it bypasses the dedup.
- [ ] No new dependencies.

**Out of scope:**
- Replacing the dedup gate itself.

