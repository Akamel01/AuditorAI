---
id: T2
title: Fix Run Live Harvest — persisted progress + KV job store (issue #24)
type: task
hitl: false
status: open
assignee:
blocked_by: [T1]
blocks: []
created: 2026-08-26
resolved:
---

## Question

How to make `Run Live Harvest` show progress, survive refresh/tab switch, and auto-refresh ledger/queue — fixing `https://github.com/Akamel01/AuditorAI/issues/24` with both phases in one effort (not lite only)?

**Phase 1 — lite (no infra, survives short runs):** `provider-health.tsx:60` persisted running flag `localStorage auditorai.discovery.run {jobId,startedAt}` + `onRun={reload}` wiring `page.tsx:204` (`page.tsx:73 reload()` calls `fetchDiscovery/fetchHealth`), `visibilitychange` listener re-`reload()` on tab return, show `D01..D10` step from response `run/route.ts:136 {coverage,queue,packages}` instead of bare `"run triggered"` `provider-health.tsx:104`.

**Phase 2 — KV job store (survives Vercel timeout + refresh):** new `src/discovery/jobs.ts` `createJob/updateJob/getJob` via `getDataStore()` KV seam (memory/file fallback local), new `POST /api/dev/discovery/run` `202 {jobId}` then async `runDiscoveryPipeline` `pipeline.ts:338` `step` hook `updateJob(logs)`, new `GET /api/dev/discovery/jobs` + `GET /api/dev/discovery/jobs/[id]` polled every 1.5s while `running` (persists `jobId` in `localStorage`, resumes after refresh), button shows `D04 ACQUIRE (3/5)` + tail, final `reload()` on `done` updates `HarvestLog` `page.tsx:206` `ledgerTail`.

Verify with: `npx tsx scripts/discovery-doctor.ts --live` (brave OK 3 hits), `curl -H x-admin-key $ADMIN_KEY POST /api/dev/discovery/run` → `202`, poll jobs → `done`, `jq '.gaps_ranked[0:3]' state/odd-coverage.json`, `launchctl print gui/$(id -u)/com.auditorai.discovery | grep -E "state|last exit"` + `tail -20 /tmp/auditorai-discovery.log`, `gh run list --workflow discovery-harvest.yml`.
