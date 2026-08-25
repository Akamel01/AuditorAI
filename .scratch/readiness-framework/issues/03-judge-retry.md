# 03 — Judge transport-flake auto-retry

Type: task · Status: open · Blocked by: —

## Question

Judge calls intermittently fail (HTTP 503 / abort), scattering `unscored` baselines
across archives; today needed three full runs to get one clean archive. Add capped
per-finding retry with jitter inside run-eval.ts (e.g., 3 attempts), and a final
`--topup` mode that re-judges only unscored findings of a named archive into it,
preserving determinism of already-scored results. Unscored still never fails the mark.

Answer records: retry/topup landed, a previously-flaky run completed fully-scored in one
invocation (or documented topup usage), no threshold semantics touched.

## Answer

