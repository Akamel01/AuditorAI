# Architecture Decisions — 28-entry Frontier (R1–R19 + T2 + M1–M8) — Corrected Grilling 2026-09-01

Date: 2026-09-01
Source: discovery 28-entry tracker-index.md (R1–R19+T2+M1–M8), grilling.md 513+ lines patched (MAP 41-59 fixes, locks plan 399-404, M gates 66-196), plans/plan.md prior wave (443 lines), ops-residual MAP:41-59, evidence byte-identity 056b75f ↔ a715ee8, seams `harvest.ts:99-104`, `ledger.ts`, `brave-search.ts:58-83`, `provider-health.tsx:135-144`, `store.ts`, `vault-sync.mjs`, `src/wayfinder/tickets.ts`
Ponytail: reuse `DataStore/KvRestStore.call()` seam, stdlib, no new deps, no generic facades.

## AD-01 — Preserve existing deep seams (no new facade)

Use `Repository/DataStore` at `src/lib/persistence/store.ts:16-26` for storage variation, `harvest.ts:98` lock + `ledger.ts:8`/`jobs.ts:41` for discovery, `providers/*` + `withHostBudget`/`retryAfterMs` at `brave-search.ts:45` for search, `provider-health.tsx:138` `lastOnRunJobId`+`JOB_STORAGE_KEY` for UI dedup, `scripts/vault-sync.mjs:16` HEAD worktree for vault, `src/wayfinder/tickets.ts` + `TRACKER.md` for Wayfinder plumbing. No `DistLockService`, ORM, AI framework, cache, or generic retention layer.

## AD-02 — R1: KV SET NX via `DataStore.setIfAbsent` (ponytail ladder rung 5 → rung 3)

**Decision:** Add `setIfAbsent(key,value,ttlSeconds):Promise<boolean>` to `DataStore` at `store.ts:16`. `KvRestStore` → `["SET",key,value,"NX","EX",ttl]` via existing `call()` at `store.ts:68`; `MemoryStore` → atomic `!m.has→set`. New `src/discovery/harvest-lock.ts` `acquireHarvestLock(workspaceHash, ttl=3600, store?)` with `discovery:harvest:lock:{hash}`. `harvest.ts:98-104` boolean replaced. Local fallback = process flag + single WARN.

**Rejected:** Redlock lib, SDK pipeline, per-cell locks (Not yet specified MAP Notes — after R1).

**Boundary:** `DataStore` owns transport atomicity; `harvest-lock.ts` owns key/TTL; `harvest.ts` owns busy → `setJobError` without throw + `finally` release. `ponytail: 3600s TTL ceiling`.

**Lock:** `persistence-single-writer`.

## AD-03 — R2: ledger ordering hardened, orphan self-heal (no CAS yet)

**Decision:** Keep `appendLedgerKV(entries,store?)`/`getLedgerTailKV(limit,store?)` at `ledger.ts:8-39`. `append` dedup+sort+trim(500); `getTail` `getMany`→`filter(null)`→`sort(seq)` (existing at 37) + best-effort writeback dropping orphans. No Lua/CAS — prove hardening under 50-entry concurrent test first. `ponytail: 500-trim bound`.

**Alternative deferred:** CAS on `INCR` seq allocator if contention persists (separate ticket).

**Lock:** `persistence-single-writer`.

## AD-04 — R3: regression tests, no seam change (HOLD behind R1/R2)

Cover busy-harvest, `onRun` dedup at `provider-health.tsx:138`, persist-before-done ordering via existing `MemoryStore`/spy seams. `vitest` only. **HOLD** — dispatchable but serialized by hazard, not DAG.

## AD-05 — R4/R17: HITL proof + HEAD anchoring, schema-stable evidence (HOLD / FOG)

**Decision:** R4 is **HOLD** `HITL_PRODUCTION_DAEMON_PROOF` capture only (no code); R17 is **FOG** `scripts/check-evidence-head.mjs` + CI `evidence-head-check` (assert `commit==HEAD` and `generatedAt` ±24h of HEAD author date). Regen path `workflow_dispatch regen-evidence=true` overwrites both `.autoforge/validation/ops-loop-evidence.json` and `stages/07_validate/output/ops-loop-evidence.json` atomically, preserving `cmp -s` byte-identity. No schema change beyond `commit`/`generatedAt`.

**Invariant:** `vault-sync --check` + `cmp -s` twin per `plan.md:55-56`.

## AD-06 — R5–R15 hygiene: minimal boundaries (OPEN — dispatchable)

- **R5 cancel (OPEN):** explicit `DiscoveryJobStatus "cancelled"` at `jobs.ts:10` + `POST /api/dev/discovery/jobs/[jobId]/cancel` (requireAdmin) → `updateJob`; `executeJob` at `harvest.ts:146` polls `getJob` per `DISCOVERY_NODE_IDS` iteration and bails via `setJobError("cancelled by user")`. Page-workspace lock shared with M5/M7. `ponytail: per-iteration poll`.
- **R6 pagination (OPEN):** replace `index.indexOf(cursor)` at `jobs.ts:234` with stable scan — missing/trimmed cursor returns latest page with `nextCursor`; no storage change.
- **R7 refresh (OPEN):** `title` explaining dedup bypass on `provider-health.tsx:478` Refresh button.
- **R8 health (OPEN):** pure `src/discovery/health-aggregate.ts:harvestHealthSummary` additive to `GET /health` at `src/app/api/dev/health/route.ts:132`.
- **R9 doctor (OPEN):** `--json` branch at `scripts/discovery-doctor.ts:17` single JSON stdout, exit codes unchanged.
- **R10 dedupe (OPEN):** KV-first load (`s.get(DISCOVERY_DEDUPE_INDEX_KEY)` at `keys.ts:50` → file seed only on null), KV-first persist + file best-effort `EROFS` WARN at `dedupe-persist.ts:70`.
- **R11/R14 (OPEN):** comment-only (R11 removes stale `getGitHead` refs at `harvest.ts:98`; R14 keeps `--topup` next to `--rebase`).
- **R12 staging (OPEN):** curated commit (`state.json`, `decisions/**`, completed `plans/reviews`) vs full ignore — documented in `.autoforge/AGENTS.md` Storage policy; `git status` must be clean after pipeline. `ponytail: curated, not blanket ignore`.
- **R13 freshness (OPEN HITL):** `scripts/check-eval-gate-freshness.mjs` reads `state/eval-scorecards/` mtime, threshold from `docs/validation/eval-gates.md` (not hardcoded), CI `gate-freshness` fails >7d. Doctrine `HITL_EVAL_DOCTRINE_FROZEN`.

All reuse existing seams; no new abstractions.

## AD-07 — R16 Brave 402: graceful but observable (FOG)

**Decision:** `brave-search.ts:58-83` keeps `return []` on 402 at line 61 but adds (1) `refusals` entry `brave:USAGE_LIMIT_EXCEEDED` propagated via `pipeline.ts:92` `runDiscoveryNode` aggregation, (2) `WARN brave quota 402` structured log token, (3) `GET /health` `providers.brave.degraded` (or harvestHealth refusal count) when last 2 runs 0 Brave hits. Pipeline already tries Google CSE before seeds — assert not short-circuited at `harvest.ts:327`. No key rotation in code (HITL `FOG_BRAVE_QUOTA_REPLENISHMENT_HITL` per plan 260).

**Lock:** none (health read hazard under `persistence-single-writer`).

## AD-08 — R18 Bento: verification only, zero code (FOG HOLD)

**Decision:** No API change to `src/app/_components/ui/*` (13 +2 files) and `src/app/dev/mission-control/**`. Verification: 0 `*.jsx/*.js` shadow (`git ls-files --others`), `npm run build` 13.9kB, `lint` 0 errors, visual segmented/odd-matrix/kpi-strip, `git diff main...feat/mission-control -- ui/` empty. `stages/` vs `.autoforge/stages/` divergence tracked separately. `ponytail: verify-and-stop only`.

## AD-09 — R19 Wayfinder plumbing traceability (OPEN)

**Decision:** Markdown remains canonical (`workflow/wayfinder/TRACKER.md:15`, `maps/ops-residual/tickets/R19-*.md` front-matter `id/title/type/hitl/status/blocked_by/blocks`). `src/wayfinder/tickets.ts:parseTicketFrontMatter` + `classifyTickets` + `WAYFINDER_MAPS_DIR` compiles into `TicketIndex` for Mission Control (`/dev/mission-control` Tickets tab) and `npm run tickets` CLI. `tracker-index.md:93-95` is compiled verbatim from this index + `MAP.md:58-59` (not hand-edited). No KV mirror, no new store. `ponytail: pure fn compilation, no new dep`.

**Rejected:** KV/DB duplicate tracker (drift), GitHub-only (breaks local-markdown guarantee).

**Boundary:** `tickets.ts` owns parse/classify/index; `MAP.md Decisions so far` owns narrative trace; `tracker-index.md` owns frontier snapshot; Mission Control owns board rendering (polls via existing `adminApi` seam).

**Lock:** none (read-only); board poll shares `page-workspace-single-writer` hazard if editing tickets.

## AD-10 — T2 closed, M1–M8 held (no speculative dispatch)

T2 `ops-seamless-verify` closed 2026-08-30 (`dce8f08`) per `plan.md:24-25` + tracker-index 98-101. Residual `ledgerGrowth/production/daemon false` tracked by R4/R17, not reopened. All M1–M8 remain **BLOCKED HOLD** per plan gates 66-196; no planner dispatch until owner/data/HITL asserts. `M1→M4` semantic edge preserved; other overlaps are resource hazards, not `blocked_by`.

**M gates HOLD:**
- M1 `OWNER_GF_SOURCE_AND_ACCEPTANCE` + `passes_corpus_mark` + fresh Tier-1
- M2 `BLOB_LIMIT_TRIGGER` + security/rollback owner (FOG)
- M3 `VAULT_CONFLICT_TRIGGER_AND_OWNER` (HITL)
- M4 `M1→M4` + `OWNER_ASSIST_SCHEMA_AND_QUALITY` + `FRESH_TIER_1`
- M5 `FLAG_2_PRODUCT_COMMITMENT` + live bottleneck
- M6 `FLAG_1_RETENTION_AUTHORITY` (ADR-0004)
- M7 `RSC_MEASURABLE_TARGET_AND_RISK_ACCEPTANCE` (FOG)
- M8 `PHASE_3_KEY_SCHEME_AND_POSTGRES_AUTHORITY`

## AD-11 — Locks & touches (extended for 28-entry)

| Lock | Members | Policy |
|---|---|---|
| `vault-state-single-writer` | M1, M3, R12, R13/R17 writers, R4 evidence regen, any `vault/**`/`state/vault-notes.json` compiler | sequential; `vault-sync --check` before handoff |
| `persistence-single-writer` | M2/M6/M8 + **R1/R2/R5/R6/R8/R10** (+ R16 health read hazard) | sequential, no semantic ordering, first-ready wins |
| `page-workspace-single-writer` | M5/M7 + **R5(UI)/R7/R19(board)** | sequential |
| `eval-canonical-report` | M1/M4 + R13/R14 | read-only gate, M4 after M1 |

R touches: R1 `[store.ts, harvest-lock.ts, harvest.ts]` hazard `persistence/**`; R2 `[ledger.ts]`; R5 `[cancel/route, jobs.ts, harvest.ts, provider-health.tsx]`; R6 `[jobs.ts, jobs/route.ts]`; R8 `[health-aggregate.ts, health/route.ts]`; R10 `[dedupe-persist.ts, keys.ts]` hazard `persistence/**+state/**`; R16 `[brave-search.ts, pipeline.ts, health]`; R17 `[check-evidence-head.mjs, ci.yml]` hazard `state/**`; R19 `[R19 ticket, MAP.md:58-59, tickets.ts, ticket-types.ts]`; R11/R14/R15 docs only. Disjoint unlocked Rs may parallel; overlapping locks serialize.

## AD-12 — Vault & evidence invariants as architecture

Vault byte-identity and evidence byte-identity are structural invariants, not quality gates. `vault-sync.mjs:16-44` is verification, not a lock; writers must serialize via `vault-state-single-writer`. Evidence regen is atomic over both `.autoforge/validation/ops-loop-evidence.json` ↔ `stages/07_validate/output/ops-loop-evidence.json` (`cmp -s`); staleness CI ties `commit` to `HEAD`. Any worker mutating `state/vault-notes.json` concurrently is correctness violation.

## AD-13 — Deletion & deepening follow-ons

- Do not bundle Postgres+Blob, report+recommendation assists, or vault UX+compiler — each has distinct trigger/owner.
- `store.ts:130 createFallbackStore` silent KV→Memory fallback violates `StoreUnavailableError` honesty — resolve before M8 cutover (`ponytail: global fallback ceiling until M8`).
- `jobs.ts:94 triplicated if(store) else if(isKv()) else file` branch — keep now, extract `resolveStore(store?)` if fourth caller appears (`ponytail: triplicated branch ceiling`).
- `DedupeIndex` KV/file fork hidden behind `isKv()` at `jobs.ts:53` — R10 makes it explicit.
- Wayfinder `tickets.ts` deepening is sufficient; R19 traceability leverages existing depth — no new module needed.

## Risk register (delta highlights)

- Cross-lambda split-brain via singleton fallback — mitigated by injected `store?` seam and R1 observability; M8 cutover must remove silent fallback.
- Orphan index growth / `KEYS` latency — bounded by 500 trim; heal pass masks but bounded.
- Health shape break — additive only; document nullable degraded flag.
- Staging poison via `git add -A` — R12 doc + potential CI `git status` check.
- Ticket index drift (R19) — `tracker-index.md` stale if tickets edited without recompile; mitigate via `npm run tickets` CI check.
- Evidence staleness — `commit != HEAD` visible via R17 CI gate.

## ADR deltas

No new ADR required beyond existing `docs/architecture/overview.md` and `docs/adr/0004`, `0006/DEC-0007`, `0008` references. If owner requires formalization: ADR-001 extension for `DataStore.setIfAbsent` atomicity, ADR-0001 follow-on for fallback honesty, short ADR for evidence HEAD anchoring (R17) and Wayfinder plumbing traceability (R19). Defer until HITL approves.

---
Acceptance: all 28 entries (R1–R19 + T2 + M1–M8) addressed with seam choices, lock/touches, vault/evidence invariants, no new deps, ponytail ceilings tagged.
