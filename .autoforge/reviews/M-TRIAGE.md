# Review: M-TRIAGE re-review after fix pass (H1–H6 closures) — docs-only module

Verdict: **CHANGES_REQUIRED** (independent, read-only; no shell per §13-14; all anchors spot-checked against CURRENT sources 2026-09-10)

## New anchors verification (post-resolution)
- H1 anchors verified in codebase: ai-search.ts:30-33; ai-search.ts:34-36; ai-search.ts:123-130; agent-reach-search.ts:149-152; providers/index.ts:11-12
- H4 anchors verified in Mission Control: page.tsx:21-23; page.tsx:44-46; page.tsx:72-79; page.tsx:413
- H5 anchors verified in harvest-stream.ts: 2; 11-13; 113-121; 234-270

Scope: `workflow/wayfinder/maps/ai-harvest-stream/tickets/H1-ai-provider-gpt5-nano.md`, `H2-structured-workflow.md`, `H3-control-api.md`, `H4-ui-monitoring.md`, `H5-verification-loop.md`, `H6-fixtures-samples.md` + `MAP.md` + `.autoforge/execution/M-TRIAGE.md` + `.autoforge/plans/plan.md` + `.autoforge/execution/work-order.json`.
Method: read all 6 tickets + MAP + execution doc + plan + work-order; spot-checked cited anchors by reading CURRENT source lines NOW; globbed fixtures/live-e2e. No shell, no edits outside this file.

## Summary

Fix pass is PARTIAL. `resolved:` dates are now FIXED for H2–H6, H1-evidence quotes in the execution doc are new (valid), and plan/work-order objectives now say "in any mode" (partial). But the fix-worker claims do NOT hold: H3/H4/H5/H6 Resolution anchors are byte-identical to the prior FAIL state (no corrections applied), H1 ticket itself is UNCHANGED (still no Resolution), MAP bullets are UNCHANGED (still frontmatter pseudo-anchors), all acceptance boxes remain unchecked, execution-doc table still asserts without per-row verbatim, and plan:30 + work-order:32 remain lint-scoped. It is NOT true that "only H1-ticket-Resolution + MAP bullets remain" — H3/H4/H5/H6 anchor defects + acceptance scoping + execution-doc per-row evidence + plan/work-order acceptance lines also remain. Fix is still docs-only.

## Row verdicts (prior row → current disposition)

### H1 (ai-provider) — STILL-OPEN: no Resolution block in ticket (unchanged as claimed)
- FIXED sub-part (docs only): `.autoforge/execution/M-TRIAGE.md:27-33` now carries verbatim H1 quotes. Spot-checked VALID:
  - `src/discovery/providers/ai-search.ts:34-35` → `async discover(query: DiscoverQuery, fetchImpl?: typeof fetch): Promise<DiscoveryHit[]> {` / `if (!isEnabled() || !hasKey()) return [];` ✓
  - `src/discovery/providers/ai-search.ts:43` → `const limit = Math.min(query.limit ?? 5, 10);` ✓
  - `src/discovery/providers/agent-reach-search.ts:1-6` → `// agent-reach-search provider — gpt-5-nano brain + Exa/Jina hands (H7)` … `// Gated by AGENT_REACH_ENABLED + EXA_API_KEY + OPENCODE_API_KEY (all off by default).` ✓
  - `src/discovery/providers/index.ts:11-12` → `import "./ai-search";` / `import "./agent-reach-search";` ✓
- STILL-OPEN (ticket itself): CURRENT `workflow/wayfinder/maps/ai-harvest-stream/tickets/H1-ai-provider-gpt5-nano.md:32-37` is verbatim:
  - `**Acceptance:**` / `- [ ] \`DISCOVERY_AI_ENABLED=true\` enables \`ai-search\` in \`listProviderIds()\` …` / `- [ ] \`ai-search\` returns \`DiscoveryHit[]\` …` / `- [ ] Respects \`query.jurisdictions\` …` / `- [ ] Uses \`withHostBudget\` …` / `- [ ] Unit test with \`MemoryStore\` …`
  - File ends at `:39-41` `**Out of scope:** Replacing brave/seed…` with NO `## Resolution` section at all. `status: closed` (`:6`) + `resolved: 2026-09-10` (`:11`) with zero cited anchors in-ticket is not a legitimate close.
- Required (blind-apply): append to H1 ticket:
  ```
  ## Resolution
  - Evidence anchors:
  - src/discovery/providers/ai-search.ts:34-36 (discover gate)
  - src/discovery/providers/ai-search.ts:43 (limit max 10)
  - src/discovery/providers/ai-search.ts:96-104 (402/429 graceful return [])
  - src/discovery/providers/ai-search.ts:123-130 (registration)
  - src/discovery/providers/agent-reach-search.ts:1-6 (H7 additive, same seam)
  - src/discovery/providers/index.ts:11-12 (both registered)
  ```
  plus one line scoping acceptance (check boxes with evidence or note H7-supersede: ai-search URL-invention vs agent-reach reach-out).

### H2 (structured-workflow) — PARTIALLY FIXED (date FIXED, acceptance STILL-OPEN, anchors OK)
- FIXED: CURRENT `H2-structured-workflow.md:11` → `resolved: 2026-09-10` ✓ (was blank).
- Anchors CONFIRMED VALID (unchanged, correctly so) — spot-checked:
  - `src/discovery/harvest-stream.ts:11` → `export type HarvestStreamStatus = "IDLE" | "RUNNING" | "PAUSED" | "VERIFYING" | "DONE" | "FAILED";` ✓
  - `src/discovery/harvest-stream.ts:136-137` → `if (stream.status === "IDLE") stream.status = "RUNNING";` / `if (stream.status !== "RUNNING" && stream.status !== "VERIFYING") return stream;` ✓
- STILL-OPEN: CURRENT `H2-structured-workflow.md:33-37` is verbatim `- [ ] \`HarvestStream\` persists …` / `- [ ] \`IDLE → start() → RUNNING …\`` / `- [ ] \`PAUSED\` via \`pause()\` …` / `- [ ] Verification uses \`computeCoverage…\`` / `- [ ] Ponytail: reuse \`DataStore\` …` — all 5 unchecked on a `closed` ticket. Either check with evidence or scope explicitly.
- Required: check/scope the 5 boxes in-ticket. No anchor change needed.

### H3 (control-api) — STILL-OPEN: resolved date FIXED, anchors UNCHANGED (claim of correction is FALSE)
- FIXED: CURRENT `H3-control-api.md:11` → `resolved: 2026-09-10` ✓.
- STILL-OPEN — CURRENT `H3-control-api.md:39-41` is verbatim:
  - `## Resolution` / `- Evidence anchors:` / `- src/app/api/dev/harvest-stream/route.ts:31-36` / `- src/app/api/dev/harvest-stream/[id]/route.ts:1-4`
  - Second anchor is still meaningless. CURRENT `src/app/api/dev/harvest-stream/[id]/route.ts:1-4` is verbatim: `// GET /api/dev/harvest-stream/[id] — get stream status` / `import { NextResponse } from "next/server";` / `import { requireAdmin, serverError } from "@/lib/api";` / `import { loadStream, tickStream } from "@/discovery/harvest-stream";` — comment + imports, proves no behavior. Correct GET evidence is `:6-23` (`export async function GET…` → `requireAdmin` → `loadStream` → `404` → auto-tick → `{ stream }`), verified CURRENT.
  - First anchor `route.ts:31-36` VALID (`stream.status = "RUNNING";` … `stream.continuous = continuous;` … `{ status: 201 }`) but carries H9-delta content without naming it.
  - Missing entirely: pause (`src/app/api/dev/harvest-stream/[id]/pause/route.ts:5-13` → `pauseStream(id)` → `{ paused: true, stream }`, verified CURRENT), resume, stop anchors; `requireAdmin` behavior; idempotency; explicit H9-delta line.
- STILL-OPEN: CURRENT `H3-control-api.md:32-36` all `- [ ]` unchecked.
- Required (blind-apply): replace `- src/app/api/dev/harvest-stream/[id]/route.ts:1-4` with `- src/app/api/dev/harvest-stream/[id]/route.ts:6-23 (GET status + auto-tick)`; append `- src/app/api/dev/harvest-stream/[id]/pause/route.ts:5-13`, `- …/resume/route.ts:5-14`, `- …/stop/route.ts:5-13`; append one line `H9-delta: continuous = body.continuous !== false default-true (route.ts:30) + client pass-through + control sends continuous:true`; check/scope acceptance.

### H4 (ui-monitoring) — STILL-OPEN: resolved date FIXED, anchors UNCHANGED (claim of correction is FALSE)
- FIXED: CURRENT `H4-ui-monitoring.md:11` → `resolved: 2026-09-10` ✓.
- STILL-OPEN — CURRENT `H4-ui-monitoring.md:39-42` is verbatim:
  - `- src/app/dev/mission-control/_components/ai-harvest-control.tsx:44-50` / `- …:60-72` / `- src/app/dev/mission-control/page.tsx:21-28`
  - Third anchor still wrong. CURRENT `page.tsx:21-28` is verbatim imports: `import { AiHarvestControl, type Stream as HarvestStream } from "./_components/ai-harvest-control";` / `import { AiHarvestKeys } …` / `import { AiHarvestViz } …` … `import type { LearningMetrics } …` — proves no segment. Correct segment proof is CURRENT `page.tsx:36` (`type Segment = "overview" | "discovery" | "odd" | "readiness" | "tickets" | "ai-harvest" | "vault";`), `:44` (`{ value: "ai-harvest", label: "AI Harvest" },`), `:413` (`{segment === "ai-harvest" && <AiHarvestTab />}`), all verified CURRENT.
  - First two anchors VALID but partial: `:44-50` ✓ Start sends `continuous: true`; `:60-72` ✓ pause+resume; missing Stop (`:77-85` `…/stop…`, verified CURRENT) and 2s poll (`:100-102` `pollRef.current = setInterval(tick, 2000);`, verified CURRENT).
- STILL-OPEN: CURRENT `H4-ui-monitoring.md:30-34` all `- [ ]` unchecked.
- Required (blind-apply): replace `- src/app/dev/mission-control/page.tsx:21-28` with `- src/app/dev/mission-control/page.tsx:36,44,413 (ai-harvest segment)`; append `- …/ai-harvest-control.tsx:77-85 (Stop)` + `- …:100-102 (2s poll)` or scope them out in one line; check/scope acceptance.

### H5 (verification-loop) — STILL-OPEN: resolved date FIXED, second anchor still misdescribed (claim of correction is FALSE)
- FIXED: CURRENT `H5-verification-loop.md:11` → `resolved: 2026-09-10` ✓.
- STILL-OPEN — CURRENT `H5-verification-loop.md:37-39` is verbatim:
  - `- src/discovery/harvest-stream.ts:113-128 (verifyStream function)` / `- src/discovery/harvest-stream.ts:130-160 (tickStream path including VERIFYING)`
  - First VALID: CURRENT `:113-128` is `export function verifyStream(…)` → `0 packages` / `no quality verdicts` / `quality_score != 1` / `dedupe_status != unique` → `return { passed: reasons.length === 0, reasons };` ✓.
  - Second MISLEADING: CURRENT `:130-160` is `// ponytail: single prompt/global poll/20%/2s ceiling …` + `export async function tickStream…` + `PAUSED/DONE/FAILED` guard + `IDLE→RUNNING` + race-guard + provider resolution — contains NO VERIFYING transition. Actual VERIFYING + delta-verify + DONE/continuous branch is CURRENT `:234-270` (`stream.status = "VERIFYING";` … `const v = uniquePkgs.length > 0 ? verifyStream(…)` … `stream.status = "DONE"` / `= "RUNNING"`), verified CURRENT.
- STILL-OPEN: CURRENT `H5-verification-loop.md:28-32` all `- [ ]` unchecked; provenance/licence gates (`provenance.length === package.length`, `licence !== unknown`) still unaddressed (implementation checks only packages/quality/dedupe per `:118-121`, coverage existence-only per `:124-126`).
- Required (blind-apply): replace `- src/discovery/harvest-stream.ts:130-160 (tickStream path including VERIFYING)` with `- src/discovery/harvest-stream.ts:234-270 (VERIFYING transition + delta-verify + DONE/continuous branch)`; append one line disposing provenance/licence (cite D08/pipeline or narrow acceptance); check/scope acceptance.

### H6 (fixtures-samples) — STILL-OPEN: resolved date FIXED, stale line + gaps UNCHANGED (claim of correction is FALSE)
- FIXED: CURRENT `H6-fixtures-samples.md:11` → `resolved: 2026-09-10` ✓.
- STILL-OPEN — CURRENT `H6-fixtures-samples.md:38-41` is verbatim:
  - `- tests/domain/ai-harvest.test.ts (2 hits → …)` / `- tests/domain/ai-harvest.test.ts lines 37-63 show gating and acquisition flow` / `- src/discovery/pipeline.ts:334 runDiscoveryPipeline (D01..D10 integration in tests)`
  - Third anchor STALE: CURRENT `src/discovery/pipeline.ts:334` is `state: DiscoverySharedState;` (inside `DiscoveryRunOutcome` interface `:333-337`); the function is at `:339` → `export async function runDiscoveryPipeline(ctx: DiscoveryCtx): Promise<DiscoveryRunOutcome> {`, verified CURRENT. Off-by-5 persists.
  - First two WEAK-but-true: CURRENT `tests/domain/ai-harvest.test.ts:83-90` → `expect(outcome.state.discovery_hits?.length).toBe(2);` … `expect(outcome.state.quality?.[0]?.dedupe_status).toBe("unique");` ✓ chain proven, but cited without lines.
  - Acceptance gaps unaddressed: CURRENT `H6-fixtures-samples.md:29-33` all `- [ ]` unchecked; fixture `tests/fixtures/ai-harvest/uk-s1-rsa.json` EXISTS (glob hit, uncited in ticket); `tests/e2e/ai-harvest-live.test.ts` does NOT exist (glob miss) while acceptance demands it.
- Required (blind-apply): replace `src/discovery/pipeline.ts:334` with `src/discovery/pipeline.ts:339`; append `- tests/fixtures/ai-harvest/uk-s1-rsa.json (2-hit fixture)`; append one line disposing live-e2e (add file or scope to H10); check/scope acceptance + typecheck/lint/vitest line.

### MAP.md closure bullets — STILL-OPEN (notes-only change does not fix pseudo-anchors)
- CURRENT `workflow/wayfinder/maps/ai-harvest-stream/MAP.md:56-61` is verbatim:
  - `- [H1 closed 2026-09-10] H1 was closed on 2026-09-10 with resolution anchored to lines 6, 9, 11.` (and H2→`6, 9, 12`, H3→`6, 9, 11`, H4/H5/H6→`6, 11`).
  - Those are ticket-frontmatter lines (`status:`/`blocks:`/`resolved:`), not source evidence — a reader finds YAML, not implementation. No edit since prior review.
- Required (blind-apply): replace each `with resolution anchored to lines X, Y, Z` with `with Resolution anchors in <ticket-file> (see ticket ## Resolution)` or drop pseudo-anchors and link tickets. Do NOT re-cite frontmatter numbers as evidence.

### M-TRIAGE.md execution doc — STILL-OPEN (partial: H1 quotes added, per-row evidence still missing)
- IMPROVED: CURRENT `.autoforge/execution/M-TRIAGE.md:27-33` adds 6 verbatim H1 quotes (`ai-search.ts:34-36`, `:43`, `:96-104`, `:123-130`, `agent-reach-search.ts:1-6`, `providers/index.ts:11-12`), all spot-checked VALID above.
- STILL-OPEN: CURRENT `.autoforge/execution/M-TRIAGE.md:10-17` table is verbatim `| H1 | closed | H1: status: closed (docs); anchors exist in H1 file. |` … `| H2 | closed | H2-structured-workflow.md: status=closed; Resolution anchors present. |` (H3–H6 identical shape) — asserts without quoting a single CURRENT path:line for H2–H6 and without H9-delta for H3. `:24-25` (`see H1 file…`, `see H2… resolution block`) still defers instead of quoting.
- Required: replace each row's evidence cell with 1–2 verbatim CURRENT `path:line` quotes (use the VALID ones confirmed in this review: H2 `:11`+`:136-137`, H3 `route.ts:31-36`+`[id]:6-23`, H4 `control:44-50`+`page:413`, H5 `:113-128`+`:234-270`, H6 `ai-harvest.test:83-90`+`pipeline:339`) + one-line H9-delta for H3.

### plan.md + work-order.json M-R19 wording — PARTIALLY FIXED, work-order still parses
- FIXED: CURRENT `.autoforge/plans/plan.md:23` → `… exits \`0\` clean / \`1\` invalid / \`2\` usage-IO; no M-R19 write in any mode; \`--json\` gains \`skipped\` array.` ✓ ("in any mode" as required).
- FIXED: CURRENT `.autoforge/execution/work-order.json:39` → `"objective": "--lint flag: same lenient loader, stderr file:reason lines, exit 0/1/2, no M-R19 write in any mode, --json gains skipped"` ✓.
- STILL-OPEN: CURRENT `.autoforge/plans/plan.md:30` → `Against temp tree with 1 bad file → exit \`1\`, stderr contains bad filename + reason; no \`.autoforge/explanation/M-R19-ticket-index.md\` write in lint mode.` — still scopes to "in lint mode"; required `in any mode` / `in all modes (artifact retired: ephemeral ignored dir, zero readers)`.
- STILL-OPEN: CURRENT `.autoforge/execution/work-order.json:32` → `"lint mode writes no .autoforge/explanation artifact"` — still lint-scoped; required `"writes no .autoforge/explanation artifact in any mode"`.
- Parse check (read-only, no exec per §13-14): `work-order.json:1-86` reads as well-formed JSON (balanced braces/brackets, quoted keys/strings, no trailing commas, `modules[5]` M-TRIAGE intact) — judged parseable by reading. No execution run.
- Required (blind-apply): plan `:30` `write in lint mode.` → `write in any mode (artifact retired).`; work-order `:32` `"lint mode writes no .autoforge/explanation artifact"` → `"writes no .autoforge/explanation artifact in any mode"`.

## Required changes (docs-only; no source/test/config edits)

1. H1 ticket: append `## Resolution` with the 6 H1 anchors above + acceptance scoping line.
2. H2: check/scope 5 acceptance boxes (date done, anchors valid).
3. H3: replace `[id]/route.ts:1-4` with `:6-23`; add pause/resume/stop anchors; add H9-delta line; check/scope acceptance.
4. H4: replace `page.tsx:21-28` with `:36,44,413`; add stop `:77-85` + poll `:100-102` or scope out; check/scope acceptance.
5. H5: correct `:130-160` → `:234-270`; one-line provenance/licence disposition; check/scope acceptance.
6. H6: fix `pipeline.ts:334` → `:339`; cite fixture path; dispose live-e2e line; check/scope acceptance.
7. MAP.md:56-61: replace frontmatter pseudo-anchors with ticket-Resolution pointers.
8. M-TRIAGE.md execution doc: per-row verbatim CURRENT path:line quotes + H3 H9-delta.
9. plan.md:30 + work-order.json:32: `in lint mode` → `in any mode` (match :23/:39 which are already fixed).

## Standards / Spec (code-review lens, docs-only module)

- Standards: ticket frontmatter schema now passes for dates (6/6 `resolved: 2026-09-10`), but Resolution-convention still fails (H1 missing, H3/H4/H5/H6 stale/misleading anchors, MAP pseudo-anchors). Unchecked `- [ ]` on closed tickets still reads "not done" — check or scope.
- Spec (M-TRIAGE objective: close H1–H6 with CURRENT valid file:line anchors): duplicate removal PASS (unchallenged); closure legitimacy still FAIL for the 7 items above. Fix-worker claim "H3/H4/H5/H6 anchors corrected" is FALSE on current files; "H1 anchors only in docs" is TRUE but insufficient (ticket itself needs them); "MAP only notes" leaves the bogus anchors in place.

One-line summary: 10 rows — 3 FIXED (H2–H6 dates, H1-doc quotes, plan/work-order objectives), 1 PASS-by-reading (work-order parses), 7 STILL-OPEN (H1-ticket, H3, H4, H5, H6, MAP, execution-doc + plan/work-order acceptance lines); worst: H3/H4 still cite import-lines as behavior evidence and H1 closes with no in-ticket Resolution.
