---
id: H6
title: Fixtures and samples for AI harvest obtaining finding documents
type: task
hitl: false
status: open
assignee:
blocked_by: [H1]
blocks: []
created: 2026-09-02
resolved:
---

## Question

How do we prove the AI harvesting obtains and finds documents, fixtures, and samples via tests that cover the full `D01..D10` pipeline with `gpt-5-nano` web search?

## Agent Brief

**Category:** enhancement
**Summary:** Add fixtures and samples plus tests that verify `ai-search` discovers hits, qualifies, matches, acquires (via `acquireDocs` mock), and packages, using `tests/fixtures/samples` and `docs/references/sample-drawing-corpus.md` PD corpus.

**Key interfaces:**
- `tests/fixtures/samples/*/index.md` (existing GF-6..10)
- `tests/domain/discovery-harvest.test.ts` (existing 12 tests, MemoryStore)
- `src/discovery/pipeline.ts:334` `runDiscoveryPipeline`, `src/discovery/providers/ai-search.ts` (H1)

**Acceptance:**
- [ ] New fixture `tests/fixtures/ai-harvest/uk-s1-rsa.json` with 2 AI hits (one `in_scope` PDF, one `reserve` HTML) + mocked `acquireDocs` returning 1 PDF doc
- [ ] Test `tests/domain/ai-harvest.test.ts` proves: `ai-search` with `DISCOVERY_AI_ENABLED=true` + `MemoryStore` + mocked `AiAdapter` → `discovery_hits:2` → `qualified:1 in_scope` → `matched:1` → `acquired:1` → `package:1` → `provenance:1` → `quality:1 unique`
- [ ] Sample test reuses `docs/references/sample-drawing-corpus.md` PD sources (FHWA, DMRB) as `ai-search` web-search results, proves `hits` contain `licence_hint: public-domain` and `jurisdiction_guess`
- [ ] Live smoke (skipped in CI without key) `tests/e2e/ai-harvest-live.test.ts` with real `gpt-5-nano` `limit:2` for `INT` → at least 1 hit, `D01..D05` not empty
- [ ] `npm run typecheck` + `npm run lint` + `vitest` 20+ tests pass

**Out of scope:** Cost/latency budget, vault sync.
