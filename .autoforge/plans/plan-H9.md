# H9 — Start-continuous API+UI wiring: execution plan

Source: `.autoforge/architecture/H9.md` verbatim (§1a–1d, §2–§4) + ticket `H9-start-continuous-ui.md`.
H3 stays OPEN (non-intersecting, verification-only block). E2E live run deferred to H10.

## Guard

- `touches` (all modules, no other glob without flag):
  - `src/app/api/dev/harvest-stream/route.ts`
  - `src/lib/client.ts`
  - `src/app/dev/mission-control/_components/ai-harvest-control.tsx`
  - `tests/e2e/harvest-buttons.spec.ts`
- Architect lock: route does `continuous = body.continuous !== false` + post-creation assignment (`stream.continuous = continuous` between status-RUNNING and saveStream). NO edit to `src/discovery/harvest-stream.ts` (H8 owner). If worker threads `continuous` through `createStream(…)` → STOP, needs guard amendment.
- AGENTS.md hygiene: worker does NO `git add -A` / commit / push. Explicit `git add <touched-paths>` only if asked; never run `scripts/vault-import/export.mjs` bare (`vault-sync.mjs --check` before push).

## Modules (sequential DAG: M-H9-1 → M-H9-2 → M-H9-3; same session allowed, in order)

### M-H9-1 — API + client (route default + optional field)
- Objective: `POST /api/dev/harvest-stream` accepts/persists `continuous`, defaults true; client forwards optional field.
- Inputs: architect §1a, §1b; ticket acceptance line 1.
- Steps:
  1. `route.ts`: extend body type `{live?: boolean; cellKey?: string \| null; continuous?: boolean}`; add `const continuous = body.continuous !== false;` (omitted/true/truthy → true; only explicit `false` → one-shot); assign `stream.continuous = continuous;` after `status = "RUNNING"`, before `saveStream`. Response shape unchanged (`201 {streamId, stream}`).
  2. `client.ts` (`startHarvestStream`): extend body type with `continuous?: boolean` only. NO default in client (locality: default lives in route). Existing callers must still compile.
- `touches`: `src/app/api/dev/harvest-stream/route.ts`, `src/lib/client.ts`
- Depends: H8 (closed). Blocks: M-H9-2.
- Acceptance (run in-session):
  - `npx tsc --noEmit`
  - `npm run lint -- --max-warnings=0 <touched-files>` (or repo lint scope covering them)
  - `npm run build` (route change → must pass)
- Reviewer needs: diff shows exact default line + post-creation assignment; no `harvest-stream.ts` in diff.

### M-H9-2 — Control UI (Start continuous wiring)
- Objective: Start sends `continuous:true`; label/badge/status/footer per ticket.
- Inputs: architect §1c; ticket acceptance lines 2–3.
- Steps:
  1. `Stream` type: add `continuous?: boolean` (OPTIONAL — falsy-safe for H8 old streams; never required, never `=== false`-gate badge).
  2. `start()` body: `JSON.stringify({live, cellKey: cellKey || null})` → add `continuous: true`.
  3. Button label → `{busy ? "Starting…" : "Start continuous"}`; keep `data-testid="ai-harvest-start"`.
  4. Status: truthy-gated badge `{!!stream.continuous && (<span className="rounded bg-sunken px-1.5 py-0.5">continuous</span>)}` (reuse idiom, no new motion); status text = existing `iter N · packages M` prefix + `{stream.continuous ? " · continuous — Stop to end" : ""}`.
  5. Footer: append `· Reach: Exa+Jina via agent-reach` verbatim.
  6. Unchanged: Pause/Resume/Stop, 2s poll + `ponytail:` ceiling comment; reuse Panel/Eyebrow/`active:scale-[0.98]`; no new components/deps/pages.
- `touches`: `src/app/dev/mission-control/_components/ai-harvest-control.tsx` (+ relies on M-H9-1 client type; no edit to other files)
- Depends: M-H9-1. Blocks: M-H9-3.
- Acceptance:
  - `npx tsc --noEmit`
  - `npm run lint -- --max-warnings=0 <control-file>`
  - vitest domain files if touched-by-behavior (none expected; report `npx vitest run` scope or "no unit surface")
- Reviewer needs: label string, badge gating (`!!`), em-dash string `continuous — Stop to end`, footer verbatim.

### M-H9-3 — E2E spec (assert continuous wiring)
- Objective: `@harvest` spec proves POST body + badge without live run.
- Inputs: architect §1d; ticket acceptance line 4.
- Steps:
  1. Keep tag `@harvest`, `gotoMissionControl` + `switchTo("AI Harvest")` + `getByTestId("ai-harvest-start")` + 201/400/401/503 tolerance harness. No monitor/harness changes (H10 owns).
  2. Add on 201 path: capture `postResp.request().postDataJSON()` (or `postData()` parse) → `expect(posted.continuous).toBe(true)`.
  3. Add badge: `await expect(page.getByText(/continuous — Stop to end/)).toBeVisible()` + `/^continuous$/` badge visible. Keep `Poll 2s` footer check; optionally assert `/Reach: Exa\+Jina/`.
- `touches`: `tests/e2e/harvest-buttons.spec.ts`
- Depends: M-H9-2. Blocks: H10 (live run).
- Acceptance (NO live browser in child session):
  - `npx playwright test tests/e2e/harvest-buttons.spec.ts --list` (collection green)
  - `npx tsc --noEmit` (spec types)
- Reviewer needs: diff shows the two assertions; harness untouched.

## Execution work order (DAG)

- M-H9-1 → M-H9-2 → M-H9-3 (strictly sequential: shared mutable state = the 4-file guard + type flow route→client→control→spec). No parallelization (intersecting `touches` + type dependency).
- Worker blocked by this plan; reviewer/validator blocked by worker (in order M1→M2→M3 reviewable independently via per-module acceptance above).
- Final gate (worker, after M-H9-3): `npx tsc --noEmit` + `npm run lint` (touched scope) + `npm run build` + `npx playwright test tests/e2e/harvest-buttons.spec.ts --list`.

## Rollback

- `git diff -- <4-touched-files>` to inspect; `git checkout -- src/app/api/dev/harvest-stream/route.ts src/lib/client.ts src/app/dev/mission-control/_components/ai-harvest-control.tsx tests/e2e/harvest-buttons.spec.ts` to revert. No migrations, no backfill (old streams stay falsy-safe by design). No commit pushed by worker, so no revert-commit needed.

## H3 / H10 boundary

- H3 KEEP-OPEN per architect §2 (unverified: [id]/pause|resume|stop transitions, requireAdmin timing/bucket, IDLE/MemoryStore lifecycle; needs 4 out-of-scope reads). H9 proceeds; H10 gated on narrow H3-verify pass, not on H9.
- E2E live explicitly deferred to H10: child session has no live server/`ADMIN_KEY` post-deploy context; collection (`--list`) + typecheck proves spec wiring. Live `npx playwright test … @harvest` + harvest monitor runs are H10 post-deploy.
