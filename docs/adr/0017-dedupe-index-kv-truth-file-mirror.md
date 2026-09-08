# ADR-0017: Dedupe index is KV truth with file seed and ROFS mirror

Grilled R10 (ops-residual) on 2026-09-04. `src/discovery/dedupe-persist.ts` already reads `state/dedupe-index.json` only; Vercel is read-only so the KV key was untouched, forking truth. We ratify KV-first.

## Decision

- **Load:** `KV GET discovery:dedupe:index` first via `DataStore`; if `null`, read file `state/dedupe-index.json` as seed (tests/local). No second fallback.
- **Persist:** `KV PUT discovery:dedupe:index` first; then best-effort `writeFileSync state/dedupe-index.json` wrapped in try/catch. On `EROFS` emit single `console.warn('dedupe: FS mirror skipped (ROFS)')` and continue — KV already holds truth.
- **Key:** `DISCOVERY_DEDUPE_INDEX_KEY = "discovery:dedupe:index"` in `src/lib/persistence/keys.ts`.
- **Siblings decided in same grill (no ADR):** R5 cancel is idempotent `POST .../cancel` → `cancelled` status (not `error`), `executeJob` polls `getJob` before each node, `D00-CANCELLED` log, UI `cancelling… → paused · cancelled by user`. R6 pagination returns latest page when `cursor === -1` (trimmed past) with `nextCursor = lastId` and comment documenting truncation. R7 Refresh bypasses `lastOnRunJobId` dedup by design → `title="Refresh bypasses dedup (manual reload)"` aria-label, minimal. R8 `harvestHealth` exposes `lockHolder:string|null` + `lockAcquiredAt:null` (no fake timestamp), derived via `harvestHealthSummary`. R9 `discovery-doctor --json` emits single JSON `{providers:[{id,enabled,hostsOk,sampleHits}], totals}` to stdout, exit code unchanged.

## Considered Options

- **File stays truth in prod:** keeps Vercel snapshot but fork is permanent; discovery would dedupe against stale set, re-acquiring duplicates. Rejected.
- **Split env (file local, KV prod):** hides the fallback path from tests; KV-first with file seed is uniformly testable via `MemoryStore`.
- **Remove file mirror entirely:** would break `git diff` observability and local-dev without KV; keeping best-effort mirror preserves debuggability.

## Consequences

- `MemoryStore` tests must seed file fallback by putting KV first, then optionally writing file; ROFS test throws on `writeFileSync` to assert warn path.
- Reverting means swapping load order back to file-first and deleting the KV-first block — reversible but reintroduces fork.
- R8 health and R9 doctor contracts are additive and backward-compatible; revert is delete sub-object/flag.

## Status

Accepted 2026-09-04. Implementation touches `src/discovery/dedupe-persist.ts`, `src/lib/persistence/keys.ts`, `scripts/discovery-doctor.ts` (+ `--json` branch), `src/discovery/health-aggregate.ts` (extension), and `src/app/api/dev/discovery/[jobId]/cancel/route.ts` (new).
