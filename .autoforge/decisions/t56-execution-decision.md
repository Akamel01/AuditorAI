# Orchestrator decisions — ticket #56 execution

Date: 2026-11-02. Authority: orchestrator, after discovery/grilling/architecture.
Scope freeze: free tier only; no PITR implementation, no real DB connection, no accounts/secrets,
no app or schema changes, no other tickets.

## OD-1 — Restore path: full custom-format restore, then re-apply 0003→0005

**Decision.** The backup archive carries schema + data for `public` only (`pg_dump --schema=public
--format=custom --no-owner --no-privileges`). Restore into an **empty** database with
`pg_restore --no-owner --no-privileges --exit-on-error`, then re-apply `0003_roles.sql`,
`0004_seats_invites.sql`, `0005_audit_trail.sql` (idempotent) to recreate the cluster-level
`auditorai_app` role and the column/table grants that `--no-privileges` deliberately excludes.

**Why override the architecture's D4 (migrations-first + `--data-only`).** A data-only restore into a
schema that already has foreign keys depends on pg_restore's data ordering; a table-order change or a
future FK can fail mid-restore. A full restore loads tables before post-data constraints, so FK order is
pg_dump's problem, not the operator's. The backup also stays self-contained (schema + data), which is
what "restore a backup" means. The cost is re-running three idempotent migration files for roles/grants,
which the drill proves on every PR.

**Precondition.** The restore connection must be the direct owner role with `rolsuper OR rolbypassrls`
(Supabase `postgres` has `bypassrls`). `pg_dump`/`pg_restore` set `row_security=off` and fail on RLS
tables otherwise. Never use `TENANT_POSTGRES_URL` (the `auditorai_app` role) for backup or restore.

## OD-2 — Shared scripts, one artifact format

`scripts/backup/backup.sh` is the single dump/manifest/age implementation used by the daily workflow and
the drill. `scripts/backup/restore.sh` is the single decrypt/hash-check/restore/re-grant implementation
used by the runbook and the drill. Artifact: one `auditorai-backup-<date>-<run_id>.tar.age` containing
`dump.pgcustom` + `manifest.json`. Manifest is inside the age envelope (public repo; row counts are
customer metadata). Actions artifact retention: 30 days.

## OD-3 — Naming and fail-closed

GitHub secret `BACKUP_POSTGRES_URL` (direct, non-pooled owner connection);
GitHub variable `BACKUP_AGE_RECIPIENT` (`age1…`). Both documented empty in `.env.example` as CI-only.
Backup fails closed (`::error::`, exit 1) when either is unset; the drill uses an ephemeral
`age-keygen` pair and needs neither.

## OD-4 — Drill scope

Drill seeds a disposable `postgres:17` service with migrations `0001→0005` per the orchestrator
directive (the issue comment says 0001–0004; 0005 is current head), two workspaces, and rows in all ten
tenant tables. It exercises the same `backup.sh`/`restore.sh` path, compares restored counts to the
manifest with `jq -e`, runs the RLS catalog + role + behavioral probe, writes measured
download+decrypt+restore+verify seconds to `$GITHUB_STEP_SUMMARY`, and fails at `>= 14400` s (RTO 4 h).
The 4 h gate is a liveness guard on synthetic data; the operator's live drill is the production number.

## OD-5a — Plan critique folded in (2026-11-02)

`.autoforge/reviews/plan-critique-t56.md` raised two blockers, both incorporated:

1. **B1 — `CREATE SCHEMA public` collision.** `pg_dump --schema=public` emits a `CREATE SCHEMA public`
   TOC entry; restoring with `--exit-on-error` into a database that already has `public` aborts before
   any table. Fix: `pg_restore --schema=public` (filters the standalone schema entry) in
   `restore.sh` and the runbook; the empty-`public` preflight now also counts functions/types and
   excludes extension-owned objects.
2. **B2 — drill seed / `CREATE DATABASE` used host `psql` with no URL.** Fix: every drill SQL step runs
   in `docker run --network host postgres:17 psql "$URL" -v ON_ERROR_STOP=1 …`; no host client.

Non-blocking notes folded in: drill job timeout raised to 250 minutes so the 14400 s gate is
reachable; every verification `psql` call uses `-v ON_ERROR_STOP=1`; `RUN_ID` is optional (defaults to
`local`) and only the URL/recipient are fail-closed.

## OD-5 — Test seam

One static vitest contract (`tests/contract/backup-restore.test.ts`) parses both workflow YAML files and
asserts schedule, retention 30, secret/variable names, step order, identical `postgres:17`, drill
triggers, migrations `0001→0005`, the `14400` gate, the ten tenant table names (from 0001+0005), and the
`.env.example`/runbook names plus RPO/RTO/PITR statements. Behavioral proof is the drill only (no local
Docker/pg_dump/age in this worktree).
