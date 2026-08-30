---
id: R4
title: Production harvest proof bundle
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
**Summary:** Confirm on the live Vercel deployment — not just the local worktree — that the harvest loop survives: KV mirror growth, daemon health, and a real `launchctl` active count > 0.

**Current behavior:** The T2 close-out evidence explicitly records `ledgerGrowth: {verified:false}`, `productionDeploymentVerified:false`, and `daemonVerified:false`. The validator's GO is scoped to in-process behavior; the lock refuses to claim production durability without these signals.

**Desired behavior:** Capture a transcript and JSON bundle from `https://auditorai-gamma.vercel.app/api/dev/discovery` after a 24h observation window. The bundle should include: `GET /api/dev/health` response shape; a forced dry-run that increments `ledgerTail.length`; and `launchctl print gui/$(id -u)/com.auditorai.discovery | grep "state"` returning an active state. Store under `.autoforge/validation/ops-loop-evidence-live.json` and mirror to `stages/07_validate/output/`.

**Key interfaces:**
- Evidence JSON schema must remain compatible with the existing `ops-loop-evidence.json` reader in the validator.
- All secret values must remain redacted.

**Acceptance criteria:**
- [ ] `ledgerGrowth.verified` becomes `true` with before/after counts.
- [ ] `productionDeploymentVerified` becomes `true` with the deploy id captured.
- [ ] `daemonVerified` becomes `true` with the `launchctl` snippet and recent log tail.
- [ ] T2 ticket status flips from `blocked` to `resolved`.
- [ ] Validator re-runs and reports Go with no contradictions.

**Out of scope:**
- Architectural changes — only run and record.

