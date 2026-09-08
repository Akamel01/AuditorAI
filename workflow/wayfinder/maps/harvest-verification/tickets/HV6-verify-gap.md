---
id: HV6
title: Live-verify "Run this gap (Live)" with auto-monitor evidence
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

Does "Run this gap (Live)" actually harvest the cell it claims to, with observable backend side-effects and no silent drop?

Execute (AFK) against `main` locally: pick a known gap from `GET /api/dev/coverage` `gaps_ranked[0]` (or a fixture gap like `UKxFEAS-01` if coverage is complete), run the HV4 API harness `node scripts/harvest-verify.mjs --api gap --cellKey <gap> --live --monitor` and the UI harness `npx playwright test tests/e2e/harvest-buttons.spec.ts -g "gap"` (headed once for proof), collecting the HV3 evidence bundle (`state/harvest-verify/<jobId>.json`): job logs D01..D10, ledger tail delta, coverage cell delta, dedupe delta, health. Assert HV5's gap-targeted success table.

If live quota blocks, prove degraded path (402/429) is surfaced via `runError`/`gapRunError` and ledger is correctly unmutated vs silently dropped. If deterministic mode is needed, run with `MemoryStore` mock and prove the same invariants without network.

Deliverable: committed evidence `state/harvest-verify/HV6-<gap>-<jobId>.json` + a `workflow/wayfinder/maps/harvest-verification/tickets/HV6-verify-gap.md## Resolution` that says pass/fail per HV5 row and links the bundle.

