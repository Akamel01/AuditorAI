---
id: HV8
title: Wire validation gates for harvest verification
type: task
hitl: true
status: open
assignee:
blocked_by: [HV6, HV7]
blocks: []
created: 2026-09-08
resolved:
---

## Question

What must CI (and the operator) check after HV6/HV7 to guarantee the fix didn't drift and the harnesses stay runnable?

Wire `verify-and-stop` style checks: `npm run lint` + `typecheck` + `test` (harvest mock tests) + `build` + `validate-state` + `vault --check` + `check-eval-gate-freshness` + `check-evidence-head` still green; plus harvesting-specific gates: the HV3 monitor's pass/fail table is run in CI as a dry mock (no quota) via `npm run test -- harvest-verify` or `node scripts/harvest-verify.mjs --dry --api gap --cellKey <fixture>`, and the Playwright UI harness is tagged `@harvest` and runs post-deploy against `preview` (adminKey via `ADMIN_KEY` secret). Update `.githooks/pre-commit` and `package.json:ci:local` if needed so `git push` would have caught the lint + vault issues again, and add a `scripts/harvest-verify.mjs --help` entry to `AGENTS.md:Guardrails`.

No new thresholds — just wiring the HV3/HV4 harnesses into the existing `ci.yml` + `ci-gates.yml` fabric so the buttons stay proved.

