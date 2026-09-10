# Review: M-H13-GATES — wire lint gate into pre-commit and CI

Verdict: **APPROVED_WITH_NOTES**

Scope (read-only): `.githooks/pre-commit`, `.github/workflows/ci.yml`,
`.autoforge/execution/M-H13-GATES.md`, plus contract source
`scripts/wayfinder-tickets.ts` and spec source `.autoforge/architecture/H13.md`
§3.5. No shell commands run; no source/test/config edited.

Contract (H13 §3.5, `.autoforge/architecture/H13.md:70-73`): wire
`npx tsx scripts/wayfinder-tickets.ts --lint` into pre-commit beside `lint`
(fastest-fail ordering per `:7` comment; precedent harvest-verify `--mock`)
AND `ci.yml` quality job after `npm run lint` (`ci.yml:74`) — defense in
depth, no new job, same seam both places.

## Findings

| # | Check | Result | Evidence (verbatim, current file) |
|---|---|---|---|
| 1 | Pre-commit gate present, correct command | PASS | `.githooks/pre-commit:17` — `npx tsx scripts/wayfinder-tickets.ts --lint` (identical string to CI step and to H13 §3.5 spec) |
| 2 | Pre-commit placement beside lint, fastest-fail ordering | PASS | `.githooks/pre-commit:7` — `# 1) lint (fastest, catches unused vars like _ and HARVEST_LOCK_KEY)` then `.githooks/pre-commit:15` — `# 1.5) lint gate (M-H13-GATES) — ensure lint tickets pass static lint gate`, ahead of `.githooks/pre-commit:23` — `# 2) typecheck (catches API wiring before push)`. Lint → lint-gate → typecheck → vault → YAML → harvest-verify preserves fastest-first. |
| 3 | Guarded form — exit propagates (blocks commit on fail, no silent swallow under `set -e`) | PASS | `.githooks/pre-commit:5` — `set -e` plus `.githooks/pre-commit:17-21`: `npx tsx scripts/wayfinder-tickets.ts --lint` / `if [ $? -ne 0 ]; then` / `echo "[pre-commit] FAIL lint gate — invalid tickets found"` / `exit 1` / `fi`. A non-zero lint exit aborts the hook (via `set -e` even before the `if`), so the gate cannot silently pass. Structurally identical to precedent `.githooks/pre-commit:55-59` (`node scripts/harvest-verify.mjs --mock >/dev/null 2>&1` + same `if [ $? -ne 0 ]` shape). |
| 4 | CI gate present, correct placement after `npm run lint` | PASS | `.github/workflows/ci.yml:74` — `- run: npm run lint` followed by `.github/workflows/ci.yml:75-76` — `- name: gate lint via wayfinder (lint gate)` / `run: npx tsx scripts/wayfinder-tickets.ts --lint`, ahead of `.github/workflows/ci.yml:77` — `- run: npm run typecheck`. Same command as pre-commit; no new job, as specced. |
| 5 | CI YAML structure valid, `name:` quoting | PASS | `.github/workflows/ci.yml:1` — `name: ci` (no `:` in value, no quotes needed); `.github/workflows/ci.yml:75` — `- name: gate lint via wayfinder (lint gate)` (parens, no colon, no quotes needed — consistent with existing `name: shared-state validation`, `name: lint / typecheck / test / build`). Indentation (6-sp `-`, 8-sp `run:`) matches sibling steps. No unquoted `Gate:` value introduced anywhere in file. |
| 6 | Gate contract exists — `--lint` flag with 0/1/2 semantics | PASS | `scripts/wayfinder-tickets.ts:23` — `const lint = argv.includes("--lint");`, `:30-38` — `if (Array.isArray(skipped) && skipped.length > 0)` → per-file `console.error` + `process.exit(1)` else `process.exit(0)`, `:40-41` — `catch { process.exit(2); }`. Matches execution doc claim (`M-H13-GATES.md:14` — "return code must be 0 for a clean tree; non-zero should fail") and H13 exit-code spec (0 clean / 1 invalid / 2 usage-IO). |
| 7 | Forbidden token check | PASS | None of the three scoped files contains the literal skip-ci token in brackets. `M-H13-GATES.md:31` uses `--no-verify` in a "how to verify" example (see Note N3), but no CI-skip token string appears in `pre-commit`, `ci.yml`, or `M-H13-GATES.md`. |
| 8 | Execution-doc fidelity (quotes match current files) | PASS | `M-H13-GATES.md:18-23` reproduces the pre-commit block verbatim; `M-H13-GATES.md:25-26` reproduces the CI step verbatim. `M-H13-GATES.md:37` scope claim ("isolated to the two gate files") holds — no test tickets added/mutated in scope. |

## Notes (non-blocking, no changes required)

- **N1 — `set -e` vs `if [ $? ]` message nuance (pre-existing pattern, faithfully replicated).**
  Under `set -e`, a failing standalone `npx tsx …` aborts the hook before the
  following `if [ $? -ne 0 ]` runs, so the custom `FAIL lint gate` echo is
  unreachable on the failure path — but the abort itself is non-zero, so the
  commit is still blocked. This is true of every block in the file
  (lint `:9-13`, typecheck `:25-29`, YAML `:47-51`, harvest-verify `:55-59`),
  and B3 explicitly required the 5-line precedent form, which the worker
  reproduced exactly. The `if ! cmd; then … fi` form would make the message
  reachable, but changing it is out of scope here (it would rewrite all six
  blocks, not just the new gate). Recorded for awareness only.
- **N2 — Minor intentional deviations, both benign.**
  (a) New pre-commit gate omits `>/dev/null 2>&1` (precedent harvest-verify
  silences; lint/typecheck blocks also don't silence). For a lint gate this is
  arguably correct — the `file: reason` stderr lines are the debuggability.
  (b) CI step is `name:` + `run:` (two lines) rather than a bare one-line
  `- run:`; matches house style of sibling steps (`ci.yml:32-33`, `:49-50`)
  and the "one step" intent. (c) `# 1.5)` numbering preserves ordering without
  renumbering — minimal diff, fine.
- **N3 — Worker evidence gap (process, not code).**
  `M-H13-GATES.md:28-34` ("How to verify locally") lists manual steps but
  records no actual run output, and the `:31` example (`git commit …
  --no-verify`) bypasses the very hook under review, so it cannot evidence the
  gate. Acceptance here rests instead on read-only contract proof: the invoked
  flag exists with the claimed exit semantics (Finding 6), both call sites use
  the identical command string (Findings 1, 4), and failure propagates by
  construction (`set -e` locally per Finding 3; step failure semantics in CI).
  Recommend future gate tickets attach at least the `--lint` exit code on a
  clean tree; not a reason to rework this change.

## Required changes

None.
