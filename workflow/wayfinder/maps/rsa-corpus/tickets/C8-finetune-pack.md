---
id: C8
title: Fine-tune pack build from T3/T4 complete RSAs
type: task
hitl: false
status: closed
assignee: orchestrator
blocked_by: [C2, C5]
blocks: []
created: 2026-09-11
resolved: 2026-09-12
---

## Agent Brief

**Category:** enhancement
**Summary:** Build the fine-tuning pack the owner harvested for: instruction/response pairs derived ONLY from T3-complete (primary) and T4-with-outcome (premium) RSAs — e.g. UNB Route 1000, OC Transpo anchors. Task shapes: finding→recommendation, evidence→risk-rank, stage→prompt-list. T1 outputs-only as fallback with downgraded weight; T0 excluded (count only).

**Current behavior:** Raw documents, no ML-ready pairs.

**Desired behavior:** `finetune-pack.jsonl` (+ builder script, rerunnable) with per-record {input, output, source anchor, tier, jurisdiction, stage, weight}; T-tier distribution table; train/holdout split honoring C5 canonical ids (no near-dup leakage across split).

**Key interfaces:**
- Inputs: C2 tiers, C5 dedupe (split integrity), C6 text; C10 license gate (only cleared docs enter the pack).
- Output stays OUT of git if large (or sample + builder script committed, bulk ignored).

**Acceptance criteria:**
- [ ] ≥50 pairs from T3+ sources, T4 flagged premium, T0 count 0 in pack.
- [ ] No near-dup leakage across train/holdout (C5 ids enforced, proof query).
- [ ] License-cleared sources only (C10 verdict referenced per source batch).

**Out of scope:**
- Running fine-tunes (owner infra), eval scoring (C9 lane), license verdicts themselves (C10).

## Resolution

`pairs.json` (50 authored pairs, grounded in extracted findings) + `scripts/build-finetune.py` (rerunnable assembly) → `finetune-train.jsonl` (36) + `finetune-holdout.jsonl` (14). T3 grading rationale: 5 CLEAR complete RSAs with findings+recommendations read in full (US12 Tech Report 18 pairs, Fairfax 12, Hwy55 8, Tacoma 6, 16-120 Transit 6); shapes 31 finding-rec / 11 evidence-rank / 8 stage-prompts; T4 count 0 (no with-outcome source identified — flagged); T0 count 0. Split proof: holdout = whole sources (Tacoma + 16-120), no shared C5 exact-dup group (assert), disjoint sources (assert). License: all 5 sources CLEAR per register. CLOSED 2026-09-12
