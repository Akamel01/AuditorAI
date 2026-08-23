---
title: Journal deletion attributed — parallel session, not sync tooling
type: journal
date: 2026-08-23
owner: agent
---

Follow-up to the ticket-21 close-out: the deletion of
`2026-08-23-ticket-21-verify-close.md` from the working tree (observed ~01:21 local,
restored same minute) is **attributed by owner confirmation to a live parallel agent
session**. No sync tooling was involved: Obsidian never installed, iCloud Documents sync
disabled, no Dropbox/Syncthing/Resilio, no trash/snapshot trace, no repo hook or script
capable of it.

Hardening landed:

- `vault/gotchas/journal-deletions-and-tz.md` — real-deletion response pattern,
  attribution order, transcript-grep blind spot, UTC/local pitfall.
- `scripts/watch-vault-journal.sh` — fswatch deterrent logging deletions outside the repo.

Process note for future sessions: two forensic subagents ran read-only; one initially
concluded "no deletion ever happened" because it misread the restored file's mtime as
pristine and inherited my wrong search window (UTC/local mix-up). Direct first-hand
observations (git porcelain) outrank subagent synthesis when they conflict.
