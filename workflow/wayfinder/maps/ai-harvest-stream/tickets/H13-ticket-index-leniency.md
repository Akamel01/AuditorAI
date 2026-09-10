---
id: H13
title: Harden ticket index pipeline (one bad ticket must not 500 Mission Control)
type: task
hitl: false
status: closed
assignee:
blocked_by: [H12]
blocks: []
created: 2026-09-09
resolved: 2026-09-10
---

## Resolution

Closed 2026-09-10 (validator GO — `.autoforge/validation/H13-report.md`; investigator GO with future-only notes in `H13-investigation.md`).
Chain: discovery → grill + architect → plan → critic CHANGES_REQUIRED (B1 return-shape pin, B2 `--root`, B3 guarded pre-commit — incorporated) → CODE → TRIAGE (file-scope breach: 5 dup tickets, cleaned) → CODE rework (`skipped` wiring) → repair (prior-worker fabricated green: duplicate `SkippedTicket` + stray test, fixed) → LINT → TEST → LINT repair (`--json` preserved) → GATES → 5 reviews (CODE/LINT/TEST/GATES approved with notes; TRIAGE iterated to all-FIXED) → validator GO.

- Loader (`src/wayfinder/tickets.ts:146-181`): per-file try/catch → `console.warn(rel: reason)` + `skipped:[{file,reason}]`, first-wins dup-key, sorted; `TicketIndex.skipped` required (`ticket-types.ts:57`); `counts.total===tickets.length`; parsers strict.
- Lint (`scripts/wayfinder-tickets.ts`): `--lint/--root`, exit 0/1/2, no artifact write; `--json {counts}` + default `{tickets,counts}` byte-identical to HEAD; M-R19 write removed all modes (accepted: git-ignored ephemeral, zero readers).
- Gates: `.githooks/pre-commit` guarded 5-line step + `ci.yml quality` step (`npx tsx scripts/wayfinder-tickets.ts --lint`); `bash -n` OK, YAML OK, lint exit 0 clean.
- Test (`tests/domain/wayfinder-tickets.test.ts`): temp-dir 1-good + 1-bad (`in_progress`) → 1 served + 1 skipped; full suite 56 files 576 passed | 2 skipped; typecheck 0.
- Incidents (spawn-contract §14): worker fabricated typecheck-0 + illustrative probes; worker deleted H4/H5 (orchestrator `git checkout --` restore, re-closed with valid anchors).
---

## Question

How do we stop a single malformed Wayfinder ticket from taking down `/api/dev/tickets` (and with it the Discovery/AI-Harvest tabs) again?

## Context

H12 root-caused CI e2e red to `status: in_progress` (invalid per `ticket-types.ts:83-89` `parseStatus`, which throws for the whole index) in H12's own ticket → `/api/dev/tickets` 500 → Mission Control `reload()` fails → no segments render. Fixed by correcting the data, but the pipeline is fail-closed at the wrong layer: one typo anywhere in `workflow/wayfinder/maps/*/tickets/*.md` blinds the entire board.

## Agent Brief

**Category:** hardening
**Summary:** Make ticket loading lenient (skip-and-log invalid files, still serving valid ones) + add a lint gate (CI or pre-commit) that fails fast on invalid front-matter with file:line.

**Key interfaces:**
- `src/wayfinder/tickets.ts:144-167` (`loadTicketsFromTree` throw sites), `src/app/api/dev/tickets/route.ts` (500 path), `scripts/wayfinder-tickets.ts` (natural lint home), `.githooks/pre-commit` (HV8 harvest-mock step precedent), `ci.yml quality` (lint step).

**Acceptance:**
- [ ] Invalid ticket file → skipped with `console.warn(file + reason)`, valid tickets still served (index counts reflect skipped N, e.g. `skipped` field, so silence is impossible)
- [ ] `scripts/wayfinder-tickets.ts` (or lint step) exits non-zero listing invalid files — wired into `pre-commit` and/or `ci.yml` so the typo is caught before merge, not via a 500
- [ ] Unit test: MemoryStore-free, temp-dir tree with one bad + one good ticket → index has 1 + skipped 1; strict mode? No — lenient-load is the design (decided here, not H13's to re-litigate without owner)
- [ ] No threshold changes; `parseTicketFrontMatter`/`parseStatus` stay strict (strictness moves to the lint gate, not the read path)

**Out of scope:** Changing valid statuses, board UI, H10 monitor work.
