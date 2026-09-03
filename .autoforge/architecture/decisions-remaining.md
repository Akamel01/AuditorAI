# Architecture Decisions — Remaining Frontier R5–R15, R19 (ops-residual)

Date: 2026-09-02
Source: `workflow/wayfinder/maps/ops-residual/MAP.md:39-59`, `R5-server-cancel.md:16-31`, `R6-pagination-trim.md:16-30`, `R7-refresh-parity.md:16-29`, `R8-harvest-health-route.md:16-30`, `R9-discovery-doctor-json.md:16-29`, `R10-dedupe-write-authority.md:16-31`, `R11-drop-stale-comments.md:16-29`, `R12-autoforge-storage-policy.md:16-30`, `R13-eval-gate-freshness.md:16-30`, `R14-tier1-housekeeping.md:16-30`, `R15-docs-production-deploy-refresh.md:16-30`, `R19-wayfinder-plumbing-traceability.md:29-48`, `.autoforge/requirements/grilling-remaining.md:1-122`, `src/discovery/jobs.ts:41-42,64,159,217-274,276-318,320-357`, `src/lib/persistence/store.ts:9-26,28-57,60-126,130-188`, `src/discovery/harvest.ts:99-173,244`, `src/discovery/dedupe-persist.ts:12-107`, `src/discovery/health-aggregate.ts:6-61`, `src/app/api/dev/health/route.ts:15-169`, `src/app/api/dev/discovery/jobs/[id]/cancel/route.ts:1-21`, `src/app/dev/mission-control/_components/provider-health.tsx:163-171,383-391,474-485`, `scripts/discovery-doctor.ts:14-53`, `src/wayfinder/tickets.ts:34-193`, `src/wayfinder/ticket-types.ts:2-51`, `src/app/api/dev/tickets/route.ts:6-17`, `src/app/dev/mission-control/_components/ticket-board.tsx:28-40`, `workflow/wayfinder/TRACKER.md:14-17`, `AGENTS.md:15-23`, `docs/validation/eval-gates.md:15-38`
Ponytail: reuse `DataStore` KV seam, `MemoryStore` for tests, Next route handlers, HTML `title`, stdlib `fs/path/crypto`, existing `yaml`; no new deps, no generic facades.

## AD-11 — R5 Stop/Cancel as single-field status truth (no in-node abort)

**Decision:** Cancel is `POST /api/dev/discovery/jobs/:id/cancel` at `cancel/route.ts:6-17` admin-gated via `requireAdmin` (`:7`), patching `updateJob(jobId,{status:"cancelled"})` at `:16`. Worker `executeJob` polls `getJob(jobId)` before lock at `harvest.ts:118-130` and before each `DISCOVERY_NODE_IDS` at `:166-173`, appends `D00-CANCELLED` and returns. Client `provider-health.tsx:168-171` fires `fetch(.../cancel,{method:"POST"})` fire-and-forget; polling continues until terminal and label becomes `cancelling… → paused · cancelled by user` (R5 AC at `R5-server-cancel.md:31`).

**Interface distinction:** seam is `jobs.ts:updateJob` + `getJob` (same `DataStore` depth as `store.ts:16-26`); route header is `x-admin-key` at `client.ts:81` — same as `health/route.ts:16` and `jobs/route.ts:7`. No new auth.

**Rejected:** `AbortSignal` through `runDiscoveryNode` (widens every node interface, shallow); separate KV `discovery:job:cancel:*` token (second truth forks).

**Boundary:** `jobs.ts` owns index/key scheme (`PREFIX:41`, `INDEX_KEY:42`); `harvest.ts` owns poll points; `cancel/route.ts` owns HTTP surface. `HARVEST_LOCK:104` stays process-local; cross-instance lock is R1 (`SET NX EX 3600` at `R1-cross-instance-harvest-lock.md:24`).

**Risk:** per-node poll is not pre-emptive inside a long node. Mitigated by out-of-scope at `R5:34`.

`ponytail: per-node poll is ceiling; AbortSignal per node deferred until measured inside-node latency.`

**Self-approve:** **TRUE** — contract fully in ticket MD:22-27 + code at `cancel/route.ts:16`/`harvest.ts:166-173` is mechanical; test is `MemoryStore` flip → bail.

---

## AD-12 — R6 Stable pagination via `loadIndex` scan (trim window 20)

**Decision:** `listJobs(limit,cursor,store?)` at `jobs.ts:223-274` uses `loadIndex(store?)` at `:94-113` (KV `INDEX_KEY` or file `state/discovery-jobs.json:64-66`). Cursor rule at `:232-242`: if `cursor` exists → `slice(idx+1,idx+1+limit)` with empty-window fallback to `slice(0,limit)` at `:237-239`; if missing/trimmed past → latest page `slice(0,limit)` at `:242`. `nextCursor = pageIds[pageIds.length-1] ?? null` at `:272`, `total=ids.length` at `:229`. `GET /api/dev/discovery/jobs` keeps shape `{jobs,nextCursor,total}` at `jobs/route.ts:14-15` and cap `[1,20]` at `:13`.

**Interface distinction:** caller learns `nextCursor` not trim internals; index trim `slice(0,20)` at `jobs.ts:159,189` is private.

**Rejected:** in-memory `index.indexOf` leading to stale-cursor lossy page (R6 bug at `R6:18-19`); KV `KEYS prefix*` scan (O(n) scan cost, speculative until >500).

`ponytail: 20-window is ceiling; KV tail scan deferred until job volume >500.`

**Self-approve:** **TRUE** — stable paging already lands at `jobs.ts:223-274`, accepts cursor present/missing/trimmed, shape preserved.

---

## AD-13 — R7 Refresh tooltip as HTML `title` (no new abstraction)

**Decision:** Keep JSX comment intent at `provider-health.tsx:383-391` but surface as `title="Refresh bypasses onRun dedup — deliberate manual inspection, no scheduling side-effect"` at `:482` on the Refresh button (aria-label alternative if tooltip mechanism present at `R7:23`). No new component.

**Rejected:** custom `<Tooltip>` (new abstraction, one string).

**Self-approve:** **TRUE** — trivial HTML attribute, no deps, no behaviour change beyond discoverability.

---

## AD-14 — R8 Harvest-health via pure aggregation (shape bridging)

**Decision:** Keep deep module `aggregateHarvestHealth(entries)` at `health-aggregate.ts:20-61` (small interface `LedgerEntry[]→HarvestHealth{lastRunAt,lastSuccessAt,lastHits,degraded}` at `:6-12`). Route `GET /api/dev/health` at `health/route.ts:135-155` returns `harvestHealth` plus bridging fields `lastRunStatus` (from `jobs.listLatest` 1 job) and `indexedEntriesCount=total` so ticket field list at `R8:21` (`lastRunAt,lastRunStatus,lockHolder,lockAcquiredAt,indexedEntriesCount` via `getLedgerTailKV/getDataStore/jobs.listLatest` at `R8:24`) is honored without inventing `lockHolder` before R1 ships. Fallback when KV unavailable → nulls with shape intact at `:149-155` per `R8 AC:29`.

**Interface distinction:** ticket asks 5 fields; implemented shape is 4 fields plus bridged 2. Owner freeze decides whether to keep implemented 4 as canonical and add 2 bridged as alias, or rename. Defer `lockHolder/lockAcquiredAt` until `harvest-lock.ts` exists.

**Rejected:** inline aggregation in route (duplicates), external alerting (out of scope at `R8:32`).

**Risk:** shape drift. Mitigate by documenting shape in route comment and test asserting shape under `MemoryStore` one completed job per `R8 AC:29`.

**Self-approve:** **FALSE — NEEDS REVIEW (shape freeze)**. Architecture is local, but canonical `HarvestHealth` field set needs owner sign-off before workers harden consumers.

---

## AD-15 — R9 Doctor `--json` as single stdout contract

**Decision:** `scripts/discovery-doctor.ts:14-53` guards `JSON_MODE=process.argv.includes("--json")` at `:15`; `--json` branch at `:17-53` awaits `providerEnabled` + `resolveProvider(...).discover({limit:3})` at `:28-29`, emits `JSON.stringify({providers:[{id,enabled,hostsOk,sampleHits}],totals:{totalProviders,totalEnabled,totalSampleHits}},null,2)` at `:44-51`, `process.exit(0)` at `:52`. Human path untouched at `:55-112`. Both `--live --json` print valid JSON per `R9 AC:27`.

**Rejected:** file output, replacing human mode.

**Self-approve:** **TRUE** — contract pinned at `R9:20-25`, exit codes preserved, deterministic validator read.

---

## AD-16 — R10 KV-truth dedupe with file seed fallback + ROFS warn

**Decision:** Load KV-first: `loadDedupeIndexAsync(store?,cwd?)` at `dedupe-persist.ts:51-58` `await s.get(DISCOVERY_DEDUPE_INDEX_KEY)` at `keys.ts:50` else fall back to `loadDedupeIndex(cwd)` file seed at `:28-47`. Persist via `persistDedupeFromResult:77-107` — single-line change `const index = await loadDedupeIndexAsync(store,cwd)` (replacing sync at `:85`) → `claimFingerprints` → `saveDedupeIndex(index,cwd)` at `:100` (EROFS warn at `:70-71` `WARN dedupe persist EROFS…`) → `await s.put(DISCOVERY_DEDUPE_INDEX_KEY,index)` at `:104`. `DISCOVERY_DEDUPE_INDEX_KEY` single-doc mirror is the truth; file is best-effort on ROFS per `R10:21`.

**Rejected:** file-only (forks on ROFS at `R10:19`), file removed (breaks local seed/offline).

`ponytail: global __KV_DEDUPE_INDEX__ at :19-26 is ceiling; remove when every caller awaits; serialized writeQueue at :17 is single-writer ceiling.`

**Self-approve:** **TRUE** — KV-first seam spelled at `R10:21-25` + `keys.ts:50` + `dedupe-persist.ts:51-58`; fix is one-line load swap + EROFS test via fake `writeFileSync` throw per `R10 AC:30`.

---

## AD-17 — R11 Drop stale comments (keep ceilings)

**Decision:** Prune `harvest.ts` narration of removed helpers (e.g. `getGitHead()`, deleted global hook at `R11:19`). Keep only `ponytail:` ceiling comments (`HARVEST_LOCK:99-103` process-local ceiling + upgrade path) and contract notes per `R11 Acceptance:27-28`. No behaviour change, `typecheck` gates.

**Self-approve:** **TRUE**.

---

## AD-18 — R12 AutoForge storage policy (curated subset default)

**Decision (proposed, needs ratification):** Either (a) commit curated subset or (b) ignore `.autoforge/` entirely per `R12:21`. **Proposed default: (a) curated subset** — add `.autoforge/AGENTS.md` `## Storage policy — curated subset: commit state.json + architecture/decisions + plans/reviews + discovery/report + grilling-remaining + MAP.md mirror; extracted evidence/*.md stays untracked (file-seed)` and adjust `.gitignore:1-46` to keep `.autoforge/state.json` tracked but ignore `*.log` + `out/` artefacts. `git status` after pipeline shows no spurious `??` per `R12 AC:29`.

**Alternative (b):** `/.autoforge/` single line in `.gitignore` — smaller diff, but fresh clone loses `.autoforge/state.json:1-28` execution ledger (Wayfinder `workflow/wayfinder/maps/**` still committed so frontier not lost).

**Rejected:** silent drift (agent dumps remain `??` at `R12:19`) — must pick one policy deliberately.

**Self-approve:** **FALSE — NEEDS REVIEW (HITL-policy)**. Storage is owner-boundary (`CHARTER.md:82-85` analogue: amendment needs owner). Agents may implement proposal but owner must pick (a) vs (b).

---

## AD-19 — R13 Freshness gate failure (threshold from doctrine)

**Decision (to harden):** Extend `scripts/check-eval-gate-freshness.mjs:7-34` from warn-only at `:25` to hard fail: when `ageMs > maxAgeMs` (`7 * 86400000` at `:22`, sourced from `docs/validation/eval-gates.md:31-38` threshold table — parse `7d` default but not hardcoded per `R13:29`), `console.error` actionable `run tier1 --topup <runId>` and `process.exit(1)`. Add GH Action step `gate-freshness` in `.github/workflows/ci.yml` after `vault determinism (V2)` at `ci.yml:35-50`.

**Rejected:** manual runbook without CI enforcement.

**Boundary:** `R13.hitl:true` at `R13:5` makes this HITL even though code is mechanical — owner must confirm threshold authority and message wording (protocol § Critique auto-approve if resolvable does not override explicit `hitl:true`).

**Self-approve:** **FALSE — NEEDS REVIEW (HITL)**. Architecture is ready; HITL flag requires owner ack before self-approve.

---

## AD-20 — R14 Tier1 archive header strict

**Decision:** Top comment of tier1 script (candidate `scripts/tier1-archive.mjs`; absents fall back to `scripts/run-eval.ts` referenced in `README`/eval pipeline or `scripts/check-eval-gate-freshness.mjs`) lists only operational flags with `--topup <runId>` next to `--rebase` per `R14:21` and references doctrine by path `docs/validation/eval-gates.md` only per `R14:21`.

**Self-approve:** **NEEDS REVIEW (clarify file)** — no `scripts/tier1-archive.mjs` present today (`glob scripts/*:18` lists none). Once canonical path confirmed, header edit is self-approvable (text-only).

---

## AD-21 — R15 README/CONTRIBUTING deploy refresh (text-only)

**Decision:** Update `README.md:85-91` `## Deployment` and `docs/deployment.md:6-23` + `CONTRIBUTING.md` (create if absent, `R15:24` says README+CONTRIBUTING) to `main is production; Vercel auto-deploys from main; discovery-harvest schedule refreshes state; see AGENTS.md Eval gates for freshness window` per `R15:21`. Keep command order per `R15:29`; no commands reorder.

**Self-approve:** **TRUE** — text-only sync, no code.

---

## AD-22 — R19 Wayfinder plumbing stays local-markdown with thin CLI

**Decision:** Keep `src/wayfinder/tickets.ts:34-193` seams (`FRONT_MATTER_RE:34`, `isTerminalStatus:36-38`, `ticketKey:40-42`, `classifyTickets frontier:119-134`, `buildTicketIndex:169-189` counts `total/open/claimed/blocked/closed/frontier/ready_without_owner/hitl_frontier`) as canonical index behind `WAYFINDER_MAPS_DIR="workflow/wayfinder/maps"` at `ticket-types.ts:2`. Add one thin adapter `scripts/wayfinder-tickets.ts` reusing `indexWayfinderTickets(root)` at `tickets.ts:191`, supporting `--lane/--json` and printing `wayfinder <n> tickets · frontier <n> · ready <n> · hitl <n> · blocked <n>` + JSON `{counts,tickets}` with `tickets[].key|status|hitl|ready_without_owner` per `R19 Acceptance:44-46`. `package.json:8-21` gains `"tickets":"tsx scripts/wayfinder-tickets.ts"`. API `GET /api/dev/tickets` at `tickets/route.ts:6-17` already serves JSON (ENOENT→`{total:0}` fallback at `:14`); board `TicketBoard` at `ticket-board.tsx:28-33` `inLane` consumes same `TicketIndex`. Markdown remains canonical (`TRACKER.md:17` claims markdown wins); claim/resolve edits `status`+`assignee` at `TRACKER.md:60-62` reflected in CLI and board without code change per `R19:47`.

**Rejected:** ops-residual GitHub sync (out of scope at `R19:51`), migrating MAP Destination/Notes structure (out of scope at `R19:52`), vault anchoring `R17`/Brave `R16` hooks.

**Boundary:** `MAP.md:39-59` tickets are the decision surface; `.autoforge/discovery/tracker-index.md:22-96` R5-R15 R19 mirror is downstream stale-cache, but `tickets.ts` compilation is the single seam.

**Self-approve:** **TRUE** — contract fully spelled at `R19:38-48` with 3 adapters proving real seam (one adapter would be hypothetical but we have 3: markdown files, compiled JSON, board UI).

---

## AD-23 — Module depth & seam placement for remaining frontier (codebase-design lens)

- `src/discovery/jobs.ts:listJobs` — deep module (small `nextCursor` interface, large hidden `loadIndex`+trim+stale-fallback) — keep. Internal seam `loadIndex`/`saveIndex` correct location. `ponytail: indexLen=20 ceiling.`
- `src/discovery/health-aggregate.ts:aggregateHarvestHealth` — deep module (one function hides timestamp max + kind filter) — keep; becomes two adapters once KV tail variant lands.
- `src/wayfinder/tickets.ts:indexWayfinderTickets` — deep module (single fn hides `readdirSync`+`FRONT_MATTER_RE`+`classifyTickets`); three adapters prove real seam (markdown, API, board) — keep; CLI fourth adapter is thin leverage.
- `src/discovery/dedupe-persist.ts:loadDedupeIndexAsync` — medium-deep; promoted from shallow sync fallback. Two adapters (KV truth, file seed) make seam real; `writeQueue:17` internal single-writer seam is correct.
- `scripts/discovery-doctor.ts --json branch` — deep guard (small `--json` flag hides `Promise.all(discover)` fan-out + totals reduce).
- `src/discovery/ledger.ts` — still shallow sequencer; deepen only when R2 pipeline+CAS lands.

**Principles applied:** acceptance before seam (no seam without reuse), interface is test surface (callers/tests cross `listJobs`/`aggregateHarvestHealth`/`indexWayfinderTickets` seams), deletion test per candidate (report-remaining §8), one adapter = hypothetical.

---

## AD-24 — Locks & touches for remaining frontier (least-privilege)

| Lock | Members | Policy |
|---|---|---|
| `harvest-single-writer` | `harvest.ts:HARVEST_LOCK:104` + `finally:244` + `cancel/route.ts:16` `updateJob` writer | process-local bool is ceiling until `harvest-lock.ts` SET NX ships (R1) |
| `job-index-single-writer` | `jobs.ts:createJob:156-160` index update + `listJobs:223-274` read | atomic per KV `put(INDEX_KEY)` at `:160`; no concurrent `createJob` overlap expected (single harvest at a time) |
| `dedupe-index-single-writer` | `dedupe-persist.ts:17 writeQueue` `saveDedupeIndex:60-75` + `persistDedupeFromResult:100-104` | serialized `writeQueue.then` is ceiling; per-package locks deferred (`:16` comment) |
| `health-read` | `health/route.ts:143-157` `withPersistenceSingleWriter` at `single-writer.ts:7` | in-process only, best-effort when KV down |
| `wayfinder-compile` | `tickets.ts:136-193` `readdirSync` + `tickets/route.ts:6-17` | `readdirSync` sorted at `tickets.ts:141,151` makes deterministic; no write contention (reads only) |
| `ci-single-writer` | `check-eval-gate-freshness.mjs:7-34` + `.github/workflows/ci.yml:35-50` | ci reads `eval-gates.md:31-38` thresholds, writes no state |
| `gitignore-single-writer` | `.gitignore:1-46` + `.autoforge/AGENTS.md` | doc only |

Staging hygiene `git add <paths>` only, never `git add -A` (`AGENTS.md:21-23`). Parallel `vault/journal/**` lanes apply only to vault frontier (prior report AD-03/09), not this ops-residual frontier — but same rule keeps `workflow/wayfinder/**` edits disjoint per ticket file.

---

## AD-25 — Risk register delta (remaining frontier)

- Dedup fork + ledger race + cancel split-brain: see report-remaining §7 table — ceilings are `global queue` (`dedupe-persist.ts:17`), `HARVEST_LOCK` (`harvest.ts:104`), `write-queue`, `20-window` — upgrades deferred to R1/R2 CAS.
- Health shape drift: tracked as AD-14 NEEDS REVIEW until owner freezes `HarvestHealth`.
- AutoForge staging fork: AD-18 policy choice — curate vs ignore — owner pick prevents `?? .autoforge/` churn.
- Freshness gate warn-only: AD-19 HITL — must harden `warn→exit 1` and wire `gate-freshness` job in `ci.yml`.

---

## ADR deltas / self-approve summary

| Decision | Self-approve | Next step |
|---|---|---|
| AD-11 R5 cancel | **TRUE** | worker adds `cancel.test.ts` + `cancelling…` label |
| AD-12 R6 pagination | **TRUE** | add truncation comment + stale-cursor test |
| AD-13 R7 tooltip | **TRUE** | keep `title` at `provider-health.tsx:482` |
| AD-14 R8 health | **FALSE** | owner freeze `HarvestHealth` shape, then workers bridge |
| AD-15 R9 doctor JSON | **TRUE** | keep `--json` branch, add `JSON.parse` test |
| AD-16 R10 dedupe | **TRUE** | switch to `loadDedupeIndexAsync` + EROFS warn test |
| AD-17 R11 comments | **TRUE** | prune stale, keep `ponytail:` ceilings |
| AD-18 R12 staging | **FALSE** | owner pick (a) curated vs (b) ignore; implement `.autoforge/AGENTS.md` |
| AD-19 R13 freshness | **FALSE** | HITL — owner confirms threshold source, harden to `exit 1` + CI job |
| AD-20 R14 tier1 header | **NEEDS REVIEW** | confirm canonical script path, then self-approve header |
| AD-21 R15 deploy docs | **TRUE** | text-only README/deployment sync |
| AD-22 R19 plumbing | **TRUE** | add thin `scripts/wayfinder-tickets.ts` + `package.json` tickets script |

**Overall 8/12 self-approved, 4 need single-owner review (R8,R12,R13,R14).** No new ADR beyond this decision log and the prior vault `AD-01–AD-10` at `.autoforge/architecture/decisions.md:7-112`. If owner requests formal `docs/adr/*`, short ADRs for `AD-14 harvest-health shape` and `AD-18 AutoForge staging curate vs ignore` only when `CHARTER.md:82-85` amendment analogue triggers for `.autoforge/` policy.

---
Acceptance: boundaries per R at §2, interfaces at §5 of report-remaining, KV vs MemoryStore + Head worktree tradeoffs (§3.13-3.14 matrices), ponytail ceilings named (`jobs.ts:159,189 slice(0,20) O(20)`, `dedupe-persist.ts:17 queue`, `harvest.ts:104 GLOBAL LOCK`, `wayfinder compile O(n) n=maps`), least-privilege cited (`TRACKER.md:17,60-62`, `client.ts:81 x-admin-key`, `.gitignore:1-46`, `ci.yml:35-50`), self-approve flags per R where ticket contract fully documented.
