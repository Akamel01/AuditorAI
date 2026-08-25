# Discovery Architecture — RSA data collection system (D01..D10)

Status: Phase-1 implemented (deterministic core, offline dry-run). Owner decisions
2026-08-25 are baked in. Companion to `docs/architecture/overview.md`; glossary in
`CONTEXT.md` §Discovery & corpus growth.

## Shape

A second pipeline beside the audit pipeline (`src/domain/pipeline`), same discipline:
pure node functions, declared slice writes enforced at the driver (`src/discovery/pipeline.ts`),
typed artifacts, no conversational memory. Declared graph: `state/graph-state.json →
graphs.discovery_graph`. Contracts: `contracts/node-contracts/D0*.md`.

```
D01 DISCOVER  providers fan-out (seed-portals offline; bing-search/google-cse env-keyed)
D02 QUALIFY   deterministic in_scope / reserve / reject (R1-R4 analogue at hit time)
D03 MATCH     getPack + resolveOdd reuse; structurally_absent refuses; odd_status stamped
D04 ACQUIRE   bytes + unpdf page/text extraction; raster/OCR pending = nulls, never dropped
D05 CLASSIFY  keyword ruleset; <0.7 auto-reserve (owner decision); trace kept
D06 PACKAGE   project-package assembly; completeness vocabulary; source_urls union
D07 PROVENANCE byte-stable chain URL→sha256→extraction→classifier→ODD cell
D08 QUALITY   exact sha256 + near-dup (normalized text) verdicts vs state/dedupe-index.json
D09 COVERAGE  ODD Coverage Score vs policies/odd.json; TARGET_TOTAL=500; gap+risk weights
D10 QUEUE     ranked themes feeding next D01 cycle (LOOP edge)
```

## Owner decisions encoded (2026-08-25)

| Decision | Where |
|---|---|
| Licensed sources case-by-case | `qualifier.ts` keeps `licensed-tier1-pending` in reserve; approval recorded by owner, never inferred |
| Both Bing API + Google CSE behind one seam | `providers/bing-search.ts`, `providers/google-cse.ts`, `providers/provider-types.ts`; OFF without keys (ADR-0001 doctrine) |
| Polite crawl: 1 req/s, 2 concurrent per host | `ratelimit.ts withHostBudget`; Retry-After honored |
| Low-conf classify auto-reserves (no human queue) | `classifier.ts AUTO_RESERVE_BELOW=0.7`, `auto_reserved_doc_ids` traced for audit |
| Targets weighted by gap + risk | `coverage.ts RISK_WEIGHT {in:1, mapped_unproven:3}` + fragile bonus for single-fixture IN cells |

## Determinism & state

- Dry-run is fully offline: `tsx scripts/discovery-run.ts` uses seed portals + fixture PDFs,
  fixed `ran_at` stamp — byte-stable ids and coverage across runs.
- Append-only machine ledger: `state/discovery-ledger.json` (one entry per node emission).
- Derived views regenerate only via script: `tsx scripts/discovery-coverage.ts` writes
  `state/odd-coverage.json`. Never hand-edit derived files.
- Dedupe index: `state/dedupe-index.json` (sha256 → canonical; normalized-text hash → canonical;
  clusters). Canonical = first claimant.
- Schemas: `contracts/schemas/discovery-*.schema.json` + `odd-coverage.schema.json` +
  `dedupe-index.schema.json` (AJV validated in tests and at D09).

## Multimodal drawings

Drawings are first-class: original PDFs preserved byte-exact (sha256), page count recorded
per page, PNG rasterization + OCR slots exist in the schema and are recorded as `null`
"pending" rather than dropped. The rasterizer dependency decision is deliberately deferred
(interface staged in `drawing.ts`) — when chosen it should land as an ADR (hard to reverse,
real trade-offs).

## Escalation gates that remain human

1. D08: any full-package whose licence is unknown → owner review before ODD-proof use.
2. Cell flips mapped_unproven → IN stay governed by eval-gates §2 trigger path 5 (Tier-1 archive) — discovery never flips cells directly; it supplies candidates.

## Non-goals

No model training, no training-pipeline redesign, no paywall circumvention. Discovery ends
at qualified packages + provenance; cataloging into `state/sample-corpus.json` remains the
existing ADR-0007 rule flow.
