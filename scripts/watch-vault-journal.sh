#!/bin/sh
# Watch vault/journal for deletions; log OUTSIDE the repo.
# Requires: fswatch (brew install fswatch)
# Run persistently: nohup scripts/watch-vault-journal.sh >/dev/null 2>&1 &

set -eu
REPO="$(cd "$(dirname "$0")/.." && pwd)"
WATCH="$REPO/vault/journal"
LOG="$HOME/Library/Logs/auditorai-journal-watch.log"

mkdir -p "$(dirname "$LOG")"
echo "$(date -u +%FT%TZ) watcher started pid=$$ on $WATCH" >> "$LOG"

# shellcheck disable=SC2016
fswatch -x --event=Removed --format='%p' "$WATCH" | while read -r path; do
  echo "$(date -u +%FT%TZ) DELETED $path" >> "$LOG"
  echo "DELETED: $path" >&2
done
