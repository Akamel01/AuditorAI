---
id: HV7
title: Live-verify "Run Live Harvest" with auto-monitor evidence
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

Does "Run Live Harvest" (gap-aware) actually run a gap-aware batch, with observable queue/coverage/ledger changes and no cross-talk with gap-targeted jobs?

Execute (AFK) the twin of HV6 for the gap-aware path: `node scripts/harvest-verify.mjs --api harvest --live --monitor` and `npx playwright test tests/e2e/harvest-buttons.spec.ts -g "live-harvest"` (ProviderHealth's Run live harvest button). Collect `state/harvest-verify/HV7-<jobId>.json` and assert HV5's gap-aware success table (job done, gaps_ranked recomputed, ledger may gain 0..N, coverage have_total may shift, health advances, queue ticker top 3 reflects new gaps). Prove the job store isolates gap vs harvest jobs (no localStorage key collision beyond `auditorai.discovery.jobId` being overwritten — monitor must track both jobIds discretely).

Deliverable: `state/harvest-verify/HV7-<jobId>.json` + resolution with pass/fail per HV5 row.

