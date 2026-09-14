# Review: M-A3 — dedupeIndex threading (read-only)

**Verdict: APPROVED_WITH_NOTES**

All acceptance claims verified against current `.ts` sources. No blocking defect. Notes are cleanup-only; no rework required for contract.

## Scope reviewed (`.ts` only, per instruction)

- `src/discovery/pipeline.ts` — D08/outcome
- `src/discovery/harvest-stream.ts` — consumer
- `tests/domain/discovery-pipeline-dedupe-index.test.ts` — new (untracked, present)
- `.autoforge/execution/M-A3.md` — brief
- Did NOT run vitest (poisoned by stale `src/discovery/*.js` twins); did NOT touch/delete `.js` files; no source/test/config edits; no git mutations.

## Acceptance rows (current evidence)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| A1 | Outcome type carries `dedupeIndex` | PASS | `src/discovery/pipeline.ts:349-357` — `export interface DiscoveryRunOutcome { ... dedupeIndex?: DedupeIndexDoc; }` |
| A2 | Pipeline return includes `dedupeIndex` | PASS | `src/discovery/pipeline.ts:398-399` — `const finalDedupeIndex = ctx.dedupeIndex ?? emptyDedupeIndex(); return { state, artifacts, refusals, dedupeIndex: finalDedupeIndex };` |
| A3 | D08 threads shared reference (no frozen clone) | PASS | `src/discovery/pipeline.ts:288-293` — `const index: DedupeIndexDoc = ctx.dedupeIndex ?? emptyDedupeIndex();` + `(ctx as any).dedupeIndex = index;` (replaces old `structuredClone` — confirmed in `git diff HEAD -- src/discovery/pipeline.ts` hunk `structuredClone(ctx.dedupeIndex)` → shared ref) |
| A4 | Critic R1 fix present: consumer assigns `outcome.dedupeIndex` (not just loop deletion) | PASS | `src/discovery/harvest-stream.ts:184` — `const { state, dedupeIndex } = await runDiscoveryPipeline(ctx);` + `src/discovery/harvest-stream.ts:219-221` — `if (dedupeIndex) { stream.dedupeIndex = dedupeIndex; }` |
| A5 | Re-claim loop deleted | PASS | `git diff HEAD -- src/discovery/harvest-stream.ts` shows deletion of 14-line block (`state.dedupe` check + `for (const pkg of uniquePkgs ...) claimFingerprints(...)` + try/catch); current file has no such loop (lines 214-222 go straight from coverage to `stream.currentNode = null`) |
| A6 | `rg claimFingerprints` in stream `.ts` = 0 | PASS | grep `claimFingerprints` in `src/discovery` hits only `src/discovery/dedupe.ts:65`, `src/discovery/pipeline.ts:25,314`, `src/discovery/dedupe-persist.ts:10,99` — zero hits in `src/discovery/harvest-stream.ts`; import at `src/discovery/harvest-stream.ts:7` is `import { emptyDedupeIndex, type DedupeIndexDoc }` (unused-import repair confirmed) |
| A7 | Test asserts threading + non-unique | PASS | `tests/domain/discovery-pipeline-dedupe-index.test.ts:42` `expect(out1.dedupeIndex).toBeDefined();` + `:45-49` threads `dedupeIndex: out1.dedupeIndex` into run2 and asserts `hasNonUnique` (`q.dedupe_status !== "unique"`) is `true`; fixture at `:18` uses widened `jurisdictions: ["UK","US","CA","AE","INT"]` (orchestrator repair confirmed) |
| A8 | No `dedupe-persist.ts` contact from M-A3 files | PASS | grep `dedupe-persist\|persistDedupe` in `src/discovery` hits only `src/discovery/harvest.ts:229,233` + `src/discovery/dedupe-persist.ts:79` — zero hits in `pipeline.ts` / `harvest-stream.ts` |
| A9 | Stream threads index in (`ctx` construction) | PASS | `src/discovery/harvest-stream.ts:165` — `dedupeIndex: stream.dedupeIndex,` |
| A10 | Typecheck green | NOT RE-VERIFIED (accepted on orchestrator evidence) | Static review only per constraints; no new type errors visible in diff regions (optional `dedupeIndex?` threading is type-consistent) |

## Standards / quality notes (non-blocking)

- N1 (dead code, cleanup): `src/discovery/pipeline.ts:368-372` — `if (!ctx.dedupeIndex) { // no-op: ... } else { // ensure ... }` does nothing. Both branches are comments only. Harmless but should be deleted on next touch; it documents intent that D08 already implements.
- N2 (lint risk, `any` without disable): `src/discovery/pipeline.ts:292` — `(ctx as any).dedupeIndex = index;`. File has no `eslint-disable` for `no-explicit-any` (contrast `src/discovery/harvest-stream.ts:161,169,172` which disable per-line). Works, but inconsistent with repo discipline; prefer typed mutation or a disable comment on next touch.
- N3 (test hygiene, unused imports/helpers): `tests/domain/discovery-pipeline-dedupe-index.test.ts:3-5,9` imports `Ajv`, `readFileSync`, `join`, `MemoryStore` — none used in body; `:13-14` helper `mk` defined but never called; `:36` `await import("@/discovery/providers");` result discarded (re-imported next line). Functional assertions unaffected; lint (`no-unused-vars`) may flag on next `lint` run. Cleanup on next touch, not a contract failure.

## Spec / scope

- No scope creep attributable to M-A3: pipeline D08/outcome + stream consumer + new test match `.autoforge/execution/M-A3.md:4-7` exactly (extend outcome, mutate `ctx.dedupeIndex` in place, consume + assign in stream, remove `claimFingerprints` propagation, pipeline-twice test).
- Behavior change (clone → shared-ref mutation) is the contracted fix, not creep: old `structuredClone` deliberately discarded cross-run state; new shared reference is what enables `run2 statuses unique,duplicate,duplicate,duplicate` per orchestrator proof.

## Foreign dirty regions overlapping the diff (not M-A3, flagged per acceptance)

- F1 (same-file overlap): `src/discovery/pipeline.ts:29` — `import { isProviderDegraded } from "@/discovery/health-state";` + `d02Qualify` refusals block (`src/discovery/pipeline.ts:106-112`) appear in `git diff HEAD -- src/discovery/pipeline.ts` but are absent from `M-A3.md:4-7` brief. Attributed to a foreign lane (Brave-quota degradation); M-A3 review does not approve or reject it.
- F2 (other-file drift): `git diff HEAD -- src/discovery/dedupe-persist.ts src/discovery/harvest.ts` shows KV-first/ROFS wording (`dedupe-persist.ts:72,87-113`) and harvest-lock comment deletions (`harvest.ts:99-171`) — both outside M-A3 scope, not contacted by M-A3 files (see A8). Flagged as foreign lanes (R10/R1).
- F3 (stale twins, vitest shadowing): untracked `src/discovery/pipeline.js:256` still uses `structuredClone`, `src/discovery/harvest-stream.js:3,176-187` still imports `claimFingerprints` and runs the old re-claim loop. Per instruction these were not read for verdict and not deleted; any local vitest run resolving `.js` over `.ts` is poisoned. E2E/CI (which resolves `.ts`) is the valid signal.

## Summary

Acceptance 10/10 (9 PASS + 1 accepted-on-orchestrator-evidence). Worst note: N1 dead no-op block (cosmetic). Worst foreign flag: F1 same-file D02 overlap (not M-A3's change — do not squash on M-A3's behalf).
