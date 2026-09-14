Module: M-A3
- Objective: Resolve dedupeIndex threading in Discovery Run. Delete the stream re-claim loop and thread dedupeIndex via DiscoveryRunOutcome.
- Changes:
  - src/discovery/pipeline.ts: extend DiscoveryRunOutcome with optional dedupeIndex; adjust D08-QUALITY to mutate ctx.dedupeIndex in-place and attach to ctx for propagation; runDiscoveryPipeline now returns dedupeIndex.
  - src/discovery/harvest-stream.ts: stop using the legacy cross-tick claimFingerprints loop; consume dedupeIndex from runDiscoveryPipeline and assign to stream.dedupeIndex; remove claimFingerprints propagation.
  - tests/domain/discovery-pipeline-dedupe-index.test.ts: add pipeline-twice test validating dedupeIndex threading across runs; rely on MemoryStore for state persistence.
  - New test file: tests/domain/discovery-pipeline-dedupe-index.test.ts
  - New test: ensures rg of claimFingerprints in harvest-stream.ts is 0 (no direct calls in edited path).
- Outcome: DedupeIndex threads across runs; cross-tick dedupe persistence is achieved via run-outcome; tests pass.
