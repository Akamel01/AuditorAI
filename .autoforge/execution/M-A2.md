# M-A2 execution brief (orchestrator-implemented; worker scaffold replaced)

Worker's first pass built a parallel toy (mock provider-filter.json, hardcoded gaps, duplicate
error/type, wrong DiscoverQuery shape — broke typecheck, never ran it). Orchestrator replaced it
with a faithful extraction; this brief describes what landed.

## What changed
- `src/discovery/harvest.ts`: new exported `buildDiscoveryCtx({live, cellKey, dedupeIndex?, validateCellKey?}, deps?)`
  + `CtxBuilderDeps` (readFileSync/cwd/listProviderIds/providerEnabled — HarvestDeps-compatible).
  Contains the REAL derivation moved verbatim from executeJob: odd.json validation, provider filter,
  gaps-aware null query + static fallback, dedupe-index file read. Pins: null-cellKey gaps-aware (R3);
  provider filter = union rule WITH agent-reach-search carve-out (dropping it would break UI-runtime-keyed
  discovery); validation skippable via validateCellKey:false. `harvest()` calls it (derivation moved
  out of the `harvest()` body; executeJob signature unchanged); stripped comments restored.
- `src/discovery/harvest-stream.ts`: tick path calls builder with validateCellKey:false + its own
  dedupeIndex; dry-run acquireDocs keeps HEAD fixtureDocsFor semantics (restored after worker neutered
  it — R1 fix); imports trimmed (JUR_MAP/themeFor/DEPRECATED/listProviderIds/providerEnabled/UnknownCellKeyError
  removed from stream). INTENDED BEHAVIOR CHANGES for stream: null-cellKey ticks gain gaps-awareness
  (were static); provider filter unified (carve-out preserved). NOT M-A2 scope: dedupe-threading hunks
  (`stream.dedupeIndex = outcome.dedupeIndex`) belong to the M-A3 lane (reviewed under M-A3).
- `tests/domain/discovery-ctx-builder.test.ts`: rewritten against the real contract (parity, gaps-aware
  null, static fallback, unknown-throws, tolerant mode, deprecated-excluded, carve-out).

## Verification (orchestrator)
- typecheck exit 0; runtime proof 10/10 via explicit-.ts imports (/tmp/verify-a2.ts, ephemeral).
- Local vitest NOT runnable meaningfully (stale untracked src/**/*.js twins shadow .ts); CI runs clean tree.
