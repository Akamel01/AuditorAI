# Architecture Decisions — Ticket #56 (re-scoped 2026-10-25)

Daily age-encrypted `pg_dump`, encrypted manifest, restore runbook, CI restore drill. Scope frozen: no
PITR, no real DB connection, no accounts/secrets, no app/schema changes. Head is `0005` (orchestrator
directive overrides the issue's `0001–0004`). Status: proposed. External facts cite URLs; repo claims cite
`path:line`.

## D1 — One encrypted envelope per backup (manifest inside)

**Decision.** Produce one artifact file `auditorai-backup-<YYYY-MM-DD>-<run_id>.tar.age` containing
`dump.pgcustom` and `manifest.json`; `upload-artifact@v4`, `retention-days: 30`, artifact name
`auditorai-backup-<date>-<run_id>`, `if-no-files-found: error`. Manifest is inside the age envelope. Step
summary prints only sizes, duration, ciphertext SHA-256, table count — never row counts.
**Why.** The repo is public, so artifacts are world-readable. Table names are public in migrations
(`0001_tenant_schema.sql:32-139`, `0005_audit_trail.sql:8`), but row counts leak customer scale. One
envelope = one fetch/decrypt and age's AEAD integrity.
**Alternatives.** Plaintext manifest (leaks metadata); two sibling `.age` files (extra steps, no benefit);
release asset (no auto-expiry, release plumbing).
**Reversibility.** High — split the tar or move the manifest out by changing encrypt/decrypt lines only.
**Risk.** Without the key the manifest is unreadable (fine — only the key holder restores). Rotating the
recipient makes old artifacts unreadable unless old private keys are retained.

## D2 — Use `postgres:17` in Docker, not the runner's client 16

**Decision.** Run `pg_dump`/`psql`/`pg_restore` via `docker run --rm --network host postgres:17 …`;
`PG_IMAGE=postgres:17` in both workflows; never the host client.
**Why.** Ubuntu 24.04 ships PostgreSQL 16.15 (runner image readme); Supabase is 17. `pg_dump` refuses a
server newer than its major (PG docs, app-pgdump). Docker is preinstalled; the image pins a matching
`pg_restore`. Client 17 dumps server 16 or 17, covering both likely majors.
**Alternatives.** PGDG apt client 17 (repo/key/apt drift); host client 16 (fails on 17); `postgres:16`
drill (inconsistent with production).
**Reversibility.** High — one `PG_IMAGE` string; contract test requires equality.
**Risk.** Server 18 requires bumping both workflows or the dump fails closed. Minor tag drift is acceptable;
digest pinning is optional hardening.

## D3 — Dump only `public`, custom format, no owner/ACLs

**Decision.** `pg_dump --format=custom --schema=public --no-owner --no-privileges --compress=9 --no-password`.
**Why.** Migrations own exactly the `public` tenant schema. A whole-DB dump includes Supabase-managed
`auth`/`storage`, which a migration-seeded restore DB lacks, so data-only restore (D4) would fail. Roles are
cluster-level and never dumped; `--no-owner --no-privileges` keeps the archive portable. Roles/grants come
from `0003_roles.sql:16-23,39-55`, `0004:22-26,156-162`, `0005:51-55`. Custom format enables `pg_restore`.
**Alternatives.** Whole-DB dump (breaks data-only restore); plain SQL (no selective restore); explicit
`--table` list (equivalent, but `--schema` stays correct if a future migration adds a table).
**Reversibility.** High — flags are local to one step.
**Risk/boundary.** Supabase `auth`/`storage` (sign-in identities) is not backed up; platform-managed and
outside #56. Runbook states this so a restore is not mistaken for full-project DR.

## D4 — Restore = migrations first, then `pg_restore --data-only` as a BYPASSRLS role

**Decision.** Fresh DB: apply `0001→0005` with the owner connection, then
`pg_restore --data-only --no-owner --no-privileges --exit-on-error -d "$URL" dump.pgcustom`, then `ANALYZE`.
Drill and runbook use the same path.
**Why.** `pg_dump`/`pg_restore` set `row_security=off` and error if the role cannot bypass RLS (PG docs,
app-pgdump); `COPY FROM` cannot apply policies, so the same bypass is required. Both must be superuser/`BYPASSRLS` — on
Supabase the owner `postgres` role. Hence `BACKUP_POSTGRES_URL` is the direct owner connection, never
`TENANT_POSTGRES_URL` (`supabase/README.md:98-105`). Migrations-first keeps schema/policies/roles out of the
dump, avoids drift, and makes a dump/migration mismatch a hard failure. `auditorai_app` is recreated by
`0003:16-23`; its password is set out of band (`supabase/README.md:40-41`); the dump adds no roles/grants.
**Alternatives.** Full restore then re-apply 0003/0004/0005 (drift, policy re-runs); data-only as
`auditorai_app` (fails FORCE RLS/COPY); temporarily `NO FORCE` (mutates the isolation guarantee).
**Reversibility.** High — documented sequence, not code.
**Risk.** FK ordering relies on pg_restore archive order; the seeded drill proves it. The restore role must
be the one that applied migrations (also grants membership in `auditorai_app` at `0003:26-37` for the probe).

## D5 — RLS verification: catalog + role + behavioral probe

**Decision.** On the restored DB: (1) all 10 tables have `relrowsecurity AND relforcerowsecurity`;
(2) `auditorai_app` exists, is not superuser, not `BYPASSRLS`, and owns no `pg_class` object; (3) under
`SET LOCAL ROLE auditorai_app` with A's claims, A's `projects` rows are visible and B's are zero; `ROLLBACK`.
Exact SQL in `report-t56.md` §D.
**Why.** Catalog alone cannot prove enforcement; the read-only probe exercises the same GUC/policy path the
app uses (`supabase/README.md:122-135`, `0002:26-32,110-124`). The role assertion pins
`supabase/README.md:98-105`/`0003:16-23`. Read-only means no cleanup and no write masking a failure.
**Alternatives.** Insert-then-switch probe (needs grants + cleanup); policy-text grep (no enforcement);
probe every table (catalog already covers all 10).
**Reversibility.** High — SQL only.
**Risk.** Needs two seeded workspaces with one project each; the drill provides them, the runbook takes the
first two workspace IDs from the restored data.

## D6 — Manifest fields, generation point, retrieval

**Decision.** `manifest.json`: `format`, `created_at`, `run_id`, `dump_file`, `dump_sha256` (plaintext dump),
`pg_dump_version`, `server_version`, `schema:"public"`, `tables:{…10…}`. Generated immediately after the
dump from the same connection. Fetched from the same artifact by the drill and by `gh run download` in the
runbook. Restore compares `sha256sum dump.pgcustom` and restored counts to the manifest.
**Why.** One artifact/source of truth; no plaintext metadata on a public repo. Hash catches a bad decrypt
before touching the DB; counts catch an empty/partial restore.
**Known limit.** Counts are post-dump, so concurrent writes can make the manifest slightly newer than the
dump. Drill has no concurrent writer and enforces exact equality; runbook investigates a mismatch.
Snapshot-identical counts need `pg_export_snapshot` + a held transaction + `pg_dump --snapshot` —
disproportionate for a daily free-tier job.
**Alternatives.** Pre-dump counts (drift the other way); plaintext manifest (D1); no counts (loses restore proof).
**Reversibility.** High.
**Risk.** A mismatch in a busy window is ambiguous; the investigation step and exact drill cover the mechanism.

## D7 — Separate `restore-drill.yml`, one job, native service container

**Decision.** New `.github/workflows/restore-drill.yml`; triggers `pull_request`, `push:[main]`,
`workflow_dispatch`; `permissions: contents: read`; timeout 30 min; concurrency
`restore-drill-${{ github.ref }}`, cancel-in-progress true. One job: `postgres:17` service (`pg_isready`,
`5432:5432`), `docker run --network host postgres:17` clients. Round-trip: migrations → seeded two-tenant
data (all 10 tables) → dump/manifest/tar/age with ephemeral keypair → `upload-artifact` (retention 1) →
`download-artifact` → fresh DB + migrations → decrypt/verify hash → data-only restore → D5 + counts. Timer
covers download+decrypt+restore+verify; seconds to `$GITHUB_STEP_SUMMARY`; fail at `>= 14400`.
**Why.** Keeps Docker/Postgres/timing out of `ci.yml:64-80`; independently requireable; one job keeps the
artifact round-trip; ephemeral keypair avoids operator secrets; health check avoids start races.
**Alternatives.** Job in `ci.yml` (slows core CI, hides timing); two jobs (faithful but doubles setup);
host client 16 (D2); `paths` filter (skips self-test).
**Reversibility.** High — delete the file; `ci.yml` untouched.
**Risk.** Tiny synthetic data makes the 4 h gate a liveness guard, not production RTO; the operator live
drill is the real measurement. Branch protection must include this workflow to block merges.

## D8 — Secret/variable names and fail-closed

**Decision.** Secret `BACKUP_POSTGRES_URL` = direct, non-pooled, privileged (superuser/`BYPASSRLS`) owner
connection. Variable `BACKUP_AGE_RECIPIENT` = `age1…` public key; private key operator-held. Both documented
empty in `.env.example` as CI-only. Backup exits 1 with `::error::` when either is unset; drill uses neither.
**Why.** A silent skip would report green for a backup that never happened (contrast `deploy.yml:16-26`).
The role requirement is correctness: pg_dump with `NOBYPASSRLS` errors on RLS tables (Supabase KB), and
`TENANT_POSTGRES_URL` names that role (`supabase/README.md:119-120`).
**Alternatives.** Skip cleanly (dishonest RPO); age private key as a secret (not needed by CI).
**Reversibility.** High.
**Risk.** Scheduled runs red until configured; intended. A wrong recipient is undetectable until restore;
runbook adds a first-run decrypt check.

## D9 — Test seam: static contract in vitest, behavior only in CI

**Decision.** `tests/contract/backup-restore.test.ts` (runs via `npm run test`, `ci.yml:78`) parses both
workflows with the existing `yaml` devDep (`package.json:48`) and asserts: schedule, retention, secret/var
refs, step order dump→count→encrypt→upload, identical `postgres:17`, drill triggers/migrations/`14400`/
summary, the 10 table names derived from `0001`+`0005`, and the runbook/`.env.example` contract. It cannot
prove dump/restore/RLS/age; that is the drill's job.
**Why.** Local machines lack `pg_dump`/`age`/Docker (discovery), and `vitest.config.ts:4-12` forbids a real
pool; static contract is the only honest unit seam. PGlite is not PG 17 + Supabase roles/RLS.
**Alternatives.** PGlite integration (does not exercise pg_dump/age); shell test in CI (duplicates drill).
**Reversibility.** High.
**Risk.** Static tests can pass while the drill is broken; the drill is the required check.

## Failure matrix

| Failure | Behavior |
|---|---|
| `BACKUP_POSTGRES_URL`/`BACKUP_AGE_RECIPIENT` unset | Backup fails before DB contact |
| Role lacks superuser/`BYPASSRLS` | Preflight fails (pg_dump would error on RLS) |
| pg_dump network/auth/version | Step red; no artifact (upload not reached) |
| Count/manifest/encrypt | Step red; no artifact |
| Artifact older than 30 d | Gone by design; RPO gap documented; dispatch re-run |
| Wrong recipient/lost key | Undetectable until restore; custody + first-run decrypt |
| Restore without `BYPASSRLS` | Preflight fails before COPY |
| Count/RLS mismatch | Drill red; runbook blocks cutover |
| Drill >4 h | Step red; seconds in summary |

## Operator-only inputs (not decisions)

Actual `BACKUP_POSTGRES_URL` value; age private-key custody/rotation; Supabase server major (if not 17, bump
`PG_IMAGE` in both workflows).
