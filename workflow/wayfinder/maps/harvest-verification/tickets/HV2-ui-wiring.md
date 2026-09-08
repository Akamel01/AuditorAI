---
id: HV2
title: Trace UI wiring for both harvesting buttons
type: research
hitl: false
status: closed
assignee: harvest-verifier
blocked_by: []
blocks: [HV3, HV4, HV5]
created: 2026-09-08
resolved: 2026-09-08
---

## Question

How are the two buttons *actually* wired today, and what state survives refresh/tab switch so an automated harness can drive them without a human?

Read `src/app/dev/mission-control/_components/provider-health.tsx` (Run live harvest: handleRun → POST /api/dev/discovery/run {live:true} → localStorage auditorai.discovery.jobId → 1.5s poll GET /api/dev/discovery/jobs/:id → onRun reload) and `src/app/dev/mission-control/_components/queue-ticker.tsx` (Run this gap (Live): onRunCell → page.tsx handleRunGap → POST /api/dev/discovery/run {live:true, cellKey} → same job store, ticker polling, gapRun UX), plus `src/app/dev/mission-control/page.tsx` (handleRunGap, gapPollRef, VaultPanel, segment cross-fade + gap-detail anchor). Note differences in payload, localStorage survival, polling vs visibility-change reload, and error surfacing (gapRunError vs runError). 

Deliverable: `docs/research/harvest-ui-wiring.md` with sequence diagrams for both buttons, a list of selectors/test-ids to drive them (`run-gap-*`, `provider-health Run live harvest`, localStorage key), and a note on what the auto-monitor must not double-count (dedup vs live coverage view).

## Resolution

Research subagent delivered `docs/research/harvest-ui-wiring.md:1` (290 lines) with sequence diagrams for both buttons, selectors (run-gap-*, provider-health aria-label, auditorai.discovery.jobId, auditorai.admin_key), and dedupe double-count note (harvest-log.tsx:81). No state mutated.
