#!/usr/bin/env bash
set -euo pipefail
umask 077

# Required env
if [[ -z "${RESTORE_DATABASE_URL:-}" ]]; then
  echo "::error::RESTORE_DATABASE_URL is required" >&2
  exit 1
fi
if [[ -z "${BACKUP_AGE_IDENTITY:-}" ]]; then
  echo "::error::BACKUP_AGE_IDENTITY is required" >&2
  exit 1
fi
if [[ -z "${ENVELOPE:-}" ]]; then
  echo "::error::ENVELOPE is required" >&2
  exit 1
fi

# Readability checks (fail closed before any docker/DB call)
if [[ ! -r "$BACKUP_AGE_IDENTITY" ]]; then
  echo "::error::BACKUP_AGE_IDENTITY is not readable" >&2
  exit 1
fi
if [[ ! -r "$ENVELOPE" ]]; then
  echo "::error::ENVELOPE is not readable" >&2
  exit 1
fi

# Required commands
for c in docker age jq sha256sum; do
  if ! command -v "$c" >/dev/null 2>&1; then
    echo "::error::missing required command: $c" >&2
    exit 1
  fi
done

# Optional env with defaults
PG_IMAGE="${PG_IMAGE:-postgres:17}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$REPO_ROOT/supabase/migrations}"

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# Preflight SQL
cat > "$TMP/preflight.sql" <<'SQL'
SELECT count(*) FROM (
  SELECT c.oid FROM pg_class c
  WHERE c.relkind IN ('r','p','v','m','S','f')
    AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
  UNION ALL
  SELECT p.oid FROM pg_proc p
  WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
  UNION ALL
  SELECT t.oid FROM pg_type t
  WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
    AND t.typtype IN ('b','c','d','e','r','m')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')
) x;
SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user;
SQL

preflight_out="$(docker run --rm --network host -e RESTORE_DATABASE_URL -v "$TMP:/work:ro" "$PG_IMAGE" sh -c 'psql "$RESTORE_DATABASE_URL" -At -v ON_ERROR_STOP=1 -f /work/preflight.sql')"
obj_count="$(printf '%s\n' "$preflight_out" | sed -n '1p')"
role_flag="$(printf '%s\n' "$preflight_out" | sed -n '2p')"
if [[ "$obj_count" != "0" ]]; then
  echo "::error::target must be a fresh database" >&2
  exit 1
fi
if [[ "$role_flag" != "t" ]]; then
  echo "::error::restore role must be superuser or BYPASSRLS" >&2
  exit 1
fi

start_ts="$(date +%s)"

# Decrypt + extract
age -d -i "$BACKUP_AGE_IDENTITY" -o "$TMP/envelope.tar" "$ENVELOPE"
tar -xf "$TMP/envelope.tar" -C "$TMP"

# Assert exactly dump.pgcustom and manifest.json
for f in dump.pgcustom manifest.json; do
  if [[ ! -f "$TMP/$f" ]]; then
    echo "::error::missing $f in envelope" >&2
    exit 1
  fi
done
extra="$(find "$TMP" -mindepth 1 -maxdepth 1 ! -name envelope.tar ! -name dump.pgcustom ! -name manifest.json ! -name preflight.sql ! -name counts.sql | wc -l)"
if [[ "$extra" -ne 0 ]]; then
  echo "::error::unexpected files in envelope" >&2
  exit 1
fi

jq -e '.format==1 and .schema=="public" and .dump_file=="dump.pgcustom"' "$TMP/manifest.json" >/dev/null

# Hash verify
dump_sha="$(jq -r .dump_sha256 "$TMP/manifest.json")"
(cd "$TMP" && printf '%s  dump.pgcustom\n' "$dump_sha" | sha256sum -c -) >/dev/null

# Full restore
docker run --rm --network host -e RESTORE_DATABASE_URL -v "$TMP:/work:ro" "$PG_IMAGE" sh -c 'pg_restore --schema=public --no-owner --no-privileges --exit-on-error --no-password -d "$RESTORE_DATABASE_URL" /work/dump.pgcustom'

# Re-apply roles/grants
docker run --rm --network host -e RESTORE_DATABASE_URL -v "$MIGRATIONS_DIR:/migrations:ro" "$PG_IMAGE" sh -c 'psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f /migrations/0003_roles.sql'
docker run --rm --network host -e RESTORE_DATABASE_URL -v "$MIGRATIONS_DIR:/migrations:ro" "$PG_IMAGE" sh -c 'psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f /migrations/0004_seats_invites.sql'
docker run --rm --network host -e RESTORE_DATABASE_URL -v "$MIGRATIONS_DIR:/migrations:ro" "$PG_IMAGE" sh -c 'psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f /migrations/0005_audit_trail.sql'
docker run --rm --network host -e RESTORE_DATABASE_URL "$PG_IMAGE" sh -c 'psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "ANALYZE;"'

# Counts
cat > "$TMP/counts.sql" <<'SQL'
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

docker run --rm --network host -e RESTORE_DATABASE_URL -v "$TMP:/work:ro" "$PG_IMAGE" sh -c 'psql "$RESTORE_DATABASE_URL" -At -v ON_ERROR_STOP=1 -f /work/counts.sql' > "$TMP/counts.json"

jq -e --slurpfile actual "$TMP/counts.json" '.tables == $actual[0]' "$TMP/manifest.json" >/dev/null
echo "counts_match=true"

# RLS catalog
cat > "$TMP/rls_catalog.sql" <<'SQL'
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_class c
  WHERE c.relname IN ('workspaces','workspace_members','workspace_credentials','projects','audits','audit_issues','attachments','artifacts','artifact_summaries','audit_trail_entries')
    AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
    AND c.relrowsecurity AND c.relforcerowsecurity;
  IF n <> 10 THEN RAISE EXCEPTION 'rls catalog %/10', n; END IF;
END $$;
SQL
docker run --rm --network host -e RESTORE_DATABASE_URL -v "$TMP:/work:ro" "$PG_IMAGE" sh -c 'psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f /work/rls_catalog.sql' >/dev/null
echo "rls_catalog=10/10"

# RLS role
cat > "$TMP/rls_role.sql" <<'SQL'
DO $$
DECLARE is_super bool; is_bypass bool; owned int;
BEGIN
  SELECT rolsuper, rolbypassrls INTO is_super, is_bypass FROM pg_roles WHERE rolname='auditorai_app';
  IF NOT FOUND THEN RAISE EXCEPTION 'auditorai_app missing'; END IF;
  IF is_super OR is_bypass THEN RAISE EXCEPTION 'auditorai_app must not be superuser/bypassrls'; END IF;
  SELECT count(*) INTO owned FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE r.rolname='auditorai_app';
  IF owned <> 0 THEN RAISE EXCEPTION 'auditorai_app owns % objects', owned; END IF;
END $$;
SQL
docker run --rm --network host -e RESTORE_DATABASE_URL -v "$TMP:/work:ro" "$PG_IMAGE" sh -c 'psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f /work/rls_role.sql' >/dev/null
echo "rls_role=pass"

# Behavioral probe
ws_ids="$(docker run --rm --network host -e RESTORE_DATABASE_URL "$PG_IMAGE" sh -c 'psql "$RESTORE_DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SELECT id FROM public.workspaces ORDER BY created_at, id LIMIT 2;"')"
ws_count="$(printf '%s\n' "$ws_ids" | grep -c . || true)"
if [[ "$ws_count" -lt 2 ]]; then
  echo "rls_probe=skipped"
else
  ws_a="$(printf '%s\n' "$ws_ids" | sed -n '1p')"
  ws_b="$(printf '%s\n' "$ws_ids" | sed -n '2p')"
  if [[ ! "$ws_a" =~ ^[0-9a-f-]{36}$ || ! "$ws_b" =~ ^[0-9a-f-]{36}$ ]]; then
    echo "::error::invalid workspace id format" >&2
    exit 1
  fi
  cat > "$TMP/rls_probe.sql" <<SQL
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub','restore-check','workspace_id','$ws_a')::text, true);
SET LOCAL ROLE auditorai_app;
DO \$\$
DECLARE own int; leak int;
BEGIN
  SELECT count(*) INTO own FROM public.projects WHERE workspace_id = '$ws_a';
  SELECT count(*) INTO leak FROM public.projects WHERE workspace_id = '$ws_b';
  IF own = 0 THEN RAISE EXCEPTION 'own rows not visible'; END IF;
  IF leak <> 0 THEN RAISE EXCEPTION 'cross-tenant leak'; END IF;
END \$\$;
ROLLBACK;
SQL
  docker run --rm --network host -e RESTORE_DATABASE_URL -v "$TMP:/work:ro" "$PG_IMAGE" sh -c 'psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f /work/rls_probe.sql' >/dev/null
  echo "rls_probe=pass"
fi

end_ts="$(date +%s)"
restore_seconds=$((end_ts - start_ts))
echo "restore_seconds=$restore_seconds"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'restore_seconds=%s\n' "$restore_seconds" >> "$GITHUB_OUTPUT"
fi
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf -- '- restore_seconds: %s\n' "$restore_seconds" >> "$GITHUB_STEP_SUMMARY"
fi
