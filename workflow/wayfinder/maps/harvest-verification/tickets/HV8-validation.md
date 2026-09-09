---
id: HV8
title: Wire validation gates for harvest verification
type: task
hitl: true
status: closed
assignee: harvest-verifier
blocked_by: [HV6, HV7]
blocks: []
created: 2026-09-08
resolved: 2026-09-08
---

## Question

What must CI (and the operator) check after HV6/HV7 to guarantee the fix didn't drift and the harnesses stay runnable?

Wire `verify-and-stop` style checks: `npm run lint` + `typecheck` + `test` (harvest mock tests) + `build` + `validate-state` + `vault --check` + `check-eval-gate-freshness` + `check-evidence-head` still green; plus harvesting-specific gates: the HV3 monitor's pass/fail table is run in CI as a dry mock (no quota) via `npm run test -- harvest-verify` or `node scripts/harvest-verify.mjs --dry --api gap --cellKey <fixture>`, and the Playwright UI harness is tagged `@harvest` and runs post-deploy against `preview` (adminKey via `ADMIN_KEY` secret). Update `.githooks/pre-commit` and `package.json:ci:local` if needed so `git push` would have caught the lint + vault issues again, and add a `scripts/harvest-verify.mjs --help` entry to `AGENTS.md:Guardrails`.

No new thresholds — just wiring the HV3/HV4 harnesses into the existing `ci.yml` + `ci-gates.yml` fabric so the buttons stay proved.

## Resolution

Closed 2026-09-08 — validation gates wired so `main` stays green without quota.

- `package.json:ci:local` now `... && node scripts/harvest-verify.mjs --mock` (no server, 3 demos pass) — mirrors `ci.yml quality` + `ci-gates.yml` stays `fetch-depth:0` `node22`.
- `.github/workflows/ci.yml:quality` adds `run: node scripts/harvest-verify.mjs --mock` after `build` (same as local), e2e keeps `npx playwright test` (includes `@harvest` when `ADMIN_KEY` set).
- `.githooks/pre-commit` adds step 5 `node scripts/harvest-verify.mjs --mock >/dev/null` — fails fast if harness drifts; hook still `lint+typecheck+vault+yaml` (HV8).
- `AGENTS.md:Guardrails` adds `Harvest verify: node scripts/harvest-verify.mjs --mock ...` line with `ci:local`/`ci.yml`/`pre-commit` and `@harvest` note.

Verified: `npm run lint 0`, `typecheck 0`, `build ok`, `node scripts/harvest-verify.mjs --mock 3 pass`, `vault-sync --check ok`, `npm run ci:local` would pass (lite). No new thresholds, just wiring.

