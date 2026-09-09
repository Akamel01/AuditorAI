---
id: H7
title: agent-reach-search provider (gpt-5-nano brain + Exa/Jina hands)
type: task
hitl: false
status: closed
assignee: harvest-verifier
blocked_by: [H1]
blocks: [H8]
created: 2026-09-09
resolved: 2026-09-09
---

## Question

How do we replace URL-invention with real reach-out: `gpt-5-nano` plans/qualifies, `agent-reach` backends (Exa search + Jina reader) fetch?

## Context

`src/discovery/providers/ai-search.ts:34-68` asks the LLM to invent URLs (hallucination risk). Owner confirmed 2026-09-09: Start must use `gpt-5-nano` with `agent-reach` skill the way intended — Exa `web_search_exa` + Jina `r.jina.ai` via HTTP (no CLI on Vercel), Exa-optional fallback first (no key → graceful `[]`, like brave 402).

## Agent Brief

**Category:** enhancement
**Summary:** New `src/discovery/providers/agent-reach-search.ts` as `DiscoveryProvider`: gpt-5-nano expands `DiscoverQuery` → Exa queries, Exa HTTP search, Jina HTTP confirm, gpt-5-nano qualifies → `DiscoveryHit[]`.

**Key interfaces:**
- `DiscoveryProvider.discover(query)` / `fetch(url)` (`provider-types.ts:21-26`)
- `chatComplete` (`lib/inference.ts:40`), `withHostBudget` (`ratelimit.ts:34`), `resolveSecret` (`keychain.ts:35`), `hitId` (`discovery/ids.ts`)
- `registerProvider("agent-reach-search", ...)` in `providers/index.ts:11`, `providerEnabled` gate in `provider-types.ts:45`

**Acceptance:**
- [ ] `AGENT_REACH_ENABLED=true` + `EXA_API_KEY` (+ `OPENCODE_API_KEY`) enables it in `listProviderIds()`; missing key → `[]`, no throw, no cost
- [ ] Returns `DiscoveryHit[]` with `hit_id,url,title_hint,jurisdiction_guess,licence_hint:unknown,source_type:search-engine,provider_id:agent-reach-search`; respects `jurisdictions/themes/limit≤10`
- [ ] Per-host budget (`api.exa.ai`, `r.jina.ai`, `api.opencode.ai`); 402/429 → `[]` + warn (brave-search.ts:91-99 pattern)
- [ ] Jina confirm is best-effort (fail-open to Exa title); gpt-5-nano qualify is fail-open (on LLM error keep Exa hits)
- [ ] Unit test `MemoryStore`-free, mocked `fetchImpl` proves Exa→Jina→qualify and missing-key `[]`
- [ ] No new deps; `ponytail:` ceiling for single-query-per-jur (no fan-out) unless throughput matters

**Out of scope:** Stream loop (H8), API/UI (H9), verification wiring (H10). Keep `ai-search` registered (no delete this slice).

## Resolution

Closed 2026-09-09 — `src/discovery/providers/agent-reach-search.ts:1` (~200 lines, no new deps): one Exa call per jurisdiction (`exaQueryFor`), Exa HTTP `POST api.exa.ai/search` (`x-api-key`), Jina `GET r.jina.ai/<url>` liveness (404/410 drops, else fail-open), single `gpt-5-nano` qualify call (`chatComplete` low effort, fail-open keeps Exa hits), `hitId` shaping `provider_id:agent-reach-search`, `402/429→[]` + `setProviderDegraded` (brave pattern), `fetch()` direct with AuditorAI UA.

- Gate: `AGENT_REACH_ENABLED=true` + `EXA_API_KEY` + `OPENCODE_API_KEY` (`provider-types.ts:62`, `index.ts:12` registration); missing → `[]`, no throw, no cost.
- Tests: `tests/domain/agent-reach-search.test.ts:1` 4/4 (Exa→Jina→qualify shaping, missing-key `[]`, `providerEnabled` gate, registry).
- Verified: `vitest` 4 pass, `lint 0`, `typecheck 0`, `--mock` 3-pass, `vault-sync --check` ok. Live needs owner `EXA_API_KEY`; until then graceful `[]`.
- Next: H8 continuous loop consumes this provider.
