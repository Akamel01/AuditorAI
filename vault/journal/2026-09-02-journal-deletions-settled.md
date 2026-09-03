---
title: Journal settlements for: Journal deletions by parallel sessions + UTC/local timestamp confusion
type: journal
date: 2026-09-02
owner: agent
links:
  - path: vault/gotchas/journal-deletions-and-tz.md
    note: "settled VG-01 gotcha"
evidence_ids: []
---

# Journal: Settled VG-01 — Journal deletions by parallel sessions

This journal documents the settlement of the VG-01 gotcha: Journal deletions in a parallel-session environment and UTC/local timestamp confusion. It notes that the gotcha has moved from open to settled, and that the deterrent/recovery runbook is in effect. No state mutations occur in this module; all evidence will be anchored by the head-worktree determinism process (VG-SYNC).

References:
- vault/gotchas/journal-deletions-and-tz.md (settled status)
- watch-vault-journal.sh deterrent and recovery runbook in repo
