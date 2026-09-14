# Architecture Decisions — Harvest Pipeline Deepening (loop 4)

Date: 2026-09-14
Source: hot-spot walk (`git log --oneline`) + organic friction scan; line evidence in `report.md` §1–2. All 92 existing tickets verified closed or owner/trigger-gated — zero dupes (full id list checked: A1/A2 taken under v2-agentic-platform; R1/F1-style short ids are map-scoped).
Map: proposed NEW map `v4-harvest-deepening` — justification: (a) A-series avoids collision with v2 A1/A2; (b) scope is harvest-pipeline depth, distinct from v2/v3 product-gate maps and closed ops maps. Series A: A1–A5.
Ponytail: reuse DataStore/MemoryStore, `provider.fetch`, ledger KV/file twin, `WorkspaceApiAdapter`-style injection; stdlib only; no new deps, no new top-level seams except A2's builder (lives in `harvest.ts`, no new file).
Supersedes: worktree `.autoforge/architecture/decisions.md` @ 2026-09-10 (uncommitted prior-loop frontier decisions; summarized in `report.md` §1).

## AD-A1 — Ledger run-persist behind the ledger seam (Strong)

- **Ticket:** id `A1` / title `ledger-run-persist-deepening` / map `v4-harvest-deepening`
- **Scope:** move run-slice persist (`src/discovery/harvest.ts:279-355`: seq alloc `:302-311`, file mirror `:336-344`) into `src/discovery/ledger.ts` as `appendLedgerRun(slices, ranAtIso, store?) → LedgerEntry[]` (seq + file mirror + KV append + trim one unit). `executeJob` call site (`:212-226`) becomes one call; `harvest.ts` keeps zero seq/INDEX_KEY arithmetic. `ledger.ts` keeps owning NX-hint/trim/orphan-prune (R2 untouched).
- **Acceptance (testable):** (1) `rg 'nextSeq|lastSeq|INDEX_KEY' src/discovery/harvest.ts` → 0 hits; (2) NEW test `tests/domain/discovery-ledger-run.test.ts`: two concurrent `appendLedgerRun` calls on MemoryStore → disjoint seqs, `getLedgerTailKV` total correct, file mirror written; (3) existing `discovery-ledger-r2` + `discovery-harvest` suites green; (4) typecheck green.
- **blocked_by:** `[]` (builds on landed R2, no gate). Sequence after/around foreign `harvest.ts` lane edits — rebase at implementation.
- **Self-approve:** TRUE (local refactor behind existing seam; KV+file two adapters = real seam).

## AD-A2 — Single DiscoveryCtx builder for harvest + stream (Strong)

- **Ticket:** id `A2` / title `harvest-ctx-builder` / map `v4-harvest-deepening`
- **Scope:** `buildDiscoveryCtx({live, cellKey}, deps?)` in `src/discovery/harvest.ts` (no new file); unify provider-filter policy (`harvest.ts:384-389` vs `harvest-stream.ts:151-154`, incl. agent-reach-search + DEPRECATED rules), query derivation (JUR_MAP/themeFor/gaps), dedupe file read, dry-run `acquireDocs` fixture wiring. `tickStream` imports it (already imports `harvest`). Preserve `UnknownCellKeyError` behavior.
- **Acceptance (testable):** (1) `harvest-stream.ts` contains no inline JUR_MAP/themeFor/provider-filter logic (imports builder); (2) NEW ctx unit test: same input via both paths → identical providerIds/query (stub deps, no jobs); unknown cellKey throws `UnknownCellKeyError`; deprecated excluded in live mode; (3) existing `harvest-stream` + `discovery-harvest` suites green.
- **blocked_by:** `[]`. Same-file lane as A3 (`harvest-stream.ts` disjoint regions) — sequence A3→A2 if one worker.
- **Self-approve:** TRUE (two callers = real seam; no interface widened beyond one builder).

## AD-A3 — Pipeline returns claimed dedupe index; single claim site (Strong, DO FIRST)

- **Ticket:** id `A3` / title `pipeline-dedupe-index-return` / map `v4-harvest-deepening`
- **Scope:** `DiscoveryRunOutcome` gains `dedupeIndex` (`src/discovery/pipeline.ts:342-346`); d08's clone (`:286`) becomes the returned index; delete stream re-claim loop (`src/discovery/harvest-stream.ts:220-233`); orchestrators persist via `dedupe-persist` only (keeps owning KV-first write — R10 untouched).
- **Acceptance (testable):** (1) outcome includes `dedupeIndex`; (2) NEW through-interface test: `runDiscoveryPipeline` twice with identical docs (MemoryStore, no orchestrator) → second run `quality.dedupe_status != unique`; (3) `rg claimFingerprints src/discovery/harvest-stream.ts` → 0; (4) existing `discovery-dedupe`, `discovery-coverage-dedupe`, `pipeline` suites green.
- **blocked_by:** `[]`.
- **Self-approve:** TRUE (smallest diff of the five; deletes a self-admitted wart).

## AD-A4 — d04Acquire via the provider.fetch seam (Worth exploring — grill first)

- **Ticket:** id `A4` / title `d04-provider-fetch-routing` / map `v4-harvest-deepening`
- **Scope:** route `d04Acquire` live fallback (`src/discovery/pipeline.ts:136-223`) through the originating hit provider's `fetch` (`provider-types.ts:25`); grill FIRST: %PDF-guard home (fetch contract vs acquire module), host-budget placement, non-PDF/error mapping. Index hits/quals by id once; remove dead `seq` (`:218`).
- **Acceptance (testable):** (1) `rg '(^|[^.a-zA-Z])fetch\(' src/discovery/pipeline.ts` → 0 bare-fetch hits (only `provider.fetch` / injected); (2) NEW test: fake `provider.fetch` returning non-PDF bytes → empty bundle + warn, zero network; (3) dead `seq` removed; (4) existing pipeline suites green.
- **blocked_by:** `[]` (grill gate is in-ticket, not a ticket dep).
- **Self-approve:** FALSE — NEEDS GRILL (interface home for %PDF guard affects every future provider adapter).

## AD-A5 — Health fallback consolidation + shape freeze, follow-up (Worth exploring — after bridge lane)

- **Ticket:** id `A5` / title `health-bridge-consolidation` / map `v4-harvest-deepening`
- **Scope:** AFTER the in-flight uncommitted bridge edit (`health-aggregate.ts:79-134` + `health/route.ts:134-150`) commits: move file-ledger fallback (`health/route.ts:139-150`) INSIDE `bridgeHarvestHealth`; freeze `HarvestHealthBridge` as the single served interface; thin route to auth + delegate; add shape-pinning test. FIRST step at implementation: diff against HEAD — if owning lane covered it, close as dup, no code.
- **Acceptance (testable):** (1) route contains no `readFileSync` ledger fallback (thin aggregator); (2) NEW test: bridge under KV-down + file-ledger-present → full 8-field shape with file-derived base fields; KV-down + no-file → nulls, shape intact; (3) existing `harvest-health` suite green; (4) dup-check against HEAD recorded in ticket comment.
- **blocked_by:** `[]` (lane dependency handled in-ticket via HEAD check, not a ticket edge).
- **Self-approve:** FALSE — NEEDS REVIEW (freezes a consumer-pinned contract; foreign-lane coordination).

## Sequencing (normative)

A3 → A1 → A2 (shared-file serialization where noted) → A4 (post-grill) → A5 (post-bridge-lane). All `blocked_by:[]` by front-matter; ordering above is planner guidance, not ticket edges. Collision sets + worker guards: `report.md` §4. No ticket touches `state/vault-notes.json`, gated tripwires, or the 92 closed maps.
