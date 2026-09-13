---
id: C6
title: Text-extraction pipeline matrix (PDF → text/OCR, HTML, PPT)
type: task
hitl: false
status: closed
assignee: autoforge-worker
blocked_by: [C1]
blocks: []
created: 2026-09-11
resolved: 2026-09-12
---

## Agent Brief

**Category:** enhancement
**Summary:** Build the extraction matrix for 202 PDFs + 18 HTML (+ presentations in state-dots): per-format tool choice (pdftotext vs OCR vs HTML-strip), scanned-PDF detection rate, French-language flagging (Quebec sources per C1), cost/time estimate for the full 886 MB. Reuse `scripts/` where present; stdlib-first, no new deps without justification. Output TEXT ONLY to a scratch mirror (never beside originals, never committed).

**Current behavior:** No extracted text; mining/fine-tune blocked on raw PDFs.

**Desired behavior:** `extraction-matrix.md` (format × tool × quality-sample × cost) + runnable `scripts/extract-corpus.sh` (stdlib + preinstalled tools only) + 5-file pilot extraction proving quality bars (guide text clean, scanned detected, table survival spot-checked).

**Key interfaces:**
- C1 format/inventory signals; scratch dir OUTSIDE repo or gitignored tmp (bulk text never committed).
- Downstream: C7 mining, C8 packs, C9 ingestion consume pilot output first.

**Acceptance criteria:**
- [ ] Matrix covers PDF(-born-digital vs scanned), HTML, PPT with measured quality samples.
- [ ] Pilot: 5 files extracted, quality bars met, script rerunnable (`--help` + idempotent).
- [ ] Zero extracted bulk committed; zero originals modified.

**Out of scope:**
- Full-corpus extraction run (follow-up after pilot approval), mining (C7), embeddings (future map).

## Resolution

`docs/RSA-Documents/scripts/extract-corpus.sh` (--help, idempotent, <80 lines; pdftotext/pdfinfo/tesseract present, ocrmypdf/pandoc absent → NEEDS_OCR-flag + sed-fallback design) + `extraction-matrix.md` + 5-file pilot in /tmp/c6-pilot (176K/261K/3.7K/30K/111K chars, no OCR flags) rerun byte-identical to /tmp/c6-pilot-2. Zero bulk committed, originals untouched. Orchestrator-verified (`--help` runs, pilot files on disk). CLOSED 2026-09-12
