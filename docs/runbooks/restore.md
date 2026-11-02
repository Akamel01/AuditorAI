# Restore Runbook (public tenant schema)

Scope: restores the `public` tenant schema only. `auth` and `storage` are NOT backed up (Supabase-managed). Full-project disaster recovery requires Supabase Pro + PITR add-on; that is not built here.

## Objectives

- RPO 24 h: daily 03:17 UTC backup, 30-day retention.
- RTO 4 h target. The CI drill measures download+decrypt+restore+verify on synthetic data; the operator live drill is the real number.

## Operator inputs / prerequisites

- Offline age private key (never in repo/CI; retain old keys when rotating). Keep it `chmod 600`:
  `chmod 600 <identity-file>`.
- A scratch Postgres 17 target (never production).
- `gh`, `docker`, `age`, `jq`, `sha256sum`.
- The backup secret `BACKUP_POSTGRES_URL` is the daily pipeline's owner connection and is NOT needed for a restore (use `RESTORE_DATABASE_URL` for the scratch target).

## Fetch

```
gh run list -R Akamel01/AuditorAI --workflow backup.yml --limit 5
gh run download -R Akamel01/AuditorAI <run-id> -n auditorai-backup-<YYYY-MM-DD>-<run-id> -D restore-work
```

## Decrypt / verify (manual equivalent of restore.sh)

```
age -d -i <identity-file> -o restore-work/envelope.tar restore-work/*.tar.age
tar -xf restore-work/envelope.tar -C restore-work
dump_sha="$(jq -r .dump_sha256 restore-work/manifest.json)"
( cd restore-work && printf '%s  dump.pgcustom\n' "$dump_sha" | sha256sum -c - )
jq . restore-work/manifest.json
```

## Create a fresh empty database

```
createdb auditorai_restore
export RESTORE_DATABASE_URL='<scratch-url>'   # e.g. postgresql://.../auditorai_restore
psql -d "$RESTORE_DATABASE_URL" -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT count(*) FROM (
  SELECT c.oid FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relkind IN ('r','p','v','m','S','f')
  UNION ALL
  SELECT p.oid FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
  UNION ALL
  SELECT t.oid FROM pg_type t
   WHERE t.typnamespace = 'public'::regnamespace
     AND t.typtype IN ('b','c','d','e','r','m')
) s;
SQL
```

Expect `0`. `restore.sh` uses the same query with extension-owned objects excluded. Use a
Postgres 17 client (`pg_restore`/`psql`) for the manual path; the script runs the clients inside
`postgres:17` via Docker.

## Restore

```
RESTORE_DATABASE_URL='<scratch-url>' BACKUP_AGE_IDENTITY='<identity-file>' ENVELOPE='restore-work/<file>.tar.age' bash scripts/backup/restore.sh
```

Manual equivalent:

```
export RESTORE_DATABASE_URL='<scratch-url>'
pg_restore --schema=public --no-owner --no-privileges --exit-on-error -d "$RESTORE_DATABASE_URL" restore-work/dump.pgcustom
psql -d "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0003_roles.sql
psql -d "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0004_seats_invites.sql
psql -d "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0005_audit_trail.sql
psql -d "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'ANALYZE;'
```

## Verify

- Counts vs manifest (restore.sh prints `counts_match=true`; manual `jq` comparison).
- RLS catalog 10/10, role invariant, behavioral cross-tenant probe.
- Record `restore_seconds`. Cut over only if all green. If the probe is skipped (fewer than two workspaces), record that.

## Re-point

Set `auditorai_app` password out of band (`alter role auditorai_app password '<operator-generated>';`), point `TENANT_POSTGRES_URL` at the restored project's pooled app URL, never reuse the old password.

## Failure handling

- Hash mismatch -> re-download.
- Counts mismatch -> investigate concurrent writes / partial restore.
- RLS failure -> stop, do not cut over.
- Non-empty target refused by design.
- Expired artifact -> dispatch a new backup and record the RPO gap.

## Operator live drill

Download the latest production artifact, restore into a scratch project/DB, record the real seconds and attach to the release record. Never restore over production.

## PITR

Not implemented. Paid upgrade path = Supabase Pro + PITR add-on; document the RPO improvement.

## Security

Public repo -> artifact encrypted. Key custody/rotation. Never paste URL/key/password into a ticket or log.
