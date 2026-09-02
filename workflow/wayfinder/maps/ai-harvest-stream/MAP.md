---
map: ai-harvest-stream
label: wayfinder:map
created: 2026-09-02
---

## Destination

AuditorAI runs a **continuous AI harvesting stream** alongside `seed-portals` and `brave-search` — powered by `opencode/gpt-5-nano` with web search, orchestrated through a **structured workflow** that never stops until results are **verified** (coverage, provenance, quality gates). The stream is fully **controllable, observable, and visualizable** from the developer-only UI (`/dev/mission-control`): start, pause, stop, resume, monitor, operate, and inspect every web-search call, hit, qualification, and package as it happens. Results are tested via fixtures, samples, and live verification before any packaging is considered done.

## Notes

- Skills every session should consult: `grilling` + `domain-modeling` for decisions, `codebase-design` vocabulary (Module/Interface/Depth/Seam/Adapter/Leverage/Locality) for structural work.
- Model policy: `opencode/gpt-5-nano` (400k window, 80k cap) is the harvesting model per `model-policy.yaml` — workers for this map inherit that pin; architect/planner inherit orchestrator for reasoning. Web search is via the model's browsing capability, not `brave-search` API.
- Structured workflow: harvesting is a state machine `IDLE → RUNNING → PAUSED → VERIFYING → DONE|FAILED`, with verification loop `RUNNING → VERIFYING → RUNNING` until coverage/quality thresholds are met or owner stops. Verification is deterministic-first: `checkDuplicate`, `computeCoverage`, `quality_score`, `provenance` must all pass.
- Control + observability: a single `HarvestStream` seam owns lifecycle (`start/pause/resume/stop`), persistence via `DataStore` + `KvRestStore`, and telemetry (hits, qualified, matched, acquired, packages, queue, dedupe, ledger). UI polls the stream, not the job.
- Ponytail ladder: reuse existing `DataStore`/`DiscoveryJob`/`Ledger`/`Dedupe` seams, stdlib, smallest diff; no new deps; `ponytail:` ceilings where single-writer or global polling is kept.
- Vault determinism: `node scripts/vault-sync.mjs --check` before any commit touching `state/**`; `cmp -s` evidence twins.
- Testing doctrine: every harvest path is proven via (a) fixtures (`tests/fixtures/samples`, `tests/domain/discovery-harvest.test.ts` MemoryStore), (b) samples (`docs/references/sample-drawing-corpus.md` PD corpus), and (c) live verification (real `gpt-5-nano` web search against a tiny jurisdiction, e.g. `AE` or `INT`, with `limit:5`).

## Decisions so far

- [Wayfinder map created 2026-09-02](MAP.md): destination, notes, and 6 frontier tickets defined for AI harvest stream (H1-H6).
- [Tickets H1-H6 created](tickets/H1-ai-provider-gpt5-nano.md): H1 provider, H2 structured workflow, H3 control API, H4 UI, H5 verification loop, H6 fixtures/samples.

## Not yet specified

- Per-jurisdiction prompt tuning for `gpt-5-nano` (UK/US/CA/AE/INT) — graduate after H1 baseline is green.
- Cost/latency budget for continuous search (calls/min, tokens, KV write rate) — observe on H2, gate on metrics.
- Deduplication across AI + Brave + Seed hits (shared `dedupe-index`) — H5 will define.
- Vault sync-conflict UX for AI-harvested provenance — out of scope for this map, track on `ops-residual`.

## Out of scope

- Replacing `brave-search` or `seed-portals` — AI stream is additive, not a replacement.
- Final audit determinations, approvals, or certifications — AI proposes candidates, adjudication disposes (deterministic-first).
- Paid-only infrastructure — `gpt-5-nano` is free-tier via `opencode` gateway; paid fallback only by explicit owner act.
- Docker / containerization.

## Tickets

- `H1` — AI provider `gpt-5-nano` web search (continuous harvest source)
- `H2` — Structured workflow for AI harvesting (state machine + loop)
- `H3` — Control API: start, pause, resume, stop for harvest stream
- `H4` — Monitoring & visualization UI (mission-control AI harvest tab)
- `H5` — Verification loop: never stop till verified (coverage/quality/provenance gates)
- `H6` — Fixtures & samples: test obtaining/finding documents via AI harvest
