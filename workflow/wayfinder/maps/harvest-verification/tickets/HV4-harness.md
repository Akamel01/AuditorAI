---
id: HV4
title: Build one-command harnesses for both buttons (API + UI)
type: prototype
hitl: true
status: open
assignee:
blocked_by: [HV1, HV2]
blocks: [HV6, HV7]
created: 2026-09-08
resolved:
---

## Question

How can an engineer (or CI) verify *both* harvesting entry points with one command each, and know which button was exercised?

Prototype two harnesses that hit the same backend seam but are traceably distinct:

- **API harness**: `scripts/harvest-verify.mjs --api gap  --cellKey <key> [--live]` and `--api harvest [--live]` — POST /api/dev/discovery/run with the same payloads the UI uses, then hand the jobId to the HV3 monitor. Must set `x-admin-key` and handle 202 vs 400 (UnknownCellKey) vs 401.

- **UI harness**: `tests/e2e/harvest-buttons.spec.ts` (Playwright) — visits `/dev/mission-control`, pastes admin key into the `auditorai.admin_key` gate, clicks `Run this gap (Live)` on a known gap card (`data-testid=run-gap-*`) and separately clicks `Run live harvest` in ProviderHealth, asserting the same backend invariants as the API harness but via the UI's localStorage + polling path.

Both should reuse the HV3 monitor for backend evidence so API vs UI is a thin driver difference, not a fork. Keep selectors stable (`data-testid=gap-card-*`, `data-testid=run-gap-*`) — add them if missing.

Deliverable: two runnable harnesses + a `docs/research/harness-design.md` that maps button → harness → backend seam and shows the one-liner to run each.
