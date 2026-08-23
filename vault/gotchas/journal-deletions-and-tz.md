# Journal deletions by parallel sessions + UTC/local timestamp confusion

Incident 2026-08-23 (~01:13–01:21 local): a live parallel agent session deleted
`vault/journal/2026-08-23-ticket-21-verify-close.md` from the working tree minutes after
it was committed. Cost >5 min across two forensic subagent runs to attribute.

## Lessons

1. **Append-only is a git convention, not a filesystem guarantee.** Any process holding a
   shell in this repo can `rm` vault files regardless of the V1 charter. When
   `git status --porcelain` shows an unexpected ` D` on a journal file:
   it is a REAL deletion — verify with `stat` + `shasum <file>` vs `git show HEAD:<path>`,
   then `git restore <path>`. Never re-write the entry from memory.

2. **Attribution order that works** (evidence gathered 2026-08-23):
   - Sync tools first, they're cheapest to exonerate: Obsidian installed?
     (`~/Library/Application Support/obsidian`), iCloud Documents sync
     (`defaults read com.apple.finder FXICloudDriveDocuments`), Dropbox/Syncthing in `ps`.
   - Repo actors second: worktrees, hooks, destructive scripts (`git log --all
     --diff-filter=D -- vault/`).
   - Humans/parallel sessions last — and note **agent-transcript greps cannot exonerate
     agents**: opencode session transcripts were not found under `~/.claude/projects`,
     `~/.config/opencode`, or `~/.opencode`, so absence of evidence there proves nothing.

3. **UTC vs local timestamps burn real time.** GitHub/CI timestamps are UTC; this machine
   is PDT (UTC−7). Correlating a local file mtime against CI run times without converting
   sent forensics hunting a nonexistent 8-hour-wide window. Convert first:
   `date -u`; ` TZ=... date`.

## Deterrent

`scripts/watch-vault-journal.sh` (requires `brew install fswatch`) logs deletions of
`vault/journal/**` to `~/Library/Logs/auditorai-journal-watch.log` with UTC timestamps,
outside the repo. Start it with:

    nohup scripts/watch-vault-journal.sh >/dev/null 2>&1 &
