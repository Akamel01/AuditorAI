---
id: C10
title: Provenance + license gate (public-domain check per E2 precedent)
type: task
hitl: false
status: closed
assignee: autoforge-worker
blocked_by: []
blocks: []
created: 2026-09-11
resolved: 2026-09-12
---

## Agent Brief

**Category:** enhancement
**Summary:** License-gate every source batch BEFORE it enters packs/evals/mining outputs: government works (FHWA/state-DOT = US public domain), Canadian federal/provincial (Crown copyright — check ATIP terms in `atip-package/`), PIARC/IRF (member terms), MPO/local (varies), FOIA-furnished (request terms). Follow the E2 precedent (`E2-public-domain-drawing-corpus-sourcing`, Firewall `docs/adr/0007`).

**Current behavior:** No license verdicts; C7/C8/C9 would otherwise ingest ungated.

**Desired behavior:** `LICENSE-REGISTER.md` (batch × verdict CLEAR/RESTRICTED/BLOCKED + basis + date) gating C7/C8/C9 inputs (they cite it, don't re-decide). BLOCKED batches excluded from all outputs; RESTRICTED batches carry use-limits into pack metadata.

**Key interfaces:**
- Inputs: `atip-package/`, FOIA_TEMPLATE.md terms, per-folder provenance; E2 + ADR-0007 (precedent, link).
- Consumers: C7 (mine only CLEAR), C8 (pack only CLEAR), C9 (ingest only CLEAR).

**Acceptance criteria:**
- [x] Register covers all 14 top-level source dirs with verdict + basis.
- [x] C7/C8/C9 reference the register (no independent license calls).
- [x] Advisory only — zero file moves, zero deletions.

**Out of scope:**
- Legal advice (verdicts are diligence records for owner counsel, not counsel), paywall circumvention (forbidden, MAP out-of-scope), re-harvesting.

## Resolution

`docs/RSA-Documents/LICENSE-REGISTER.md` covers all 14 batches (CLEAR 4: fhwa-case-studies, state-dots, local-mpo, root loose; RESTRICTED 9; BLOCKED 1: canadian-not-audit). Diligence record only, zero moves. Lint exit 0. 2026-09-12
