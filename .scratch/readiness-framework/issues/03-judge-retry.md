# 03 — Judge transport-flake auto-retry

Type: task · Status: resolved · Blocked by: —

## Question

Judge calls intermittently fail (HTTP 503 / abort), scattering `unscored` baselines
across archives; today needed three full runs to get one clean archive. Add capped
per-finding retry with jitter inside run-eval.ts (e.g., 3 attempts), and a final
`--topup` mode that re-judges only unscored findings of a named archive into it,
preserving determinism of already-scored results. Unscored still never fails the mark.

Answer records: retry/topup landed, a previously-flaky run completed fully-scored in one
invocation (or documented topup usage), no threshold semantics touched.

## Answer


## Answer

RESOLVED 2026-08-25. Two mechanisms landed in scripts/run-eval.ts:
1. **In-run retry**: judgeFinding now attempts 4× with exponential backoff (2s/4s/8s) on
   transport-class errors (HTTP 5xx / abort / network), keeping the existing shape-retry
   semantics for rubric-shape failures.
2. **--topup <runId>**: re-judges ONLY unscored findings of an archive into a sibling
   `<runId>-completed` dir with manifest.json; scored verdicts carried over verbatim,
   original archives never mutated (provenance discipline preserved).

Proven live: `--topup 2026-08-25T06-49-33-605Z` completed GF-14 in place; final clean run
`2026-08-25T07-34-03-343Z` needed no topup — retry alone absorbed the night's flake storm.
No threshold semantics touched; validation-state scope string fixed to GF-6..16.
