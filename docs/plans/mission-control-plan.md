# Mission Control — Developer Operation & Readiness UI

**Status:** Plan (pre-implementation)  
**Route:** `https://auditorai-gamma.vercel.app/dev/mission-control` (new developer-only area)  
**Owner:** Principal Architect (this session) + Discovery Operator/Monitor subagents (spawned post-approval)

---

## 1. Goal

A single, developer-only **Mission Control** that makes AuditorAI's development state observable and controllable without digging through `state/*.json` or Vercel logs. It will:

- **Operate** the discovery pipeline (start/pause, run one batch, set targets, approve Tier-1 licensed sources).
- **Monitor** discovery health (provider pings, rate-limit, dedupe, harvest history, queue).
- **Visualize ODD coverage** as a first-class matrix with per-cell readiness meters.
- **Track readiness** across discovery → validation → fine-tuning layers, with honest numbers for future client confidence views.

Later, the same shell expands to fine-tuning progress, eval runs, and client-facing confidence dashboards. This plan only builds the developer signal; client visuals reuse the same data contracts.

**Non-goals for this slice:** client confidence UI, automated fine-tuning execution, paywall circumvention.

---

## 2. Users & Jobs

- **Developer / Operator (you):** "Is harvest healthy? Which ODD cells are starved? Should I approve the next Tier-1 source? Run one more gap-aware batch now."
- **Reviewer / Auditor:** "Is this cell's `full-package` count honest? What's the provenance of the last 10 packages?"
- **Future client stakeholder:** Will see a *derived* confidence view (same `OddCoverageView` + `readiness-report.json` but filtered). Not built here — contract compatibility is the handoff.

---

## 3. Information Architecture

### 3.1 Navigation

Current `AppShell` (`src/app/_components/ui/app-shell.tsx:13`) exposes `/` + `/projects`. Dev console (`/dev`) is orphaned (no nav link). **Proposed:**

- Add a `Mission Control` link in `AppShell` that is **visible only when `x-admin-key` is present** (same gate as `/api/dev/*`). It points to `/dev/mission-control`.
- Inside `/dev/mission-control`, a `Segmented` control (`src/app/_components/ui/segmented.tsx:9` — already exists, unused) switches four views without route changes (keeps state). Alternative is sub-routes `/dev/mission-control/discovery|odd|readiness` — segmented is simpler for now; sub-routes can be added later if deep-linking is needed.

```
AppShell
 ├── /            (landing)
 ├── /projects    (workspace)
 └── /dev/mission-control  ← new, admin-gated
       ├── [Overview]  KPI cards + health + next queue
       ├── [Discovery] Operation & logs
       ├── [ODD Matrix] Visual grid + per-cell drilldown
       └── [Readiness] Corpus / fixtures / eval / learning
```

### 3.2 Views

#### A. Overview (default)

- **KPI strip** (5 cards, uses existing `Panel` + `Eyebrow` `CH` pattern):
  - ODD cells: `5 IN / 10 mapped_unproven / 1 absent` (`policies/odd.json:16`, `src/domain/odd.ts:92` three-zone)
  - Coverage: `have_total / 500` + `have_full_package / target` donut (from `state/odd-coverage.json:5` or `GET /api/dev/coverage`)
  - Ledger: `entries.length` + last `at` (`state/discovery-ledger.json:5`)
  - Corpus: `78 total / 6 fewshot / 26 calib / 41 reserve` (`state/readiness-report.json:16-22`)
  - Gate health: latest Tier-1 archive `pass_rate` + `projectPassRate` sparkline (`src/lib/eval-gates.ts:63`)
- **Health row:** provider pings (Brave OK / CSE deprecated), rate-limit (1 rps / 2-conc), last harvest status (from `discovery-ledger` last `D08-QUALITY` + `D09-COVERAGE`), daemon state (LaunchAgent `running` vs GitHub Action last run).
- **Next queue ticker:** top 3 `gaps_ranked` + `query_theme` cards (`src/discovery/coverage.ts:212` `buildQueue`).

#### B. Discovery (Operation)

- **Controls** (admin-only, `POST` with `x-admin-key`):
  - `Run one gap-aware batch now` → `POST /api/dev/discovery/run` (wraps `runDiscoveryPipeline` dry/live, returns `coverage` + `queue`)
  - `Run targeted` → pick a `cell_key` from dropdown → runs with that cell's `query_theme`
  - `Approve Tier-1 source` → moves a `reserve` entry's licence from `licensed-tier1-pending` → `ogl-v3` (writes `state/discovery-ledger.json` via `exceptions_queue` pattern)
- **Provider health panel:** `GET /api/dev/discovery/providers` → `listProviderIds()` + `providerEnabled()` + last `discover()` latency/error (from `scripts/discovery-doctor.ts` logic). Shows Brave OK 3 hits, CSE deprecated badge, seed-portals always.
- **Harvest history:** table of last 20 ledger `entries` grouped by `at` (run), with `payload_kind` chips, `dedupe_status` badges, `provenance` link (SHA). Uses `Panel` + `StateChip`.
- **Dedupe inspector:** `state/dedupe-index.json` clusters view.

#### C. ODD Matrix (Visual)

- **Matrix:** Jurisdictions as rows (UK, US, CA, AE, INT), canonical stages as columns (`FEASIBILITY_CONCEPT | PRELIMINARY_DESIGN | DETAILED_DESIGN` + combined `PRELIM+DETAILED` for `ae-ad:S12`). Each cell is a card:
  - Header: `jurisdiction_id` + `native_stage_id` (or `—` for absent) + `mapping_confidence` chip (`authoritative`/`interpreted`/`inferred`)
  - Status badge: `IN` (accent), `mapped_unproven` (warn), `structurally_absent` (hairline, disabled)
  - Donut: `have_total / target` (from `odd-coverage.json:target` via `RISK_WEIGHT` + fragile bonus `src/discovery/coverage.ts:41-51`)
  - Small bar: `have_full_package` vs `have_total`
  - Label pill: `COVERED / UNDER-COVERED / MISSING / OVER-REPRESENTED / EXCLUDED` (`src/discovery/types.ts:179`)
  - Footer: `fixture_ids.length` + `input_floor.length` icons + `priority` heat (0–3)
- **Drilldown (click cell):** side sheet shows `uncovered_reasons[]`, `scheme_scope_note`, `input_floor[]` checklist with `oddFloorSatisfied` check, recent packages for that `cell_key`, and `queue` rank.

#### D. Readiness (Meters)

- **Discovery meter:** `odd-coverage` progress + `discovery-ledger` growth sparkline.
- **Validation meter:** `eval-gates` thresholds (`src/lib/eval-gates.ts:17-23`) + latest archive `gate{pass_rate, scored}` (`state/readiness-report.json:170-483`) + `detectRegression` delta.
- **Fine-tuning meter (placeholder, honest):** `learning-metrics.ts:24` `promotion_rate` + `hallucination.rate` — currently `null` / "no outcomes logged yet" (`state/readiness-report.json:496`). Shows **0% → not ready** until `CandidateOutcome` log exists. This honesty is intentional for future client view.
- **References meter:** `evidence_records` count (161) from `state/evidence-registry.json`, per-jurisdiction breakdown.
- **Per-cell readiness strip:** For each of the 16 cells, a 4-segment bar (samples / fixtures / references / guidelines) — maps directly to the "different aspects" you listed. Each segment's definition is tied to a `state/*.json` field so the meter is auditable, not decorative.

---

## 4. Data & API Contracts

All new routes are **admin-gated** (`requireAdmin` `src/lib/api.ts:30`, `x-admin-key` via `adminApi` `src/lib/client.ts:80`), like existing `/api/dev/*`. No new auth model.

| Route | Method | Reads | Returns | Notes |
|---|---|---|---|---|
| `GET /api/dev/odd` | admin | `policies/odd.json` via `getOddDeclaration()` `src/domain/odd.ts:52` | `OddDeclaration` | Single source of truth for matrix |
| `GET /api/dev/coverage` | admin | `state/odd-coverage.json` (or recomputed via `computeCoverage`) | `OddCoverageView` `src/discovery/types.ts:201` | Validated against `odd-coverage.schema.json` |
| `GET /api/dev/discovery` | admin | `state/discovery-ledger.json` tail + `state/dedupe-index.json` + provider health | `{ ledgerTail, dedupe, providers, lastRun }` | Ledger tail = last 20 entries; providers = `listProviderIds` + `providerEnabled` |
| `POST /api/dev/discovery/run` | admin | triggers `runDiscoveryPipeline` | `{ coverage, queue, packages }` | Body `{ live?: boolean, cellKey?: string }`; live requires secrets, else dry-run |
| `GET /api/dev/readiness` | admin | `state/readiness-report.json` + `src/lib/learning-metrics.ts` | `ReadinessReport` + `LearningMetrics` | Reuses existing script output, no new computation |
| `GET /api/dev/health` | admin | provider pings + ledger recency + `validate-state` | `{ providers, ledgerAge, topologyDrift }` | Wraps `scripts/discovery-doctor.ts` logic |

**Client contracts:** All `state/*.json` files remain the single source of truth. API routes are thin projections (no new state). This preserves `AGENTS.md:5` vault determinism and `validate-state.mjs` checks.

---

## 5. Component Breakdown (deep modules, small interfaces)

Reuse existing design system: `Panel` `src/app/_components/ui/panel.tsx:3`, `Segmented` `src/app/_components/ui/segmented.tsx:9`, `Chips` `src/app/_components/ui/chips.tsx:8`, `AppShell` `src/app/_components/ui/app-shell.tsx:10`, tokens `src/app/globals.css:11`.

New components (each <150 lines, pure, testable):

- `src/app/dev/mission-control/_components/kpi-strip.tsx` — 5 `Panel` cards, props `OddCoverageView` + `ReadinessReport`.
- `src/app/dev/mission-control/_components/odd-matrix.tsx` — grid `jurisdiction × canonical`, props `OddDeclaration` + `OddCoverageView`, emits `onCellClick(cell_key)`.
- `src/app/dev/mission-control/_components/cell-card.tsx` — per-cell donut + label + priority heat, props `CoverageCellView`.
- `src/app/dev/mission-control/_components/readiness-meters.tsx` — 4 bars (discovery/validation/fine-tuning/references), props `ReadinessReport` + `LearningMetrics`.
- `src/app/dev/mission-control/_components/provider-health.tsx` — provider badges + last latency.
- `src/app/dev/mission-control/_components/queue-ticker.tsx` — `QueueItem[]` cards.
- `src/app/dev/mission-control/page.tsx` — client page, `adminApi` fetches, `Segmented` state, composes above.

Deep modules behind APIs:

- `src/discovery/coverage.ts` already is the deep module for `OddCoverageView`.
- `src/domain/odd.ts` for `OddDeclaration`.
- New thin API handlers: `src/app/api/dev/coverage/route.ts`, `src/app/api/dev/discovery/route.ts`, etc. — each <40 lines, delegating to deep modules.

---

## 6. Spawning Discovery Operation Agents

You asked to **spawn agents in new sessions to operate and monitor discovery, with you as overseer**. Proposed:

| Agent | Session | Responsibility | Spawn trigger |
|---|---|---|---|
| **Discovery Operator** | `opencode` session `discovery-operator` | Runs `npx tsx scripts/discovery-run.ts --live --write` hourly (or on demand via Mission Control), respects `TARGET_TOTAL` and `LOOP` edge | Spawned after Mission Control lands; `Task` with `subagent_type: general`, prompt = run loop + report to `state/discovery-ledger.json` |
| **Discovery Monitor** | `opencode` session `discovery-monitor` | Tails `/tmp/auditorai-discovery.log`, watches `odd-coverage` gaps, alerts if `lastRunAge > 2h` or `providerEnabled` flips to false, updates health endpoint | Spawned alongside Operator; reads `state/*` every 5m |
| **Overseer (you, main session)** | `AuditorAI` main | Owns `AGENTS.md` vault determinism, merges `feat/*` branches, approves Tier-1 licensed sources via Mission Control | Already acting |

Spawn is via `Task` tool with `subagent_type: general` and explicit `prompt` referencing `src/discovery/pipeline.ts:333` `runDiscoveryPipeline` and `state/graph-state.json:discovery_graph`. Each subagent is stateless; authoritative state stays in `state/*.json` (ICM invariant 9: filesystem is the state machine).

---

## 7. Build Phases

| Phase | Deliverable | Verify |
|---|---|---|
| **P1 — API seam** | 5 admin routes above + `src/lib/client.ts` `adminApi` wrappers | `npm run typecheck` + `vitest` for route handlers (mock `state/*.json`) |
| **P2 — Mission Control shell** | `src/app/dev/mission-control/page.tsx` + `Segmented` + `AppShell` link (admin-gated) | `npm run lint` + visual check at `/dev/mission-control` |
| **P3 — ODD Matrix + meters** | `odd-matrix.tsx` + `cell-card.tsx` + `readiness-meters.tsx` consuming `OddCoverageView` | `npx tsx scripts/gen-node-topology.ts --check` still OK, `validate-state.mjs` OK |
| **P4 — Discovery operation** | `provider-health.tsx` + `queue-ticker.tsx` + `POST /api/dev/discovery/run` wiring | `npx tsx scripts/discovery-doctor.ts --live` shows Brave OK |
| **P5 — Spawn subagents** | Two `Task` sessions with prompts as above, monitored via Mission Control health panel | `launchctl print` shows `com.auditorai.discovery` still active alongside new agents |

Each phase is one agent session, one commit, `explicit git add <paths>` per `AGENTS.md`.

---

## 8. Risks & Guards

- **Vault determinism race** (`AGENTS.md:5`): Discovery ledger is append-only in `state/` (machine zone per `vault/CHARTER.md:19`), never in `vault/`. New UI reads `state/*.json` only; no `vault-import.mjs` bare calls.
- **Admin key exposure:** Dev routes stay `requireAdmin` (`src/lib/api.ts:30`, SHA256 `timingSafeEqual`). Mission Control link hidden when no admin key (same pattern as dev console).
- **Client vs dev signal:** Client view (later) will project `OddCoverageView` through a filtered API (`have_total` only, no `queue` or `provider` internals) to keep discovery internals internal.
- **Over-structuring:** Ladder check — a single `Mission Control` page with 4 segments is the smallest structure that carries the job (ICM "three real stages beat seven imagined ones"). No separate `workspace/discovery/` UI yet.

---

## 9. Open Questions (grill before build)

1. Should `Mission Control` live at `/dev/mission-control` (gated, existing dev pattern) or at new top-level `/ops` (ungated but still admin-only)? Leaning `/dev/mission-control` for now.
2. Do you want the `LaunchAgent` hourly harvest to remain the primary loop, with Mission Control as *monitor*, or should Mission Control's `Run now` become the primary trigger (and LaunchAgent becomes fallback)?
3. For the future client confidence view, which denominator do you want: `500` (discovery target) or per-cell `target` from `odd-coverage.json:target`? The latter is more honest per ODD.

---

**Next step:** Approve this plan, then spawn P1 (API seam) in the next session. No files changed in this turn (plan mode).
