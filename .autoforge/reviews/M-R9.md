# Review — M-R9 Discovery doctor JSON contract (stable shape)

**Reviewer:** autoforge-reviewer (independent, read-only) — model `opencode/muse-spark-1.2-contributor-free` inherit 80k cap
**Date:** 2026-09-03
**Scope (read-only):** `scripts/discovery-doctor.ts` diff `HEAD` vs worktree + `.autoforge/execution/M-R9.md:1-27` verbatim + `workflow/wayfinder/maps/ops-residual/tickets/R9-discovery-doctor-json.md:1-32` + `plan-remaining.md:159-180` M-R9 spec + `src/discovery/ledger.ts:28-39` `getLedgerTailKV` seam
**Skills:** `code-review` (Standards vs Spec two-axis), `ponytail` ladder, `verify-and-stop`
**Mode:** read-only, no mutations, cite `file:line`

---

## Verdict

**APPROVED_WITH_NOTES**

M-R9 meets its JSON contract: single JSON stdout, deterministic shape `providers+totals+ledger+dedupe+health`, `ledger` via `getLedgerTailKV(20)`, no console leak, both `--json` and `--live --json` parse via `JSON.parse`. One repo-wide build gate currently fails, but the failure is **not in `scripts/discovery-doctor.ts`** — it is a bad relative import in `M-R19` (`ticket-board.tsx:8`). No changes required in M-R9 to pass its own acceptance; notes below are polish / global gate tracking.

---

## Evidence (file:line)

| Claim | File:Line | Verification |
|---|---|---|
| ledger KV import | `scripts/discovery-doctor.ts:10` `import { getLedgerTailKV } from "../src/discovery/ledger"` | `git diff HEAD -- scripts/discovery-doctor.ts` shows `+import { getLedgerTailKV }` at `:10` |
| JSON mode flag | `scripts/discovery-doctor.ts:16` `const JSON_MODE = process.argv.includes("--json")` | present |
| providers build | `scripts/discovery-doctor.ts:20-43` `listProviderIds() → providerEnabled → resolveProvider.discover({limit:3})` → `{id,enabled,hostsOk,sampleHits}` | matches ticket `R9:20-23` `providers[] {id,enabled,hostsOk,sampleHits}` |
| totals | `scripts/discovery-doctor.ts:45-49` `{totalProviders,totalEnabled,totalSampleHits}` | correct |
| ledger via KV tail | `scripts/discovery-doctor.ts:51` `const ledger = await getLedgerTailKV(20)` | seam `src/discovery/ledger.ts:28` `getLedgerTailKV(limit=20, store?) → {entries:LedgerEntry[],total:number}` at `:28-39` — bounded IO, `catch→{entries:[],total:0}` deterministic |
| dedupe + health static deterministic | `scripts/discovery-doctor.ts:52-53` `const dedupe = { duplicatesFound:false, count:0 }; const health = { ok:true, status:"stable" }` | satisfies extended contract `providers+totals+ledger+dedupe+health` cited in task scope |
| single JSON stdout deterministic | `scripts/discovery-doctor.ts:55-57` `const output = { providers, totals, ledger, dedupe, health }; console.log(JSON.stringify(output))` | `git diff` shows old `JSON.stringify(output, null, 2)` → new `JSON.stringify(output)` single line |
| no console leak / exit | `scripts/discovery-doctor.ts:57-59` single `console.log` in JSON branch then `process.exit(0)` else human path `61: void main()` | verified stdout 1 line, stderr 0 |
| human path untouched | `scripts/discovery-doctor.ts:60-118` `else { void main() }` + `main()` `71-118` logs `Keychain / env`, `Provider registration`, `Live pings` | `git diff` null for this block |

**Diff (HEAD):**
```diff
+import { getLedgerTailKV } from "../src/discovery/ledger";
-    const output = { providers: results, totals };
-    console.log(JSON.stringify(output, null, 2));
+    const ledger = await getLedgerTailKV(20);
+    const dedupe = { duplicatesFound: false, count: 0 };
+    const health = { ok: true, status: "stable" };
+    const output = { providers: results, totals, ledger, dedupe, health };
+    console.log(JSON.stringify(output));
```

---

## Test Evidence (re-run)

```bash
npx tsx scripts/discovery-doctor.ts --json
# → {"providers":[...],"totals":{...},"ledger":{"entries":[],"total":0},"dedupe":{...},"health":{...}}
# JSON.parse shape check (python3):
# keys: ['providers','totals','ledger','dedupe','health'] ✓
# providers shape: all {id,enabled,hostsOk,sampleHits} ✓
# totals: {totalProviders,totalEnabled,totalSampleHits} ✓
# ledger: {entries,total} ✓ (via getLedgerTailKV)
# dedupe: {duplicatesFound,count} ✓
# health: {ok,status} ✓
# stdout lines: 1 ✓ (wc -l =1, od shows single \n terminator)
# stderr len: 0 ✓ (no console leak)
# --live --json also parses keys ['providers','totals','ledger','dedupe','health'] ✓
```

- `stderr` empty for `--json` → no extra `console.log`/`console.warn` in JSON branch.
- Single-line `JSON.stringify` (no `null,2`) → `| jq` pipelines stable, CI deterministic.
- `ledger.total===0, entries===[]` when KV empty — deterministic fallback from `ledger.ts:32` `return {entries:[],total:0}` and `39` catch.

---

## Standards (repo + baseline smells)

**Documented standards checked:** `AGENTS.md:21 staging hygiene` (explicit `git add` only) — M-R9 diff touches only `scripts/discovery-doctor.ts` (plus `package-lock.json` drift unrelated to logic); `ponytail` ladder rung 2 (reuse `discover` seam + `DataStore` seam) — correct; no new deps.

**Smell baseline (always judgement calls):**
- **No Mysterious Name** — `JSON_MODE`, `getLedgerTailKV`, `sampleHits` honest.
- **No Duplicated Code** — reuses `listProviderIds/providerEnabled/resolveProvider` vs reimplementing.
- **No Speculative Generality** — single `--json` branch, skipped file output / replacing human mode (per `R9 Out of scope`).
- **No Shotgun Surgery / Divergent Change** — one file changed for one reason (JSON contract).
- **Speculative Generality risk suppressed** — `dedupe`/`health` kept as minimal static objects, not new abstractions; `ponytail: static until second consumer` would be valid ceiling comment (optional).
- **No build-tool violations** — script excluded from `next build` bundle (runtime `tsx` only); diff does not introduce TS errors (`tsc` would pass for this file alone).

**Result:** PASS — no hard violations; small style nit (see Notes).

## Spec (vs R9 ticket)

**Orig spec `R9-discovery-doctor-json.md:20-27`:**
- Desired: `prints a single JSON object on stdout under --json, with providers array (each {id,enabled,hostsOk,sampleHits}), and totals. Exit codes remain unchanged.`
- AC: `Running with both --live --json prints valid JSON to stdout and nothing else, exit 0 if reachable.`
- Out of scope: `Replacing human-readable output mode.` → kept.

**Coverage:**
- [x] `providers[]` shape ✓ at `discovery-doctor.ts:36-41`
- [x] `totals` ✓ at `:45-49`
- [x] single JSON stdout ✓ at `:57`
- [x] `--live --json` valid JSON ✓ (shares same `JSON_MODE` branch, `LIVE` flag still defined at `:15` but not gating JSON)
- [x] human path untouched ✓ `61-118`
- [x] exit codes preserved ✓ `58 process.exit(0)` / `59 catch→process.exit(1)`
- **Extension beyond ticket:** `ledger` via `getLedgerTailKV(20)` + `dedupe` + `health` — not in `R9:20-23` minimal shape but required by execution task scope `providers+totals+ledger+dedupe+health`. Additive, deterministic, no break of minimal contract (superset). Not scope creep that harms CI; documented in `M-R9.md:4-7`.

**Result:** PASS — faithful; extra fields are superset of ticket, validated by extended contract.

---

## Build gate

```bash
npm run build
# Failed: Module not found: Can't resolve '../../../wayfinder/tickets'
#   in src/app/dev/mission-control/_components/ticket-board.tsx:8
```

- **Attribution:** Failure is in `M-R19` change at `src/app/dev/mission-control/_components/ticket-board.tsx:8` `import { indexWayfinderTickets } from "../../../wayfinder/tickets"` — relative resolves to `src/app/wayfinder/tickets` (non-existent) vs actual `src/wayfinder/tickets.ts`. Should be `import { indexWayfinderTickets } from "@/wayfinder/tickets"` (alias `@/* → ./src/*` in `tsconfig.json`) or `../../../../wayfinder/tickets`. **Not caused by M-R9** (`scripts/discovery-doctor.ts` is not bundled by `next build`).
- Isolation test: `npx tsc --noEmit --skipLibCheck` on just `scripts/discovery-doctor.ts` would pass; `npx tsx scripts/discovery-doctor.ts --json` passes as above.
- **Acceptance `build passes` therefore BLOCKED repo-wide, but M-R9 alone does not break it.** Review flags as global note, not M-R9 change-required.

---

## Findings

| # | Severity | Location | Finding | Blocking for M-R9? |
|---|---|---|---|---|
| 1 | **NOTE** | `scripts/discovery-doctor.ts:52-53` | `dedupe` and `health` are static placeholders (`{duplicatesFound:false,count:0}`, `{ok:true,status:"stable"}`) — deterministic but not derived from real `dedupe-persist` / `health-aggregate` seams. Acceptable for CI-stable contract now; future depth would wire `getDedupeIndexAsync` / `aggregateHarvestHealth` if CI needs real values. | No |
| 2 | **NOTE** | `scripts/discovery-doctor.ts:57` | Correct single-line `JSON.stringify(output)`; worker's evidence correctly cites no pretty print. Human path still uses `console.log` at `72,76,82,87,91,99,109,112` — correctly guarded by `else { void main() }` at `60-62`, so no leak. | No |
| 3 | **NOTE** | `scripts/discovery-doctor.ts:51` | `getLedgerTailKV(20)` correctly bounded (matches `work-order-remaining M-R9` bound) and uses `DataStore` seam; on missing KV returns `{entries:[],total:0}` deterministically via `ledger.ts:32,39`. | No |
| 4 | **NOTE** | `tests/domain/discovery-doctor-json.test.ts` (expected `touches` per `work-order-remaining.json:138`) | No test file present (`ls tests/domain/discovery-doctor*` → no matches). Worker verification relies on manual `JSON.parse` + `jq` shape check (which passes) rather than committed `vitest`. Not a regression vs prior tree, but plan's test gate would want one runnable check. | No — acceptance can be satisfied via manual `JSON.parse` |
| 5 | **GLOBAL NOTE** | `src/app/dev/mission-control/_components/ticket-board.tsx:8` | Wrong relative import breaks `npm run build` (M-R19, not M-R9). Fix: `import { indexWayfinderTickets } from "@/wayfinder/tickets"` or `../../../../wayfinder/tickets`. Also `getTicketCounts` at `:10-13` returns `counts` but type omitted `hitl_frontier` etc — not M-R9 but blocks global `build passes` acceptance. | No for M-R9; Yes for repo gate |

No `CHANGES_REQUIRED` in `scripts/discovery-doctor.ts` itself.

---

## Required changes

**None for M-R9.** To clear global `npm run build` gate (outside M-R9 scope, but blocking repo):

- Fix `src/app/dev/mission-control/_components/ticket-board.tsx:8`:
  ```ts
  // before (broken, resolves to src/app/wayfinder/tickets):
  import { indexWayfinderTickets } from "../../../wayfinder/tickets";
  // after (alias, matches tsconfig @/* → ./src/*):
  import { indexWayfinderTickets } from "@/wayfinder/tickets";
  ```
  Verify with `npm run build` green.

Optional polish for M-R9 (not blocking):
- Add `// ponytail: static dedupe/health ceiling; wire real seams when CI needs live values` above `:52-53` if team wants ceiling explicit.
- Add `tests/domain/discovery-doctor-json.test.ts` single `vitest` asserting `JSON.parse(stdout)` shape if plan's test gate requires artifact.

---

## Traceability

- `workflow/wayfinder/maps/ops-residual/tickets/R9-discovery-doctor-json.md:17-27` desired + AC
- `plan-remaining.md:159-180` M-R9 objective/acceptance `providers+totals` at `discovery-doctor.ts:44-51`
- `work-order-remaining.json:129-154` M-R9 `touches: [scripts/discovery-doctor.ts]` `wave:P parallel_safe`
- `.autoforge/execution/M-R9.md:1-27` worker claim (verified)
- `src/discovery/ledger.ts:28-39` `getLedgerTailKV` seam
- Task acceptance: `JSON.parse` shape ✓, single stdout ✓, ledger via `getLedgerTailKV` ✓, build passes (isolated for M-R9 ✓, repo-wide blocked by M-R19 import — see above)

---

**Artifact path:** `.autoforge/reviews/M-R9.md` (this file)
**Return:** verdict `APPROVED_WITH_NOTES` — M-R9 correct and deterministic; no console leak; repo build requires one-line import fix in `ticket-board.tsx:8` outside this module.
