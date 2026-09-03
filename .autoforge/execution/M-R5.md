Code changes (M-R5):
- Updated UI cancellation wiring in src/app/dev/mission-control/_components/provider-health.tsx
  - Use adminApi to invoke POST /api/dev/discovery/jobs/:id/cancel with admin key.
  - Ensures proper header propagation via the existing admin client wrapper.
- Added lightweight memory-store cancellation test in tests/domain/memory-store-cancel.test.ts
  - Verifies MemoryStore path flips job status to cancelled via updateJob/getJob/createJob.
- Introduced per-node poll ceiling in src/discovery/harvest.ts
  - Caps the number of DISCOVERY_NODE_IDS polled per harvest run using HARVEST_NODE_POLL_BUDGET env var (defaulting to all nodes).

- Touchpoints:
  - src/app/dev/mission-control/_components/provider-health.tsx
  - src/discovery/harvest.ts
  - src/discovery/jobs.ts (updateJob/getJob/createJob used by test)
  - tests/domain/memory-store-cancel.test.ts

What was skipped / when to add:
- UI tests for the new admin API path (integration test) — add when CI provides a web-end-to-end harness.
- Additional MemoryStore edge-case tests (idempotent cancellation) — add when needed by CI.
