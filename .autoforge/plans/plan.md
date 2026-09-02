# Plan — 28-entry Frontier (R1–R19 + T2 + M1–M8) — Executable DAG

**Scope:** planning-only. No product code dispatched, no tracker/map/ADR/state mutation. Ponytail ladder enforced; vault determinism & evidence byte-identity hard constraints.

**Sources pinned:** `.autoforge/discovery/tracker-index.md` (28 entries verbatim, 2026-09-01) `workflow/wayfinder/maps/ops-residual/MAP.md:41-59` `.autoforge/requirements/grilling.md` (519 lines) `.autoforge/architecture/report.md` (346 lines) + `decisions.md` (124 lines) `src/discovery/harvest.ts:98-104` `src/lib/persistence/store.ts:16-26,68,130-181` `src/discovery/ledger.ts:8-39` `src/discovery/jobs.ts:10,41,233-235` `scripts/vault-sync.mjs:16-44` `src/wayfinder/tickets.ts:30-42`

**Model budget:** inherit `muse-spark-1.2 1M → 80k cap` (30% capped).

---

## 1. Tracker and status reconciliation (MUST cover all 28)

| # | Ticket | Tracker Source | Canonical source | Tracker status | Canonical status |
|---|---|---|---|---|---|
| 1 | R1 — Cross-instance harvest lock via Vercel KV atomic SET NX | v2/v3 Not-yet-specified | ops-residual MAP:41-42 | BLOCKED | BLOCKED — `persistence-single-writer` |
| 2 | R2 — Ledger KV ordering + orphan-key recovery | v2/v3 Not-yet-specified | ops-residual MAP:42-43 | BLOCKED | BLOCKED — `persistence-single-writer` |
| 3 | R3 — Regression tests for lock + dedup | v2/v3 Not-yet-specified | ops-residual MAP:43-44 | BLOCKED | BLOCKED — tests only; hazard-serialized |
| 4 | R4 — Production harvest proof bundle (Vercel KV + daemon) | v2/v3 Not-yet-specified | ops-residual MAP:44-45 | BLOCKED | BLOCKED HITL — `HITL_PRODUCTION_DAEMON_PROOF` |
| 5 | R5 — Stop/Cancel server endpoint | v2/v3 Not-yet-specified | ops-residual MAP:45-46 | OPEN | OPEN — `persistence` + `page-workspace` |
| 6 | R6 — Pagination cursor stability | v2/v3 Not-yet-specified | ops-residual MAP:46-47 | OPEN | OPEN — `persistence-single-writer` |
| 7 | R7 — Refresh parity tooltip | v2/v3 Not-yet-specified | ops-residual MAP:47-48 | OPEN | OPEN — `page-workspace` |
| 8 | R8 — Health route `harvestHealth` | v2/v3 Not-yet-specified | ops-residual MAP:48-49 | OPEN | OPEN — `persistence-single-writer` |
| 9 | R9 — Discovery doctor JSON contract | v2/v3 Not-yet-specified | ops-residual MAP:49-50 | OPEN | OPEN — no lock |
| 10 | R10 — `state/dedupe-index.json` KV-truth | v2/v3 Not-yet-specified | ops-residual MAP:50-51 | OPEN | OPEN — `persistence` + `vault-state` |
| 11 | R11 — Drop speculative source comments | v2/v3 Not-yet-specified | ops-residual MAP:51-52 | OPEN | OPEN — no lock |
| 12 | R12 — AutoForge staging policy | v2/v3 Not-yet-specified | ops-residual MAP:52-53 | OPEN | OPEN — `vault-state-single-writer` |
| 13 | R13 — Eval gate §2 freshness automation | v2/v3 Not-yet-specified | ops-residual MAP:53-54 | OPEN | OPEN HITL — `HITL_EVAL_DOCTRINE_FROZEN` |
| 14 | R14 — Tier-1 archive helper drift | v2/v3 Not-yet-specified | ops-residual MAP:54-55 | OPEN | OPEN — `eval-canonical-report` |
| 15 | R15 — README/CONTRIBUTING deploy refresh | v2/v3 Not-yet-specified | ops-residual MAP:55-56 | OPEN | OPEN — no lock |
| 16 | R16 — Brave 402 graceful degradation + monitoring | v3-architecture-deepening | ops-residual MAP:56, MAP:76-78 | FOG | FOG — `FOG_BRAVE_QUOTA_REPLENISHMENT_HITL` |
| 17 | R17 — Evidence HEAD anchoring automation | v3-architecture-deepening | ops-residual MAP:57, MAP:82-84 | FOG | FOG — stale trigger |
| 18 | R18 — Bento merge verification | v3-architecture-deepening | ops-residual MAP:58, MAP:87-89 | FOG | FOG — verify-only |
| 19 | R19 — Wayfinder plumbing traceability | v3-architecture-deepening | ops-residual MAP:58-59, 2026-09-01 | OPEN | OPEN — markdown canonical via `tickets.ts` |
| 20 | T2 — Ops-seamless-verify | v2/v3 Not-yet-specified | Loop-2 dce8f08, plan.md:24-25 | CLOSED | CLOSED — residual owned by R4 |
| 21 | M1 — Quote-bearing GF-6..10 baseline upgrade | v2/v3 Not-yet-specified | Loop-3 plan.md:66-68 | BLOCKED | BLOCKED — `OWNER_GF_SOURCE` |
| 22 | M2 — Conditional blob-storage escape hatch | v2/v3 Not-yet-specified | Loop-3 plan.md:81-90 | BLOCKED | BLOCKED — `BLOB_LIMIT_TRIGGER` |
| 23 | M3 — Vault sync-conflict UX | v2/v3 Not-yet-specified | Loop-3 plan.md:105-106 | BLOCKED | BLOCKED — `VAULT_CONFLICT_TRIGGER` |
| 24 | M4 — Report/recommendation drafting assists | v2/v3 Not-yet-specified | Loop-3 plan.md:123-130 | BLOCKED | BLOCKED — `M1→M4` |
| 25 | M5 — Candidate-findings review UX | v2/v3 Not-yet-specified | Loop-3 plan.md:135-146 | BLOCKED | BLOCKED — `FLAG_2` |
| 26 | M6 — Audit-history retention policy | v2/v3 Not-yet-specified | Loop-3 plan.md:150-164 | BLOCKED | BLOCKED — `FLAG_1` |
| 27 | M7 — RSC initial Repository snapshot (fog) | v2/v3 Not-yet-specified | Loop-3 plan.md:165-178 | BLOCKED | BLOCKED — `RSC_MEASURABLE_TARGET` |
| 28 | M8 — Postgres third DataStore adapter | v2/v3 Not-yet-specified | Loop-3 plan.md:180-196 | BLOCKED | BLOCKED — `PHASE_3` |

**Counting proof:** 19 R + 1 T2 + 8 M = **28**. Prior plan 27 omitted R19; this plan enumerates all per `tracker-index.md:1-140` verbatim. No omission, no invention. R19 triaged 2026-09-01 `tracker-index.md:93-95` `MAP.md:58-59` via `src/wayfinder/tickets.ts:30-42` + `TRACKER.md:15-18`.

**DAG note:** `blocked_by:[]` for R1/R2/R3 hazard-only per `grilling.md:14-15` + prior plan `393-395` + `architecture/report.md §4`. Only true DAG edges: `M1→M4` and `R4→T2` traceability (T2 CLOSED).

---

## 2. Global execution guardrails

| Guardrail | Enforcement | Cite |
|---|---|---|
| **Vault determinism** | `state/vault-notes.json` compiled from HEAD worktree only. Never bare `vault-import/export`. Use `node scripts/vault-sync.mjs` / `--check`. | `scripts/vault-sync.mjs:16-44` `AGENTS.md:15-17` |
| **Evidence byte-identity** | `.autoforge/validation/ops-loop-evidence.json` ↔ `stages/07_validate/output/ops-loop-evidence.json` `cmp -s` identical. Regen overwrites both atomically (R17). | `architecture/report.md:13` `plan §4` |
| **Staging hygiene** | Explicit `git add <paths>` only; never `git add -A`. | `AGENTS.md` |
| **Ponytail ladder** | Reuse `DataStore`/`KvRestStore.call()` at `store.ts:68`, stdlib, smallest diff. No new deps/facade/ORM. | `store.ts:68-96` |
| **Single-writer locks** | `vault-state-single-writer`, `persistence-single-writer`, `page-workspace-single-writer`, `eval-canonical-report` (see §4). | `architecture/report.md §4` |
| **Frozen doctrine** | Thresholds, judge prompts, E5, ODD frozen. No dispatch before owner/HITL. | `docs/validation/eval-gates.md:8-12` |
| **External gates** | 5 R HITL + 8 M owner gates — held = not dispatched. | `decisions.md AD-10` |

---

## 3. Modules — one per tracker entry (28) — objective, touches, blocked_by, lock, wave, acceptance

### R1 — Cross-instance harvest lock via KV SET NX — BLOCKED — Wave F

- **Objective:** Replace process-local `HARVEST_LOCK` at `harvest.ts:98-104` with KV-distributed lock.
- **Seam:** `DataStore.setIfAbsent(key,value,ttl):Promise<boolean>` at `store.ts:16-26` (`KvRestStore` `["SET",k,v,"NX","EX",ttl]` via `call()` at `store.ts:68`, `MemoryStore` atomic `!has→set`), new `src/discovery/harvest-lock.ts` `acquireHarvestLock(workspaceHash, ttl=3600, store?)` with `discovery:harvest:lock:{hash}`, `harvest.ts:98-219` busy→`setJobError` + `finally release`.
- **touches:** [`src/lib/persistence/store.ts`, `src/discovery/harvest-lock.ts`, `src/discovery/harvest.ts`]
- **read_for_gate:** [`src/lib/persistence/keys.ts`, `src/discovery/jobs.ts`]
- **hazard_touches:** [`src/lib/persistence/**`]
- **blocked_by:** `[]` (hazard-only)
- **Acceptance:** [ ] concurrent `acquire` via MemoryStore 1 true/1 false; [ ] release → third succeeds; [ ] KV unavailable → WARN fallback; [ ] TTL 3600 > maxDuration 60s; [ ] `executeJob` busy → `setJobError` no throw. `ponytail: 3600s TTL ceiling`.
- **Agent/reviewer:** `autoforge-worker` / `autoforge-reviewer` — **Lock:** `persistence-single-writer` — **Wave: F** — Skills: `lean-build`, `codebase-design`, `surgical-patch`; Tests: `vitest` `tests/discovery/harvest-lock.test.ts`

### R2 — Ledger KV ordering + orphan-key recovery — BLOCKED — Wave F

- **Objective:** Fix read-sort-trim-write race and orphan keys in `discovery:ledger:index`.
- **Seam:** `src/discovery/ledger.ts:8-39` `appendLedgerKV`/`getLedgerTailKV`; harden dedup+sort+trim 500 + orphan heal writeback.
- **touches:** [`src/discovery/ledger.ts`]
- **hazard_touches:** [`src/lib/persistence/**`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] 50-entry concurrent append all 50 seq present no dup; [ ] `getLedgerTailKV` drops null orphans and heals index. `ponytail: 500-trim bound`.
- **Lock:** `persistence-single-writer` — **Wave: F**

### R3 — Regression tests for lock + dedup — BLOCKED — Wave F

- **Objective:** Cover busy-harvest, `lastOnRunJobId` dedup, persist-before-done ordering without seam change.
- **touches:** [`tests/discovery/regression-lock-dedup.test.ts`]
- **read_for_gate:** [`src/discovery/harvest.ts`, `src/app/dev/mission-control/_components/provider-health.tsx`, `src/discovery/ledger.ts`]
- **blocked_by:** `[]` (hazard-serialized behind R1/R2)
- **Acceptance:** [ ] concurrent `executeJob` one done one busy-error no throw; [ ] mocked `fetchJobById` → `onRun` once per terminal id at `provider-health.tsx:138`; [ ] spy `appendLedgerKV` before `setJobDone` at `harvest.ts:188-211`. `vitest` only.
- **Lock:** none (read-only) — **Wave: F**

### R4 — Production harvest proof bundle — BLOCKED HITL — Wave F

- **Objective:** Prove live Vercel KV + daemon durability (`ledgerGrowth`/`production`/`daemon` false→true).
- **touches:** [`.autoforge/validation/ops-loop-evidence-live.json`, `stages/07_validate/output/ops-loop-evidence-live.json`, `.autoforge/validation/report.md`]
- **hazard_touches:** [`state/**`]
- **blocked_by:** `[]` (T2 traces to R4)
- **external_gates:** [`HITL_PRODUCTION_DAEMON_PROOF`]
- **Acceptance:** [ ] `ledgerGrowth.verified true`, `productionDeploymentVerified true` (deploy `33295…`), `daemonVerified true` (`launchctl print` + log tail); [ ] validator GO; [ ] no code change.
- **Lock:** `vault-state-single-writer` — **Wave: F**

### R5 — Stop/Cancel server endpoint — OPEN — Wave B+C

- **Objective:** Make Stop honest — server marks `cancelled`, harvest bails mid-loop.
- **Seam:** `DiscoveryJobStatus "cancelled"` at `jobs.ts:10`, new `src/app/api/dev/discovery/jobs/[jobId]/cancel/route.ts` POST `requireAdmin→updateJob`, `executeJob` at `harvest.ts:146` polls `getJob` per `DISCOVERY_NODE_IDS` iteration → `setJobError("cancelled by user")`.
- **touches:** [`src/app/api/dev/discovery/jobs/[jobId]/cancel/route.ts`, `src/discovery/jobs.ts`, `src/discovery/harvest.ts`, `src/app/dev/mission-control/_components/provider-health.tsx`]
- **hazard_touches:** [`src/lib/persistence/**`, `src/app/dev/mission-control/_components/provider-health.tsx`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] cancel flips `running→cancelled` in MemoryStore; [ ] next iteration bails; [ ] UI polling to `paused · cancelled`; `ponytail: per-iteration poll`.
- **Locks:** `persistence-single-writer` + `page-workspace-single-writer` — **Wave: B + C**

### R6 — Pagination cursor stability — OPEN — Wave B

- **Objective:** Fix `index.indexOf(cursor)` at `jobs.ts:233-235` trimming to 20 losing stale cursor.
- **touches:** [`src/discovery/jobs.ts`, `src/app/api/dev/discovery/jobs/route.ts`]
- **hazard_touches:** [`src/lib/persistence/**`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] cursor present → next page; [ ] cursor missing → latest page with `nextCursor`; [ ] trimmed past → latest page not empty. `ponytail: 20-index cap ceiling`.
- **Lock:** `persistence-single-writer` — **Wave: B**

### R7 — Refresh parity tooltip — OPEN — Wave C

- **Objective:** Surface dedup bypass as `title` at `provider-health.tsx:478`.
- **touches:** [`src/app/dev/mission-control/_components/provider-health.tsx`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] DOM `title` contains `bypasses.*dedup` and `no scheduling side-effect`.
- **Lock:** `page-workspace-single-writer` — **Wave: C**

### R8 — Health route `harvestHealth` sub-object — OPEN — Wave B

- **Objective:** Centralize freshness/lock observability at `health/route.ts:11-138`.
- **Seam:** New pure `src/discovery/health-aggregate.ts` `harvestHealthSummary(store?)` from `getLedgerTailKV` + `listJobs(1)`.
- **touches:** [`src/discovery/health-aggregate.ts`, `src/app/api/dev/health/route.ts`]
- **hazard_touches:** [`src/lib/persistence/**`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] `GET /health` additive shape nullable when KV unavailable preserves `providers/ledger/topology`.
- **Lock:** `persistence-single-writer` — **Wave: B**

### R9 — Discovery doctor JSON contract — OPEN — Wave A

- **Objective:** Stable JSON for CI at `scripts/discovery-doctor.ts:17-53`.
- **touches:** [`scripts/discovery-doctor.ts`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] `--live --json` valid JSON nothing else; validator parses.
- **Lock:** none — **Wave: A** — parallel safe

### R10 — `state/dedupe-index.json` KV-truth — OPEN — Wave B+D

- **Objective:** KV-truth when `KV_REST_API_URL` present; break file/KV fork under ROFS.
- **Seam:** `dedupe-persist.ts:16-72` KV-first load/persist + file best-effort `EROFS → WARN`.
- **touches:** [`src/discovery/dedupe-persist.ts`, `src/lib/persistence/keys.ts`]
- **hazard_touches:** [`src/lib/persistence/**`, `state/**`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] ROFS throw → KV succeeds + WARN token; [ ] local dev writes both.
- **Locks:** `persistence-single-writer` + `vault-state-single-writer` — **Wave: B**

### R11 — Drop speculative source comments — OPEN — Wave A

- **Objective:** Delete stale `getGitHead()` chatter at `harvest.ts:98-102`.
- **touches:** [`src/discovery/harvest.ts`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] `rg getGitHead src/discovery/harvest.ts` 0 hits; `typecheck` green.
- **Lock:** none — **Wave: A**

### R12 — AutoForge staging policy — OPEN — Wave D

- **Objective:** Curated commit vs ignore for `.autoforge/` at `AGENTS.md` + `.gitignore`.
- **touches:** [`.gitignore`, `.autoforge/AGENTS.md`]
- **hazard_touches:** [`vault/**`, `state/**`, `state/vault-notes.json`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] policy documented; `git check-ignore -v .autoforge/state.json` not ignored; `git status` clean.
- **Lock:** `vault-state-single-writer` — **Wave: D**

### R13 — Eval gate §2 freshness automation — OPEN HITL — Wave D

- **Objective:** CI fails when Tier-1 archive >7d per `docs/validation/eval-gates.md:14-25`.
- **Seam:** `scripts/check-eval-gate-freshness.mjs` reads `state/eval-scorecards/` mtime threshold from `eval-gates.md`.
- **touches:** [`scripts/check-eval-gate-freshness.mjs`, `.github/workflows/ci.yml`]
- **hazard_touches:** [`state/**`, `state/eval-scorecards/**`]
- **blocked_by:** `[]`
- **external_gates:** [`HITL_EVAL_DOCTRINE_FROZEN`]
- **Acceptance:** [ ] fresh → pass stale → fail with `run tier1 --topup`.
- **Locks:** `eval-canonical-report` + `vault-state-single-writer` — **Wave: D**

### R14 — Tier-1 archive helper drift — OPEN — Wave A

- **Objective:** Header hygiene at `scripts/tier1-archive.mjs` keep `--topup` next to `--rebase`.
- **touches:** [`scripts/tier1-archive.mjs`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] header contains `topup` and `rebase` tokens.
- **Lock:** `eval-canonical-report` — **Wave: A**

### R15 — README/CONTRIBUTING deploy refresh — OPEN — Wave A

- **Objective:** Text-only sync: main is production, Vercel auto-deploys, `discovery-harvest.yml` schedule.
- **touches:** [`README.md`, `CONTRIBUTING.md`, `docs/ops/deploy.md`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] docs match workflow.
- **Lock:** none — **Wave: A**

### R16 — Brave 402 graceful degradation + monitoring — FOG — Wave E

- **Objective:** Make existing 402 `return []` at `brave-search.ts:61` observable.
- **Seam:** `refusals` `brave:USAGE_LIMIT_EXCEEDED` via `pipeline.ts:92`, `WARN` token, health `providers.brave.degraded` after 2 zero-hit runs.
- **touches:** [`src/discovery/providers/brave-search.ts`, `src/discovery/pipeline.ts`, `src/app/api/dev/health/route.ts`]
- **hazard_touches:** [`src/lib/persistence/**`]
- **blocked_by:** `[]`
- **external_gates:** [`FOG_BRAVE_QUOTA_REPLENISHMENT_HITL`]
- **Acceptance:** [ ] mock 402 → `[]` no throw + refusal propagated + WARN searchable.
- **Lock:** none — **Wave: E**

### R17 — Evidence HEAD anchoring automation — FOG — Wave D

- **Objective:** Tie `ops-loop-evidence.json.commit` to `HEAD` and freshness, keep byte-identity.
- **Seam:** `scripts/check-evidence-head.mjs` asserts `commit==HEAD` and `generatedAt` ±24h; CI `evidence-head-check`; regen twin-write.
- **touches:** [`scripts/check-evidence-head.mjs`, `.github/workflows/ci.yml`]
- **hazard_touches:** [`state/**`, `.autoforge/validation/**`, `stages/**`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] exit 0 when `commit==HEAD` else `evidence stale: commit X != HEAD Y — run: gh workflow run discovery-harvest`; [ ] `cmp -s` identical.
- **Lock:** `vault-state-single-writer` — **Wave: D**

### R18 — Bento components merge verification — FOG — Wave E

- **Objective:** Verify Bento/Ethereal Glass safe after duplicate cleanup 2026-08-31 — no code.
- **touches:** [] (verify-only)
- **read_for_gate:** [`src/app/_components/ui/*`, `src/app/dev/mission-control/page.tsx`, `next.config.ts`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] `git ls-files --others | grep -E "\.jsx|\.js$"` 0 shadow; [ ] `build` 13.9kB + `lint` 0; [ ] `git diff main...feat/mission-control -- ui/` empty.
- **Lock:** none — **Wave: E**

### R19 — Wayfinder plumbing traceability — OPEN — Wave A

- **Objective:** Wayfinder local-markdown traceable to Mission Control via `tickets.ts` compile.
- **Seam:** Markdown canonical `TRACKER.md:15` + `tickets.ts:30-42` `parseTicketFrontMatter`/`classifyTickets` → `TicketIndex` for Mission Control Tickets tab and `npm run tickets`; `R19-wayfinder-plumbing-traceability.md` front-matter.
- **touches:** [`workflow/wayfinder/maps/ops-residual/tickets/R19-wayfinder-plumbing-traceability.md`, `workflow/wayfinder/maps/ops-residual/MAP.md`, `src/wayfinder/tickets.ts`, `src/wayfinder/ticket-types.ts`, `src/app/dev/mission-control/page.tsx`]
- **read_for_gate:** [`workflow/wayfinder/TRACKER.md`, `.autoforge/discovery/tracker-index.md:93-95`]
- **blocked_by:** `[]`
- **Acceptance:** [ ] `npm run tickets` prints R19 OPEN; [ ] Mission Control Tickets tab lists R19; [ ] `tracker-index.md:93-95` matches `MAP.md:58-59`; `ponytail: pure fn compile`.
- **Lock:** none — **Wave: A** — parallel safe

### T2 — Ops-seamless-verify — CLOSED — Wave E

- **Objective:** Close-out verifier already shipped at `dce8f08` — no new work.
- **touches:** [] (no writes)
- **read_for_gate:** [`.autoforge/validation/ops-loop-evidence.json:t1`, `.autoforge/validation/ops-loop-evidence.json:t2`, `workflow/wayfinder/maps/ops-residual/MAP.md:21`]
- **blocked_by:** [`R4`] (traceability only, not dispatch gate)
- **Acceptance:** [ ] Already verified: health 200, live job `job_mtfe7dsk_z9sej8` 23 logs done, doctor brave 3 hits; `cmp -s` pass; `vault-sync --check` pass.
- **Lock:** none — **Wave: E**

### M1 — Quote-bearing GF-6..10 baseline upgrade — BLOCKED — Wave F

- **Objective:** Add owner-supplied verbatim INT evidence to baseline for GF-6..10 without runtime/E5.
- **touches:** [`state/eval-scorecards/**`, `vault/journal/**`]
- **hazard_touches:** [`state/**`, `vault/**`, `state/vault-notes.json`]
- **blocked_by:** `[]`; **external:** `OWNER_GF_SOURCE_AND_ACCEPTANCE`
- **Acceptance:** all five `passes_corpus_mark=true` zero-drop GF-9 quoted archive manifest owner ack.
- **Locks:** `vault-state-single-writer` + `eval-canonical-report` — **Wave: F**

### M2 — Conditional blob-storage escape hatch — BLOCKED — Wave F

- **Objective:** Only after limit probe crosses margin, add second attachment impl.
- **touches:** [`src/domain/types.ts`, `src/lib/persistence/project-store.ts`, `src/lib/persistence/attachments/**`, `tests/attachments/**`]
- **hazard_touches:** [`src/lib/persistence/**`, `state/**`]
- **blocked_by:** `[]`; **external:** `BLOB_LIMIT_TRIGGER`
- **Acceptance:** absent trigger → no code; if opened adapter contract + migration/rollback proof.
- **Lock:** `persistence-single-writer` — **Wave: F**

### M3 — Vault sync-conflict UX — BLOCKED — Wave F

- **Objective:** After qualifying divergence, add deterministic diagnostics at `vault-sync.mjs` seam, fail closed.
- **touches:** [`scripts/vault-sync.mjs`, `scripts/vault-import.mjs`, `tests/vault/**`]
- **hazard_touches:** [`vault/**`, `state/vault-notes.json`]
- **blocked_by:** `[]`; **external:** `VAULT_CONFLICT_TRIGGER_AND_OWNER`
- **Acceptance:** divergent-path fixture byte-identical compile fail-closed instructions.
- **Lock:** `vault-state-single-writer` — **Wave: F**

### M4 — Report/recommendation drafting assists — BLOCKED — Wave F

- **Objective:** After M1 quality gate, pilot typed draft-only assistance.
- **touches:** [`src/lib/ai.ts`, `src/lib/inference.ts`, `src/domain/candidate-review.ts`, `src/domain/types.ts`, `src/app/projects/[projectId]/audits/[auditId]/page.tsx`, `tests/ai/**`]
- **hazard_touches:** [`state/eval-scorecards/**`, `vault/**`]
- **blocked_by:** [`M1`] — **only true DAG edge** (plan 393-395)
- **Acceptance:** OFF default typed provenance/budget/refusal/degraded deterministic fallback no `renderReportMarkdown` mutation.
- **Lock:** `eval-canonical-report` — **Wave: F**

### M5 — Candidate-findings review UX hardening — BLOCKED — Wave F

- **Objective:** If Flag #2 + bottleneck, smallest UX patch.
- **touches:** [`src/app/projects/[projectId]/audits/[auditId]/page.tsx`, `src/domain/audit-workspace.ts`, `tests/candidate-review/**`]
- **hazard_touches:** [`src/app/projects/[projectId]/audits/[auditId]/page.tsx`, `src/domain/audit-workspace.ts`]
- **blocked_by:** `[]`; **external:** `FLAG_2_PRODUCT_COMMITMENT`
- **Acceptance:** accept/edit/reject preserved no auto-accept a11y smoke.
- **Lock:** `page-workspace-single-writer` — **Wave: F**

### M6 — Audit-history retention policy — BLOCKED — Wave F

- **Objective:** After Flag #1 authority, retention for drafts/issues/artifacts (ADR-0004).
- **touches:** [`src/lib/persistence/issue-ledger.ts`, `src/lib/persistence/artifact-trail.ts`, `src/domain/outcomes.ts`, `tests/retention/**`]
- **hazard_touches:** [`src/lib/persistence/**`, `state/**`]
- **blocked_by:** `[]`; **external:** `FLAG_1_RETENTION_AUTHORITY`
- **Acceptance:** TTL/purge/export/legal issued issues survive.
- **Lock:** `persistence-single-writer` — **Wave: F**

### M7 — RSC initial Repository snapshot (fog) — BLOCKED — Wave F

- **Objective:** Only with measurable SEO/TTFB target, spike serializable server snapshot.
- **touches:** [`src/app/projects/[projectId]/page.tsx`, `src/app/projects/[projectId]/audits/[auditId]/page.tsx`, `tests/rsc/**`]
- **hazard_touches:** [`src/app/projects/[projectId]/audits/[auditId]/page.tsx`, `src/domain/audit-workspace.ts`]
- **blocked_by:** `[]`; **external:** `RSC_MEASURABLE_TARGET_AND_RISK_ACCEPTANCE`
- **Acceptance:** TTFB/SEO before/after hydration tests no second Repository/cache.
- **Lock:** `page-workspace-single-writer` — **Wave: F**

### M8 — Postgres third DataStore adapter — BLOCKED — Wave F

- **Objective:** After Phase-3 authority, add third `DataStore` adapter, remove silent KV→Memory split-brain at `store.ts:130-181`.
- **touches:** [`src/lib/persistence/store.ts`, `src/lib/persistence/keys.ts`, `tests/persistence/postgres/**`]
- **hazard_touches:** [`src/lib/persistence/**`, `state/**`]
- **blocked_by:** `[]`; **external:** `PHASE_3_KEY_SCHEME_AND_POSTGRES_AUTHORITY`
- **Acceptance:** Memory/KV/Postgres contract matrix `StoreUnavailableError` honest no ORM.
- **Lock:** `persistence-single-writer` — **Wave: F**

---

## 4. Execution work order (DAG + resource serialization)

**Semantic DAG edges (only `blocked_by` that is ordering, not hazard):**

- `M1 → M4` (quality gate precedes AI assists). `R4 → T2` traceability (T2 CLOSED). All other overlaps are **resource hazards** serialized by locks, not DAG edges — per `grilling.md:14-15` + prior plan `393-395` + `architecture/report.md §4`.

```
M1 ──→ M4
R4 ──→ T2 (traceability, T2 CLOSED)
```

**Locks:**

| Lock | Members | Policy | Wave |
|---|---|---|---|
| `vault-state-single-writer` | M1, M3, R4, R10, R12, R13, R17 | sequential; `vault-sync --check` before handoff | D + F |
| `persistence-single-writer` | M2, M6, M8, R1, R2, R5, R6, R8, R10, (R16 health read hazard) | sequential ready-order; no semantic ordering | B + F |
| `page-workspace-single-writer` | M5, M7, R5(UI), R7, R19(board polling hazard) | sequential | C + F |
| `eval-canonical-report` | M1, M4, R13, R14 | sequential; M4 after M1 | A/D/F |

**Waves:**

| Wave | Members | Parallel? | Guard |
|---|---|---|---|
| **A — docs/scripts/traceability safe** | `R9`, `R11`, `R15`, `R14`, `R19` | parallel safe | disjoint `touches`/`locks` |
| **B — persistence serial** | `R5`, `R6`, `R8`, `R10` | serial | `persistence-single-writer`; R5 also page-workspace |
| **C — page-workspace serial** | `R7`, `R5` | serial | `page-workspace-single-writer`; R19 hazard serializes under same lock if editing but dispatched in A |
| **D — vault-state serial** | `R12`, `R13`, `R17` | serial | `vault-state-single-writer`; R13 also `eval-canonical-report` |
| **E — fog/verify** | `R16`, `R18`, `T2` | parallel safe | R16 read hazard but no write; R18/T2 zero-write |
| **F — BLOCKED/HITL/FOG gated** | `R1,R2,R3,R4,M1-M8` | serial per lock when gate opens | held = not dispatched |

**Parallelization guard:** `R9+R11+R15+R19` can run in parallel today (disjoint touches, no shared lock; scheduler may group as single Task batch). `R12` cannot parallel with `R13` or `R10` `state/**` hazard or `R17` regen. `R5` cannot parallel with any `persistence` or `page-workspace` holder. Waves A and E may run in parallel (disjoint locks); B,C,D serial within lock. `vault-state` writers (D) cannot parallel with any `state/**` hazard.

**Recommended schedule:** `R12` (staging hygiene) then `R11`/`R7`/`R9`/`R15`/`R14`/`R19` wave A, then persistence wave `R10→R6→R8→R5`; FOG monitors `R17`/`R16` can be pulled early; `R1`/`R2`/`R3` trio when ready; `R18`/`T2` verify anytime; `R4` HITL held.

**Global proof before handoff:** `node scripts/vault-sync.mjs --check` + `cmp -s .autoforge/validation/ops-loop-evidence.json stages/07_validate/output/ops-loop-evidence.json` + `npm run typecheck` green. `git add <paths>` only.

---

## 5. Skills & agent roles per module

| Skill | When |
|---|---|
| **lean-build** | every R/M — reuse `DataStore`/`MemoryStore`/`KvRestStore`, stdlib, smallest diff, WARN tokens, no new deps |
| **codebase-design** | seams that deepen — R1 `setIfAbsent` (`store.ts:16-26,68`), R2 orphan heal (`ledger.ts`), R10 KV-truth, R8 aggregate, R19 `tickets.ts:30-42`, M8 honesty (`store.ts:130-181`) |
| **tdd / verify-and-stop** | R3,R6,R16,R17,R18,M1-M8 where gate opens |
| **domain-modeling** | glossary for `TicketIndex`, `harvestHealth`, `DedupeIndex` |

**Agent roles:** `R1,R2,R5,R6,R8,R10,M2,M6,M8` → `autoforge-worker` (surgical/lean) — reviewer checks persistence honesty; `R7,R15,R11,R14,R19` → `autoforge-worker` (lean) — smallest diff; `R9,R13,R17` → scripts worker; `R16` → worker (no key rotation); `R18,R4,T2` → `autoforge-validator` (verify-and-stop); `R3,M1,M4,M5` → TDD worker; `M3,M7` → prototype/surgical after gate. All require `autoforge-reviewer` + `autoforge-validator` for evidence-affecting modules.

**Task grouping for 05_execute:** Parallel groups (disjoint `touches`/`locks`): `[R9,R11,R15,R19]` and `[R16,R18,T2]` may be dispatched same turn as separate `Task autoforge-worker` calls. Sequential groups: `[R5]→[R6]→[R8]→[R10]` (persistence), `[R7]→[R5]` (page-workspace), `[R12]→[R13]→[R17]` (vault-state).

---

## 6. Risks & mitigations (carried)

- `getDataStore()` silent fallback at `store.ts:130-181` hides split-brain — mitigated by `store?` injection + R1 WARN, resolved before M8 cutover (`StoreUnavailableError` honest).
- Ledger `KEYS` bounded by 500 trim at `ledger.ts:25` + orphan heal.
- Health shape break — additive only nullable degraded flag never remove `providers/ledger/topology` at `health/route.ts:132-138`.
- Staging poison via `git add -A` — enforced by `AGENTS.md` + R12.
- Brave silent degrade — mitigated by R16 `refusals` + WARN.
- Ticket index drift (R19) — `tracker-index.md:93-95` stale if tickets not recompiled; mitigate via `npm run tickets` CI check.
- Evidence staleness — `commit != HEAD` visible via R17 CI gate; regen atomic twin-write preserves `cmp -s`.

---

*Evidence anchoring:* `056b75f 2026-08-31T22:05:26Z` (historicalProbe `61c7475 2026-08-30T05:52:52Z`), HEAD `a715ee8`, `vault-sync --check` pass, `cmp` byte-identical. Next anchors: R4 live bundle + R17 `commit==HEAD` gate. No speculative dispatch. All 28 modules trace to `tracker-index.md:1-140` verbatim.
