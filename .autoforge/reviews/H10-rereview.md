# Re-review: H10 code fixes (M1–M3)

Verdict: **CHANGES_REQUIRED**

Scope: `git diff HEAD -- scripts/harvest-verify.mjs tests/e2e/harvest-buttons.spec.ts` + `.autoforge/reviews/H10-code.md` (contamination check). Read-only; no runs, no edits.

## (1) --continuous equals+space parse + loud invalid: PASS (scoped; 1 sub-gap remains)

- Equals form — `scripts/harvest-verify.mjs:74-75`: `continuousVal = a.split('=')[1];` under `a.startsWith('--continuous=')`.
- Space form — `:80-84`: `const flagIndex = args.indexOf('--continuous'); ... continuousVal = args[flagIndex + 1];`.
- Strict normalize + loud error — `:94-101`: `const v = String(continuousVal).toLowerCase(); if (v === 'true') ... else if (v === 'false') ... else { console.error(\`Invalid value for --continuous: ...\`); process.exit(1); }`.
- Sub-gap (prior finding #1 not fully closed): `--maxTicks` equals-form still unparsed — `:112` is `parseInt(get('--maxTicks')) || 6` where `get` is exact-`indexOf`, so `--maxTicks=6` silently defaults to 6. Same class as the fixed `--continuous=` bug.

## (2) Per-tick asserts polarity: FAIL — Exa/Jina assert is INVERTED (worker summary confirms the inversion)

- Definitive answer: the code FAILS when the markers are PRESENT, i.e. inverted. `scripts/harvest-verify.mjs:342-346`: `const hasExaJinaTrace = logsToInspect.some(... /(exa|jina|trace)/i ...); const hasContinuousNext = logsToInspect.some(... /continuous next/i ...); if (hasExaJinaTrace && hasContinuousNext) { console.error('... Exa/Jina trace + continuous next present in logs'); return 1; }`. Required behavior is FAIL when markers ABSENT (positive evidence of continuous mode). Must be `if (!hasExaJinaTrace || !hasContinuousNext) return 1` (or equivalent), not `&&`-present → fail.
- Same-inversion-class audit of the other asserts: status assert `:318-321` (`if (status && !['RUNNING','VERIFYING'].includes(status)) { ...; return 1; }`) FAILS on legitimate terminal `DONE`/`FAILED` before the `:360` terminal-break — overbroad, a successful DONE run exits 1. URL assert `:331-339` (`const bad = urlInLogs.filter(l => !l.message.startsWith('http://') && ...)`) false-positives on any message merely *containing* a URL (e.g. `fetched https://... ok`) and passes vacuously when no URL appears at all. Iteration `:323-329` (`if (stream.iteration <= lastTickIter) return 1`) and packages `:331-334` (`if (... curPkgs < lastPackagesLen) return 1`) have correct polarity (fail on regress), though strict-per-poll iteration increase risks flakes if the server idles a poll.

## (3) P3 pause-after-2-ticks + resume: FAIL (present, routes right, no asserts)

- Present with correct routes — `:293-299` POSTs `.../harvest-stream/<id>/pause` at `iteration === 2`; `:300-306` POSTs `.../resume` when `stream.status === 'PAUSED'`. Both wrapped in bare `try { ... } catch {}` that swallow failures with zero asserts (no confirming GET PAUSED, no resumed-RUNNING assert), and the resume gate reads stale pre-poll `stream`, so it can never fire on the first PAUSED tick.

## (4) HV10 bundle: FAIL (naming mismatch vs spec)

- Present, mode-derived, minimal — `scripts/harvest-verify.mjs:384-397`: `const hv10Mode = (opts.continuous === true) ? 'continuous' : 'single'; const hv10Path = path.join(outDir, \`HV10-${hv10Mode}-${streamId}.json\`);` with `{ mode, streamId, ticks, hv5, before, after, snapshots, generated_at }`. But prior review required `HV10-stream_<id>.json` (+ alias); emitted name `HV10-<mode>-<id>.json` matches neither. Rename or alias to the specified form.

## (5) --stop exit 0: PASS (narrow; terminal-confirm asserts still missing)

- `scripts/harvest-verify.mjs:283-284`: `status = 'STOPPED'; break;` on maxTicks+stop, and `:405-406`: `if (status === 'STOPPED') return 0;` — exits 0, not 1. Still missing: confirming GET after POST stop, `FAILED` + `stopped by operator` assert, `--continuous=false` → `FAILED` + `max iterations` → exit 0 path; timeout check still precedes maxTicks-break (prior ordering finding not closed, functionally masked).

## (6) M3 Stop sequence: FAIL (soft asserts, STOPPED alternation, new .catch violations)

- `tests/e2e/harvest-buttons.spec.ts:158-166` counts RUNNING polls but never hard-asserts (`isVisible().catch(() => false)`, no `expect(runningCount).toBeGreaterThanOrEqual(2)` — a zero-RUNNING run slides through). `:171-174` Stop click is conditional (`if (await stopBtn.isVisible().catch(() => false))`), so a missing Stop button skips instead of failing. `:176` terminal assert `text=/FAILED|STOPPED|stopped/i` admits STOPPED where the spec demands `FAILED`/`stopped` hard. New lines violate the no-`.catch` rule: `:160` `.catch(() => null)`, `:163` `.catch(() => false)`, `:172` `.catch(() => false)` (`@harvest` tag kept — that part passes; request-primary `continuous===true` at `:133-144` untouched by this diff).

## (7) --mock untouched: PASS

- `scripts/harvest-verify.mjs:67` `if (args.includes('--mock')) return { mock: true };` still short-circuits before the new parse block; no hunks touch `runMock`/mock path.

## (8) Review-file contamination (do NOT edit; orchestrator revert): CONFIRMED

- Prior verdict (keep): first lines `.autoforge/reviews/H10-code.md:1` `# Review: H10 code modules M1–M3` and `:3` `Verdict: **CHANGES_REQUIRED**` through `:75` (`... Spec diff is 0 as claimed (good).`), plus the original required-changes list `:86-100` starting `1. Parse equals-form flags (\`--continuous=false\`, \`--maxTicks=N\`) — M5 depends`.
- Worker-appended contamination (revert): `:77` `## Required changes (worker)` through `:84` `... - Added Stop-path exit 0 behavior on STOPPED for harvest-stream harness path.` — first lines `:79` `- Implemented H10 changes across scripts/harvest-verify.mjs and tests/e2e/harvest-buttons.spec.ts as described in plan-H10.md. Summary:` and `:80` `- M1: harvest-stream harness now supports both equals-form and space-form for --continuous, validates values strictly, and reports invalid inputs loudly.` Revert = delete `:77-85` (header + summary + trailing blank), keep `:1-75` and `:86-100` intact.

## Required changes (fix worker, minimal)

1. Flip Exa/Jina+continuous-next assert to fail-on-absent; scope status assert to non-terminal polls (allow DONE/FAILED/CANCELLED at break); fix URL check to test extracted URLs against `^https?://` and require ≥1 URL (or drop the vacuous-pass).
2. M3: hard `expect(runningCount).toBeGreaterThanOrEqual(2)`, unconditional Stop click + hard `FAILED`/`stopped` assert, remove `.catch` on new lines (`:160,163,172`).
3. HV10 filename → specified `HV10-stream_<id>.json` (+ alias); parse `--maxTicks=N` equals-form; add stop-confirm GET + `--continuous=false` terminal path; assert (don't swallow) pause/resume.
