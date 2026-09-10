# Plan Critique — H13 Leniency + H1–H6 Triage Closures

**Reviewer:** autoforge-reviewer (independent, read-only)  
**Date:** 2026-09-10  
**Scope:** `.autoforge/plans/plan.md` (95 lines) + `.autoforge/execution/work-order.json` (5 modules) vs `.autoforge/discovery/tracker-index.md` (7 open frontier: H13, H1–H6) + `.autoforge/architecture/H13.md` (117 lines, Alt A) + `workflow/wayfinder/maps/ai-harvest-stream/tickets/H13-ticket-index-leniency.md`  
**Mode:** read-only; 80k tok cap respected (5 plan-side files + 7 current-code probes, well under cap)  
**Skills:** `code-review` (standards + spec axes), ponytail ladder

## Verdict

**CHANGES_REQUIRED** — 3 blocking rows below (B1–B3), each paired with a verbatim quote from a CURRENT file with path:line. All other dimensions PASS or carry non-blocking notes (N1–N5, auto-incorporable by orchestrator).

---

## Blocking findings

### B1 — M-H13-CODE leaves the loader return type ambiguous (two incompatible contracts) — PIN ONE

- **Problem:** Plan allows `loadTicketsFromTree` to return "`{tickets, skipped}` (or `tickets` + out-param per impl choice — arch prefers `{tickets, skipped}`)". An out-param variant is a different interface from the `{tickets, skipped}` object that M-H13-LINT and M-H13-TEST are specified against (`skipped` shape, `skipped.length`, `skipped[0].file`). Two workers could ship two contracts; downstream modules cannot be built against "impl choice".
- **Current evidence (not plan text):**
  - `src/wayfinder/tickets.ts:144` — `export function loadTicketsFromTree(root = process.cwd()): WayfinderTicket[] {`
  - `src/wayfinder/tickets.ts:191-192` — `export function indexWayfinderTickets(root = process.cwd()): TicketIndex {` / `return buildTicketIndex(loadTicketsFromTree(root));`
  - `src/wayfinder/ticket-types.ts:36-51` — `export interface TicketIndex {` … `counts: {` … `};` `}` (no `skipped` field today; any shape change must propagate through the single call site at `tickets.ts:192` or `route.ts` breaks).
- **Required change:** Pin `loadTicketsFromTree(root): { tickets: WayfinderTicket[]; skipped: SkippedTicket[] }` and `buildTicketIndex(tickets, skipped = [])` / `TicketIndex.skipped?: SkippedTicket[]` exactly as arch H13 §3.1–3.2 specifies. Delete the "(or … out-param per impl choice)" escape clause from M-H13-CODE Outputs. M-H13-LINT/M-H13-TEST then build against the pinned shape with no further decision.
- **Why blocking:** Interface ambiguity is the one thing a 3-module chain (CODE→LINT, CODE→TEST) cannot absorb — it forks the contract every downstream acceptance depends on.

### B2 — M-H13-LINT acceptance "against temp tree" is unexecutable: CLI is cwd-bound with no `--root` and no `--lint` parsing today — SPECIFY THE PROBE

- **Problem:** M-H13-LINT acceptance requires "Against temp tree with 1 bad file → exit `1`, stderr contains bad filename + reason". The CLI as it exists today takes no root argument and parses no flags, so there is no specified mechanism to point `--lint` at a temp dir. A worker cannot pass this acceptance without either (a) inventing an undocumented `--root` flag (scope creep), (b) mutating `process.cwd()` (explicitly forbidden as parallel-unsafe by M-H13-TEST's own rule), or (c) writing a bad file into the real tree (dangerous, pollutes the repo under test).
- **Current evidence:**
  - `scripts/wayfinder-tickets.ts:12` — `const idx = indexWayfinderTickets();` (no root forwarded; `indexWayfinderTickets(root)` seam exists but CLI does not use it)
  - `scripts/wayfinder-tickets.ts:18` — `const jsonOnly = process.argv.includes("--json");` (only flag parsed; no `--lint`, no `--root`/`--dir` handling anywhere in the 42-line file)
  - `src/wayfinder/tickets.ts:191` — `export function indexWayfinderTickets(root = process.cwd()): TicketIndex {` (the DI seam exists at the library layer, but the plan does not wire it to the CLI layer).
- **Required change (pick one, smallest first):** (a) Add optional `--root <dir>` (or `--dir`) to the `--lint` contract and rewrite the acceptance as `npx tsx scripts/wayfinder-tickets.ts --lint --root <tmp>; echo $?` → `1`; or (b) keep CLI cwd-bound and rewrite the acceptance to probe via `node -e`/`tsx -e` importing `indexWayfinderTickets(<tmp>)` directly (no CLI temp-tree probe), with the CLI exit-code probe running only against the clean real tree. Either closes the gap; the current text (temp-tree probe through a CLI with no dir parameter) does not.
- **Why blocking:** An acceptance criterion the worker cannot execute as written is a certain review-loop failure, not a polish item.

### B3 — M-H13-GATES "one-line step" under `set -e` will exit silently without the guarded pattern — PRESCRIBE THE INSERTION FORM

- **Problem:** Plan specifies "one-line step in `.githooks/pre-commit` beside `lint`" but does not prescribe the guarded form. Under the hook's `set -e`, a bare failing `npx tsx … --lint` line exits the hook immediately with no diagnostic (and a bare passing line is fine, but the failure path — the entire point of the gate — is silent). The repo's own precedent for exactly this situation is the guarded `harvest-verify --mock` block.
- **Current evidence:**
  - `.githooks/pre-commit:5` — `set -e`
  - `.githooks/pre-commit:47-51` — `node scripts/harvest-verify.mjs --mock >/dev/null 2>&1` / `if [ $? -ne 0 ]; then` / `echo "[pre-commit] FAIL harvest-verify --mock"` / `exit 1` / `fi`
  - `.github/workflows/ci.yml:74` — `      - run: npm run lint` (the anchor line the `quality`-job insertion follows; a bare `- run: npx tsx scripts/wayfinder-tickets.ts --lint` line is correct in YAML, but the pre-commit side needs the guard).
- **Required change:** Prescribe the pre-commit insertion as the guarded 5-line form matching `:47-51` (run, `if [ $? -ne 0 ]`, `echo "[pre-commit] FAIL wayfinder-tickets --lint …"`, `exit 1`, `fi`), placed after the `lint` block for fastest-fail ordering; keep the ci.yml side as a single `- run:` line after `npm run lint` (`ci.yml:74`). Also state the hook must still `sh -n` clean and pass on a clean tree (already in acceptance — keep).
- **Why blocking:** The gate's failure path IS the feature (fail fast with a human-readable pointer). An unguarded line under `set -e` delivers the exit code with none of the diagnosability the hook's own convention (`FAIL … — run: …`) provides, and a worker following "one-line" literally will ship exactly that.

---

## Passing dimensions (with evidence)

| # | Dimension | Verdict | Current-file evidence |
|---|---|---|---|
| 1 | Enumeration completeness (7/7) | **PASS** | `.autoforge/discovery/tracker-index.md:3-9` lists H13 + H1–H6 (7 lines); `work-order.json` `ticket_coverage: [H13,H1…H6]` covers all 7; H1–H6 `status: open` confirmed at review time (`H1…:6`, `H2…:6`, `H3…:6`, `H4…:6`, `H5…:6`, `H6…:6` all read `status: open`) |
| 2 | CODE↔TRIAGE disjointness | **PASS** | CODE touches `src/wayfinder/*` (throw sites verified: `src/wayfinder/tickets.ts:158` `readFileSync`, `:159-160` parse calls, `:161` `if (seen.has(ticket.key)) throw new Error(…duplicate ticket key…)`); TRIAGE touches only `workflow/**` (6 ticket files + MAP.md). No shared file. Real disjointness, not asserted |
| 3 | LINT∥TEST parallel safety | **PASS** | `scripts/wayfinder-tickets.ts` vs `tests/domain/wayfinder-tickets.test.ts` — disjoint touches; both `blocked_by: [M-H13-CODE]` only; no shared mutable state between them |
| 4 | TEST seam exists | **PASS** | `src/wayfinder/tickets.ts:191` — `export function indexWayfinderTickets(root = process.cwd()): TicketIndex {` (DI seam real; temp-dir test needs no signature change, no MemoryStore, no `process.cwd()` mutation — as specified) |
| 5 | TEST backward-compat claim | **PASS** | `tests/domain/wayfinder-tickets.test.ts:146` — `buildTicketIndex([` (single-arg caller; defaulted second param keeps it green); `:151-160` asserts `counts` via `toEqual` (counts object unaffected by additive `skipped`); `src/app/dev/mission-control/_components/ticket-board.tsx:36` — `TicketBoard({ index }: { index: TicketIndex })` reads `index.tickets` (`:39`), `index.counts` (`:49-57`), `index.maps` (`:49`), `index.source` (`:60`) — never constructs a `TicketIndex`, so additive optional `skipped` cannot break it |
| 6 | Route-unchanged claim | **PASS** | `src/app/api/dev/tickets/route.ts:10` — `return NextResponse.json(indexWayfinderTickets());` (full-index serialization; `skipped` rides free once the index carries it); `:13-15` `ENOENT` fallback stays for whole-dir-missing; `:16` `serverError` stays for truly unexpected faults. No route edit needed — verified |
| 7 | Arch consistency (Alt A) | **PASS** | Per-file try/catch covering `:158-162`, parsers stay strict (`parseTicketFrontMatter` `:44-46` throws, `ticketFromFields` `:96-100` throws, `parseStatus` `:83-89` throws — interfaces unchanged), dup first-wins on sorted enumeration (`:138-141` maps sorted, `:151` names sorted), `counts.total === tickets.length` invariant, `file: reason` (not `file:line`) deviation documented with ponytail rationale. Matches H13 ticket acceptance (skipped+warn, non-zero lint, temp-dir 1+1, strict parsers) with one intentional strengthening (BOTH gates vs ticket's "and/or" — see N4) |
| 8 | `tsx` availability assumption | **PASS** | `package.json:41` — `"tsx": "^4.23.12"` in devDeps; `package.json:16-19` precedent (`tsx scripts/run-eval.ts`, etc.). No new dep — verified |
| 9 | Vault determinism | **PASS** | No module touches `state/**`, `vault/**`, or `.autoforge/explanation/` as a committed artifact (LINT explicitly skips the M-R19 write in lint mode: `scripts/wayfinder-tickets.ts:27-39` is the write to suppress). `vault-sync --check` unaffected by construction |
| 10 | H1 live-ness citations | **PASS (spot-checked)** | `src/discovery/providers/ai-search.ts:31` `readonly id = "ai-search";` + `:125,129` `registerProvider("ai-search", …)` + `src/discovery/providers/index.ts:11` `import "./ai-search";` — registered, not deleted. Full H1–H6 citation set (H2–H6 line refs) is the TRIAGE worker's to verify with `rg` at execution time; plan correctly scopes that check as read-only (H10 CLOSED, no live runs) |

## Non-blocking notes (resolvable by orchestrator, no human escalation)

- **N1 — Rollback per module is unspecified.** Add one line per module: CODE/LINT/TEST/GATES revert is `git checkout -- <touched files>` pre-commit (workers never `add/commit` per spawn-contract §14 — commit-time `git add <paths>` only); TRIAGE revert is re-flipping `status: closed` → `open` + dropping the `## Resolution` note (no code to unwind). No irreversible migration exists in this plan (all changes additive or docs-only), so this is a one-line addition, not a redesign.
- **N2 — TRIAGE verification has a latent read-dependency on CODE.** TRIAGE acceptance allows `npx tsx scripts/wayfinder-tickets.ts --json (post-H13-CODE)` as a probe, but the DAG lists TRIAGE `blocked_by: []` (parallel with CODE). Pre-CODE, `--json` emits only `{ counts }` — current evidence `scripts/wayfinder-tickets.ts:20` (`console.log(JSON.stringify({ counts: idx.counts }, null, 2));`, no `skipped`). Resolution: when dispatched parallel with CODE, TRIAGE verification MUST use the `rg -n "^status:"` probe (CODE-independent); the `--json` probe is valid only when run after CODE lands. One parenthetical in the DAG note fixes it.
- **N3 — H3 closure carries known residual risk; plan handles it correctly.** `workflow/wayfinder/maps/ai-harvest-stream/tickets/H9-start-continuous-ui.md:56` (`H3 stays open … remaining items outside H9 touches`) and `MAP.md:28` (`H3 stays open (non-intersecting)`) mean the default "close H3 as done-in-code" requires the worker to produce explicit H9-delta evidence or take the documented-hold path. The plan already encodes this branch ("close only with explicit H9-delta evidence or leave open with reason"). No change needed — flagging so the validator holds the worker to the branch condition and does not accept a bare close.
- **N4 — Both-gates wiring intentionally strengthens the ticket ("and/or" → AND).** Ticket acceptance §2 says "wired into `pre-commit` and/or `ci.yml`"; plan/arch require BOTH (defense against `--no-verify` bypass + silent rot, arch §5). Endorse the strengthening; note it raises GATES cost by one line and makes `sh -n` + YAML-parse + 2-hit `rg` the correct acceptance (already specified).
- **N5 — LINT `--json` + `skipped` contract needs one pinned sentence.** After B1 lands, state: `--json` emits `{ counts, skipped }` (superset of today's `{ counts }`), `--lint --json` emits the same shape with `skipped` populated; empty tree → exit `0` with `skipped: []`. Prevents a worker from "fixing" the temp-tree gap by changing the JSON shape.

## Scope / risks / testability summary

- **Scope:** H13 hardening (loader + lint + 2 gates + 1 test) plus docs-only H1–H6 closures; `route.ts` untouched, parsers strict, no threshold/live-monitor changes, no new deps. Matches H13 "Out of scope" (board UI, statuses, H10 monitor). Single-module TRIAGE correctly avoids MAP.md write contention (all 7 docs files under one writer).
- **Risks carried correctly:** silent rot (both gates + `skipped` in 200 payload), dup-key determinism (sorted-first-wins, map-scoped `ticketKey`), `console.warn` operator-channel vs `skipped` user-channel split, `serverError` quieting as intended, additive-shape ripple. No unmitigated high-severity risk once B1–B3 land.
- **Testability:** CODE (typecheck + untouched suite green), LINT (exit-code probes — executable after B2), GATES (grep + `sh -n` + YAML parse via `yaml`, verified importable at review time), TEST (temp-dir 1+1 + dup first-wins, no cwd mutation), TRIAGE (grep + `file:line` citation check, read-only). Full `npm run ci:local` correctly deferred to validator, not to M-H13-GATES.

## References (current-file grounding for every blocking row)

- B1: `src/wayfinder/tickets.ts:144`, `:191-192`; `src/wayfinder/ticket-types.ts:36-51`
- B2: `scripts/wayfinder-tickets.ts:12`, `:18`; `src/wayfinder/tickets.ts:191`
- B3: `.githooks/pre-commit:5`, `:47-51`; `.github/workflows/ci.yml:74`
- Passes: `src/wayfinder/tickets.ts:158-162,138-141,151,44-46,83-100`; `src/app/api/dev/tickets/route.ts:10,13-16`; `src/app/dev/mission-control/_components/ticket-board.tsx:36,39,49-60`; `tests/domain/wayfinder-tickets.test.ts:146,151-160`; `package.json:41`; `workflow/wayfinder/maps/ai-harvest-stream/MAP.md:28`; `…/tickets/H9-start-continuous-ui.md:56`; `…/tickets/H{1..6}-*.md:6` (`status: open` × 6 at review time)

---
*Reviewer: independent, read-only; no source/test/config edited; no git operations performed; artifact is this file only. No irreversible, missing-auth, or conflicting-owner condition found — B1–B3 are ordinary plan-text fixes within planner authority, no human escalation per protocol §16.*
