#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ -z "${BACKUP_POSTGRES_URL:-}" ]]; then
  echo "::error::BACKUP_POSTGRES_URL is required" >&2
  exit 1
fi
if [[ -z "${BACKUP_AGE_RECIPIENT:-}" ]]; then
  echo "::error::BACKUP_AGE_RECIPIENT is required" >&2
  exit 1
fi
case "$BACKUP_AGE_RECIPIENT" in
  age1*) ;;
  *)
    echo "::error::BACKUP_AGE_RECIPIENT must start with age1" >&2
    exit 1
    ;;
esac

PG_IMAGE="${PG_IMAGE:-postgres:17}"
OUT_DIR="${OUT_DIR:-backup-out}"
RUN_ID="${RUN_ID:-local}"
BACKUP_DATE="${BACKUP_DATE:-$(date -u +%F)}"

for c in docker age jq; do
  if ! command -v "$c" >/dev/null 2>&1; then
    echo "::error::missing required command: $c" >&2
    exit 1
  fi
done

workdir="$(mktemp -d)"
partial_envelope=""
cleanup() {
  rm -rf "$workdir"
  if [[ -n "$partial_envelope" && -f "$partial_envelope" ]]; then
    rm -f "$partial_envelope"
  fi
}
trap cleanup EXIT

cat > "$workdir/preflight.sql" <<'SQL'
SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user;
SHOW server_version;
SQL

preflight_out="$(docker run --rm --network host -e BACKUP_POSTGRES_URL -v "$workdir:/work:ro" "$PG_IMAGE" sh -c 'psql "$BACKUP_POSTGRES_URL" -At -v ON_ERROR_STOP=1 -f /work/preflight.sql')"
first_line="$(printf '%s\n' "$preflight_out" | sed -n '1p')"
if [[ "$first_line" != "t" ]]; then
  echo "::error::role must be superuser or BYPASSRLS; never use TENANT_POSTGRES_URL" >&2
  exit 1
fi
server_version="$(printf '%s\n' "$preflight_out" | sed -n '2p')"
server_major="${server_version%%.*}"
if [[ ! "$server_major" =~ ^[0-9]+$ ]]; then
  echo "::error::could not read server_version from preflight" >&2
  exit 1
fi
if (( server_major > 17 )); then
  echo "::error::bump PG_IMAGE in both workflows" >&2
  exit 1
fi

pg_dump_version="$(docker run --rm "$PG_IMAGE" pg_dump --version)"

start_ts="$(date +%s)"
docker run --rm --network host --user "$(id -u):$(id -g)" -e BACKUP_POSTGRES_URL -v "$workdir:/work" "$PG_IMAGE" sh -c 'pg_dump --format=custom --schema=public --no-owner --no-privileges --compress=9 --no-password --file=/work/dump.pgcustom "$BACKUP_POSTGRES_URL"'
end_ts="$(date +%s)"
dump_seconds=$((end_ts - start_ts))

cat > "$workdir/counts.sql" <<'SQL'
SELECT jsonb_object_agg(t, n ORDER BY t) FROM (
  SELECT 'workspaces' t, count(*) n FROM public.workspaces
  UNION ALL SELECT 'workspace_members', count(*) FROM public.workspace_members
  UNION ALL SELECT 'workspace_credentials', count(*) FROM public.workspace_credentials
  UNION ALL SELECT 'projects', count(*) FROM public.projects
  UNION ALL SELECT 'audits', count(*) FROM public.audits
  UNION ALL SELECT 'audit_issues', count(*) FROM public.audit_issues
  UNION ALL SELECT 'attachments', count(*) FROM public.attachments
  UNION ALL SELECT 'artifacts', count(*) FROM public.artifacts
  UNION ALL SELECT 'artifact_summaries', count(*) FROM public.artifact_summaries
  UNION ALL SELECT 'audit_trail_entries', count(*) FROM public.audit_trail_entries
) s;
SQL

counts_json="$(docker run --rm --network host -e BACKUP_POSTGRES_URL -v "$workdir:/work:ro" "$PG_IMAGE" sh -c 'psql "$BACKUP_POSTGRES_URL" -At -v ON_ERROR_STOP=1 -f /work/counts.sql')"

dump_sha256="$(sha256sum "$workdir/dump.pgcustom" | awk '{print $1}')"
created_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
manifest="$workdir/manifest.json"
jq -n \
  --arg created_at "$created_at" \
  --arg run_id "$RUN_ID" \
  --arg dump_sha256 "$dump_sha256" \
  --arg pg_dump_version "$pg_dump_version" \
  --arg server_version "$server_version" \
  --argjson tables "$counts_json" \
  '{format:1, created_at:$created_at, run_id:$run_id, dump_file:"dump.pgcustom", dump_sha256:$dump_sha256, pg_dump_version:$pg_dump_version, server_version:$server_version, schema:"public", tables:$tables}' > "$manifest"

jq -e '.format==1 and .schema=="public" and (.tables|length)==10' "$manifest" >/dev/null

mkdir -p "$OUT_DIR"
envelope="$OUT_DIR/auditorai-backup-${BACKUP_DATE}-${RUN_ID}.tar.age"
partial_envelope="$envelope"
tar -C "$workdir" -cf - dump.pgcustom manifest.json | age -r "$BACKUP_AGE_RECIPIENT" -o "$envelope"
rm -f "$workdir/dump.pgcustom" "$workdir/manifest.json"
partial_envelope=""

artifact_name="auditorai-backup-${BACKUP_DATE}-${RUN_ID}"
envelope_bytes="$(stat -c %s "$envelope")"
ciphertext_sha256="$(sha256sum "$envelope" | awk '{print $1}')"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'artifact_name=%s\n' "$artifact_name" >> "$GITHUB_OUTPUT"
  printf 'envelope=%s\n' "$envelope" >> "$GITHUB_OUTPUT"
fi
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    printf '## Backup OK\n'
    printf -- '- artifact: `%s`\n' "$artifact_name"
    printf -- '- envelope bytes: %s\n' "$envelope_bytes"
    printf -- '- dump seconds: %s\n' "$dump_seconds"
    printf -- '- ciphertext sha256: `%s`\n' "$ciphertext_sha256"
    printf -- '- table_count=10\n'
  } >> "$GITHUB_STEP_SUMMARY"
fi

echo "backup_ok=true"
echo "artifact_name=$artifact_name"
echo "table_count=10"
