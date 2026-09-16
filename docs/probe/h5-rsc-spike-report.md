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

## Round 2 — RSC spike (2026-09-16, NOT landed)

Spike (uncommitted, isolated): `src/app/probe/rsc-snapshot/page.tsx`
(`force-static` Server Component, deterministic static snapshot ≈ 2.4 KB
server text) + `src/app/probe/rsc-snapshot/harness.tsx` (client harness,
read-only: `loadWorkspace` sentinel GETs via `api`, skeleton → 404 notice).
Zero edits outside `src/app/probe/**`, `docs/probe/**`. Forbidden files
(`audits/[auditId]/page.tsx`, mission-control, `audit-workspace.ts`,
`client.ts`, pipeline/Repository) read but untouched.

Method: local `npm run build` + `npm run start`, same N=20 (10 cold +
10 warm) Fast-3G + 4x CPU. Collector = committed `h5-measure.mjs` with only
the ROUTES entry repointed (`audit` → `/probe/rsc-snapshot`; key kept so
`h5-compare.mjs` diffs mechanically, actual URL in artifact `path` field).
Artifact: `docs/probe/h5-spike.json`.

| metric (audit p50 / p95) | baseline | spike | Δ |
|---|---|---|---|
| M1 first-skeleton (ms) | 995 / 1040 | 1005 / 1027 | +1% / −1.3% |
| M3 complete (ms) | 2335 / 2381 | 2256 / 2267 | −3.4% / −4.8% |
| M4 TTFB (ms) | 5 / 14 | 3 / 7 | −40% / −50% |
| M4 LCP (ms) | 808 / 832 | 808 / 824 | 0% / −1% |
| M5 CLS | 0 / 0 | 0 / 0 | — |
| M6 doc bytes | 12197 | 20931 (+71%) | — |
| M7 doc hashes (20 iters) | 1 | 1 | — |
| settled / mutations | 20/20, none | 20/20, none | — |
| server text (tags/scripts stripped) | 161 chars | 2404 chars | — |

`h5-compare.mjs` exits 1: NO guardrail breach (TTFB/LCP within +10%), but
14 hash-∅ lines (route-specific URLs present on one side only — different
pages load different chunks) + doc-hash set change (by design: new server
text) + `mission-control MISSING` (spike targets the audit pattern only).
P5-relevant: 10/10 shared sub-resource URLs byte-identical vs baseline;
spike self-consistent (1 doc hash, 0 mutations).

P2 root cause (diags, N=4 each, throwaway collector copies, no src edits):
skeleton DOM genuinely absent until ~1 s even with `state: attached` +
50 ms interval polling (1003–1008 ms) — not an rAF-observation artifact.
Doc +71% moved M1 +1% / LCP 0%: size is not the lever. First skeleton is
gated by the shared shell on 1.6 Mbps — 86 KB render-blocking CSS +
347 KB JS + 147 KB font preloads contending — not by skeleton placement.

## P1–P5 vs spike (owner-confirmed targets)

| target | verdict | evidence |
|---|---|---|
| P1 100% skeleton zones | PASS | m1 n=20/20, settled 20/20 |
| P2 first-skeleton p50 ≤ 300 ms | FAIL | 1005 ms (+1% vs baseline); shell-bound, see root cause above |
| P3 complete ≤ 3.0 s / 2.5 s or −10% | PASS (via caps) | p50 2256 ms, p95 2267 ms — inside both caps; −3.4% (not −10%) |
| P4 TTFB/LCP ≤ +10%; ≥ 2 KB server text | PASS | TTFB 3 ms, LCP 808 ms, no guardrail breach; 2404 chars server text |
| P5 zero hash divergence | PASS | 1 doc hash/20 iters, 0 mutations, 10/10 shared URLs identical; compare exit 1 is route-set difference by design |

Recommendation: CLOSE without landing. P2 — the spike's raison d'être
(−70% needed) — is unmoved: +9 KB of server text buys no measurable
loading gain under probe conditions, and landing would add a parallel
snapshot surface with Repository-drift risk (F3 fog stands). If P2 ≤ 300 ms
is still wanted, the next lever is shell weight (render-blocking CSS, JS,
font preloads) — production-`src` work needing its own risk acceptance;
re-spike only with that scope. Spike files left uncommitted for owner
inspection; safe to delete (`src/app/probe/`, `docs/probe/h5-spike.json`).
