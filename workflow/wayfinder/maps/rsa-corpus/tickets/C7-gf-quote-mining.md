---
id: C7
title: GF-6..10 quote mining → owner-ratifiable quote pack (opens F1)
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
**Summary:** Mine the classified, deduped corpus for GF-6..10 candidate verbatim quotes + draft pass criteria per GF (esp. GF-9 pivotal claims), producing the QUOTE PACK the owner ratifies. Ratified pack OPENS `OWNER_GF_SOURCE_AND_ACCEPTANCE` (v2 F1) → F1 executes → F4 unblocks. Quotes byte-exact from owner files (no paraphrase ever), each tagged file + jurisdiction + GF.

**Current behavior:** F1 blocked on owner-authored verbatim; owner offered documents instead — this ticket converts documents → ratifiable pack.

**Desired behavior:** `gf-quote-pack.md` (per GF: candidate quotes with file:line/provenance anchors + proposed acceptance + strike/approve checkboxes) → owner review session → ratified pack feeds `state/eval-scorecards/**` + `vault/journal/**` per F1. Unratified lines never enter scorecards.

**Key interfaces:**
- Inputs: C2 taxonomy (GF↔jurisdiction/stage filters), C5 canonical ids, C6 pilot text; v2 F1 ticket (downstream contract).
- Rule: AI proposes, owner disposes. No quote enters evidence without a checked approve box.

**Acceptance criteria:**
- [ ] Quote pack covers GF-6..10 (≥3 candidates each, GF-9 ≥5) with provenance anchors.
- [ ] Byte-exactness proof (spot-check script: quote ⊂ source file).
- [ ] Owner ratification recorded (signed pack) OR explicit keep-gated note — either closes C7.

**Out of scope:**
- Editing scorecards/journals (F1 does that post-ratification), embeddings, paraphrase (forbidden).

## Resolution

`docs/RSA-Documents/gf-quote-pack.md`: 20 candidates (GF-6: 3, GF-7: 3, GF-8: 3, GF-9: 8, GF-10: 3) from 7 CLEAR source files, each with provenance anchor + proposed acceptance + approve/strike boxes. Proof `scripts/verify-quotes.py`: 20/20 word-sequence-exact under stated whitespace-folding rule (pdftotext wraps mid-sentence; rule stated in pack+script). Honest boundaries: GF-6/GF-10 all-ANALOG (no UK/CLEAR-CA source in corpus), GF-9 pivotal covered by US-practice ANALOGs + PIARC-RESTRICTED follow-up flagged. Keep-gated close per ticket (ratification + F1 downstream = owner side). CLOSED 2026-09-12
