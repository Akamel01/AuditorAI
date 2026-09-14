# Plan Critique — Loop 3: 8 gated monitors + v4-harvest-deepening A1–A5 + tickets

**Reviewer:** autoforge-reviewer (independent, read-only; no source/test/config edited; no git mutations)
**Date:** 2026-09-14
**Scope:** `.autoforge/plans/plan.md` (132 lines, 8 modules) + `.autoforge/execution/work-order.json` (8 modules, machine-parsed) vs `.autoforge/discovery/tracker-index.md` (18 lines) + `.autoforge/architecture/decisions.md` (51 lines, AD-A1..A5) + `.autoforge/requirements/grilling.md` (81 lines)
**Mode:** read-only + own artifact write only; code-review skill (critique discipline); evidence rule honored — every CHANGES_REQUIRED row quotes a CURRENT file path:line verified this session
**Worktree (verified `git status --porcelain` this session):** `M src/discovery/pipeline.ts`, `M src/discovery/harvest.ts`, `M src/discovery/dedupe-persist.ts`, `M src/discovery/health-aggregate.ts`, `M src/app/api/dev/health/route.ts`, `M tests/domain/wayfinder-tickets.test.ts`, `M scripts/tier1-archive.mjs` (+ `.autoforge/*`, `state/*`, `workflow/**` staging); notably `src/discovery/harvest-stream.ts` is CLEAN (absent from M list)

## Verdict

**CHANGES_REQUIRED** — 3 load-bearing rows (R1–R3). All three pair a current-file contradiction with a plan defect that would break a zero-questions executor or regress runtime behavior. Everything else passes (see Passing dimensions); notes N1–N5 are non-blocking.

---

## Required changes (each blocks worker dispatch until fixed)

### R1 — M-A3 deletes the stream re-claim loop but never wires the stream to consume the returned index → cross-tick dedupe silently dies (H10 regression)

- **Current-file evidence:** `src/discovery/pipeline.ts:342-346` (`DiscoveryRunOutcome` = `{state, artifacts, refusals}`, no index field) + `:372` (`return { state, artifacts, refusals }`); d08 claims into a per-run clone (`:286` `structuredClone(ctx.dedupeIndex)`, `:307` `claimFingerprints(pkg, bundle, index)`) that is discarded. Consumer side `src/discovery/harvest-stream.ts:216-219` reads `(state as { dedupe?: DedupeIndexDoc }).dedupe` — a field the pipeline **never sets** (no `patch: {dedupe}` anywhere in `pipeline.ts`) — so the only thing advancing `stream.dedupeIndex` today is the re-claim loop at `:220-233` (`:228-229` `claimFingerprints(…, stream.dedupeIndex)`), whose own comment admits it (`:220-222` "d08Quality claims into a per-run clone that the pipeline never returns").
- **Plan defect:** `plan.md:55-67` M-A3 scope says "d08 clone becomes returned index" + "delete `harvest-stream.ts:220-233` loop" but contains **zero instruction to rewire the stream to `outcome.dedupeIndex`** (no mention of `:216-219`, no `stream.dedupeIndex = outcome.dedupeIndex`), and acceptance (`rg claimFingerprints … → 0`) is satisfied by a worker who deletes the loop and returns the index without any consumer — leaving `stream.dedupeIndex` frozen forever. Next tick re-discovers the same docs as unique; the cap-50 fills with dupes — the exact H10 failure the deleted comment warns about.
- **Concrete fix:** extend M-A3 scope: stream replaces the `:216-233` block with `stream.dedupeIndex = outcome.dedupeIndex` (destructure outcome, not just `{state}` at `:182`); acceptance: pipeline-twice test **threads the returned index** (`run2 ctx.dedupeIndex = run1 outcome.dedupeIndex`, MemoryStore, identical docs → second `dedupe_status != unique`) + existing stream test asserting `stream.dedupeIndex` advances across two ticks without `claimFingerprints` in stream.

### R2 — M-A4 "route d04 fallback through originating provider.fetch" blackouts the default seed path: `seed-portals.fetch` throws by design, and budget placement is unspecified

- **Current-file evidence:** `src/discovery/providers/seed-portals.ts:75-77` (`async fetch(): Promise<never> { throw new Error("seed-portals is an offline discovery source; use a fetching provider to acquire"); }`); hits carry the originating id (`src/discovery/types.ts:43` `provider_id: string`, populated e.g. `seed-portals.ts:62`); seed-portals is unconditionally first in the live set (`src/discovery/harvest.ts:385`, `src/discovery/harvest-stream.ts:151-153`), so keyless live runs are seed-hit-dominated. Current d04 succeeds for those hits via direct fetch (`src/discovery/pipeline.ts:150-168`, per-hit try/catch + `%PDF` guard at `:162-166`). Further, `src/discovery/providers/brave-search.ts:105-110` already wraps `withHostBudget` **inside** `provider.fetch` — if d04 keeps its own `withHostBudget` wrapper around `provider.fetch`, budget nests/doubles.
- **Plan defect:** `plan.md:79-92` M-A4 scope + `work-order.json` M-A4 (acceptance: "fake provider.fetch non-PDF test green") cover only the happy path. A zero-questions executor routing seed-originated hits through `resolveProvider(hit.provider_id).fetch()` gets a throw per hit → warn + `docs = []` for **every** seed hit: live seed-only acquisition goes to zero with all suites green. No fallback, no budget-placement rule, no seed-hit test.
- **Concrete fix:** extend M-A4 scope: (a) per-hit `try provider.fetch` → on throw (offline/non-fetching provider), fall back to the current direct-fetch path (preserves seed behavior; document if instead the intent is seed-hits degrade, with rationale); (b) budget rule: `withHostBudget` lives **inside** `provider.fetch` impls — d04 must NOT wrap `provider.fetch` calls (keep wrapper only around the legacy fallback); (c) acceptance += seed-originated-hit test (live fallback with `provider_id: "seed-portals"` still acquires non-empty bundle, zero network via stubbed global fetch) + fake-fetch routing test asserting `provider.fetch` was actually called (spy), not just output shape.

### R3 — M-A2 builder leaves the null-cellKey semantic fork unpinned; zero-questions executor must silently change one path's behavior

- **Current-file evidence:** `src/discovery/harvest.ts:396-413` (cellKey null → gaps-aware query from `odd-coverage.json` top-3 + file `dedupe-index.json` read at `:415-421`) vs `src/discovery/harvest-stream.ts:157-163` (cellKey null → static `["UK","US","CA","AE","INT"]` + 3 hardcoded themes; provider filter at `:151-154` also differs: stream admits `agent-reach-search` unconditionally, harvest `:384-386` does not). Streams can lack cellKey (`harvest-stream.ts:150,160-162` null-tolerant).
- **Plan defect:** `plan.md:94-100` M-A2 scope ("filter policy in one place") + acceptance ("same input both paths → identical providerIds/query") force convergence but never state **which** null-cellKey semantics the builder adopts. Either choice changes runtime behavior for one caller (stream ticks gain file reads + gaps-awareness, or harvest loses gaps-awareness) with no acknowledgment, no brief-record requirement, no fixture-wiring note for the tick path (stream has no `read`/`cwd` dep today).
- **Concrete fix:** pin in M-A2 scope: builder adopts harvest gaps-aware semantics + static fallback (quote `:396-413`), stream no-cellKey ticks thereby gain gaps-awareness (intended, record in `M-A2.md` brief); `deps?` carries `read`/`cwd` so the tick path stays injectable and the parity test runs hermetic (stub deps, no jobs). One line in acceptance: "null-cellKey case asserts gaps-aware derivation, not the legacy static default."

---

## Passing dimensions (with current-file evidence)

| # | Dimension | Verdict + evidence |
|---|---|---|
| 1 | All 8 gated enumerated | **PASS** — `tracker-index.md:7-14` (v2 F1–F4 `:7-10`, v3 F1–F4 `:11-14`) → `plan.md:17-26` rows 1–8 one-to-one; gates match (judge 401, BLOB absent, VAULT absent, F1→F4 edge, FLAG_2/FLAG_1/target/PHASE_3) |
| 2 | T2 deferral | **PASS** — `tracker-index.md:18` (worktree-resolved vs HEAD-blocked, owner commits) → `plan.md:27` explicitly deferred; `wayfinder-tickets.test.ts:142-144` still expects `blocked` and no module touches that file (work-order `forbidden` lists it) |
| 3 | A3-first + dep ordering | **PASS** — work-order `blocked_by`: M-A1←[M-A3], M-A4←[M-A3], M-A2←[M-A3,M-A1] (machine-parsed); serialization `harvest.ts` A3→A1→A2, `pipeline.ts` A3→A4, `harvest-stream.ts` A3→A2 matches shared files. A4-in-Wave-1 vs `decisions.md:49-51` ("→ A4 (post-grill)") is benign: normative text declares ordering "planner guidance, not ticket edges" (`decisions.md:51`), A4 shares no file with A1/A2, and A3→A4 serialization is kept |
| 4 | Cited line ranges real | **PASS** — spot-verified: `pipeline.ts:136` d04 head / `:218` `void seq` / `:285` d08 head / `:342-346` outcome; `harvest-stream.ts:151-154` filter / `:220-233` re-claim loop; `harvest.ts:227-234` dedupe call / `:279` persist head / `:302-312` seq / `:336-344` mirror / `:384-386` filter; `provider-types.ts:25` fetch; `health-aggregate.ts:81` bridge head / `:127-133` return; `route.ts:139-150` file fallback |
| 5 | Collision guards real | **PASS** — dirty set verified this session (`M pipeline.ts/harvest.ts/dedupe-persist.ts/health-aggregate.ts/route.ts`); plan's verify-before-edit + stop-and-report + `dedupe-persist.ts` no-touch + `state/vault-notes.json` ban are the correct protocols. Over-serialization of clean `harvest-stream.ts` (A3→A2) is harmless |
| 6 | A5 lane gate | **PASS** — Step-0 HEAD-diff with 3-way verdict (implement / verify-only / dup-close) correctly handles the uncommitted foreign bridge diff (`health-aggregate.ts` +73 uncommitted, verified); in-ticket gate (not an edge) matches `decisions.md:46` |
| 7 | A4 grill pre-decision sound | **PASS (decision), NOTE on ticket encoding (N1)** — guard-stays-caller-side + unwidened-fetch passes the hypothetical-seam/two-adapter test; `grilling.md` covers only the 8 gated tickets so planner-as-griller leaves no contradictory grill artifact; rationale + revisit condition + guard-home acceptance check are recorded |
| 8 | Parallelism safety | **PASS** — Wave 0 (V2/V3/TICKETS/A3), Wave 1 (A1/A4), Wave 2 (A2/A5) are pairwise disjoint-write sets; shared-file chains serialized. M-TICKETS Wave-0 "post-approval" is consistent (post-*plan*-approval, docs-only, disjoint dir) |
| 9 | Acceptance measurability | **PASS** — every module has `rg`-equality + named-suite + typecheck gates; GATED modules have empty-diff proofs |
| 10 | Scope creep | **PASS** — no interface widened (A4 pre-decided), R10 untouched, no vault/gated-tripwire/closed-map contact, stdlib-only, no git mutations by children |

---

## Non-blocking notes (orchestrator-auto-incorporable)

- **N1 — M-TICKETS must encode the A4 grill resolution + A5 lane-gate in front-matter, not copy `self-approve: FALSE` blindly.** `decisions.md:39` (AD-A4 "Self-approve: FALSE — NEEDS GRILL") and `:47` (AD-A5 "FALSE — NEEDS REVIEW") vs `plan.md:114-121` ("front-matter per decisions.md"). Fix: A4 ticket records `grill: resolved-by-planner (guard caller-side, fetch unwidened; revisit on 2nd content-type)` + `self-approve: true`; A5 ticket records `lane-gate: foreign bridge lane; reviewer = lane owner`. Otherwise the map ships a NEEDS-GRILL ticket no lane is tasked to grill.
- **N2 — M-A4 `touches` includes `provider-types.ts` but the pre-decision demands zero contract change.** Clarify expected diff is zero (read-only reference for the guard-home check); any diff there fails review. Prevents a literal-minded executor from widening the contract to "complete" the touch.
- **N3 — M-A1: keep the VITEST/ NODE_ENV guard at the `executeJob` call site.** `harvest.ts:214` gates persist; moved fn `appendLedgerRun` writes unconditionally (new test expects "file mirror written"). Scope should state the guard stays wrapping the one call, and the coverage-mirror write (`harvest.ts:346-353`) moves with the fn or is explicitly excluded (ledger owning a coverage file is a Divergent-Change smell — prefer moving only ledger slices, leaving coverage mirror at the call site).
- **N4 — Stale field-count comments vs M-A5 "8-field" tests.** `health-aggregate.ts:79-80` ("6-field") and `:18-21` ("two extra") undercount the true 8 (4 base `:11-16` + 4 bridge `:22-27`); `route.ts:134` repeats "6 fields". M-A5's 8-field shape pin is correct — have the worker fix the two comments in passing (or explicitly exclude them to avoid an "unrelated edit" flag).
- **N5 — Rollback story (one paragraph, no redesign):** GATED/TICKETS/A5-verify-only → nothing to revert (no prod diff); A3/A4/A1/A2 → single-commit `git revert` each (additive outcome field, loop deletion, seam moves — no migrations, no schema/data moves); Wave-2 A2 re-runs stream+harvest suites as its own gate. No irreversible step exists in this plan.

---

## References (current-file grounding, all verified this session)

- Plan/work-order: `.autoforge/plans/plan.md:17-33` (coverage), `:55-121` (modules), `:123-132` (DAG); `.autoforge/execution/work-order.json` (8 modules, `blocked_by`, waves, `forbidden`, machine-parsed via python3 json)
- Tracker/arch: `.autoforge/discovery/tracker-index.md:7-14,:18`; `.autoforge/architecture/decisions.md:9-51`
- Code: `src/discovery/pipeline.ts:136-223,:285-313,:342-373`; `src/discovery/harvest-stream.ts:148-233`; `src/discovery/harvest.ts:210-234,:279-355,:384-434`; `src/discovery/providers/seed-portals.ts:55-77`; `src/discovery/providers/brave-search.ts:105-110`; `src/discovery/providers/provider-types.ts:21-26`; `src/discovery/types.ts:40-49`; `src/discovery/health-aggregate.ts:11-27,:79-134`; `src/app/api/dev/health/route.ts:134-150`; `tests/domain/wayfinder-tickets.test.ts:142-144`

---
*Artifact: `.autoforge/reviews/plan-critique.md` (overwrite of prior-cycle critique; this file only). Read-only otherwise; no checkout/stash/reset/add/commit/push; nothing under `state/` touched.*
