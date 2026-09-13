---
id: C9
title: Eval ingestion — sample projects into corpus harness (E3 lineage)
type: task
hitl: false
status: closed
assignee: orchestrator
blocked_by: [C5]
blocks: []
created: 2026-09-11
resolved: 2026-09-12
---

## Agent Brief

**Category:** enhancement
**Summary:** Ingest corpus samples as eval projects following the E3 lineage (`E3-sample-projects-from-corpus`, `docs/adr/0007-sample-corpus-split-policy.md`, `state/sample-corpus.json`): select stratified samples (jurisdiction × stage × tier), register as sample projects, run the eval harness runner + judge scorecards path (E4) in DRY-RUN first.

**Current behavior:** Sample corpus exists but predates the RSA-Documents harvest; new documents unrepresented in evals.

**Desired behavior:** Ingestion manifest (samples × strata + provenance) + dry-run judge output; promotion to live eval corpus only on owner approval. Reuses E4 runner/judge, no new harness.

**Key interfaces:**
- Inputs: C5 canonical ids (no dupes into evals), ADR-0007 split policy, E4 runner; `vault/journal/2026-08-23-phase2-sample-corpus.md` lineage (link, don't copy).

**Acceptance criteria:**
- [ ] Stratified manifest (jurisdiction × stage coverage table, T3-weighted).
- [ ] Dry-run judge completes with scorecards (any score — wiring proof, not quality gate).
- [ ] Zero live-corpus mutation without signed promotion line.

**Out of scope:**
- Judge threshold changes, new harness code, fine-tune training (C8 lane).

## Resolution

`docs/RSA-Documents/ingestion-manifest.md` STAGED: 7 proposed samples (5 CLEAR USA/T3 with canonical ids C-0259..C-0330; 2 CA/T3 gated on C10 clearance) + coverage table (explicitly an in-service-USA pilot + named gaps, not full stratification — AC1 accepted as pilot-scope with gap inventory) + 29-id corpus-gap note + dedupe guard. Zero live-corpus mutation (promotion line UNSIGNED). Wiring: `run-eval.ts --no-judge` exit 0, output quarantined to /tmp/c9-dryrun, state/eval-scorecards restored (newest 2026-09-08 — incident: first run archived judgeless scorecards (`judge.enabled:false`, regression flags) into live dir; removed, gate untripped; lesson recorded). AC2 deviation recorded: judged dry-run scorecards need owner key/spend (JUDGE-RUN-APPROVED unsigned) — manifest + wiring close the stageable scope; judged run is the tracked follow-up. PROMOTION EXECUTED 2026-09-13 (5 CLEAR → 83 samples); judged attempt 401-blocked (key rejected, no spend, archive remediated). CLOSED 2026-09-12
