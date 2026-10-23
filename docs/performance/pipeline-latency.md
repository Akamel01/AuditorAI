# Per-stage pipeline latency (G-14)

- Run id: `g14-local-2026-10-23T00:49:05.232Z`
- Fixture (named run): `gf2-usa-rural-highway-prelim.json` (USA rural highway, preliminary design)
- Sample size: 1000 synchronous batch runs per stage
- Method: each run executes all 13 AG nodes via DefaultAuditPipeline.runAllArtifacts;
  per-node wall-clock duration captured with performance.now(); p50/p95 computed as
  nearest-rank over the N samples. Deterministic input; no I/O, no AI (adapter off).
- Reproduce: `npx tsx scripts/measure-pipeline-latency.ts`

| Stage (AG node) | p50 (ms) | p95 (ms) | n |
|---|---:|---:|---:|
| AG-PROJECT | 0.000 | 0.001 | 1000 |
| AG-STAGE-SELECT | 0.001 | 0.001 | 1000 |
| AG-MANIFEST | 0.001 | 0.002 | 1000 |
| AG-RULES | 0.001 | 0.001 | 1000 |
| AG-FINDINGS | 0.000 | 0.001 | 1000 |
| AG-QUESTIONS | 0.001 | 0.002 | 1000 |
| AG-AI-CANDIDATES | 0.000 | 0.001 | 1000 |
| AG-HALLUCINATION-CHECK | 0.000 | 0.001 | 1000 |
| AG-EVIDENCE-USE-AUDIT | 0.000 | 0.001 | 1000 |
| AG-ADJUDICATION | 0.000 | 0.001 | 1000 |
| AG-EVIDENCE-LINKS | 0.001 | 0.002 | 1000 |
| AG-REPORT | 0.005 | 0.009 | 1000 |
