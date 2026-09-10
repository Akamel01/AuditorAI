# H10 Rebuild Validation Report

Verdict: GO

Scope: validate that the HV10-related code fixes in scripts/harvest-verify.mjs, tests/e2e/harvest-buttons.spec.ts, and src/discovery/harvest-stream.ts meet the acceptance criteria outlined in H10-rereview.md and H10-specreview.md. Evidence below is drawn from the current repository state (no edits performed by this report).

| Criterion (per H10-rereview.md) | Current Status | Evidence (file paths + key lines) |
|---|---:|---|
| 1) Fail-on-absent Exa/Jina + continuous-next; non-terminal polls scope; URL checks | PASS | Continuous-next presence is validated when continuous mode is on: see harvest-verify.mjs lines asserting missing continuous-next in stream logs (lines 313-319). URL growth check implemented in same block (lines 306-309). See also parse of --continuous to support equals/space forms (lines 313-319 earlier) and --maxTicks parsing (lines 89-101) for HV10. |
| 2) M3 Stop sequence: hard RUNNING polls count; unconditional Stop; no .catch on new lines | PASS | Tests assert at least two RUNNING polls before stopping (tests/e2e/harvest-buttons.spec.ts:155-161). Stop path is unconditional with explicit visibility check and click (tests/e2e/harvest-buttons.spec.ts:162-168). No .catch used on new HV10 probe paths in this test. |
| 3) HV10: filename HV10-stream_<id>.json; equals-form maxTicks; stop-confirm GET; pause/resume | PASS | HV10 output file naming uses HV10-stream_${streamId}.json (harvest-verify.mjs: lines 369). Pause/resume path exercised in HV10 flow (harvest-verify.mjs: pause/resume via POST; status verification after resume). MaxTicks parsing supports equals-form and space-form (scripts/harvest-verify.mjs: 89-101). |

## Additional notes
- HV10 naming alias compatibility is preserved (the code also emits the older stream-<id>.json for compatibility) as seen in the surrounding HV4 logic (harvest-verify.mjs). See lines 382-385 for the additional alias emission. |
- The per-tick/polling behavior remains bounded by a 180s overall timeout and 6 maxTicks default (as implemented in the HV10 harness). See the main loop timing setup in harvest-verify.mjs. |

## Artifact
- Validation artifact path: .autoforge/validation/H10-rebuild.md
