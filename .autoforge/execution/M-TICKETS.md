---
title: M-TICKETS execution brief for v4-harvest-deepening
created: 2026-09-14
---
Summary: Docs-only map and five tickets for v4 harvest-deepening. No code changes. Generated per task contract; front-matter encodes plan edges and gating assumptions.

Tickets included:
- A1-ledger-run-persist.md
- A2-harvest-ctx-builder.md
- A3-pipeline-dedupe-index.md
- A4-provider-fetch-routing.md
- A5-health-bridge-consolidation.md

Map: workflow/wayfinder/maps/v4-harvest-deepening/MAP.md

Notes for reviewer:
- Read .autoforge/architecture/decisions.md AD-A1..A5 for draft content alignment and acceptance expectations.
- Ensure lint passes with: npx tsx scripts/wayfinder-tickets.ts --lint
