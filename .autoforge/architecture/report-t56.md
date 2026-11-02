# Architecture Report — Ticket #56 (re-scoped 2026-10-25)
Daily age-encrypted `pg_dump`, encrypted manifest, restore runbook, CI restore drill.
Branch `oc/56`, HEAD `0e26570`. Read-only analysis; decisions/rationale in
`.autoforge/architecture/decisions-t56.md` (D1–D9).

**Verdict.** Implement with two new workflows, one runbook, one `.env.example` block, one static contract
test. No changes to `ci.yml`, migrations, app code, or dependencies. Runner tools: Docker + `jq` preinstalled;
`age` from Ubuntu's archive.

## 1. Boundaries and interfaces
| File | Change | Contract |
|---|---|---|
| `.github/workflows/backup.yml` | new | cron `17 3 * * *` + dispatch; secret `BACKUP_POSTGRES_URL`, var `BACKUP_AGE_RECIPIENT`; one `.tar.age` artifact, retention 30 |
| `.github/workflows/restore-drill.yml` | new | PR + push `main` + dispatch; `postgres:17` service; seeds `0001→0005`; times download+decrypt+restore+verify; fails at `>= 14400` s |
| `docs/runbooks/restore.md` | new | fetch → decrypt → verify → fresh DB → migrations → data-only restore → verify; RPO/RTO/PITR |
| `.env.example` | +2 names | CI-only block, empty values, after `:60` |
| `tests/contract/backup-restore.test.ts` | new | static YAML/docs/SQL contract; no Postgres |

Unchanged: `ci.yml:64-80` runs `npm run test` (`package.json:15`); pre-commit parses every workflow YAML
(`.githooks/pre-commit:45-52`). Artifact envelope: `auditorai-backup-<YYYY-MM-DD>-<run_id>.tar.age`
containing `dump.pgcustom` and `manifest.json` (encrypted with the dump). Manifest: `{format:1, created_at,
run_id, dump_file, dump_sha256, pg_dump_version, server_version, schema:"public", tables:{<10 tenant
tables>: count}}`. Step summary carries sizes/duration/ciphertext SHA-256/table count, never row counts
(public repo).

## 2. Data flow
**Backup:** cron → fail-closed env check → role preflight (`rolsuper OR rolbypassrls`, server version) →
`docker run postgres:17 pg_dump --schema=public …` → counts from the same connection → manifest → tar →
`age -r "$BACKUP_AGE_RECIPIENT"` → `upload-artifact` (30 d) → step summary. No checkout, no app code; concurrency `db-backup` (no cancel), timeout 60 min.
**Drill:** `postgres:17` service (`pg_isready`) → `0001→0005` into `drill` → seed two workspaces and rows
across all 10 tables → dump/manifest/tar/age with ephemeral `age-keygen` keypair → upload (1 d) → download →
fresh `drill_restore` DB + migrations → decrypt/verify `dump_sha256` → `pg_restore --data-only` → catalog,
role, probe, counts → timing summary, red at 14400 s.
**Operator:** `gh run download -R Akamel01/AuditorAI <run-id> -n auditorai-backup-<date>-<run-id>` →
decrypt with offline key → same verify/restore path on a scratch Postgres 17 → cutover only after green.

## 3. Resolutions A–H
**A. Artifact/manifest.** One encrypted tar envelope; manifest **inside**. 30-day Actions artifact,
`upload-artifact@v4`, `compression-level: 0`, `if-no-files-found: error`; upload is last, so a failed
dump/count/encrypt leaves no artifact. Release assets rejected (no auto-expiry).
**B. pg client.** `docker run --rm --network host postgres:17 …`; no host client. Ubuntu 24.04 ships client
16.15, Supabase is 17, and `pg_dump` refuses a newer server. One `PG_IMAGE` string in both workflows.
Drill uses `postgres:17` consistently.
**C. Dump/restore.** `--format=custom --schema=public --no-owner --no-privileges --compress=9 --no-password`.
`--schema=public` avoids Supabase-managed `auth`/`storage` schemas that a migration-seeded DB lacks.
Restore order: **apply `0001→0005`, then `pg_restore --data-only --no-owner --no-privileges
--exit-on-error`**. Safer than full restore + re-applying 0003/0004/0005: schema stays version-controlled,
no policy/ACL re-run, drift is a hard failure. `pg_dump`/`pg_restore` set `row_security=off` and error
unless superuser/`BYPASSRLS`; `COPY FROM` cannot apply policies, so the restore path needs that bypass. Both use the direct owner connection
(Supabase `postgres` has `bypassrls`), never `auditorai_app`. Runbook asserts the precondition.
**D. RLS verification (exact shapes).** Preflight (backup and restore; must print `t`):
```sql
SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user;
```
Catalog — 10/10 enabled + forced:
```sql
DO $$ DECLARE ok int; BEGIN
  SELECT count(*) INTO ok FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname = ANY (ARRAY['workspaces','workspace_members','workspace_credentials','projects',
      'audits','audit_issues','attachments','artifacts','artifact_summaries','audit_trail_entries'])
    AND c.relrowsecurity AND c.relforcerowsecurity;
  IF ok <> 10 THEN RAISE EXCEPTION 'RLS catalog assertion: %/10 forced', ok; END IF;
END $$;
```
Role invariant:
```sql
DO $$ DECLARE r record; owned int; BEGIN
  SELECT rolsuper, rolbypassrls INTO r FROM pg_roles WHERE rolname = 'auditorai_app';
  IF NOT FOUND THEN RAISE EXCEPTION 'auditorai_app missing'; END IF;
  IF r.rolsuper OR r.rolbypassrls THEN RAISE EXCEPTION 'auditorai_app is privileged'; END IF;
  SELECT count(*) INTO owned FROM pg_class WHERE relowner = 'auditorai_app'::regrole;
  IF owned <> 0 THEN RAISE EXCEPTION 'auditorai_app owns % objects', owned; END IF;
END $$;
```
Behavioral cross-tenant probe (read-only; A/B UUIDs from restored data):
```sql
BEGIN;
SET LOCAL ROLE auditorai_app;
SELECT set_config('request.jwt.claims', json_build_object('sub','restore-check','workspace_id','<A>')::text, true);
DO $$ DECLARE own int; leak int; BEGIN
  SELECT count(*) INTO own  FROM public.projects WHERE workspace_id = '<A>';
  SELECT count(*) INTO leak FROM public.projects WHERE workspace_id = '<B>';
  IF own = 0  THEN RAISE EXCEPTION 'own rows invisible under A claims'; END IF;
  IF leak <> 0 THEN RAISE EXCEPTION 'cross-tenant leak: % rows', leak; END IF;
END $$;
ROLLBACK;
```
**E. Row counts.** Generated at backup time from the 10 tables, encrypted in the manifest; same query after restore:
```sql
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
```
Drill: `jq -e --slurpfile actual restored-counts.json '.tables == $actual[0]' manifest.json`. Manifest lives
inside the artifact: drill fetches via `actions/download-artifact`, operator via `gh run download`. Limit:
counts are post-dump, so concurrent writes create a small delta; drill is exact, runbook investigates.
**F. Drill.** Separate `restore-drill.yml`, not a `ci.yml` job: isolates Docker/Postgres/timing from
`ci.yml:64-80`, independently requireable. One job, one service, same-job artifact round-trip. Triggers
`pull_request`, `push:[main]`, `workflow_dispatch`; `permissions: contents: read`; timeout 30 min;
concurrency `restore-drill-${{ github.ref }}`, cancel-in-progress true. Timer starts before download, ends
after verification; seconds in `$GITHUB_STEP_SUMMARY`; fail at `>= 14400`.
**G. Secrets/variables.** Secret `BACKUP_POSTGRES_URL` (direct non-pooled owner, superuser/`BYPASSRLS`);
variable `BACKUP_AGE_RECIPIENT` (`age1…`). Both in `.env.example` as CI-only, empty. Backup fails closed
(`::error::`, exit 1) when either is unset; drill needs neither. Secret scoped to dump/count/preflight steps,
never job-level or echoed.
**H. Test seam.** Static only (vitest, no Postgres): YAML parse; schedule; retention 30; secret/var refs;
step order dump→count→encrypt→upload; same `postgres:17` in both; drill triggers, `0001→0005` order, `14400`,
step summary; 10 table names match `0001`+`0005`; `.env.example`/runbook names, RPO/RTO/PITR. Behavior is
provable only in the drill; local tools are absent and `vitest.config.ts:4-12` forbids a real pool.

## 4. Failure behavior
| Failure | Result |
|---|---|
| Secret/variable unset | Backup red before DB contact (honest RPO signal) |
| Role not superuser/`BYPASSRLS` | Preflight red; pg_dump would error on RLS |
| pg_dump auth/network/version | Step red; upload not reached; no artifact |
| Count/manifest/encrypt/upload | Step red; no partial success |
| Artifact >30 d | Expired by design; dispatch re-run; gap documented |
| Wrong recipient/key loss | Silent until restore; custody + first-run decrypt check |
| Restore as non-bypass role | Preflight red before any COPY |
| Counts/RLS mismatch or drill >4 h | Drill red; runbook blocks cutover |

## 5. Security notes
- Public repo ⇒ artifacts/summaries world-readable; encryption and encrypted manifest are the boundary.
  Never print counts, URLs, hostnames, or dump content.
- Age private key never enters repo/CI/logs/artifacts; drill uses an ephemeral keypair. Retain old private
  keys when rotating, or old artifacts become unrecoverable.
- `BACKUP_POSTGRES_URL` must never be `TENANT_POSTGRES_URL` (app role, `NOBYPASSRLS`); pg_dump then fails
  closed rather than exporting an empty/partial tenant view.
- Scope boundary: `public` only. Supabase `auth`/`storage` (sign-in identities) are not backed up; runbook
  says so and points full-project recovery at Pro/PITR. Runbook uses placeholders only.
- No `paths` filter on the drill, so workflow edits always exercise it.

## 6. Evidence table
| Claim | Evidence |
|---|---|
| 9 base tenant tables, then a 10th | `supabase/migrations/0001_tenant_schema.sql:32-139`, `0005_audit_trail.sql:8` |
| RLS ENABLE+FORCE on the 9 | `supabase/migrations/0002_rls_policies.sql:39-56` |
| 10th table forced too | `supabase/migrations/0005_audit_trail.sql:40-41` |
| Uniform `workspace_id` policies | `supabase/migrations/0002_rls_policies.sql:110-124` |
| `auditorai_app` NOSUPERUSER/NOBYPASSRLS | `supabase/migrations/0003_roles.sql:16-23` |
| App grants incl. claim helpers | `supabase/migrations/0003_roles.sql:39-55` |
| Column hardening / extra grants | `supabase/migrations/0004_seats_invites.sql:22-26,156-162` |
| Trail select/insert only | `supabase/migrations/0005_audit_trail.sql:51-55` |
| Apply order `0001→0005`; re-runnable | `supabase/README.md:13-23,209-214` |
| Owner bypasses FORCE RLS; app role must not | `supabase/README.md:98-105` |
| App URL names `auditorai_app` | `supabase/README.md:119-120`, `.env.example:47-49` |
| Owner credentials platform-injected, unread by app | `.env.example:54-57` |
| Password set out of band after 0003 | `supabase/README.md:40-41` |
| No Postgres service today; tests in `quality` | `.github/workflows/ci.yml:64-80` |
| Deploy skip-cleanly precedent (rejected here) | `.github/workflows/deploy.yml:16-26` |
| Workflow YAML parsed pre-commit | `.githooks/pre-commit:45-52` |
| `yaml` devDep exists | `package.json:48` |
| Vitest include + offline env | `vitest.config.ts:4-12` |
| Tests are part of CI | `package.json:15`, `.github/workflows/ci.yml:78` |
| No `docs/runbooks/` yet | `.autoforge/discovery/report-t56.md:55` |
| Runner has PG 16.15, Docker, jq | Ubuntu 24.04 runner image readme (PostgreSQL/Docker/jq sections) |
| pg_dump refuses newer server; `row_security=off` errors without bypass | https://www.postgresql.org/docs/17/app-pgdump.html |
| COPY FROM unsupported on RLS; pg_restore `row_security=off` | https://www.postgresql.org/docs/17/sql-copy.html ; https://www.postgresql.org/docs/17/app-pgrestore.html |
| Supabase `postgres` has bypassrls; NOBYPASSRLS dump fails | https://supabase.com/docs/guides/database/postgres/row-level-security ; Supabase KB on pg_dump + RLS |

## 7. Risks / operator inputs
1. **Manifest drift** under concurrent writes (post-dump counts); drill exact, runbook investigates.
2. **Auth/storage not backed up** — sign-in identities need Supabase/Pro/PITR; documented.
3. **Synthetic RTO** — drill proves mechanism, not production duration; operator live drill is the real number.
4. **Branch protection** must require `restore-drill`, else advisory; **no backup-failure alert** is in scope.
5. **Key custody/rotation** is the single restore failure point; no escrow. **PG major bump** requires
   changing `PG_IMAGE` in both workflows; the contract test enforces equality.
6. Operator-only: URL value, private key, server major (branch protection is a repo setting, listed above).
