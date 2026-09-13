---
id: C5
title: Dedupe vs sample-corpus + near-dup sweep (hash + shingle)
type: task
hitl: false
status: closed
assignee: orchestrator
blocked_by: [C2]
blocks: [C8, C9]
created: 2026-09-11
resolved: 2026-09-12
---

## Agent Brief

**Category:** enhancement
**Summary:** Deduplicate the corpus internally (alt guideline editions: FHWA-SA-06-006 vs _2005; Bicycle guide vs alt) and against `state/sample-corpus.json` + `vault/journal/2026-08-23-phase2-sample-corpus.md` (E3 lineage). Exact: sha256. Near: shingle/Jaccard on extracted or inventory-sampled text (coordinate with C6 for text availability; hash pass needs no text).

**Current behavior:** Known duplicate pairs co-exist (2005 vs 2006 guidelines, bicycle guide + alt); overlap with sample-corpus unmeasured.

**Desired behavior:** `dedupe-report.md` (pairs/clusters with scores + KEEP/DROP-CANDIDATE verdicts; drops need owner sign-off, never silent) + canonical-id assignment feeding `corpus-catalog.json` (C4). E3 lineage refs linked, not copied.

**Key interfaces:**
- C2 taxonomy keys (dedupe within same jurisdiction×stage first), `state/sample-corpus.json` (read-only), stdlib hashing.

**Acceptance criteria:**
- [ ] Exact-dup report (sha256) with zero false negatives on known pairs above.
- [ ] Near-dup clusters (threshold documented, e.g. Jaccard ≥0.9) with verdicts.
- [ ] Sample-corpus overlap measured (count + ids); zero deletes without signed lines.

**Out of scope:**
- Deleting (owner-gated), text extraction itself (C6), fine-tune/eval builds (C8/C9 consume this).

## Resolution

`docs/RSA-Documents/dedupe-report.md` + `dedupe-index.json` (327 rows, canonical C-ids) via `scripts/dedupe-report.py` (rerunnable, repo-relative state path): 14 exact groups (known pairs caught, zero false negatives — incl. FHWA-SA-06-006 pair, Bicycle pair, + mislabeled triplicate `1032147.pdf` = SA-07-007 = SA-16-026 bytes); near-dup filename-stem Jaccard≥0.9 same-top-dir → none, content-shingle deferred to post-C6-full-run (documented); sample overlap 49/78 direct + 29 named gaps (UK/MassDOT pre-harvest → C9 strata note). Review fix applied: catalog/index universe unified (tooling/dotfiles excluded from both). Zero deletes. CLOSED 2026-09-12
