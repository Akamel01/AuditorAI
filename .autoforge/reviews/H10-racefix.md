# H10 stop-race fix — independent review

Scope: `src/discovery/harvest-stream.ts` (3 hunks) + `tests/domain/harvest-stream-race.test.ts` (new).
Method: read-only (diff, source, test, `MemoryStore` semantics). No runs, no edits.

## Core claim verification (gating)

Claim: "no save happens between load and pipeline-resolve". **HOLDS.**
`tickStream` loads at line 132, snapshots at 141, and lines 143–181 contain only
in-memory mutation (`iteration += 1`, `updatedAt`, `currentNode`, `appendLog`) plus
pure ctx construction (`acquireDocs` is a closure, defined-not-called). First
post-load persistence surface is line 243 (`saveStream`), after both guards.
Additionally `MemoryStore` is JSON-clone-on-write/read, so unsaved in-memory
mutation is invisible to any concurrent loader:

- `src/lib/persistence/store.ts:34-35` — `async put(key, value) { this.m.set(key, JSON.stringify(value)); }`
- `src/lib/persistence/store.ts:37-40` — `get` returns `JSON.parse(raw)` (fresh copy per call)

## Items

1. **Snapshot correctness — PASS.** `"const startUpdatedAt = stream.updatedAt;"` (`harvest-stream.ts:141`)
   captured before the in-memory `stream.updatedAt = nowIso()` at line 144; no
   pre-pipeline save exists (see above), and clone semantics make the line-144
   mutation invisible to the store, so later `fresh.updatedAt !== startUpdatedAt`
   drift can only come from a concurrent writer.
2. **Success guard — PASS (logic), conditions complete.** `"if (!fresh || (fresh.status !== \"RUNNING\" && fresh.status !== \"VERIFYING\") || fresh.updatedAt !== startUpdatedAt) {"` (`:186`) covers deleted record, stopped/paused/done/failed takeover, and pause→resume drift; `"return fresh ?? null;"` (`:187`) mutates nothing, appends no log, saves nothing. Stale result fully dropped.
3. **Pause+resume-then-drop benign — PASS.** Package/dedupe merge (`:193-199`) sits
   strictly after the guard, so the drop path leaves the store's `dedupeIndex`
   untouched; next tick reloads the old index and rediscovers. `ctx.dedupeIndex`
   aliases the doomed in-memory clone only (`:165`), never persisted on drop.
4. **Catch guard asymmetry — PASS (justified in-code).** `"const fresh = await loadStream(id, store);"` + `"if (fresh && fresh.status !== ..."` (`:235-236`) is status-only, and the comment (`:232-234`: "a pause+resume cycle keeps RUNNING, and a real pipeline error should still surface then") states the rationale: a genuine pipeline error must not be swallowed by a resume. NOTE (non-blocking): `!fresh` on the error path falls through and re-`saveStream`s the stale clone, resurrecting a hypothetically deleted record while the success path returns `null`. No `deleteStream` API exists in this module, so unreachable in practice; consider `if (!fresh) return null;` for symmetry.
5. **Race test determinism — FAIL (one wrong assertion; ordering itself airtight).**
   Entered-gate interleave (`harvest-stream-race.test.ts:39-48`: signal-then-block;
   `:47-50` tick-blocked ⇒ stop-lands-mid-tick) is deterministic; `afterEach`
   (`:23-26`) clears `__h10_gate`/`__h10_entered`; `vi.mock("@/discovery/pipeline")`
   (`:10-21`) is file-scoped and delegates to actual when gateless, so no leakage
   into `harvest-stream.test.ts`. BUT `expect(final?.iteration).toBe(1)` (`:57`)
   contradicts JSON-clone semantics and its own comment ("tick's increment was
   dropped"): tick's `iteration 0→1` lives on an unsaved clone, `stopStream`
   (`harvest-stream.ts:271-282`, never touches `iteration`) persists `iteration: 0`,
   the guard returns without saving — final `iteration` is `0`, so this assertion
   goes red. Required change: `toBe(0)`.
6. **Invariant comments — PASS.** Snapshot rationale (`:139-140`), success-guard
   rationale (`:183-184`), catch-path rationale (`:232-234`) all present and
   accurate against the verified no-pre-pipeline-save + clone semantics.
7. **Ponytail — PASS.** No new imports/deps in source (guard reuses in-module
   `loadStream`); test file adds only `vitest` + existing module imports.

## Verdict: CHANGES_REQUIRED

Source fix is correct; the new test fails on its own assertion. One precise fix:
`tests/domain/harvest-stream-race.test.ts:57` → `expect(final?.iteration).toBe(0);`
(optionally amend the comment to "stays 0: tick's increment lived on the dropped clone").
Re-run `tests/domain/harvest-stream-race.test.ts` after the one-line change; no source change needed.
(Optional nit: symmetric `if (!fresh) return null;` in the catch guard.)
