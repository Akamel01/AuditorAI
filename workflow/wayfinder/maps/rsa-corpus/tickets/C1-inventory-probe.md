---
id: C1
title: Corpus inventory probe — formats, sizes, languages, jurisdiction signals
type: task
hitl: false
status: closed
assignee: autoforge-worker
blocked_by: []
blocks: [C2, C3, C6]
created: 2026-09-11
resolved: 2026-09-12
---

## Agent Brief

**Category:** exploration
**Summary:** Probe all 350 files under `docs/RSA-Documents/` (886 MB: 202 PDF, 18 HTML, 15 MD, scripts/logs) without moving anything. Reconcile against `COLLECTION_INDEX.md` ("73 documents, 331 MB" — stale vs actual tree) and record per-folder counts, size outliers (e.g. 76 MB briefing book), language signals (French/Quebec?), jurisdiction signals per file, and unreadable/corrupt candidates.

**Current behavior:** No machine inventory exists; COLLECTION_INDEX.md covers only the US baseline and undercounts the tree ~5x.

**Desired behavior:** `corpus-inventory.json` (generated artifact, same dir): per-file {path, bytes, ext, jurisdiction_hint, lang_hint, status: ok|suspect}. Plus a Drifts section listing COLLECTION_INDEX.md staleness line-items (no edits to it — C2 owns schema, C4 owns moves).

**Key interfaces:**
- Read-only walk (`find`, `pdfinfo`/`pdftotext -l 1` sample where available, `file`).
- Never write into corpus dirs except the single inventory JSON at `docs/RSA-Documents/corpus-inventory.json`.

**Acceptance criteria:**
- [ ] `corpus-inventory.json` covers all 350 files with bytes + ext + hints.
- [ ] Drifts vs COLLECTION_INDEX.md enumerated (≥3 line-items with file refs).
- [ ] Zero moves/renames/deletes (`git status` N/A — untracked tree; prove via before/after `find | sort | sha256`).

**Out of scope:**
- Classification taxonomy (C2), quarantine decisions (C3), text extraction (C6).

## Resolution

`docs/RSA-Documents/corpus-inventory.json` built by `scripts/build-inventory.py` (rerunnable, stdlib): 352 files, 928.2MB, 6 drifts (count 73→352, size 331→928MB, non-US coverage gap ~300 files, 3 empty dirs, fha/fhwa near-collision, top-5 outliers). Zero moves (creates only). Lint exit 0. 2026-09-12
