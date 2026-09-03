---
title: Journal settlements for: OPENCODE_API_KEY handling + eval invocation quirks
type: journal
date: 2026-09-02
owner: agent
links:
  - path: vault/gotchas/opencode-api-key-invocation.md
    note: "settled VG-02 gotcha"
evidence_ids: []
---

# Journal: Settled VG-02 — OPENCODE_API_KEY handling

This journal documents settlement of VG-02 gotcha: keychain handling and eval invocation quirks. The gotcha moves from open to settled; runbook is now anchored.

Key storage and use (macOS) reminder:
- Store via `security add-generic-password -U -a "$USER" -s "auditorai/opencode" -w "$(pbpaste | tr -d '[:space:]')"`, never pasting into chat.
- Invoke via `OPENCODE_API_KEY="$(security find-generic-password -a "$USER" -s auditorai/opencode -w)" npx tsx scripts/run-eval.ts` (mirrors .github/workflows/eval.yml:29), budget ~30s per judge call, 60+ chars sanity via `echo ${#K}`.
- Never transit key via chat history; rotation was required after previous paste.

No state mutations in this module; evidence anchored by head-worktree determinism (VG-SYNC).

References:
- vault/gotchas/opencode-api-key-invocation.md (settled status)
- security find-generic-password -a "$USER" -s auditorai/opencode -w
