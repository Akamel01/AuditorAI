---
id: H10
title: Verify continuous reach-out (monitor + e2e + gates)
type: task
hitl: false
status: open
assignee:
blocked_by: [H9]
blocks: []
created: 2026-09-09
resolved:
---

## Question

How do we prove continuous reach-out runs till Stop, with no URL-invention and no self-DONE?

## Context

`scripts/harvest-verify.mjs --api harvest-stream` currently expects terminal `DONE|FAILED`; continuous mode never `DONE`s. `@harvest` e2e in `tests/e2e/harvest-buttons.spec.ts` same.

## Agent Brief

**Category:** verification
**Summary:** Extend monitor + e2e + gates for continuous semantics; keep `--mock` green.

**Key interfaces:**
- `scripts/harvest-verify.mjs` (`--api harvest-stream`, 2s poll), `tests/e2e/harvest-buttons.spec.ts` (`@harvest ai harvest stream`), `ci.yml quality` + `pre-commit` mock step (HV8)

**Acceptance:**
- [ ] Monitor: `--api harvest-stream --live --monitor --maxTicks N` (default e.g. 6) asserts `RUNNING` across ticks, `iteration`↑, `packages` non-decreasing, every `url` http(s) + Exa/Jina trace in logs; then `--stop` (or Stop API) → `FAILED stopped by operator`; exits 0 on that path
- [ ] E2E: Start-continuous → 2 polls `RUNNING` → Stop → `FAILED/stopped`; asserts POST body `continuous:true`
- [ ] Unit: provider test (H7) + stream test (H8) run in `npm run test`; `node scripts/harvest-verify.mjs --mock` still 3-pass in `ci:local`/`ci.yml`/`pre-commit`
- [ ] Evidence: `state/harvest-verify/HV10-stream_*.json` + ticket resolution

**Out of scope:** New thresholds; daemon/cron keep-alive is documented, not gated.
