---
title: VG-SYNC execution evidence
type: execution
date: 2026-09-02
owner: autoforge
status: settled
touches: ["state/vault-notes.json", "vault/views/**", ".autoforge/discovery/tracker-index.md"]
---

- VG-SYNC: compiled vault from HEAD worktree via `node scripts/vault-sync.mjs` (vault-sync.mjs:16-44 HEAD worktree, vault-import.mjs:14-90, vault-export.mjs:45-96)
- Refreshed state/vault-notes.json from HEAD: note_count 25→27, both gotchas settled, 2 new journals (2026-09-02-journal-deletions-settled, 2026-09-02-opencode-key-settled) with body_chars 586/957
- Views wholesale regenerated (vault/views/graph-overview.md source_hash bcd4207749e4) — no hand-edit, generated:true
- Updated .autoforge/discovery/tracker-index.md: 2 open → 0 frontier (both settled)
- Verified determinism: `node scripts/vault-sync.mjs --check` → committed matches HEAD compilation (exit 0), `git diff --exit-code -- state/vault-notes.json vault/views` clean after commit
- Locks: vault-state-single-writer held, blocked_by [VG-01,VG-02] respected, staging via explicit `git add <paths>`
