# Per-stage pipeline latency (G-14)

- Run id: `g14-78b1031-2026-10-23T00-54-41-857Z`
- Git SHA: `78b103134300eb61804a3dee96d92f1000fa3106`
- Fixture (named run): `gf2-usa-rural-highway-prelim.json` (USA rural highway, preliminary design)
- Node version: `v22.23.4`
- Warm sample size: 1000 back-to-back in-process runs per stage
- Cold sample size: 30 new Node processes, one audit each
- Method: warm runs execute all 13 AG nodes via DefaultAuditPipeline.runAllArtifacts;
  per-node wall-clock duration captured with performance.now(); p50/p95 computed as
  nearest-rank over the N samples. Cold runs hit POST /api/projects/[id]/audits with the
  legacy in-memory store (storage + serialisation included). AI adapter is off by
  default in production, so no live inference occurs in either measurement.
- Raw samples: `docs/performance/runs/g14-78b1031-2026-10-23T00-54-41-857Z.json`
- Reproduce: `npx tsx scripts/measure-pipeline-latency.ts` (re-render: `--from <file>`)

## Warm in-process

| Stage (AG node) | p50 (ms) | p95 (ms) | n |
|---|---:|---:|---:|
| AG-PROJECT | 0.000 | 0.001 | 1000 |
| AG-STAGE-SELECT | 0.001 | 0.001 | 1000 |
| AG-MANIFEST | 0.001 | 0.002 | 1000 |
| AG-RULES | 0.001 | 0.001 | 1000 |
| AG-FINDINGS | 0.000 | 0.001 | 1000 |
| AG-QUESTIONS | 0.001 | 0.002 | 1000 |
| AG-AI-CANDIDATES | 0.001 | 0.001 | 1000 |
| AG-HALLUCINATION-CHECK | 0.000 | 0.001 | 1000 |
| AG-EVIDENCE-USE-AUDIT | 0.000 | 0.001 | 1000 |
| AG-ADJUDICATION | 0.000 | 0.001 | 1000 |
| AG-EVIDENCE-LINKS | 0.001 | 0.002 | 1000 |
| AG-REPORT | 0.005 | 0.009 | 1000 |
| AG-PERSIST | 0.000 | 0.000 | 1000 |

## Cold per-request (total)

- p50: 13.892 ms
- p95: 16.370 ms
- n: 30

## Cold per-stage

| Stage (AG node) | p50 (ms) | p95 (ms) | n |
|---|---:|---:|---:|
| AG-PROJECT | 0.096 | 0.111 | 30 |
| AG-STAGE-SELECT | 10.937 | 13.127 | 30 |
| AG-MANIFEST | 0.083 | 0.095 | 30 |
| AG-RULES | 0.070 | 0.077 | 30 |
| AG-FINDINGS | 0.018 | 0.020 | 30 |
| AG-QUESTIONS | 0.042 | 0.054 | 30 |
| AG-AI-CANDIDATES | 0.021 | 0.024 | 30 |
| AG-HALLUCINATION-CHECK | 0.037 | 0.043 | 30 |
| AG-EVIDENCE-USE-AUDIT | 0.030 | 0.035 | 30 |
| AG-ADJUDICATION | 0.092 | 0.101 | 30 |
| AG-EVIDENCE-LINKS | 0.066 | 0.073 | 30 |
| AG-REPORT | 0.310 | 0.352 | 30 |
| AG-PERSIST | 0.000 | 0.000 | 30 |
