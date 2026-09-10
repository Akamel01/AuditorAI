# H12 — CI green for harvest chain: work plan

Source of truth: `.autoforge/architecture/H12.md` (follow verbatim). Ticket: `workflow/wayfinder/maps/ai-harvest-stream/tickets/H12-ci-green.md` (blocked_by [], blocks H10).
Status: architect done. This plan maps every architect line; no new design.

## Parallel rationale (explicit)

M1 and M2 touches are disjoint (architect §3, confirmed): M1 = `tests/e2e/harvest-buttons.spec.ts` + `.github/workflows/ci.yml`; M2 = `scripts/refresh-evidence-head.mjs` (new) + `.github/workflows/discovery-harvest.yml` + the two evidence JSONs. `ci.yml` vs `discovery-harvest.yml` are different workflows; `ci-gates.yml` and `scripts/check-evidence-head.mjs` are read-only in both. Overlap is conceptual only (both concern CI greenness). **M-H12-1 and M-H12-2 run PARALLEL. Merge order irrelevant.** Joint acceptance = single merge push with anchor refreshed at HEAD (`ci` + `Gate` green together).

Out of scope (explicit): e2e-live-prod / H10 monitor / live-e2e, threshold changes, new e2e coverage, `flow.spec.ts`, any checker (`check-evidence-head.mjs`) relaxation.

AGENTS.md hygiene: workers run NO `git add` / `git commit` / `git push` (no blanket adds ever). Merge push + immediate anchor refresh are orchestrator-side.

---

## M-H12-1 — Strict heading locator + keyed CI server (worker)

- Objective: fix `ci/browser e2e` strict-mode kill + keyless CI server (architect §1).
- Inputs: `tests/e2e/harvest-buttons.spec.ts:1-30`, `.github/workflows/ci.yml` e2e job (:80-92), `src/app/dev/mission-control/page.tsx:221-223` (ground ref, read-only), `playwright.config.ts:12-17` (read-only).
- Touches: `["tests/e2e/harvest-buttons.spec.ts", ".github/workflows/ci.yml"]`
- Steps (architect §1.2–§1.4 verbatim):
  1. Line 19: replace `await expect(page.getByText("MISSION CONTROL")).toBeVisible({ timeout: 10_000 });` with `await expect(page.getByRole("heading", { name: "Mission Control", exact: true })).toBeVisible({ timeout: 10_000 });`. No new params; `ADMIN_KEY` const (line 3) unchanged.
  2. Sibling audit, same file — disposition: **keep hard asserts unless a local browser run proves duplication, then minimal `.first()` with comment; worker decides, reviewer judges.** Table: :60/:91 `getByText("polling 1.5s").first()` SAFE keep; :146 `getByText(/stream/i).first()` SAFE keep; :148 `getByText(/Poll 2s/)` FLAG — append `.first()` only if run shows footer+badge duplicate; :153 `getByText(/continuous — Stop to end/)` FLAG — `.first()` only if run shows strict kill; :154 `getByText(/^continuous$/)` LIKELY SAFE leave unless red. `flow.spec.ts` untouched.
  3. `ci.yml` e2e job: add `env: { ADMIN_KEY: test-admin-key-0123456789abcdef }` on the e2e job (or on the `npx playwright test` step) — placement A only. Do NOT also touch `playwright.config.ts` `webServer.env` (no redundant seams). No secret wiring; prod `ADMIN_KEY` untouched. Rejected alts (no action): `exact:true` on `getByText` (asserts on Eyebrow span decoration), `data-testid` on `h1` (prod markup for test convenience, two-file diff).
- Exact commands (worker runs all):
  - `npm run build`
  - `ADMIN_KEY=test-admin-key-0123456789abcdef npx playwright test` (FULL suite, build mode, keyed server; headed-off headless default; ~3–5 min)
  - `npx tsc --noEmit`
- Acceptance:
  - [ ] Helper uses `getByRole("heading", { name: "Mission Control", exact: true })`.
  - [ ] Sibling audit done with per-line disposition above (any `.first()` addition has a comment citing observed duplication).
  - [ ] `ci.yml` e2e sets `ADMIN_KEY: test-admin-key-0123456789abcdef`.
  - [ ] Full local `npx playwright test` green in build mode.
  - [ ] `flow.spec.ts` unaffected (zero diff).
- Agent role: implementer. Reviewer needs: R-H12-1 (spec diff + sibling disposition + ci.yml placement).
- Rollback: `git checkout -- tests/e2e/harvest-buttons.spec.ts .github/workflows/ci.yml`

## M-H12-2 — Anchor writer + scheduled auto-refresh (worker)

- Objective: legitimate anchor refresh now + hourly auto-refresh with no checker changes (architect §2).
- Inputs: `.github/workflows/discovery-harvest.yml:35-64`, `scripts/check-evidence-head.mjs` (read-only, NOT touched), `.autoforge/validation/ops-loop-evidence.json` (read-only shape ref).
- Touches: `["scripts/refresh-evidence-head.mjs", ".github/workflows/discovery-harvest.yml", ".autoforge/validation/ops-loop-evidence.json", "stages/07_validate/output/ops-loop-evidence.json"]`
- Steps (architect §2.2–§2.3 verbatim):
  1. New `scripts/refresh-evidence-head.mjs` (~25 lines, stdlib only: `node:fs/promises`, `node:path`, `node:child_process`). Zero-arg. `commit = git rev-parse HEAD`; `generatedAt = new Date().toISOString()`; all other keys passed through untouched (invent NO health/ledger/probe data). Write canonical `.autoforge/validation/ops-loop-evidence.json` as `JSON.stringify(data, null, 2) + "\n"`, then `fs.copyFile` canonical → `stages/07_validate/output/ops-loop-evidence.json` in the same process (never separate steps). Rejected alts (no action): separate scheduled workflow (doubles push traffic); writer regenerating `t1`/`t2` bodies (fabricates evidence).
  2. `discovery-harvest.yml`: after `run discovery harvest` step add `refresh evidence anchor` step running `node scripts/refresh-evidence-head.mjs`; extend `commit ledger if changed` step's `git diff --quiet --` and `git add` paths with the two anchor JSONs. Keep `if: github.event_name != 'pull_request'`, keep `[skip ci]` in the commit message (loop-safety), keep `fetch-depth: 0`. No new commit step, no new push.
  3. Immediate refresh: orchestrator (not worker) runs the writer at merge HEAD so the merge push takes the strict `commit == HEAD` path.
- Exact commands (worker runs all):
  - `node scripts/refresh-evidence-head.mjs`
  - `cmp -s .autoforge/validation/ops-loop-evidence.json stages/07_validate/output/ops-loop-evidence.json && echo TWIN-OK`
  - `node scripts/check-evidence-head.mjs` (must exit 0)
  - YAML parse check same as pre-commit (e.g. `node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/discovery-harvest.yml','utf8')); console.log('YAML-OK')"` or repo pre-commit YAML hook)
- Acceptance:
  - [ ] Writer run green; canonical + twin byte-identical (`cmp -s`).
  - [ ] `node scripts/check-evidence-head.mjs` green locally (strict `commit == HEAD` path).
  - [ ] Workflow YAML parses (pre-commit parity); `[skip ci]` retained; PR guard retained.
  - [ ] No checker (`check-evidence-head.mjs`) or threshold changes (zero diff).
- Agent role: implementer. Reviewer needs: R-H12-2 (writer stdlib-only + passthrough + twin atomicity; workflow diff minimal + loop-safety).
- Rollback: `git checkout -- scripts/refresh-evidence-head.mjs .github/workflows/discovery-harvest.yml` + restore JSON anchors from HEAD: `git checkout HEAD -- .autoforge/validation/ops-loop-evidence.json stages/07_validate/output/ops-loop-evidence.json` (i.e. `git checkout --` both JSONs if uncommitted; writer output never commits from worker).

---

## Execution work order (DAG)

```
M-H12-1 ──┐
          ├──> R-H12-1 ──┐
M-H12-2 ──┘              ├──> V-H12 (merge-push gate: ci + Gate green)
          ├──> R-H12-2 ──┘
```

- Wave 1 (parallel): M-H12-1 + M-H12-2 — disjoint touches, parallel-safe.
- Wave 2 (parallel after BOTH workers land): R-H12-1 (M1 review) + R-H12-2 (M2 review).
- Wave 3: V-H12 validator after both reviews — joint acceptance: anchor refreshed at merge HEAD via writer, `ci` + `Gate R13/R17` green on the merge push. Machine-readable DAG: `.autoforge/execution/work-order-H12.json`.
- Shared-state guard: workers share no mutable file; intersecting-touches flag = false. Sequential only at review/validate gates.

## Acceptance traceability (architect §4 mapped)

- "helper uses `getByRole(\"heading\", …)`" → M-H12-1 step 1 (§1.2).
- "sibling text locators audited" → M-H12-1 step 2 (§1.3 table + disposition).
- "`ci.yml` e2e sets `ADMIN_KEY: …`" → M-H12-1 step 3, placement A (§1.4).
- "full `npx playwright test` green locally in build mode; flow.spec unaffected" → M-H12-1 commands + acceptance (§1.4).
- "anchor refreshed from real evidence (commit=HEAD, generatedAt=now, twin identical)" → M-H12-2 steps 1+3 (§2.2 + immediate-refresh).
- "scheduled workflow refreshes anchor on each run (writer script + step, `[skip ci]`-safe)" → M-H12-2 step 2 (§2.3).
- "no checker relaxation" → M-H12-2 acceptance (checker zero-diff).
- "`ci` + `Gate` green on the merge push" → V-H12 joint acceptance (§2.3 last para + §3).
