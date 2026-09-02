---
id: H1
title: AI provider gpt-5-nano web search (continuous harvest source)
type: task
hitl: false
status: open
assignee:
blocked_by: []
blocks: [H2, H5, H6]
created: 2026-09-02
resolved:
---

## Question

How do we add a continuous AI harvesting provider that uses `opencode/gpt-5-nano` with web search as a third source alongside `seed-portals` and `brave-search`, without duplicating seams or adding dependencies?

## Context

Current harvest has two live sources: `seed-portals` (offline curated) `src/discovery/providers/seed-portals.ts:23` and `brave-search` `src/discovery/providers/brave-search.ts:58` (Brave API, 402 graceful). We need a third provider `ai-search` that calls `opencode/gpt-5-nano` via the existing `AiAdapter` seam `src/lib/ai.ts` with web search, returns `DiscoveryHit[]` in the same shape, respects `withHostBudget` and `providerEnabled`, and is controllable via `DISCOVERY_AI_ENABLED` env gate (off by default, like `AI_ENABLED`).

## Agent Brief

**Category:** enhancement
**Summary:** Implement `src/discovery/providers/ai-search.ts` as a `DiscoveryProvider` that uses `opencode/gpt-5-nano` web search to discover RSA documents, reusing the `AiAdapter` seam and `DataStore` patterns.

**Key interfaces:**
- `DiscoveryProvider.discover(query: DiscoverQuery): Promise<DiscoveryHit[]>`
- `src/lib/ai.ts` `AiAdapter` (Zen gateway, `x-preview-f-free`, `gpt-5-nano` per `model-policy.yaml`)
- `src/discovery/provider-types.ts` `registerProvider`

**Acceptance:**
- [ ] `DISCOVERY_AI_ENABLED=true` enables `ai-search` in `listProviderIds()`, `false` (default) keeps current behavior (no new hits, no cost)
- [ ] `ai-search` returns `DiscoveryHit[]` with `hit_id`, `url`, `title_hint`, `jurisdiction_guess`, `licence_hint: unknown`, `source_type: search-engine`, `provider_id: ai-search`
- [ ] Respects `query.jurisdictions`, `query.themes`, `query.limit` (max 10)
- [ ] Uses `withHostBudget` per host, handles 402/429 like `brave-search` (empty on quota, retry on 429)
- [ ] Unit test with `MemoryStore` and mocked `AiAdapter` proves 2 Jurisdictions → hits

**Out of scope:** Replacing brave/seed, final determinations.
