---
id: F1
title: Quote-bearing baseline upgrades for GF-6..10
type: task
hitl: true
status: open
assignee:
blocked_by: []
blocks: [F4]
created: 2026-08-30
resolved:
---

## Question

Provide owner-supplied verbatim INT evidence for GF-6..10 baseline/fixture records, especially GF-9 pivotal claims, to satisfy the ratified evidence-grounding rubric (evidence_grounding=2 requires verbatim quotes). Currently blocked on owner source material and acceptance rubric.

Source: workflow/wayfinder/maps/v2-agentic-platform/MAP.md:66-67; workflow/wayfinder/maps/v3-architecture-deepening/MAP.md:66-67; .autoforge/discovery/tracker-index.md:1-5; .autoforge/plans/plan.md:56-73 (M1)

## Progress (2026-09-13)

- Gate OPENED: `OWNER_GF_SOURCE_AND_ACCEPTANCE` satisfied via chat ratification — gf-quote-pack.md 20/20 APPROVED, 0 struck (RATIFIED-BY recorded in-pack).
- Scorecards updated: ratified-quote annex appended to GF-6..10.md in live archive `state/eval-scorecards/2026-09-08T01-52-05-000Z/` (.json judged records untouched).
- Journal: `vault/journal/2026-09-13-ratification-promotion-migration.md`.
- BLOCKED on fresh Tier-1: judged eval run 2026-09-13 failed systematically — Zen gateway HTTP 401 on all 11 fixtures (Keychain `auditorai/opencode` value rejected; no spend incurred; bad archive removed, 09-08 restored as newest). Needs a valid OPENCODE_API_KEY, then: rerun eval → `tier1-archive.mjs --rebase --topup <runId>` → verify zero-drop + GF-9 quotes → close.

## Resolution

*Pending owner gate `OWNER_GF_SOURCE_AND_ACCEPTANCE`. When opened, update `state/eval-scorecards/**` and `vault/journal/**`, run fresh Tier-1 archive, verify `passes_corpus_mark=true` zero-drop and GF-9 quotes, and `node scripts/vault-sync.mjs --check`. See M1 in .autoforge/plans/plan.md for full touches and acceptance.*

