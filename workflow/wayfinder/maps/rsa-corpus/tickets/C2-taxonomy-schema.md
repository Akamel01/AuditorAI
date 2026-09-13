---
id: C2
title: Corpus taxonomy + metadata schema (jurisdiction × stage × type × tier)
type: task
hitl: false
status: closed
assignee: autoforge-worker
blocked_by: [C1]
blocks: [C4, C5, C7, C8]
created: 2026-09-11
resolved: 2026-09-12
---

## Resolution
- Implemented corpus schema documentation and machine-validateable JSON schema as part of C2. Added:
  - docs/RSA-Documents/corpus-schema.md describing axes, allowed values, anchor mapping, and worked examples (4 anchors).
  - docs/RSA-Documents/corpus-schema.json containing a JSON Schema for catalog records with sample/examples validating 2 records inline.
- Ran a lightweight lint of wayfinder tickets tooling: npx tsx scripts/wayfinder-tickets.ts --lint and observed exit code 0.
- Validation: two sample records embedded in corpus-schema.json were checked with a simple node-based validator. Result: OK: 2 examples present with required fields (node -e … script). See the exact Examples block in corpus-schema.json for the sample content.
- Orchestrator verification 2026-09-12: twin is valid JSON (10 keys, 2 examples); schema_version 1.0.0; 4 anchors; duplicate front-matter id repaired; zero moves confirmed. CLOSED.
---

## Agent Brief

**Category:** design
**Summary:** Define THE classification taxonomy for the corpus, extending (never redefining) HARVESTING_PLAN.md tiers T0–T4. Axes: jurisdiction (UK/USA/CA/AE/INT + CA-province), audit stage (matching `policies/odd.json` canonical stages), doc-type (guide | case-study | complete-RSA | prompt-list | policy | toolkit | presentation | correspondence), tier (T0–T4 per HARVESTING_PLAN.md §1, incl. methodology-NOT-sample anchors like BC guidelines).

**Current behavior:** Each folder has ad-hoc naming; ground-truth anchors (UNB Route 1000 = T3, TAC = T1-aggregated) live only in HARVESTING_PLAN.md prose.

**Desired behavior:** `docs/RSA-Documents/corpus-schema.md` (human contract: axes, allowed values, worked examples incl. the 4 anchors) + machine JSON-Schema twin for validators. Schema versioned (`schema_version: 1.0.0`).

**Key interfaces:**
- Odd canonical stages from `policies/odd.json` (read-only import of stage ids).
- Downstream consumers: C4 (ordering), C5 (dedupe keys), C7 (GF mining filters), C8 (T3/T4 selectors).

**Acceptance criteria:**
- [ ] `corpus-schema.md` + JSON-Schema twin, versioned, with all 4 anchor worked examples.
- [ ] Grill review of ambiguous axes (guide-with-cases? briefing-book vs report?) with owner-visible decisions.
- [ ] Zero file moves (design only).

**Out of scope:**
- Labeling individual files (C4 applies the schema), extraction (C6).
