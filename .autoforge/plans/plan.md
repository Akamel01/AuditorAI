# Plan — H13 Leniency + H1–H6 Triage Closures

Date: 2026-09-10. Source: `.autoforge/discovery/tracker-index.md` (7 open frontier: H13, H1–H6),
`.autoforge/discovery/report.md`, `.autoforge/requirements/grilling.md`,
.autoforge/architecture/H13.md` (Alt A, per-file try/catch). H10 CLOSED — no live prod work.

## Module list

### M-H13-CODE — lenient loader + index shape (H13 core)
- **Objective:** one bad ticket file → `console.warn` + `skipped[]` entry; valid tickets still served; `counts.total === tickets.length` preserved.
- **Inputs (B1):** The loader now returns a single object containing both `tickets` and `skipped` (i.e. `{ tickets, skipped }`). The index is built via `buildTicketIndex(tickets, skipped = [])` so `skipped` is defaulted to an empty array when not provided. Parsers and ordering remain unchanged; duplicate-key behavior remains first-wins. The previous `{tickets,skipped}-or-out-param` escape variant is removed.
- **Outputs:** `loadTicketsFromTree` returns `{ tickets, skipped }`; new `SkippedTicket { file, reason }` alongside `TicketIndex`. `TicketIndex.skipped` remains optional/defaulted. Dup-key handling follows existing rules; `counts.total` stays in sync with `tickets.length`.
- **touches:** `["src/wayfinder/tickets.ts", "src/wayfinder/ticket-types.ts"]`
- **Dependencies:** none (root of H13 chain).
- **Acceptance:**
  - `npm run typecheck` passes; existing `tests/domain/wayfinder-tickets.test.ts` green untouched (optional `skipped` / defaulted arg keeps `buildTicketIndex([...])` caller at `:146` and `TicketBoard` reads-only-`counts`/`maps` green).
  - Manual: temp tree with 1 good + 1 `status: in_progress` → `tickets.length===1`, `skipped.length===1`, `counts.total===1`.
- **Tests:** existing suite `npx vitest run tests/domain/wayfinder-tickets.test.ts` (must stay green); new coverage in M-H13-TEST.
- **Agent role:** builder. **Reviewer:** needs arch H13 §§1–3 + throw-site table.
- **Ticket:** H13.

-### M-H13-LINT — `--lint` flag on CLI (H13 gate surface)
- **Objective:** `scripts/wayfinder-tickets.ts --lint` calls same lenient loader, prints `<file>: <reason>` per skipped entry to stderr, exits `0` clean / `1` invalid / `2` usage-IO; no M-R19 write in any mode; `--json` gains `skipped` array.
- **Inputs (B2):** M-H13-CODE `skipped` shape. CLI now supports a `--root <dir>` argument to probe a temporary tree at a non-CWD location; the underlying probe remains cwd-bound by default, but `--root` enables tests and staging in other directories without changing production code.
- **Outputs:** lint-mode branch in `scripts/wayfinder-tickets.ts`, no new deps (`tsx` already in devDeps).
- **touches:** `["scripts/wayfinder-tickets.ts"]`
- **Dependencies:** blocked by M-H13-CODE.
- **Acceptance:**
  - `npx tsx scripts/wayfinder-tickets.ts --lint; echo $?` → `0` on clean tree.
- Against temp tree with 1 bad file → exit `1`, stderr contains bad filename + reason; no `.autoforge/explanation/M-R19-ticket-index.md` write in any mode.
  - `npx tsx scripts/wayfinder-tickets.ts --lint --json` emits parseable JSON with `skipped` array.
- **Tests:** CLI exit-code probes above (no vitest needed).
- **Agent role:** builder. **Reviewer:** needs H13 §3.4 (exit-code contract) + §5 silent-rot note.
- **Ticket:** H13.

### M-H13-GATES — pre-commit + CI wiring (H13 defense in depth)
- **Objective:** same lint command in both gates, fail-fast, no new job.
- **Inputs:** M-H13-LINT exit contract.
- **Outputs:** one-line step in `.githooks/pre-commit` beside `lint` (fastest-fail ordering per `:7` comment; precedent `harvest-verify --mock` at `:47`); one-line step in `ci.yml` `quality` job after `npm run lint` (`ci.yml:74`).
- **touches:** `[".githooks/pre-commit", ".github/workflows/ci.yml"]`
- **Dependencies:** blocked by M-H13-LINT.
- **Acceptance:**
  - `sh -n .githooks/pre-commit` passes; YAML parses: `node -e "import('yaml').then(m=>{import('node:fs').then(f=>m.default.parse(f.readFileSync('.github/workflows/ci.yml','utf8')))})"` (or repo's existing YAML one-liner from pre-commit step 4).
  - Grep proves same command both places: `rg -n "wayfinder-tickets.*--lint" .githooks/pre-commit .github/workflows/ci.yml` → 2 hits.
  - Pre-commit hook still passes on clean tree (`npm run lint --silent` unaffected).
- **Tests:** gate-presence grep + YAML parse; full `npm run ci:local` is validator's job, not this module's.
- **Agent role:** builder. **Reviewer:** needs AGENTS.md hook/YAML-quote rules.
- **Ticket:** H13.

### M-H13-TEST — temp-dir leniency unit test (H13 proof)
- **Objective:** MemoryStore-free temp-dir test via existing `indexWayfinderTickets(root)` DI seam (no signature change for testability).
- **Inputs:** M-H13-CODE shape.
- **Outputs:** new `describe` block in `tests/domain/wayfinder-tickets.test.ts`: build `<tmp>/workflow/wayfinder/maps/<map>/tickets/{good.md,bad.md}` via `fs.mkdtempSync(os.tmpdir())` + `mkdirSync recursive`; good = valid front-matter, bad = `status: in_progress` (site 3) or missing `title` (site 2); assert `tickets.length===1`, `skipped.length===1`, `skipped[0].file` contains bad filename, `counts.total===1`; dup-key case: two files same `id` → first-wins + 1 skipped. No `process.cwd()` mutation (parallel-safe).
- **touches:** `["tests/domain/wayfinder-tickets.test.ts"]`
- **Dependencies:** blocked by M-H13-CODE. Parallel-safe with M-H13-LINT and M-TRIAGE (disjoint touches).
- **Acceptance:**
  - `npx vitest run tests/domain/wayfinder-tickets.test.ts` → all pass (old + new).
  - `npm run lint && npm run typecheck` clean for the test file.
- **Agent role:** builder. **Reviewer:** needs arch H13 §6.
- **Ticket:** H13.

### M-TRIAGE — H1–H6 docs closures, single module (MAP.md contention guard)
- **Objective:** close H1–H6 as done-in-code / superseded-with-evidence by doc-only edits (front-matter `status: open` → `closed`, `resolved: 2026-09-10`, append `## Resolution` with code citations). NO prod code changes, NO live runs (H10 CLOSED). Single module owns ALL six ticket files + MAP.md so no two writers contend on MAP.md.
- **Inputs:** discovery report §§H1–H6 verdicts (report.md:28-34), grilling Q1/Q2 + R1/R5/R6, MAP.md decisions (H7/H11/H8/H9/H12/H10 closed), code:
-   - H1 live-ness check (read-only, inside this module): `src/discovery/providers/ai-search.ts:31` (registered), `provider-types.ts:56-61` (gated live when `DISCOVERY_AI_ENABLED=true` + key), `providers/index.ts:11` (imported), `harvest-stream.ts:153` (tick filter includes any `providerEnabled(p)`, only `google-cse` in `DEPRECATED_PROVIDERS` per `harvest.ts:18` — ai-search NOT deprecated), H7 ticket `:40` ("Keep `ai-search` registered (no delete this slice)"). Verdict: **H1 live-legacy (gated), H7 additive — close H1 done-in-code with supersede-note, do NOT delete**.
- **Outputs (per ticket):** status/resolved/resolution-note. Cross-map for grilling R6: H1→H7 (additive, both registered), H2→H8 (continuous loop closed), H3→H9 (H9 notes "H3 stays open (non-intersecting)" — if H3 still non-intersecting-open per H9, close only with explicit H9-delta evidence or leave open with reason; default per tracker-index is close-as-done-in-code, flag gap if H9 delta unproven), H4→H9/H11, H5/H6→H10 (verify closed 2026-09-10).
- **touches:** `["workflow/wayfinder/maps/ai-harvest-stream/tickets/H1-ai-provider-gpt5-nano.md", "workflow/wayfinder/maps/ai-harvest-stream/tickets/H2-structured-workflow.md", "workflow/wayfinder/maps/ai-harvest-stream/tickets/H3-control-api.md", "workflow/wayfinder/maps/ai-harvest-stream/tickets/H4-ui-monitoring.md", "workflow/wayfinder/maps/ai-harvest-stream/tickets/H5-verification-loop.md", "workflow/wayfinder/maps/ai-harvest-stream/tickets/H6-fixtures-samples.md", "workflow/wayfinder/maps/ai-harvest-stream/MAP.md"]`
- **Dependencies:** none (docs-only; parallel-safe with M-H13-CODE — disjoint touches).
- **Acceptance:**
  - `npx tsx scripts/wayfinder-tickets.ts --json` (post-H13-CODE) or `rg -n "^status:" workflow/wayfinder/maps/ai-harvest-stream/tickets/H{1,2,3,4,5,6}-*.md` → all `closed` (or documented hold with gap citation for H3).
  - Each closed ticket has `## Resolution` with ≥1 `file:line` code citation verifiable by `rg`.
  - MAP.md Tickets section updated to closed state; `node scripts/vault-sync.mjs --check` unaffected (no `state/**` touched).
- **Tests:** no vitest; verification is grep + citation check (read-only commands above).
- **Agent role:** docs-closer. **Reviewer:** needs grilling Q1/Q2/R1/R6 + H7/H9/H10 resolution texts.
- **Tickets:** H1, H2, H3, H4, H5, H6.

## Execution Work Order (DAG)

```
M-H13-CODE  (root) ──┬── M-H13-LINT ── M-H13-GATES
                     └── M-H13-TEST
M-TRIAGE    (root, docs-only, parallel-safe with CODE)
```

- Parallel-safe pairs (disjoint touches): M-H13-CODE ∥ M-TRIAGE; M-H13-LINT ∥ M-H13-TEST ∥ M-TRIAGE.
- Sequential (shared state): M-H13-LINT after M-H13-CODE (needs `skipped` shape); M-H13-GATES after M-H13-LINT (needs exit contract); M-H13-TEST after M-H13-CODE.
- Shared-state guard: `src/wayfinder/*` vs `workflow/**` vs `scripts/*` vs `tests/**` vs gates are disjoint — no two modules write the same file. `route.ts` is intentionally untouched (no module claims it).
- Machine-readable: `.autoforge/execution/work-order.json`.

## Constraints honored

- Ponytail smallest diff: Alt A single loop, no mode flag, no new deps, route unchanged, `file: reason` not `file:line` (arch §4 note).
- Spawn-contract: workers execute real commands; children never `git checkout/stash/reset/add/commit/push`, never delete `state/*`; explicit `git add` paths at commit time per AGENTS.md; plan touches no `state/**` so `vault-sync --check` stays green.
- No live prod work (H10 closed): M-TRIAGE code check is read-only (`rg`/Read); H13 tests use temp-dir + mocked/invalid front-matter, no keys, no server.

(End of file)
