# H8 — Continuous-loop execution plan (worker work order companion)

Source decisions: `.autoforge/architecture/H8.md` (chosen: `continuous` flag, Alt B/C rejected).
Ticket: `workflow/wayfinder/maps/ai-harvest-stream/tickets/H8-continuous-loop.md`.
Grounding: `src/discovery/harvest-stream.ts` (235 lines; interface 13–29, `createStream` 46–66, `tickStream` 118–197, `verifyStream` 100–115, controls 199–235).

Touches (ALL modules, no exceptions):
`touches: ["src/discovery/harvest-stream.ts", "tests/domain/harvest-stream.test.ts"]`
Any need beyond these two globs → STOP, flag out-of-scope (H9 API/UI, H10 monitor own their globs), return to architect. Do NOT touch `state/discovery-ledger.json`, `harvest.ts`, `pipeline.ts`, API/UI/monitor, or add deps/imports.

## Module M-H8-1 — IMPLEMENT continuous loop (sequential, first)

Objective: smallest diff implementing the architect contract behind the existing seam.
Inputs: H8.md §3–§4; harvest-stream.ts lines cited below.
Outputs: edited `src/discovery/harvest-stream.ts` only.

Steps (in file order):
1. Type + ctor: add `continuous: boolean` to `HarvestStream` (after `live`, ~line 17); `createStream(cellKey, live, continuous = true)` — new streams default true; existing call sites compile unchanged. Log line 63 appends `continuous=${continuous}`.
2. Load migration: in `loadStream` (79–82), normalize stored streams missing the field: `stream.continuous ??= false` (one line, in-memory only; never flip in-flight single-shot to infinite). Document with one-line comment.
3. Append (replace overwrite 165–166): `const newPkgs = (state.package as unknown[]) ?? []` / same for quality; `stream.packages = [...stream.packages, ...newPkgs].slice(-50)`; same for `quality` in the SAME edit (pairing invariant). `dedupeIndex` persist 169–171 unchanged (already the correctness guard). Cap applied BEFORE `saveStream` (store-growth mitigation).
4. Transition (replace 176–187 with branch):
   - `if (stream.continuous)`: per-iteration verdict = `verifyStream({...stream, packages: newPkgs, quality: newQuals, coverage: state.coverage ?? null})` (NOT cumulative — avoids one bad early iteration poisoning all later verifies; cumulative arrays kept for evidence). Pass OR fail → `status = "RUNNING"`; `appendLog(stream,"STREAM", \`continuous next ${stream.cellKey ?? <gap label from ctx.query>}\`)`. Skip `DONE` + `maxIterations` entirely (DONE unreachable, maxIterations ignored). Rotation display derived ONLY from already-built `ctx.query` (jurisdictions/themes) or `state.coverage` — NO new imports (glob-guard mitigation §6.1).
   - `else`: legacy lines 176–187 byte-for-byte (`DONE` on pass, `FAILED` at cap, else `RUNNING` retry).
5. Controls/poll: NO edits to 199–235 (`pause/resume/stop` unchanged; `stop → FAILED "stopped by operator"` verbatim) and no debounce/poll changes. Add one interface-invariant comment: `// continuous:true → DONE unreachable, VERIFYING→RUNNING always, exit via stop only`.
6. Ponytail: stdlib only, no new deps, no new files, no new status, no coverage-gate tightening (demo 20% ceiling stays).

Dependencies: `blocked_by: []`. H7/H11 keys not needed (non-live path in tests).
Acceptance (executable): `npx vitest run tests/domain/harvest-stream.test.ts` (existing tests still pass — proves legacy path unbroken) + `npx tsc --noEmit` + `npm run lint`.

## Module M-H8-2 — TEST continuous + legacy (sequential, after M-H8-1)

Objective: prove contract through existing seam with MemoryStore, no network.
Inputs: M-H8-1 output. Outputs: edited `tests/domain/harvest-stream.test.ts` only.
Shared-state guard: SAME two files as M-H8-1 → MUST run sequential after M-H8-1, never parallel.

Tests (all `MemoryStore` + `seed-portals` non-live path; live-provider mocking only via existing `providerEnabled` seam, no keys):
1. Continuous 3 ticks: `createStream(null, false, true)` → save → tick×3 → assert packages/quality length grows vs overwrite, status never `DONE`/`FAILED`, `dedupeIndex` persists/changes across iterations, logs contain `continuous next`, `iteration === 3`.
2. Single-shot preserved: `createStream(cell, live, false)` → DONE reachable on pass; maxIterations enforced (drive to cap or stub verify-fail → `FAILED` at cap).
3. Controls: pause holds tick (no iteration increment), resume continues count (no reset), stop → `FAILED "stopped by operator"` (including from PAUSED).
4. Cap: drive >50 packages (loop ticks or direct slice unit) → `length <= 50`, newest retained.

Dependencies: `blocked_by: ["M-H8-1"]`.
Acceptance (executable): `npx vitest run tests/domain/harvest-stream.test.ts` (all new + existing green) + `npx tsc --noEmit` + `npm run lint`.

## Execution DAG (work order)

- M-H8-1 (implement) → M-H8-2 (test). Sequential (intersecting touches = shared mutable state). No parallelization within H8. H9 (API/UI) and H10 (monitor) are downstream of H8, out of scope here.
- Worker blocked by this plan; reviewer/validator blocked by worker (M-H8-2 green).

## Risk mitigations (architect §6 → worker action)

1. gaps_ranked unavailable / new-import temptation → derive `continuous next` label from `ctx.query` only; if impossible, STOP and return to architect (do not breach glob guard).
2. Verify drift → per-iteration verdict for transition, cumulative arrays for evidence; document choice in code comment + test name.
3. Store growth → `.slice(-50)` before save; logs already capped at 200 (line 97, untouched).
4. Infinite live spend → accepted (Stop is the exit); ensure `stop` path tested; monitor surfacing is H10, not here.
5. Fixture-vs-live cost → tests use non-live stub path (149–159) only.

## Rollback

Revert 2 files: `git checkout -- src/discovery/harvest-stream.ts tests/domain/harvest-stream.test.ts` (or `git revert` the H8 commit). No migrations, no other files touched, no schema change (migration is in-memory `??= false`).

## Staging hygiene (AGENTS.md)

Explicit `git add src/discovery/harvest-stream.ts tests/domain/harvest-stream.test.ts .autoforge/plans/plan-H8.md .autoforge/execution/work-order-H8.json` only. Never `git add -A`. Vault-sync rule unaffected (no `vault/` touched).
