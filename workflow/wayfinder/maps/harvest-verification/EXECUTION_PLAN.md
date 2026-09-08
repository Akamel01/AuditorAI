# Harvest Verification — Execution Plan to Close the Loop

**Map:** `workflow/wayfinder/maps/harvest-verification/MAP.md`  
**Destination:** Automated, evidence-backed verification of harvesting via **Run this gap (Live)** and **Run Live Harvest** with reusable auto-monitor + one-command harnesses (local + CI) that prove `main` is green.  
**Created:** 2026-09-08  
**Ticks:** HV1 ✓, HV2 ✓, HV3-8 pending (8 total, 2 closed via research subagents)

---

## 0. Wayfinder Invariant (read before executing)

- **Frontier = open + unassigned + every `blocked_by` closed.** Work only frontier tickets. Claim by setting `assignee` + `status: claimed` before any work.
- **Never resolve more than one non-research ticket per session** (research may batch). Subagents handle research via `research` skill.
- **Ponytail:** reuse `DataStore` seam, no new deps, `node`+`fetch` + `adminApi`, prefer API harness over Playwright where it reaches same seam.
- **Staging:** explicit `git add <paths>`; never bare `vault-import/export`; use `vault-sync.mjs`.

---

## 1. Phased DAG (dependency-aware)

```
Phase 1 — Harden (parallel frontier, 1 session each)
  HV5 [grilling HITL] ─┐
  HV3 [prototype HITL] ─┼─► Phase 2
  HV4 [prototype HITL] ─┘        │
                                ▼
Phase 2 — Verify (AFK, parallel after Phase 1)
  HV6 [task AFK] — gap-targeted live-verify ─┐
  HV7 [task AFK] — gap-aware live-verify    ─┼─► Phase 3
                                              ▼
Phase 3 — Gate (HITL)
  HV8 [task HITL] — wire validation gates

Blocked edges (from ticket front-matter):
  HV1 -> HV3,HV4,HV5 ✓ closed
  HV2 -> HV3,HV4,HV5 ✓ closed
  HV3 -> HV6,HV7
  HV4 -> HV6,HV7
  HV5 -> HV6,HV7,HV8
  HV6 -> HV8
  HV7 -> HV8
```

**Current frontier (open + unblocked + unclaimed):** `HV3`, `HV4`, `HV5` — pick one per session, claim first.

---

## 2. Phase 1 — Harden (3 tickets, can run in parallel sessions)

### HV5 — Define success for gap-targeted vs gap-aware (grilling, HITL)

**Claim:** `status: claimed` + `assignee: <you>` on `HV5-success-criteria.md`

**Do:**
1. Call Skill `grilling` + `domain-modeling` (per map Notes) with `docs/research/harvest-backend-seams.md` + `docs/research/harvest-ui-wiring.md` + `src/discovery/harvest.ts:373` + `src/discovery/pipeline.ts:83` (D01..D10) in context.
2. Lock table (copy into `docs/research/harvest-success-criteria.md`):

| Path | Payload | Success | Degraded | Skipped/Busy |
|---|---|---|---|---|
| **Gap-targeted** `cellKey` set | `POST {live:true, cellKey}` | job `done`, D01..D10 includes gap-targeted hint, ledger `+≥1` package for that `cellKey`, that `cellKey` `have_total` ↑ or refusal with reason recorded, dedupe `delta == packages`, `health.lastRunAt==ranAtIso` | Brave 402 `health_degraded true` but ledger correctly refused/unmutated with `gapRunError` surfaced (not silent) | `harvest lock held` → `202` then job `error` `busy`, ledger 0, surfaced as `error` not hang |
| **Gap-aware** `cellKey null` | `POST {live:true}` | job `done`, gaps `slice(0,3)` themes used, `coverage.gaps_ranked` recomputed (`generated==ranAtIso`), queue ticker `result.queue[0..2]` matches gaps, ledger `0..N`, `target_total` unchanged | same 402 handling | same busy |
| **Dry vs live** | `live false` vs `true` | dry: seed-portals only, no quota | live: brave-search may 402 | — |

3. Note CI oracle: dry mock (MemoryStore, no network) must pass same table with `0` or `1` deterministic package; live quota may 402 is `degraded` not `fail`.

**Done:** `HV5` closed, `## Resolution` appended, `MAP.md:Decisions so far` line added, `docs/research/harvest-success-criteria.md` committed. This unblocks HV3/HV4 to reference frozen oracle, and HV6/HV7/HV8 to assert.

**Guard:** HITL — do not have subagent answer for human; record human's words verbatim.

---

### HV3 — Design the auto-monitor (prototype, HITL)

**Claim:** `HV3-auto-monitor.md`

**Prototype:** `scripts/harvest-verify.mjs` (single file, node stdlib + `fetch`)

- CLI: `ADMIN_KEY=... node scripts/harvest-verify.mjs --api gap --cellKey <key> --live --monitor` or `--api harvest --live --monitor` or `--jobId <id> --monitor` or `--dry --api gap --cellKey <fixture>`
- Poll `GET /api/dev/discovery/jobs/:id` every 1.5s (mirrors UI), each tick snapshot:
  - J: `job.status/logs/currentNode/D01..D10` (expect 22 logs `D00-QUEUED×2 → D01..D10`)
  - L: `GET /api/dev/discovery` `ledgerTotal/ledgerTail` + `state/discovery-ledger.json` `discovery:ledger:entry:*`
  - C: `GET /api/dev/coverage` `cells[*].have_total/target` `gaps_ranked` `generated`
  - D: `dedupe.sha256Entries` `discovery:dedupe-index` + `state/dedupe-index.json`
  - H: `GET /api/dev/health` `harvestHealth.lastRunAt/health_degraded` + `ledgerAge`
  - P: `GET /api/dev/discovery/proof` `ledgerDigest/manifest.jobId`
  - Q: `job.result.queue` vs `coverage.gaps_ranked`
- Detect terminal `done/error/cancelled`, `busy` (202→error `harvest lock held`), `UnknownCellKey 400`, `StoreUnavailable 503`, `429` Retry-After, `402` degraded.
- Emit `state/harvest-verify/<jobId>.json` (ticks + before/after deltas + pass/fail per HV5 table) + stdout human summary. Keep `state/harvest-verify` git-tracked but `.gitignore` `tmp/` for large captures.

**Accept:** `ADMIN_KEY=test-admin-key-... node scripts/harvest-verify.mjs --dry --api gap --cellKey usa:PRELIMINARY_DESIGN --monitor` proves HV5 table without network (MemoryStore mock, 1 package).

**Done:** prototype linked, `HV3` closed.

---

### HV4 — Build one-command harnesses (prototype, HITL)

**Claim:** `HV4-harness.md`

**Prototype 2 harnesses reusing HV3 monitor:**

- **API harness:** same `scripts/harvest-verify.mjs --api gap|harvest` as above (thin driver: sets `x-admin-key`, picks `cellKey` or null, hands jobId to monitor). Handles `202` vs `400` vs `401`.
- **UI harness:** `tests/e2e/harvest-buttons.spec.ts` (Playwright, tag `@harvest`):
  ```ts
  test('gap via UI', async ({page}) => {
    await page.goto('/dev/mission-control');
    await page.evaluate(k=>localStorage.setItem('auditorai.admin_key', k), ADMIN_KEY);
    await page.reload();
    await page.getByTestId('run-gap-usa:DETAILED_DESIGN').click(); // queue-ticker.tsx:168
    await expect(page.getByText(/polling 1.5s/)).toBeVisible();
    // monitor via API in parallel, assert same HV5 table
  });
  test('live harvest via UI', async ({page}) => {
    await page.getByRole('button', {name: /Run one live harvest batch/}).click(); // provider-health.tsx:381
  });
  ```
  Add missing `data-testid` if absent (`gap-card-*`, `run-gap-*`).

- **Doc:** `docs/research/harness-design.md` mapping `button → harness → backend seam` + one-liners.

**Accept:** Both harnesses hit same seam (`POST /api/dev/discovery/run` → `after(executeJob)` → `discovery:job:*`), produce identical evidence shape, differ only in driver.

**Done:** `HV4` closed.

---

## 3. Phase 2 — Verify (2 tasks, AFK, parallel after Phase 1)

### HV6 — Live-verify "Run this gap (Live)"

**Claim:** `HV6-verify-gap.md`

**Execute AFK:**
```bash
GAP=$(curl -s -H "x-admin-key: $ADMIN_KEY" /api/dev/coverage | jq -r .gaps_ranked[0]) # e.g. usa:DETAILED_DESIGN
ADMIN_KEY=$ADMIN_KEY node scripts/harvest-verify.mjs --api gap --cellKey $GAP --live --monitor
npx playwright test tests/e2e/harvest-buttons.spec.ts -g "gap" --headed  # once for proof
```

**Assert HV5 gap-targeted table** (see subagent evidence `HV6-usa-DETAILED_DESIGN-job_mts2z6cn_typy9b` as reference: ledger `+10` but `have_total 0→0` degraded due seed-only fallback — still pass as `degraded` with correct refusal; on fresh gap expect `+1`).

**Deliver:** `state/harvest-verify/HV6-<gap>-<jobId>.json` + `## Resolution` with pass/fail per HV5 row + link.

**Flake:** if `402` quota, prove `health_degraded true` + `gapRunError` surfaced, ledger correctly unmutated vs silent drop; else `MemoryStore` dry run.

---

### HV7 — Live-verify "Run Live Harvest"

**Claim:** `HV7-verify-harvest.md`

**Execute AFK:**
```bash
ADMIN_KEY=$ADMIN_KEY node scripts/harvest-verify.mjs --api harvest --live --monitor
npx playwright test tests/e2e/harvest-buttons.spec.ts -g "live-harvest"
```

**Assert HV5 gap-aware** (reference `HV7-job_mts33fzf_f5ohj6`: `44→54 +10`, `queue[0..2]` matches `gaps_ranked`, dedupe `0` on duplicate, health advances, job store isolates `cellKey null` vs `usa:DETAILED_DESIGN`).

**Deliver:** `state/harvest-verify/HV7-<jobId>.json` + resolution.

---

## 4. Phase 3 — Gate (1 task, HITL, after HV6/HV7)

### HV8 — Wire validation gates

**Claim:** `HV8-validation.md`

**Wire `verify-and-stop`:**
- `package.json:ci:local` already covers `lint+typecheck+test+build+validate-state+vault+gates`; add `node scripts/harvest-verify.mjs --dry --api gap --cellKey usa:PRELIMINARY_DESIGN --monitor` as dry gate (no quota) — assert `HV5` dry table.
- Tag Playwright `@harvest` to run post-deploy on `preview` (`ADMIN_KEY` secret) — not on `main` push without preview.
- Update `.githooks/pre-commit` and `AGENTS.md:Guardrails` with `--help` entry for `harvest-verify.mjs`.
- Update `ci.yml` `quality` or new `harvest` job: dry mock only; live stays manual (`workflow_dispatch`).

**Done:** `HV8` closed, `MAP.md:Decisions so far` updated, `Not yet specified` fog graduate if new patches surfaced.

---

## 5. Evidence Contract (what "done" leaves on disk)

- `docs/research/harvest-backend-seams.md` (HV1) ✓
- `docs/research/harvest-ui-wiring.md` (HV2) ✓
- `docs/research/harvest-success-criteria.md` (HV5) — frozen oracle
- `docs/research/harness-design.md` (HV4)
- `scripts/harvest-verify.mjs` + `--help` (HV3)
- `tests/e2e/harvest-buttons.spec.ts` (HV4)
- `state/harvest-verify/HV6-*.json` + `HV7-*.json` (HV6/HV7) — ad-hoc evidences already exist as `HV6-usa-DETAILED_DESIGN-job_mts2z6cn_typy9b.json` + `HV7-job_mts33fzf_f5ohj6.json`; replace with hardened harness reruns.
- CI green: `lint 0, typecheck 0, test 560pass, build ok, vault 36, R13/R17 pass, harvest dry mock pass`.

---

## 6. Who does what (subagent map)

| Ticket | Subagent | Skill | Branch |
|---|---|---|---|
| HV1 | `ses_f810f7343ffe` | `research` | `research/harvest-backend-seams` (done) |
| HV2 | `ses_f810df0dcffe` | `research` | `research/harvest-ui-wiring` (done) |
| HV3 | next frontier | `prototype` | `prototype/harvest-monitor` |
| HV4 | next frontier | `prototype` | `prototype/harvest-harness` |
| HV5 | next frontier | `grilling` + `domain-modeling` | HITL — human locks table |
| HV6,HV7 | AFK `general` | `tdd` + `diagnosing-bugs` | `verify/harvest-gap` + `verify/harvest-live` |
| HV8 | HITL | `verify-and-stop` | `gate/harvest-verify` |

Research subagents already completed in parallel; next session claims the **first frontier** (`HV3` or `HV5` — grilling can interleave with prototyping) per Wayfinder rule: claim → work → resolution comment → close → append `MAP.md:Decisions so far`.

---

## 7. One-liners to close the loop right now

```bash
# claim & grill HV5 (human)
open workflow/wayfinder/maps/harvest-verification/tickets/HV5-success-criteria.md
# prototype monitor (AFK)
npm run dev &  # ensure localhost:3000 + ADMIN_KEY
ADMIN_KEY=test-admin-key-... node scripts/harvest-verify.mjs --dry --api gap --cellKey usa:PRELIMINARY_DESIGN --monitor
# verify gap (AFK)
ADMIN_KEY=3fa73bcd104a03775313e0368bf39cc01f52b79e45d852926bb68fac5b5cb74b node scripts/harvest-verify.mjs --api gap --cellKey $(curl -s -H "x-admin-key: $ADMIN_KEY" http://localhost:3000/api/dev/coverage | jq -r .gaps_ranked[0]) --live --monitor
# verify harvest (AFK)
ADMIN_KEY=... node scripts/harvest-verify.mjs --api harvest --live --monitor
# gate
npm run ci:local
```

**Stop condition:** `HV8` closed, `MAP.md` has 8 decisions, `gh run list` shows `ci` + `Gate: R13...` + `deploy` green on `main` with `state/harvest-verify` evidence committed.

