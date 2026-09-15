---
id: F1
title: Quote-bearing baseline upgrades for GF-6..10
type: task
hitl: true
status: closed
assignee:
blocked_by: []
blocks: [F4]
created: 2026-08-30
resolved: 2026-09-15
---

## Question

Provide owner-supplied verbatim INT evidence for GF-6..10 baseline/fixture records, especially GF-9 pivotal claims, to satisfy the ratified evidence-grounding rubric (evidence_grounding=2 requires verbatim quotes). Currently blocked on owner source material and acceptance rubric.

Source: workflow/wayfinder/maps/v2-agentic-platform/MAP.md:66-67; workflow/wayfinder/maps/v3-architecture-deepening/MAP.md:66-67; .autoforge/discovery/tracker-index.md:1-5; .autoforge/plans/plan.md:56-73 (M1)

## Progress (2026-09-13)

- Gate OPENED: `OWNER_GF_SOURCE_AND_ACCEPTANCE` satisfied via chat ratification — gf-quote-pack.md 20/20 APPROVED, 0 struck (RATIFIED-BY recorded in-pack).
- Scorecards updated: ratified-quote annex appended to GF-6..10.md in live archive `state/eval-scorecards/2026-09-08T01-52-05-000Z/` (.json judged records untouched).
- Journal: `vault/journal/2026-09-13-ratification-promotion-migration.md`.
- BLOCKED on fresh Tier-1: judged eval run 2026-09-13 failed systematically — Zen gateway HTTP 401 on all 11 fixtures (Keychain `auditorai/opencode` value rejected; no spend incurred; bad archive removed, 09-08 restored as newest). Needs a valid OPENCODE_API_KEY, then: rerun eval → `tier1-archive.mjs --rebase --topup <runId>` → verify zero-drop + GF-9 quotes → close.

## Progress (2026-09-15 — CLOSED)

- Judge transport solved (agent-reach research → fix): muse-spark free is Responses-native (`/zen/v1/responses` + `x-opencode-session`); all chat `-free` IDs retired/unavailable; implemented `responsesComplete` in `src/lib/inference.ts`, routed in `makeZenJudgeComplete`, default judge `muse-spark-1.3-contributor-free` (`scripts/run-eval.ts:56`); contract tests `tests/domain/inference-responses.test.ts` 2/2.
- Fresh Tier-1 `state/eval-scorecards/2026-09-15T08-44-29-699Z`: 11/11 fixtures, 22/22 findings judged, 0 unscored. GF-9: scored 2, mean 9.5, mark True, no regression; both verdicts evidence_grounding 2/2 with verbatim quotes.
- Archive `state/eval-archive/2026-09-15T08-55-55-678Z --rebase --topup 2026-09-15T08-44-29-699Z`. Zero-drop verified.
- Note: new judge = clean-break baseline (no parallel calibration possible — no prior working judge); future runs compare against this run's means. Contributor-tier training-consent terms apply (owner key, owner-directed).

## Resolution

*Pending owner gate `OWNER_GF_SOURCE_AND_ACCEPTANCE`. When opened, update `state/eval-scorecards/**` and `vault/journal/**`, run fresh Tier-1 archive, verify `passes_corpus_mark=true` zero-drop and GF-9 quotes, and `node scripts/vault-sync.mjs --check`. See M1 in .autoforge/plans/plan.md for full touches and acceptance.*

