---
id: R13
title: Eval gate §2 freshness automation
type: task
hitl: true
status: open
assignee:
blocked_by: []
blocks: []
created: 2026-08-30
resolved:
---

## Agent Brief

**Category:** enhancement
**Summary:** Automate the freshness check required by `docs/validation/eval-gates.md` §2 (no eval gate run older than N days without re-trigger).

**Current behavior:** Re-baselines are mentioned in `AGENTS.md: Eval gates` but no automation enforces them in CI. Operators sometimes miss the freshness window.

**Desired behavior:** Add a CI step that fails when the most recent Tier-1 archive in `state/eval-scorecards/` is older than the configured maximum age (default 7d). Threshold comes from doctrine, not the team's discretion.

**Key interfaces:**
- `state/eval-scorecards/` directory shape — read last-modified timestamp.
- New GitHub Actions step `gate-freshness` that runs `node scripts/check-eval-gate-freshness.mjs <max-age>`.

**Acceptance criteria:**
- [ ] When an archive is older than the threshold, CI fails with an actionable message.
- [ ] Threshold lives outside the script body and is sourced from `docs/validation/eval-gates.md` to keep doctrine authority.
- [ ] A test case exists for "fresh" and "stale" inputs.

**Out of scope:**
- Changing doctrine thresholds.

