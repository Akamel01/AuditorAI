#!/bin/zsh
# AuditorAI discovery daemon — hourly live harvest.
# - Secrets resolved strictly in this order inside the pipeline:
#   1) env vars (CI / GitHub Secrets)
#   2) macOS Keychain services auditorai/discovery-{brave,cse-key,cse-cx}
# - This wrapper pre-exports Keychain values so the headless LaunchAgent
#   never needs to trigger a GUI permission dialog at fetch time.
# - Every package stays in state/discovery-ledger.json (append-only) and
#   state/odd-coverage.json (derived). Never hand-edit derived files.
set -euo pipefail
ROOT="/Users/akamel/Documents/AuditorAI"
LOG="/tmp/auditorai-discovery.log"
mkdir -p "$(dirname "$LOG")"

for svc in discovery-brave discovery-cse-key discovery-cse-cx; do
  env_name="$(printf %s "$svc" | tr 'a-z-' 'A-Z_' | sed 's/^/DISCOVERY_/')"
  # normalize: discovery-brave -> DISCOVERY_BRAVE_API_KEY etc. (handled below)
  case "$svc" in
    discovery-brave)   var=DISCOVERY_BRAVE_API_KEY ;;
    discovery-cse-key) var=DISCOVERY_GOOGLE_CSE_KEY ;;
    discovery-cse-cx)  var=DISCOVERY_GOOGLE_CSE_CX ;;
  esac
  if [ -z "${(P)var:-}" ] 2>/dev/null; then
    val="$(security find-generic-password -a "$USER" -s "auditorai/$svc" -w 2>/dev/null || true)"
    if [ -n "$val" ]; then export "$var=$val"; fi
  fi
done

# Brave is the only required live secret (CSE is deprecated/optional)
if [ -z "${DISCOVERY_BRAVE_API_KEY:-}" ]; then
  echo "[$(date -u +%FT%TZ)] discovery: no DISCOVERY_BRAVE_API_KEY (Keychain auditorai/discovery-brave empty) — skipping live harvest" >> "$LOG"
  exit 0
fi

cd "$ROOT"
# 1 rps / 2-concurrent per host is enforced inside the pipeline (src/discovery/ratelimit.ts)
if ! npx --yes tsx scripts/discovery-run.ts --live --write >> "$LOG" 2>&1; then
  echo "[$(date -u +%FT%TZ)] discovery: harvest failed — see $LOG" >&2
  exit 1
fi

echo "[$(date -u +%FT%TZ)] discovery: ok — $(jq '.entries | length' state/discovery-ledger.json 2>/dev/null || echo '?') ledger entries" >> "$LOG"
