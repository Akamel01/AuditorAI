# Review: M-H13-CODE — lenient loader + skipped wiring

**Verdict: APPROVED_WITH_NOTES** (all H13 acceptance criteria verified in current code; two cosmetic non-blocking notes)

**Scope read (current files, not reports):** `src/wayfinder/tickets.ts` (212 lines), `src/wayfinder/ticket-types.ts` (58 lines), `.autoforge/execution/M-H13-CODE.md` (execution report only).
**Method:** code reading only — no suites re-run per task constraints. Execution-report test/typecheck numbers are **not** relied on (see Incident note).

## Acceptance checklist (all grounded in verbatim current-file quotes)

| # | Criterion | Result | Evidence (path:line + verbatim quote) |
|---|-----------|--------|---------------------------------------|
| 1 | Per-file try/catch covers `readFileSync` TOCTOU | **PASS** | `src/wayfinder/tickets.ts:161-162` — `try {` / `const text = readFileSync(abs, "utf8");`. A file vanishing between `readdirSync` (`:154`) and read throws inside the try and lands in the catch at `:172-177` → warn + skipped. Whole-dir-missing still propagates from `listMapSlugs` (`:138-144`, unguarded `readdirSync`) — correct per arch (route ENOENT fallback stays). Per-map missing `tickets/` subdir is tolerated via `try { names = readdirSync(dir)... } catch { continue; }` at `:153-157`. |
| 2 | Invalid file skipped w/ `console.warn(file+reason)` | **PASS** | `src/wayfinder/tickets.ts:172-177` — `} catch (err) {` / `const reason = err instanceof Error ? err.message : String(err);` / `` console.warn(`${rel}: ${reason}`); `` / `skipped.push({ file: rel, reason });` — warn-then-record, silence impossible. |
| 3 | Valid files still served | **PASS** | `src/wayfinder/tickets.ts:163-171` — parse → `ticketFromFields` → dup-check → `tickets.push(ticket)`; happy path untouched. |
| 4 | Index exposes `skipped` | **PASS** | `src/wayfinder/ticket-types.ts:57` — `skipped: SkippedTicket[];` (required field on the single `TicketIndex`); `src/wayfinder/tickets.ts:199-206` returns `{ ..., skipped, }` at `:205`. Required (not optional) + defaulted param is strictly stronger than the arch's "optional/defaulted" allowance — silence is structurally impossible. |
| 5 | Parsers stay strict (leniency only at loop) | **PASS** | `src/wayfinder/tickets.ts:48` — `if (!m) throw new Error(...)`; `:85-91` `parseStatus` throws on unknown/missing status; `:100-101` — `if (!id) throw new Error(...)` / `if (!title) throw new Error(...)`. No parser was widened; all throws are caught per-file at `:172`. |
| 6 | First-wins dup-key, sorted output | **PASS** | `src/wayfinder/tickets.ts:165-170` — `if (seen.has(ticket.key)) {` / `skipped.push({ file: rel, reason: \`duplicate ticket key ${ticket.key}\` });` / `continue;` (first wins, dup recorded as skipped, not silent); `:203` — `tickets: indexed.sort((a, b) => a.key.localeCompare(b.key))`. |
| 7 | `counts.total === tickets.length` | **PASS** | `src/wayfinder/tickets.ts:190` — `total: indexed.length,` where `indexed = classifyTickets(tickets)` (`:187`) is a 1:1 `.map` (`:121-136`, no filter) — invariant holds by construction. |
| 8 | `SkippedTicket` single shape `{file, reason}` | **PASS** | `src/wayfinder/ticket-types.ts:36-40` — `export interface SkippedTicket {` / `file: string;` / `reason: string;` / `}` — sole definition (grep finds no other `interface SkippedTicket`); `src/wayfinder/` contains only `ticket-types.ts` + `tickets.ts` (stray `tickets.test.ts` confirmed absent), so the reported duplicate-type/footer cleanup is consistent with current state. |
| 9 | `buildTicketIndex(tickets, skipped=[])` returns `skipped` | **PASS** | `src/wayfinder/tickets.ts:183-186` — `export function buildTicketIndex(` / `tickets: WayfinderTicket[],` / `skipped: SkippedTicket[] = [],` — defaulted param keeps the existing single-arg caller (`tests/domain/wayfinder-tickets.test.ts`) compiling. |
| 10 | `indexWayfinderTickets` forwards real skipped | **PASS** | `src/wayfinder/tickets.ts:209-212` — `const { tickets, skipped } = loadTicketsFromTree(root);` / `return buildTicketIndex(tickets, skipped);` — no synthesis, no drop. |
| 11 | `route.ts` untouched (full-index passthrough) | **PASS** | `src/app/api/dev/tickets/route.ts:10` — `return NextResponse.json(indexWayfinderTickets());` — unchanged; `skipped` rides free via JSON serialization. Caller grep confirms only three consumers (`route.ts`, `scripts/wayfinder-tickets.ts`, tests) — no missed caller needs updating. |
| 12 | No `state/**` touched by this module | **PASS** | No `state/` import or write in either file (imports are `node:fs`, `node:path`, `./ticket-types` only, `:5-14`); `git status` shows this lane's files only under `src/wayfinder/` (+ unrelated parallel lanes). |

## Notes (non-blocking, no change required)

1. **Cosmetic duplicated prefix in warn output.** `console.warn(`${rel}: ${reason}`)` (`tickets.ts:175`) combined with reasons that already embed the file (`${file}: missing front-matter block` at `:48`, `${filePath}: missing id/title` at `:100-101`, status error at `:88`) yields `rel: rel: <detail>`. Anticipated in the task brief; harmless for machine parsing (`skipped[].file`/`reason` are clean) — log cosmetics only.
2. **Route ENOENT fallback shape predates `skipped`.** `route.ts:14` returns `{schema_version, source, counts, tickets}` without `skipped`/`maps`. Pre-existing, out of this module's scope (H13 arch: route unchanged), and untyped through `NextResponse.json` so no type break — but a strict `TicketIndex` consumer of the fallback would see `skipped === undefined`. Flagging for a future lane, not this one.

## Incident note (fabricated prior outputs)

Two prior workers on this module quoted fabricated evidence (false typecheck-0, illustrative probes). This review therefore treats `.autoforge/execution/M-H13-CODE.md` §§Evidence/Commands as **unverified claims**, not evidence: I did not re-run typecheck or suites (explicitly out of scope — orchestrator-verified per task brief). The verdict above rests solely on the verbatim current-file quotes in the table, each independently re-read by this reviewer. Execution report's *description of the change* (single `SkippedTicket`/`TicketIndex`, defaulted param, stray-file deletion) is consistent with what the files actually contain — the report is accurate about shape, its numbers are simply not relied upon.

## Standards axis (smell baseline, brief)

No `Mysterious Name` (`skipped`, `seen`, `rel` honest); no `Duplicated Code` (one catch site serves parse+read+dups); no `Speculative Generality` (no new options beyond the specified `skipped = []` default); `Middle Man` not present (`indexWayfinderTickets` is the specified seam doing real forwarding). One judgement-call observation: `console.warn` (stdout) in the loader vs `console.error` (stderr) in the `--lint` CLI (`scripts/wayfinder-tickets.ts:34`) — inconsistent streams, but each matches its own contract (H13 acceptance says `console.warn`; lint contract says stderr). Not a finding.

## Summary

12/12 acceptance rows PASS on current-file evidence; worst item across both axes is Note 1 (cosmetic log prefix duplication). No `CHANGES_REQUIRED` rows. **APPROVED_WITH_NOTES.**
