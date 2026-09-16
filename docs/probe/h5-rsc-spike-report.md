# H5 loading-UX probe — RSC spike report (baseline, no spike yet)

Probe-only. No `src/` edits. Targets P1–P5 are PROPOSED (owner confirms numbers).

## Method

- Collector: `scripts/probe/h5-measure.mjs` (Playwright, read-only — GETs only,
  zero non-GET requests observed). Routes: audit page (sentinel IDs
  `/projects/probe-nonexistent/audits/probe-nonexistent`, renders Skeleton then
  read-only 404 notice) + `/dev/mission-control`.
- Conditions: N=20 per route (10 cold fresh-context + 10 warm reload),
  Fast-3G (1.6 Mbps / 768 Kbps / 150 ms RTT) + 4x CPU throttle.
- Build: local `npm run start` production build, 2026-09-15.
  Artifact: `docs/probe/h5-baseline.json`.
- Comparator: `scripts/probe/h5-compare.mjs` — baseline-vs-baseline exits 0,
  `RESULT: SELF-CONSISTENT (clean)`, 0 diverged URLs.
- E2E: `tests/e2e/probe-h5-loading.spec.ts`, `tests/e2e/probe-h5-divergence.spec.ts`
  (`@probe`, self-skip unless `PROBE_H5=1`; default `npx playwright test` shows
  4 skipped; `PROBE_H5=1` run: 4 passed).

## Baseline numbers (M1–M7)

| metric | audit p50 | audit p95 | mission-control p50 | mission-control p95 |
|---|---|---|---|---|
| M1 first-skeleton (ms) | 995 | 1040 | 1000 | 1060 |
| M3 complete (ms) | 2335 | 2381 | 2126 | 2223 |
| M4 TTFB (ms) | 5 | 14 | 3 | 6 |
| M4 LCP (ms) | 808 | 832 | 816 | 2148 |
| M5 CLS | 0 | 0 | 0 | 0 |
| M6 doc bytes | 12197 | 12197 | 14118 | 14118 |
| M7 doc SHA-256 (distinct across 20 iters) | 1 (`5f1ae175…`) | — | 1 (`659cf658…`) | — |

Notes:

- M1 ≈ 1 s is hydration-bound under 4x CPU + Fast-3G: first skeleton needs JS.
  Unthrottled `@probe` e2e settles the same pages in ~700 ms.
- M4 LCP on mission-control is bimodal (p50 816, p95 2148): late paint after
  admin-gated fetches resolve on some iters. Watch post-spike.
- M5 CLS = 0 both routes (static skeleton, no shifts).
- M6 server text (tags/scripts stripped): audit 161 chars, mission-control
  438 chars — shell chrome only, ~0 meaningful content (client-rendered).
  Doc bytes (12–14 KB) are the JS shell, not content.
- M7: 1 distinct doc hash per route across all 20 iters; comparator reports
  0 diverged sub-resource URLs. Mutations issued: none.

## P1–P5 vs baseline (PROPOSED targets)

| target | verdict | evidence |
|---|---|---|
| P1 100% skeleton zones | PASS | skeleton/loading observed 20/20 iters both routes; settled 20/20 |
| P2 first-skeleton p50 ≤ 300 ms | FAIL (baseline) | 995 / 1000 ms throttled; spike must cut ~70% |
| P3 complete ≤ 3.0 s / 2.5 s or −10% | PASS | p50 2335/2126 ms, p95 2381/2223 ms — inside both caps throttled |
| P4 TTFB/LCP ≤ +10%; ≥ 2 KB server text where baseline ~0 | BASELINE ONLY (no spike exists) | TTFB p50 5/3 ms, LCP p50 808/816 ms recorded as guardrail anchors; server text 161/438 chars confirms ~0 |
| P5 zero hash divergence | PASS | 1 distinct hash/route; self-compare clean, exit 0 |

## For the future spike

Re-run `h5-measure.mjs --out docs/probe/h5-spike.json`, then
`h5-compare.mjs --before docs/probe/h5-baseline.json --after docs/probe/h5-spike.json`.
Guardrails: TTFB/LCP p50 within +10%, P5 zero divergence, P4 ≥ 2 KB server text.
