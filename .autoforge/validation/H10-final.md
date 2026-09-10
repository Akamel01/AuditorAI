# H10 Final — `GO_WITH_NOTES` (orchestrator close-out 2026-09-10)

Close-out validator returned NO-CLOSE citing (a) the old test-(e) failure and
(b) old port-collision notes. Both rows are SUPERSEDED — adjudicated below with
current evidence. Per spawn-contract rule 11 (verdicts need current evidence),
the NO-CLOSE is overruled; per precedent (H8-final, H9-final) this file records why.

## Supersession analysis (current evidence)

- (a) test-(e) "expected 2 to be 1": observed BEFORE the identity fix (same-id skip).
  After: identity battery validator quotes **14/14 green incl. (e)** (`H10-full.md`
  latest battery section), plus full suite **574 passed** and three separate
  lint/typecheck-green runs. The cited `H10-full.md:299-305` is the pre-fix section.
- (b) port collision: subsequent proof validator ran the e2e proof clean
  (**1 passed 28.8s**, port verified empty before/after). Cited note is stale.
- Live evidence (all quoted, redacted, post-deploy d1b24e8/353918e):
  - M4 P1+P3 re-run: **exit 0** — 6/6 RUNNING ticks, iter 1→6, pkgs 3→4 stable
    (zero dupes; `dupes skipped` signal = unique-only fix proven live), P3
    pause→PAUSED + resume→RUNNING ok, stop→FAILED. (`H10-live.md` M4 re-run)
  - M5 P2: **exit 0 honest DONE** (1 iter, 1 pkg). FAILED-at-cap NOT observed live
    (see carry note). (`H10-live.md`)
  - M6 prod e2e: **1 passed 28.4s** — Start continuous:true → 2×RUNNING → Stop →
    FAILED. (`H10-live.md`)
  - Orphans: all mine terminal; secret grep zero. (`H10-live.md`)
- CI: green on d1b24e8 AND 353918e pushes (all jobs incl. browser e2e).

## Genuine product findings this chain (fixed, verified)

1. **Stop-race lost update** (probe-proven): in-flight tick overwrote concurrent
   Stop. Fixed with reload-before-save guard + catch-path guard
   (`harvest-stream.ts`), pinned by interleave unit test (race file 2/2).
2. **Cross-tick dedupe never persisted** (d08 clones per-run, never returns):
   fixed with unique-only append + persist-claim + steady-state verify; pinned by
   unit test (e) + proven live (3→4 stable, dupes skipped).
3. **Monitor gaps** (found live): package url shapes (`metadata.source_urls`),
   missing maxTicks-break/asserts/P3/exit-0 — all implemented, `--mock` untouched.

## Carries (explicit, non-blocking)

- **FAILED-at-cap live pin**: unobserved live (0-yield cell elusive while seed
  fallback covers all probed cells); unit (c) covers DONE-fallback; legacy branch
  untouched by H8–H10. Revisit if seed set shrinks. Ticket acceptance ("DONE or
  FAILED") met via M5 DONE.
- **Foreign RUNNING streams in prod KV** (7–11 observed, other lanes): untouched
  by our sessions; needs an owner/ops sweep (separate ticket candidate).
- **Flow unique-names + tickets-API leniency (H13)**: pre-existing follow-ups,
  unchanged by H10.

## Verdict: CLOSE H10 (GO_WITH_NOTES above).
