---
id: H4
title: Monitoring and visualization UI for AI harvest stream
type: task
hitl: false
status: open
assignee:
blocked_by: [H3]
blocks: []
created: 2026-09-02
resolved:
---

## Question

How do we let a developer control (start, pause, stop), monitor, operate, and visualize the `gpt-5-nano` web-search harvesting from `/dev/mission-control` without adding a new page or deps?

## Agent Brief

**Category:** enhancement
**Summary:** Extend `/dev/mission-control` with an AI Harvest tab that controls the `HarvestStream` via `src/lib/client.ts` and visualizes hits, qualification, packages, provenance, and `gpt-5-nano` web-search calls.

**Key interfaces:**
- `src/app/dev/mission-control/page.tsx` new segment `ai-harvest`
- `src/app/dev/mission-control/_components/ai-harvest-control.tsx` (start/pause/resume/stop buttons, status, iteration, coverage, logs)
- `src/app/dev/mission-control/_components/ai-harvest-viz.tsx` (hits → qualified → matched → acquired → packages Sankey/list, dedupe, ledger)
- `src/lib/client.ts` `fetchHarvestStream`, `startHarvestStream`, `pauseHarvestStream` etc., `src/wayfinder/ticket-types.ts`

**Acceptance:**
- [ ] `/dev/mission-control` has `AI Harvest` segment (like `Tickets` `page.tsx:29`), default `overview`, shows stream status `IDLE|RUNNING|PAUSED|VERIFYING|DONE|FAILED` + iteration + coverage `have_total/target_total`
- [ ] Buttons: `Start` (cellKey + live toggle, like `gapRun` `harvest.ts:398`), `Pause` (holds), `Resume`, `Stop` (server mark, like `R5` `harvest.ts:164`), all call `adminApi` with `x-admin-key`
- [ ] Polls `GET /api/dev/harvest-stream/[id]` every 2s when `RUNNING`, shows logs (tail `D01..D10`), hits list (url, title_hint, provider_id `ai-search`), web-search call trace (query, limit, latency)
- [ ] Visualization: hits (13) → qualified (in_scope/reserve) → matched (1) → acquired (1) → packages (1) → quality (1) as a flow, dedupe index, ledger tail
- [ ] No new deps, reuse `adminApi`, `withHostBudget` already, `ponytail:` for polling ceiling

**Out of scope:** Final audit UI, vault sync UX.
