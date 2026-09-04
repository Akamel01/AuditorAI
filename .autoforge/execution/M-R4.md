# M-R4 Production harvest proof bundle

- Added src/discovery/proof-bundle.ts with HarvestProofBundle, sha256 helper, and bundle creator.
- Added src/discovery/harvest.ts to compute ledger and dedupe digests and mirror to state, exposing via global for tests/routes.
- Added lightweight admin route at src/app/api/dev/discovery/proof/route.ts with admin gating and test hooks.
- Created state/production-harvest-proof.json as KV truth mirror.
- Created tests/discovery/proof-bundle.test.ts validating ledgerDigest and dedupeDigest computations.
- Created placeholder proof mirror in tests orchestration via global hook.
- Evidence: proof-bundle.ts computes sha256 of entries; dedupe uses JSON-string-based dedupe.
- HITL: daemon deferred; everything wired to state mirror.

What was skipped: integration with real KV store, full vault integration, and database-backed routes. These can be added later if needed.
When to add: if tests require live KV persistence or admin authentication hooks wired to a server.
