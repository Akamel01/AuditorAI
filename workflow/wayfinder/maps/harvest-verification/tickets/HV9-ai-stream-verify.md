---
id: HV9
title: Live-verify AI Harvest Stream Start with auto-monitor evidence
type: task
hitl: false
status: open
assignee:
blocked_by: [HV3, HV4, HV5]
blocks: [HV8]
created: 2026-09-08
resolved:
---

## Question

Does the AI Harvest Stream Start button actually run the continuous gpt-5-nano harvest with observable backend side-effects and proper stream lifecycle?

Execute (AFK) against `main` locally: run the HV4 API harness `node scripts/harvest-verify.mjs --api harvest-stream [--cellKey <gap>] --live --monitor` and the UI harness `npx playwright test tests/e2e/harvest-buttons.spec.ts -g "ai harvest stream"` (ai-harvest tab), collecting the HV3/HV4 evidence bundle (`state/harvest-verify/stream-<streamId>.json`): stream status IDLE→RUNNING→VERIFYING→DONE|FAILED, iteration, coverage, logs, error. Assert stream reaches DONE or FAILED with verified coverage, ledger may gain packages, health advances, and job store isolation (no collision with discovery jobs). Prove stream survives pause/resume/stop if exercised.

Deliverable: `state/harvest-verify/HV9-<streamId>.json` + resolution with pass/fail per stream success table and links.

