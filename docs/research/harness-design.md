HV4 Harness Design

- API gap harness: reuse HV3 monitor to drive discovery gap runs
- API harvest harness: reuse HV3 monitor for harvest runs
- API harvest-stream harness: POST /api/dev/harvest-stream and poll /api/dev/harvest-stream/:id (2s)
- UI gap harness: run gap via data-testid="run-gap-<key>" from the queue ticker, gate via localStorage auditorai.admin_key
- UI harvest harness: Run live harvest button in Provider Health (data-testid="provider-health-run-live-harvest"), and Start in AI Harvest (data-testid="ai-harvest-start")
- ADMIN_KEY env example: ADMIN_KEY=... npm run start
- Evidence paths:
  - API gap/harvest: state/harvest-verify/<jobId>.json
  - API harvest-stream: state/harvest-verify/stream-<streamId>.json
  - HV3/HV5 expectations preserved

- Commands to run harnesses (one-liners):
  - API gap: node scripts/harvest-verify.mjs --api gap --cellKey usa:DETAILED_DESIGN --live --monitor
  - API harvest: node scripts/harvest-verify.mjs --api harvest --live --monitor
  - API harvest-stream: node scripts/harvest-verify.mjs --api harvest-stream --cellKey usa:PRELIMINARY_DESIGN --live --monitor
  - UI gap: open /dev/mission-control in browser with admin gate and click Run this gap (Live)
  - UI harvest: use Provider Health Run Live Harvest button and AI Harvest Start as described above

Note: In all cases, use ADMIN_KEY to authorize live operations. For sandbox runs, use --mock or --dry where appropriate.
