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
- [Start = gpt-5-nano + agent-reach, non-stop till Stop (owner confirmed 2026-09-09)](tickets/H7-agent-reach-provider.md): `ai-search` invents URLs — replaced by `agent-reach-search` (`gpt-5-nano` plans/qualifies, Exa search + Jina reader reach out via HTTP, Exa-optional fallback); stream gains `continuous:true` default (rotate top-3 gaps when `cellKey=null`, stick when set; `DONE` unreachable, `Stop→FAILED stopped` kept); H7 provider → H8 loop → H9 Start-continuous UI → H10 verify.
- [Reach keys settable from UI (H11 closed 2026-09-09)](tickets/H11-reach-keys-ui.md): `runtime-secrets.ts` DataStore overrides + admin-gated `GET/POST/DELETE /api/dev/harvest-stream/secrets` (presence booleans only) + `ai-harvest-keys.tsx` panel (status → toggle → password inputs + show/hide → Save/Clear, `reach-keys-*` testids); provider falls back env→runtime per-field; Apple-design (no new motion, presence-only, forgiving Clear).
- [Continuous loop till Stop (H8 closed 2026-09-09, GO_WITH_NOTES)](tickets/H8-continuous-loop.md): persisted `continuous` default true, `??= false` migration, append-50, delta-verify, `continuous next <label>`, DONE unreachable, legacy byte-for-byte; AutoForge architect→plan→worker→review→re-review→validator chain in `.autoforge/{architecture,plans,execution,reviews,validation}/H8*`; FAILED-at-cap unit pin carried to H10 (test passes via DONE fallback — legacy branch untouched).
- [Start-continuous API+UI (H9 closed 2026-09-09, GO_WITH_NOTES)](tickets/H9-start-continuous-ui.md): `POST {continuous}` default true, client pass-through, "Start continuous" + badge + footer, hard e2e asserts; chain in `.autoforge/{architecture,plans,execution,reviews,validation}/H9*` (reviewer spec fixes applied; defective NO-GO overruled with current-file evidence in H9-final); H3 stays open (non-intersecting).
- [CI green for harvest chain (H12 closed 2026-09-09, validator GO)](tickets/H12-ci-green.md): heading-exact e2e locator + keyed CI server + own-ticket `in_progress` poisoning fixed (index 500 → 200) + `refresh-evidence-head.mjs` + scheduled auto-refresh; chain in `.autoforge/{architecture,plans,execution,reviews,validation}/H12*`; leniency hardening tracked as H13.
- [Verify continuous reach-out (H10 closed 2026-09-10, GO_WITH_NOTES)](tickets/H10-verify-continuous.md): monitor `--maxTicks/--stop/--continuous` + P3 + HV10 bundles + exit-0 semantics; stop-race guard + cross-tick dedupe (unique-only + steady-state) proven live (M4 exit 0 zero-dupes, M5 DONE, M6 28.4s); chain in `.autoforge/{architecture,plans,execution,reviews,validation}/H10*` (stale NO-CLOSE overruled in H10-final; validator evidence-destruction incident → spawn-contract rule 14).

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
