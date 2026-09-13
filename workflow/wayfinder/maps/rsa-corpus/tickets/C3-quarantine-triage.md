---
id: C3
title: Quarantine triage — keep, quarantine, or drop per staging dir
type: task
hitl: false
status: closed
assignee: autoforge-worker
blocked_by: [C1]
blocks: [C4]
created: 2026-09-11
resolved: 2026-09-12
---

## Agent Brief

**Category:** triage
**Summary:** Triage the ambiguous dirs: `canadian-html-quarantine/` (99 files, 76M), `canadian-quarantine-v2/` (15 files, 86M), `canadian-not-audit/` (57 files, 182M), `canadian-staging/` (empty), `fha-case-studies/` (empty), `templates/` (empty), `atip-package/` (8 files). Verdict per dir AND per-file where mixed: KEEP (classify in C4) | QUARANTINE (stays, excluded from mining/fine-tune) | DROP (owner-confirmed delete only — never silent).

**Current behavior:** Quarantine dirs accumulate without recorded rationale; empty dirs (`staging`, `fha-case-studies`, `templates/`) purpose-unknown.

**Desired behavior:** `docs/RSA-Documents/QUARANTINE.md` (verdict register with reasons + dates) + disposition of empties (adopt per C4 tree or remove). DROP verdicts need explicit owner sign-off line in the register before any delete.

**Key interfaces:**
- C1 inventory (suspect-file flags), download logs (`canadian-download-log.tsv`), methodology notes.

**Acceptance criteria:**
- [ ] QUARANTINE.md covers all 7 dirs above with KEEP/QUARANTINE/DROP + reason.
- [ ] Zero deletes without a signed DROP line; zero moves (C4 moves).
- [ ] Empty-dir disposition recorded (adopt/remove + why).

**Out of scope:**
- Moves/renames (C4), license review (C10 — orthogonal axis, may overlap on ATIP).

## Resolution

`docs/RSA-Documents/QUARANTINE.md`: all 7 dirs verdicted (QUARANTINE 4: html-quarantine, quarantine-v2, not-audit, fha-case-studies; KEEP 3: staging-adopted, templates-adopted, atip-package) + empty-dir dispositions. Zero DROPs → zero deletes. Orchestrator-verified on disk. CLOSED 2026-09-12
