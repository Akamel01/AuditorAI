# Plan — Ticket #56: daily age-encrypted `pg_dump`, restore runbook, CI restore drill

Status: ready for implementation. Author: autoforge-planner, 2026-11-02.
Ticket: `GH:Akamel01/AuditorAI#56` (re-scoped 2026-10-25; the re-scope comment replaces the body).
Scope freeze: free tier only; no PITR implementation, no real DB connection, no accounts/secrets,
no app or schema changes, no other tickets.

Inputs (all read):
- `.autoforge/discovery/report-t56.md` (facts, A1–A8, unknowns)
- `.autoforge/requirements/grilling-t56.md` (D1–D7)
- `.autoforge/architecture/report-t56.md` (interfaces, SQL, failure behavior)
- `.autoforge/architecture/decisions-t56.md` (D1–D9)
- `.autoforge/decisions/t56-execution-decision.md` (OD-1…OD-5; **OD-1 overrides architecture D4**)
- `.autoforge/discovery/tracker-index.md`, `.autoforge/discovery/tracker-index-t56.md`

---

## 0. Tracker accounting (every index entry)

`tracker-index-t56.md` is the index for this run; `.autoforge/discovery/tracker-index.md` is the
older 2026-10-21 index (it lists #56 as blocked by #53, which is now closed). Neither is edited.

| Entry | Source | Status | Why |
|---|---|---|---|
| **GH#56** | `tracker-index-t56.md:4` | **IN SCOPE** | This ticket: backup + runbook + drill |
| GH#90 Next.js 16 upgrade | `tracker-index-t56.md:2` | out | Separate upgrade; no shared paths |
| GH#89 Dependabot `@types/node` ignores | `tracker-index-t56.md:3` | out | Dependabot policy; no shared paths |
| GH#75 key-scheme home | `tracker-index-t56.md:5` | out | Repository refactor; no shared paths |
| GH#41 enterprise map | `tracker-index-t56.md:6` | out | Parent map, not an implementation ticket |
| `scratch:readiness-framework/map.md` | `tracker-index-t56.md:7` | out | Map corpus; no shared paths |
| `scratch:learning-loop/map.md` | `tracker-index-t56.md:8` | out | Map corpus; no shared paths |
| #40, R1, R2, R3, R5, R6, R7, R8, R9, R10, R11, R12, R14, R15, R16, R17, R18, R19, F2 | `tracker-index.md:8–26` (19 frontier entries) | out | Each is a separate ticket; none is #56 and none shares a `touches` path. #56 adds only `.github/workflows/{backup,restore-drill}.yml`, `scripts/backup/*`, `docs/runbooks/restore.md`, one `.env.example` block, and `tests/contract/backup-restore.test.ts`. |
| #53 (closed), #41, #54, #55, #56, #47, #48, #46, #44, #49, #40, #50 (closed), #51 (closed), F4-postgres-adapter, F2-blob-storage, R1-cross-instance, F1-candidate-findings, F3-vault-sync, G1-stack-hosting, G3-mvp-scope, D1-admin-auth-seam, M1-image-storage, F3-rsc-initial-page-data | `tracker-index.md` "# Tracker Index — ticket #53 discovery" list | out except #56 | #56 is this ticket. #53/#50/#51 are closed. #54/#55 are separate open tickets (#55's `0005_audit_trail.sql` is seeded, never modified). The rest are separate/hitl/frontier items with no shared paths. |
| #60, #41, #40, #56, #55, #54, #53, #49, #48, #47, #46 | `tracker-index.md` "# Tracker Index — ticket #60 discovery" list | out except #56 | #60 is harvest round 2; all others are separate tickets; #56 is this ticket. |
| Non-frontier groups (local `.scratch/*`, wayfinder H/HV/G/C/D/E/M/N/R/V/F/T lanes) | `tracker-index.md:28–47` | out | Closed, resolved, or HITL; not this ticket |

Adjacent (not in either frontier list, noted for the reviewer): #53 is **closed** (unblocks #56);
#54/#55 are open but separate; #55's `0005_audit_trail.sql` is *seeded*, never modified; #47/#48/#46/
#44/#49 were flagged "relevant" in the #53 index but are out of scope here.

---

## 1. Fixed contract (do not relitigate)

| # | Decision | Source |
|---|---|---|
| F1 | Secret `BACKUP_POSTGRES_URL` = direct, non-pooled **owner** URL (`rolsuper OR rolbypassrls`); never `TENANT_POSTGRES_URL`. Variable `BACKUP_AGE_RECIPIENT` = `age1…`. Both empty and CI-only in `.env.example`; backup **fails closed** when unset. | grilling D1; arch D8; OD-3 |
| F2 | One `.tar.age` envelope `auditorai-backup-<YYYY-MM-DD>-<run_id>.tar.age` containing `dump.pgcustom` + `manifest.json`; manifest inside the envelope; Actions artifact `auditorai-backup-<date>-<run_id>`, `retention-days: 30`. | arch D1; OD-2 |
| F3 | `postgres:17` for both workflows, run through Docker; never the runner's client 16. | arch D2; grilling D3 |
| F4 | Dump flags: `--format=custom --schema=public --no-owner --no-privileges --compress=9 --no-password`. `public` only; `auth`/`storage` excluded and documented. | arch D3; OD-1 |
| F5 | **Restore (OD-1):** full custom-format restore into an **empty** DB (`pg_restore --schema=public --no-owner --no-privileges --exit-on-error`), then re-apply `0003→0005` (idempotent) for the cluster role and grants, then `ANALYZE`. **Not** `--data-only`. `--schema=public` suppresses pg_dump's `CREATE SCHEMA public` TOC entry, which would collide with the target's existing `public` schema (critique B1). | OD-1; critique B1 |
| F6 | Separate `.github/workflows/restore-drill.yml`; seeds `0001→0005` on a disposable `postgres:17` service; two workspaces, all ten tables; same `backup.sh`/`restore.sh`; measured download+decrypt+restore+verify seconds in `$GITHUB_STEP_SUMMARY`; fail at `>= 14400` s. | OD-4; grilling D5 |
| F7 | One static vitest contract, `tests/contract/backup-restore.test.ts`; no Postgres. Behavioral proof is the drill only. | arch D9; OD-5 |
| F8 | No PITR implementation. Runbook documents Supabase Pro + PITR add-on as the paid upgrade path. No app/ORM/schema changes. | ticket re-scope; grilling D7 |

---

## 2. Interfaces (single source of truth)

### 2.1 Artifact and manifest

Envelope (tar root, exactly two entries):

```
dump.pgcustom        # pg_dump custom-format archive of schema+data, public only
manifest.json        # plaintext inside the age envelope
```

Artifact/file names:

- file: `auditorai-backup-<YYYY-MM-DD>-<run_id>.tar.age` (UTC date; `run_id` = `github.run_id`)
- Actions artifact: `auditorai-backup-<YYYY-MM-DD>-<run_id>`
- drill upload retention: 1 day; daily backup retention: 30 days.

Manifest schema (`format` 1; field order as written; `tables` keys sorted by the SQL `ORDER BY`):

```json
{
  "format": 1,
  "created_at": "2026-11-02T03:17:00Z",
  "run_id": "1234567890",
  "dump_file": "dump.pgcustom",
  "dump_sha256": "<64 lowercase hex of the plaintext dump>",
  "pg_dump_version": "pg_dump (PostgreSQL) 17.x",
  "server_version": "17.x",
  "schema": "public",
  "tables": {
    "artifact_summaries": 0,
    "artifacts": 0,
    "attachments": 0,
    "audit_issues": 0,
    "audit_trail_entries": 0,
    "audits": 0,
    "projects": 0,
    "workspace_credentials": 0,
    "workspace_members": 0,
    "workspaces": 0
  }
}
```

Rules: `dump_file` is always `dump.pgcustom`; `schema` is always `public`; `tables` has exactly the
ten names below; counts are generated **after** the dump from the same connection (known drift under
concurrent writes — arch D6). Never print counts, URL, hostname, or dump content to logs or summaries.
The step summary carries only: artifact name, envelope bytes, dump duration, ciphertext SHA-256, and
`table_count=10`.

### 2.2 `scripts/backup/backup.sh` contract

Usage: `bash scripts/backup/backup.sh` (no positional args). Required env:
`BACKUP_POSTGRES_URL`, `BACKUP_AGE_RECIPIENT`, `RUN_ID`. Optional: `PG_IMAGE` (default `postgres:17`),
`OUT_DIR` (default `backup-out`), `BACKUP_DATE` (default `date -u +%F`).
`set -euo pipefail`; temp/`OUT_DIR` created with `mkdir -p`; trap removes partial envelope on failure.

Ordered steps (order is contractual; the static test asserts the first four markers):

1. **Fail closed.** Empty URL or recipient → `::error::` + exit 1 before any Docker/DB call. Recipient
   must match `age1*`. The script never reads `TENANT_POSTGRES_URL`; the role preflight is the real
   guard (an app-role URL fails `rolsuper OR rolbypassrls`). Message names the missing variable.
2. **Preflight** (same `PG_IMAGE`, `--network host`):
   - `SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user;` → must print `t`;
   - `show server_version;` → parse major; if major `> 17`, fail with "bump `PG_IMAGE` in both
     workflows" (a 17 client cannot dump an 18 server);
   - `pg_dump --version` captured for the manifest.
3. **Dump** (mounted `OUT_DIR`; `--user "$(id -u):$(id -g)"`). The URL is expanded **inside** the
   container (`sh -c`) so it never appears in the host argv:
   ```
   docker run --rm --network host --user "$(id -u):$(id -g)" \
     -e BACKUP_POSTGRES_URL -v "$PWD/$OUT_DIR:/out" "$PG_IMAGE" \
     sh -c 'pg_dump --format=custom --schema=public --no-owner --no-privileges \
       --compress=9 --no-password --file=/out/dump.pgcustom "$BACKUP_POSTGRES_URL"'
   ```
   The preflight/counts `psql` calls use the same `docker run … -e BACKUP_POSTGRES_URL "$PG_IMAGE"
   sh -c 'psql "$BACKUP_POSTGRES_URL" …'` wrapper.
4. **Counts** (exact query in §2.4), `psql -At -v ON_ERROR_STOP=1`; result is one JSON object.
5. **Manifest** written with `jq -n` from: format 1, created_at UTC, run_id, dump_file, `sha256sum`,
   pg_dump_version, server_version, schema, tables. Validate with `jq -e '.format==1 and .schema=="public"
   and (.tables|length)==10'`.
6. **Encrypt:** `tar -C "$OUT_DIR" -cf - dump.pgcustom manifest.json | age -r "$BACKUP_AGE_RECIPIENT"
   -o "$OUT_DIR/<file>"`. Remove plaintext `dump.pgcustom` and `manifest.json` after a successful
   encrypt. Compute ciphertext `sha256sum`.
7. **Outputs:** append `artifact_name=…` and `envelope=…` to `$GITHUB_OUTPUT` when set; append summary
   lines to `$GITHUB_STEP_SUMMARY` when set. Always print `backup_ok=true`, `artifact_name=…`,
   `table_count=10` (never row counts).

Exit 0 only if all steps succeed. The workflow uploads only after this exits 0, so a failed dump,
count, manifest, or encrypt leaves **no artifact**.

### 2.3 `scripts/backup/restore.sh` contract

Usage: `bash scripts/backup/restore.sh`. Required env: `RESTORE_DATABASE_URL` (target **empty**
database, owner role with `rolsuper OR rolbypassrls`), `BACKUP_AGE_IDENTITY` (path to age identity
file), `ENVELOPE` (path to `.tar.age`). Optional: `PG_IMAGE` (default `postgres:17`),
`MIGRATIONS_DIR` (default `supabase/migrations`). `set -euo pipefail`; trap cleans the temp dir.

Ordered steps:

1. **Fail closed** on missing env or unreadable identity/envelope, before any DB call.
2. **Target preflight:** (a) `public` has no non-extension objects —
   ```sql
   SELECT count(*) FROM (
     SELECT 'pg_class'::regclass AS classid, c.oid FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')
     UNION ALL
     SELECT 'pg_proc'::regclass, p.oid FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
     UNION ALL
     SELECT 'pg_type'::regclass, t.oid FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typtype IN ('b','c','d','e','r','m') AND t.typelem = 0
   ) s
   WHERE NOT EXISTS (SELECT 1 FROM pg_depend d
                     WHERE d.classid = s.classid AND d.objid = s.oid AND d.deptype = 'e');
   ```
   must be `0`; (b) `SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user;`
   must print `t`. Fail with a message that the target must be a fresh database. The check is a guard,
   not the correctness guarantee: `pg_restore --schema=public` skips the schema-create entry (B1), and
   the runbook still requires a newly created database.
3. **Decrypt/extract** into the temp dir: `age -d -i "$BACKUP_AGE_IDENTITY" -o "$TMP/envelope.tar"
   "$ENVELOPE"`; `tar -xf "$TMP/envelope.tar" -C "$TMP"`; assert exactly `dump.pgcustom` and
   `manifest.json` exist; assert manifest `format==1`, `schema=="public"`, `dump_file=="dump.pgcustom"`.
4. **Hash check:** `echo "<manifest dump_sha256>  dump.pgcustom" | sha256sum -c -` (run inside `$TMP`).
5. **Full restore (OD-1):**
   ```
   docker run --rm --network host --user "$(id -u):$(id -g)" \
     -e RESTORE_DATABASE_URL -v "$TMP:/work" "$PG_IMAGE" \
     sh -c 'pg_restore --schema=public --no-owner --no-privileges --exit-on-error --no-password \
       -d "$RESTORE_DATABASE_URL" /work/dump.pgcustom'
   ```
6. **Re-apply roles/grants** (idempotent; `0001/0002` schema already came from the dump). All `psql`
   calls use the same `docker run --rm --network host "$PG_IMAGE"` wrapper, mounting
   `-v "$PWD/$MIGRATIONS_DIR:/migrations:ro"`:
   `psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f /migrations/0003_roles.sql`, then
   `0004_seats_invites.sql`, then `0005_audit_trail.sql`; then `ANALYZE;`.
7. **Counts compare:** run §2.4 against the restored DB; `jq -e --slurpfile actual "$TMP/counts.json"
   '.tables == $actual[0]' "$TMP/manifest.json"`; print `counts_match=true` (never the numbers).
8. **RLS verification:** catalog, role, behavioral probe (§2.4), every `psql` call with
   `-v ON_ERROR_STOP=1` (a raised `DO` block otherwise exits 0). Print `rls_catalog=10/10`,
   `rls_role=pass`, `rls_probe=pass` (or `skipped` only when fewer than two workspaces exist; the drill
   requires `pass`).
9. **Timing/outputs:** `restore_seconds` measured from decrypt start through verification; print
   `restore_seconds=<int>`; append to `$GITHUB_OUTPUT`/`$GITHUB_STEP_SUMMARY` when set.

The runbook and the drill call this same script. No `--data-only`, no temporary `NO FORCE RLS`, no
restore as `auditorai_app`.

### 2.4 SQL blocks (exact)

**Counts (backup and restore use the same query):**

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

**RLS catalog (must print 10/10 or raise):**

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

**Role invariant (`auditorai_app` exists, not superuser, not BYPASSRLS, owns nothing):**

```sql
DO $$ DECLARE r record; owned int; BEGIN
  SELECT rolsuper, rolbypassrls INTO r FROM pg_roles WHERE rolname = 'auditorai_app';
  IF NOT FOUND THEN RAISE EXCEPTION 'auditorai_app missing'; END IF;
  IF r.rolsuper OR r.rolbypassrls THEN RAISE EXCEPTION 'auditorai_app is privileged'; END IF;
  SELECT count(*) INTO owned FROM pg_class WHERE relowner = 'auditorai_app'::regrole;
  IF owned <> 0 THEN RAISE EXCEPTION 'auditorai_app owns % objects', owned; END IF;
END $$;
```

**Behavioral cross-tenant probe (read-only; A/B = first two workspace ids by `created_at, id`):**

```sql
BEGIN;
SELECT set_config('request.jwt.claims',
  json_build_object('sub','restore-check','workspace_id','<A>')::text, true);
SET LOCAL ROLE auditorai_app;
DO $$ DECLARE own int; leak int; BEGIN
  SELECT count(*) INTO own  FROM public.projects WHERE workspace_id = '<A>';
  SELECT count(*) INTO leak FROM public.projects WHERE workspace_id = '<B>';
  IF own = 0  THEN RAISE EXCEPTION 'own rows invisible under A claims'; END IF;
  IF leak <> 0 THEN RAISE EXCEPTION 'cross-tenant leak: % rows', leak; END IF;
END $$;
ROLLBACK;
```

### 2.5 Workflow settings

**`.github/workflows/backup.yml`**

| Setting | Value |
|---|---|
| `name` | `backup` (no colon) |
| triggers | `schedule: [{cron: "17 3 * * *"}]`, `workflow_dispatch` |
| `permissions` | `contents: read` |
| `concurrency` | group `db-backup`, `cancel-in-progress: false` |
| job | `backup`, `runs-on: ubuntu-latest`, `timeout-minutes: 60`, `env.PG_IMAGE: postgres:17` |
| steps | checkout → install `age` (`sudo apt-get update -qq && sudo apt-get install -y -qq age`) → `Run backup` (`id: backup`, env from `secrets.BACKUP_POSTGRES_URL` / `vars.BACKUP_AGE_RECIPIENT` / `github.run_id`, `run: bash scripts/backup/backup.sh`) → `Upload encrypted backup` (`if: success()`, `actions/upload-artifact@v4`, name `${{ steps.backup.outputs.artifact_name }}`, path `backup-out/*.tar.age`, `retention-days: 30`, `if-no-files-found: error`, `compression-level: 0`) |
| summary | script writes artifact name, bytes, dump seconds, ciphertext SHA-256, `table_count=10` |

**`.github/workflows/restore-drill.yml`**

| Setting | Value |
|---|---|
| `name` | `restore-drill` |
| triggers | `pull_request`, `push: {branches: [main]}`, `workflow_dispatch` |
| `permissions` | `contents: read` |
| `concurrency` | group `restore-drill-${{ github.ref }}`, `cancel-in-progress: true` |
| job | `drill`, `runs-on: ubuntu-latest`, `timeout-minutes: 250` (must exceed the 14400 s gate so the gate is reachable) |
| service | `postgres:17`, `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=drill`, `POSTGRES_DB=drill`, `ports: ["5432:5432"]`, `options: --health-cmd "pg_isready -U postgres" --health-interval 5s --health-timeout 5s --health-retries 10` |
| env | `PG_IMAGE: postgres:17`; `DRILL_URL=postgresql://postgres:drill@localhost:5432/drill`; `RESTORE_URL=…/drill_restore`; `ADMIN_URL=…/postgres` |
| steps | checkout → install age → apply `0001→0005` to `drill` via `docker run --rm --network host -v "$PWD/supabase/migrations:/migrations:ro" postgres:17 psql "$DRILL_URL" -v ON_ERROR_STOP=1 -f /migrations/<file>` → seed via `docker run --rm --network host -v "$PWD/scripts/backup:/seed:ro" postgres:17 psql "$DRILL_URL" -v ON_ERROR_STOP=1 -f /seed/drill-seed.sql` → `age-keygen -o "$RUNNER_TEMP/age-key.txt"`; recipient `age-keygen -y` → `backup.sh` (`BACKUP_POSTGRES_URL=$DRILL_URL`, `BACKUP_AGE_RECIPIENT=$RECIPIENT`, `RUN_ID=${{ github.run_id }}`, `OUT_DIR=backup-out`) → upload artifact (retention 1, `if-no-files-found: error`) → create restore DB via `docker run --rm --network host postgres:17 psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c 'create database drill_restore'` → download artifact → timed `restore.sh` → assert `counts_match=true` and `rls_probe=pass` → summary + 14400 gate |
| timer | `START=$(date +%s)` **before** `actions/download-artifact`; `END` after `restore.sh`; `restore_drill_seconds=$((END-START))` to `$GITHUB_STEP_SUMMARY`; `if [ "$restore_drill_seconds" -ge 14400 ]; then exit 1; fi` |
| artifact boundary | ephemeral keypair; no operator secret/variable is referenced in this workflow |

---

## 3. Modules

### M1 — Backup pipeline

**Objective.** Produce one encrypted, self-contained daily backup artifact from the tenant DB,
fail closed when unconfigured, and document the two CI-only names.

**Touches (exactly):** `.github/workflows/backup.yml`, `scripts/backup/backup.sh`, `.env.example`.

**blocked_by:** none. **Depends on:** F1–F4, §2.1–2.2, §2.4 counts, §2.5 backup settings.

**Behavior.**
1. `backup.sh` implements §2.2 exactly: fail-closed → preflight (role bypass, server major) → dump →
   counts → manifest → tar+age → outputs/summary. Remove plaintext after encrypt. No artifact on any
   failure.
2. `backup.yml` implements §2.5: daily `17 3 * * *` + dispatch, `contents: read`, `db-backup`
   concurrency (no cancel), 60-minute timeout, `postgres:17`, upload last with 30-day retention.
3. `.env.example`: append after line 60 (`POSTGRES_PRISMA_URL=`) a CI-only block with empty values:
   ```
   # Daily backup pipeline (ticket #56) — CI-only, never read by the app.
   # GitHub Actions secret: direct, non-pooled OWNER connection string
   # (superuser or BYPASSRLS). Never TENANT_POSTGRES_URL (the app role cannot dump RLS).
   BACKUP_POSTGRES_URL=
   # GitHub Actions variable: age public key (age1...) the dump is encrypted to.
   # The private key is operator-held and never enters the repo or CI.
   BACKUP_AGE_RECIPIENT=
   ```
4. No app code, no migrations, no `ci.yml` change.

**Commands to run (real; local where possible):**

```bash
node -e 'import fs from "node:fs"; import yaml from "yaml"; yaml.parse(fs.readFileSync(".github/workflows/backup.yml","utf8")); console.log("yaml-ok")'
bash -n scripts/backup/backup.sh
env -u BACKUP_POSTGRES_URL -u BACKUP_AGE_RECIPIENT bash scripts/backup/backup.sh   # must exit 1 before Docker
BACKUP_POSTGRES_URL=x BACKUP_AGE_RECIPIENT=not-a-key bash scripts/backup/backup.sh  # must exit 1 on recipient
npm run lint
npm run typecheck
```

**Acceptance checks / evidence.**
- [ ] YAML parses (command above prints `yaml-ok`); cron, dispatch, permissions, concurrency, timeout,
      `PG_IMAGE: postgres:17`, `retention-days: 30`, `if-no-files-found: error`, upload after backup.
      Evidence: parse output + `grep -n` of those keys.
- [ ] `.env.example` has both names empty with the CI-only comment. Evidence: `grep -n
      "BACKUP_POSTGRES_URL=\|BACKUP_AGE_RECIPIENT=" .env.example`.
- [ ] Fail-closed works without Docker (two commands above exit 1 with `::error::`).
- [ ] Script contains the contractual flags and order (`pg_dump`, `jsonb_object_agg`, `age -r`,
      upload is in YAML after the script). Evidence: `grep -n` / static contract test in M3.
- [ ] No row counts/URL printed: script emits only `table_count=10`, sizes, duration, ciphertext hash.
- [ ] `bash -n`, `npm run lint`, `npm run typecheck` pass.

**NOT built:** release assets; backup failure alerting; restore; drill; PITR; any DB/schema change;
`auth`/`storage` backup; pre-dump snapshot (`pg_export_snapshot`) — documented limit only.

**Reviewer needs:** security (secret scope, no echo, artifact contents, fail-closed) + CI reviewer
(schedule/permissions/concurrency/retention). Reviewer role: security/CI.

---

### M2 — Restore path

**Objective.** One shared restore implementation (OD-1) and an operator runbook that fetches,
decrypts, restores into an empty DB, re-applies roles/grants, verifies counts + RLS, and states
RPO/RTO/PITR honestly.

**Touches (exactly):** `scripts/backup/restore.sh`, `docs/runbooks/restore.md`.

**blocked_by:** M1 (artifact format/interface, manifest fields, flags).

**Behavior.**
1. `restore.sh` implements §2.3 exactly: fail-closed → empty-DB + bypass preflight → decrypt/extract →
   manifest assertions + SHA-256 → full `pg_restore` → re-apply `0003→0005` → `ANALYZE` → counts
   compare → RLS catalog/role/probe → timing/outputs. No `--data-only`; no temporary `NO FORCE RLS`.
2. `docs/runbooks/restore.md` (new directory `docs/runbooks/`) contains, in order:
   - **Scope:** `public` schema only; `auth`/`storage` not backed up; full-project DR = Supabase
     Pro + PITR add-on (not built).
   - **Objectives:** RPO 24 h (daily 03:17 UTC artifact; 30-day retention); RTO 4 h target; measured
     by the CI drill and by the operator live drill.
   - **Operator inputs:** age private key (offline custody; never in repo/CI); scratch Postgres 17
     target; `BACKUP_POSTGRES_URL` only for the scratch restore (owner, `rolsuper OR rolbypassrls`);
     `gh` authenticated. Never paste the URL or key into a ticket.
   - **Fetch:** `gh run list -R Akamel01/AuditorAI --workflow backup.yml --limit 5`;
     `gh run download -R Akamel01/AuditorAI <run-id> -n auditorai-backup-<YYYY-MM-DD>-<run-id> -D restore-work`.
   - **Decrypt + verify:** `age -d -i ~/auditorai-backup.key -o restore-work/envelope.tar
     restore-work/auditorai-backup-*.tar.age`; `tar -xf restore-work/envelope.tar -C restore-work`;
     `sha256sum -c` against `manifest.json.dump_sha256`.
   - **Create empty DB:** `createdb auditorai_restore` (or a fresh Supabase project's empty `public`);
     assert the same empty-`public` query used by `restore.sh` returns 0.
   - **Restore:** run `scripts/backup/restore.sh` with the three env vars; document the manual
     equivalent (`pg_restore --schema=public --no-owner --no-privileges --exit-on-error`, then
     `psql -v ON_ERROR_STOP=1 -f supabase/migrations/0003_roles.sql`, `0004`, `0005`, `ANALYZE`).
   - **Verify:** counts vs manifest; RLS catalog/role/probe; record `restore_seconds`; cut over only
     after green. If the probe is skipped (fewer than two workspaces), record that explicitly.
   - **Re-point:** `alter role auditorai_app password '<operator-generated>';` (out of band) and
     `TENANT_POSTGRES_URL` to the restored project; never reuse the old password.
   - **Failure handling:** hash mismatch → re-download; counts mismatch → investigate concurrent
     writes/partial restore; RLS failure → stop, do not cut over; restore into a non-empty DB is
     refused by design.
   - **Live drill (operator, by hand):** download the latest production artifact, restore into a
     scratch project/DB, record the real seconds; never restore over production.
   - **PITR:** not implemented; upgrade path = Supabase Pro + PITR add-on; document the RPO change.
   - **Security:** public repo → artifacts are encrypted; key custody/rotation (retain old private keys
     or old artifacts become unrecoverable).

**Commands to run:**

```bash
bash -n scripts/backup/restore.sh
test -f docs/runbooks/restore.md
grep -n "RPO 24\|RTO 4\|PITR\|Supabase Pro\|gh run download\|age -d\|pg_restore\|0003_roles\|0004_seats_invites\|0005_audit_trail\|auditorai_app\|empty" docs/runbooks/restore.md
env -u RESTORE_DATABASE_URL -u BACKUP_AGE_IDENTITY -u ENVELOPE bash scripts/backup/restore.sh  # exit 1 before Docker
npm run lint
npm run typecheck
```

**Acceptance checks / evidence.**
- [ ] `bash -n` passes; fail-closed command exits 1 without Docker.
- [ ] Runbook exists and contains every section above; grep output shows the required strings.
- [ ] Runbook uses placeholders only: no real host, URL, key, or password. Evidence:
      `grep -RIn "supabase.co\|pooler.supabase.com\|postgres://\|postgresql://" docs/runbooks scripts/backup`
      returns no real endpoint (only `<…>` placeholders / localhost examples).
- [ ] Restore order is full `pg_restore` then `0003→0005` (OD-1), never `--data-only`. Evidence:
      `grep -n "pg_restore\|0003_roles\|0004_seats\|0005_audit" scripts/backup/restore.sh docs/runbooks/restore.md`.
- [ ] RPO/RTO/PITR statements present; PITR explicitly "not implemented" + paid upgrade path.

**NOT built:** automated live restore; cutover automation; password management; PITR; backup of
`auth`/`storage`; restore into a non-empty DB; app changes.

**Reviewer needs:** DB/ops reviewer (restore order, roles/grants, RLS SQL, empty-DB precondition) +
security reviewer (key handling, no secrets in docs). Reviewer role: DB/ops.

---

### M3 — Drill + static contract

**Objective.** Prove the mechanism end-to-end on a disposable `postgres:17` service, record the
measured seconds, enforce the 4 h gate, and pin the static contract in vitest.

**Touches (exactly):** `.github/workflows/restore-drill.yml`, `scripts/backup/drill-seed.sql`,
`tests/contract/backup-restore.test.ts`.

**blocked_by:** M1, M2 (calls both scripts; asserts their interfaces).

**Behavior.**

1. `scripts/backup/drill-seed.sql` — applied once to the fresh `drill` DB after `0001→0005`.
   Fixed ids, two workspaces, two rows in every tenant table (20 rows total), valid constraints:

   | Table | Rows (A, B) |
   |---|---|
   | `workspaces` | `11111111-1111-4111-8111-111111111111` "drill-a", `22222222-2222-4222-8222-222222222222` "drill-b"; `region='ca-central-1'`; `legacy_key_hash` `aaaaaaaaaaaaaaaa` / `bbbbbbbbbbbbbbbb` |
   | `workspace_members` | `('A','subject-a','owner','active','a@drill.invalid')`, same for B (`status`/`email` columns from 0004) |
   | `workspace_credentials` | hashes `cccccccccccccccc` / `dddddddddddddddd`, subjects `subject-a`/`subject-b` |
   | `projects` | `project-a`/`project-b`; `metadata`, `stage_selection`, `input_values` JSON objects; `created_at`/`updated_at` fixed; `updated_by` set |
   | `audits` | `audit-a`/`audit-b`; fixed `ran_at`; `payload` JSON; `produced_by` set |
   | `audit_issues` | revision `1`; fixed `issued_at`; `issued_by='auditor'`; `payload` JSON |
   | `attachments` | `attachment-a`/`attachment-b`; fixed `created_at`; `payload` JSON; `uploaded_by` |
   | `artifacts` | `node-a`/`node-b`, `seq=1`; `payload` JSON |
   | `artifact_summaries` | fixed `pruned_at`; `payload` JSON |
   | `audit_trail_entries` | `seq=1`; fixed `recorded_at`; `actor='drill'`, `action='drill.seed'`, `subject_type='project'`, `subject_id='project-a'`; `project_id`/`audit_id`; `evidence_refs='[]'`, `payload='{}'`; 64-hex `payload_hash`/`prev_hash`/`entry_hash` |

   Probe expectation: under A's claims, `projects` count = 1; under B's = 0. The seed is wrapped in
   `BEGIN; … COMMIT;`; ids/values are fixed so the manifest counts are deterministic (2 per table).

2. `.github/workflows/restore-drill.yml` — §2.5: triggers, `contents: read`, concurrency, 250-min
   timeout, `postgres:17` service + Dockerized clients (no host `psql`), migration loop in exact order
   `0001 0002 0003 0004 0005`, Dockerized seed (`psql "$DRILL_URL" -f /seed/drill-seed.sql`),
   ephemeral `age-keygen`, `backup.sh`, upload (retention 1), Dockerized
   `psql "$ADMIN_URL" -c 'create database drill_restore'`, download, timed `restore.sh`, assert
   `counts_match=true` + `rls_probe=pass`, summary `restore_drill_seconds`, fail `>= 14400`.

3. `tests/contract/backup-restore.test.ts` — static, `node:fs` + `yaml` + `vitest`; no Postgres.
   Assert at least:
   - backup YAML: parses; cron `17 3 * * *`; `workflow_dispatch`; `permissions.contents == "read"`;
     concurrency group `db-backup` / `cancel-in-progress: false`; job timeout 60; `PG_IMAGE` is
     `postgres:17`; upload `uses` contains `actions/upload-artifact@v4`, `retention-days == 30`,
     `if-no-files-found == "error"`; upload step comes after the `backup.sh` step; `secrets.
     BACKUP_POSTGRES_URL` and `vars.BACKUP_AGE_RECIPIENT` are referenced; no other `secrets.*`.
   - backup script: contains the dump flags, the counts query marker, `age -r`, `::error::`, `exit 1`,
     `GITHUB_OUTPUT`/`GITHUB_STEP_SUMMARY`; marker order dump → counts → age.
   - drill YAML: triggers `pull_request`, push `main`, `workflow_dispatch`; `contents: read`;
     concurrency `restore-drill-${{ github.ref }}`; timeout 250; service image `postgres:17`; env
     `PG_IMAGE` `postgres:17`; both `scripts/backup/backup.sh` and `scripts/backup/restore.sh`
     referenced; seed file referenced; `age-keygen`; migration names appear in order 0001→0005;
     `14400` present; `GITHUB_STEP_SUMMARY` present; no `secrets.` reference.
   - migration table set: parse `create table if not exists public.<name>` from
     `0001_tenant_schema.sql` + `0005_audit_trail.sql`; expect exactly the ten names.
   - `.env.example`: `BACKUP_POSTGRES_URL=` and `BACKUP_AGE_RECIPIENT=` empty; CI-only comment.
   - runbook: exists; contains `RPO 24`, `RTO 4`, `PITR`, `Supabase Pro`, `gh run download`,
     `age -d`, `pg_restore`, `0003_roles`, `0004_seats_invites`, `0005_audit_trail`, `auditorai_app`,
     "empty"; no `postgres://`/`postgresql://` endpoint other than `localhost` or `<…>` placeholders.
   - `backup.sh` and `restore.sh` contain no `TENANT_POSTGRES_URL` reference; workflows contain no
     `supabase.co`/`pooler.supabase.com`.
   - seed SQL references all ten tables and both fixed workspace UUIDs.

**Commands to run:**

```bash
node -e 'import fs from "node:fs"; import yaml from "yaml"; for (const f of [".github/workflows/backup.yml",".github/workflows/restore-drill.yml"]) yaml.parse(fs.readFileSync(f,"utf8")); console.log("yaml-ok")'
npx vitest run tests/contract/backup-restore.test.ts
npm run test          # full suite; contract test is included via tests/**/*.test.ts
npm run lint
npm run typecheck
```

CI (only real behavioral proof; requires push/PR and configured repo):

```bash
git push origin oc/56
gh run list --repo Akamel01/AuditorAI --workflow restore-drill.yml --limit 1
gh run watch <run-id> --repo Akamel01/AuditorAI
gh run view <run-id> --repo Akamel01/AuditorAI --log
```

**Acceptance checks / evidence.**
- [ ] Contract test passes locally (output shows all assertions; no DB/skip).
- [ ] Both YAMLs parse; pre-commit YAML check passes.
- [ ] Seed SQL contains all ten tables, two workspaces, deterministic 2-rows-per-table shape.
- [ ] Drill run green in Actions; `$GITHUB_STEP_SUMMARY` shows `restore_drill_seconds=<int>` and the
      value is `< 14400`; `counts_match=true`; `rls_probe=pass`.
- [ ] Drill artifact is one `.tar.age`; restore log proves decrypt/hash/restore/re-grant/verify order.
- [ ] `npm run test`, `npm run lint`, `npm run typecheck` pass.

**NOT built:** a second drill job for "faithful two-cluster" separation; live production drill
automation; backup failure alerting; branch-protection configuration (repo setting, operator);
PITR; any app/schema change.

**Reviewer needs:** test reviewer (static test asserts contracts, not implementation trivia; no
false confidence) + CI reviewer (service health, same-job artifact round-trip, timer boundaries).
Reviewer role: test/CI.

---

## 4. Execution work order (DAG)

```
M1 (backup pipeline)
  └─> M2 (restore path)          blocked_by: M1  (artifact format, manifest, flags)
        └─> M3 (drill + contract) blocked_by: M1, M2 (calls both scripts; asserts both)
```

| Order | Module | blocked_by | touches | Why this edge |
|---|---|---|---|---|
| 1 | M1 | — | `backup.yml`, `backup.sh`, `.env.example` | Defines the artifact/manifest contract |
| 2 | M2 | M1 | `restore.sh`, `restore.md` | Consumes M1's manifest/flags; must match exactly |
| 3 | M3 | M1, M2 | `restore-drill.yml`, `drill-seed.sql`, `backup-restore.test.ts` | Executes both scripts and pins both workflows |

**Parallelization:** none. The three modules share one artifact interface; running M1 and M2 in
parallel would let the restore script guess the manifest/flags, and M3's test would pin guesses.
M3's `drill-seed.sql` could be authored after M1 (it only needs the migrations), but it has no
independent proof until M3's workflow exists; splitting it adds coordination for no wall-clock gain.
Module boundary ≠ child-session boundary: each module is one implementer session; M3 is the only
candidate for two sessions (seed+test, then workflow), and the plan does not recommend it — the test
must see the final workflow.

**Shared-state guard:** `touches` sets are disjoint. No module edits `ci.yml`, migrations, app code,
`package.json`, or `vitest.config.ts`. If an implementer believes a touch outside its set is needed,
stop and return to the orchestrator; do not widen scope.

---

## 5. Verification matrix (A1–A8)

| AC | Statement | Module | Evidence (real) | Boundary |
|---|---|---|---|---|
| A1 | Daily Action exists, scheduled, uses the secret named in `.env.example` + runbook | M1 | YAML parse; contract test asserts cron/dispatch/`secrets.BACKUP_POSTGRES_URL`; `grep -n BACKUP_POSTGRES_URL .env.example docs/runbooks/restore.md` | local static |
| A2 | Dump age-encrypted before upload; recipient variable documented | M1 | contract test: `age -r` in `backup.sh` before upload step; `grep -n "age -r" scripts/backup/backup.sh`; drill decrypts successfully | local static + CI drill |
| A3 | Off-Supabase storage, 30-day retention | M1 | contract test: `actions/upload-artifact@v4`, `retention-days: 30`, `if-no-files-found: error`; `gh run view` artifact listing | local static + CI runtime |
| A4 | Runbook fetch → decrypt → restore → verify counts + RLS | M2 | `test -f docs/runbooks/restore.md`; grep of all required commands/sections; contract test | local |
| A5 | CI drill seeds 0001→0005, measures restore time | M3 | drill run; summary `restore_drill_seconds`; contract test asserts migration order, `14400`, `GITHUB_STEP_SUMMARY` | CI only (behavior) |
| A6 | No real DB/accounts/secrets anywhere | M1/M2/M3 | `grep -RIn "supabase.co\|pooler.supabase.com\|postgres://\|postgresql://"` over new files shows only `<…>` placeholders or the drill's `localhost` URL; drill has no `secrets.*`; contract test asserts it | local static + CI |
| A7 | PITR documented as paid upgrade only, not implemented | M2 | `grep -n "PITR\|Supabase Pro\|not implemented" docs/runbooks/restore.md`; contract test | local |
| A8 | RPO 24 h / RTO 4 h stated | M1/M2 | workflow cron comment/summary + `grep -n "RPO 24\|RTO 4" docs/runbooks/restore.md .github/workflows/backup.yml`; contract test | local |

Every AC has a static local check; only A2's decryption and A5's timing are behaviorally proven, and
only in the CI drill. No AC is "proven" by a mock.

---

## 6. Local vs CI proof boundary

**Local (this worktree) has:** Node 22/npm, vitest, `yaml`, eslint, tsc, bash, git. **No** Docker,
`pg_dump`/`pg_restore`, `psql`, or `age` (discovery `report-t56.md:55`; confirmed by `command -v`).
`vitest.config.ts:4–12` also forbids a real Postgres pool.

| Proof | Local | CI |
|---|---|---|
| YAML parses; workflow settings; script syntax | yes (`node -e` + `bash -n`) | yes (pre-commit + CI) |
| Fail-closed env checks | yes (unset env exits 1 before Docker) | yes |
| Static contract (A1–A8 structure) | yes (`npx vitest run tests/contract/backup-restore.test.ts`) | yes (`npm run test`, `ci.yml:78`) |
| Real dump/encrypt/decrypt/restore/RLS/timing | **no** | yes, `restore-drill.yml` only |
| Live operator drill against production artifact | no | no (operator, by hand, scratch target) |

Do not fake a dump, hand-write an artifact, or mock `pg_dump`/`age` locally to "prove" behavior. The
static test is the only honest local seam; the drill is the behavioral gate.

---

## 7. Risks

| Risk | Mitigation / acceptance |
|---|---|
| Manifest counts drift under concurrent writes (post-dump counts) | Drill is exact (no writer); runbook investigates a mismatch; documented limit, no snapshot machinery (arch D6) |
| Age private-key loss/rotation makes old artifacts unreadable | Runbook: offline custody, retain old keys on rotation, first-run decrypt check; no escrow (out of scope) |
| Synthetic RTO (tiny data) is not production RTO | 14400 s is a liveness gate; operator live drill is the real number; stated in runbook |
| OD-1 full restore reproduces the dump-time schema | Expected and self-contained; runbook says do not apply newer migrations before verification; `0003→0005` only for roles/grants |
| Restore into a non-empty DB would mix data | `restore.sh` empty-`public` preflight fails closed |
| `auditorai_app` password is not in the dump | Runbook step: set it out of band after restore; otherwise the app cannot connect |
| Branch protection may not require `restore-drill` | Operator repo setting; plan flags it; drill is advisory until required (arch risk 4) |
| PG major bump (18) breaks the 17 client | `backup.sh` fails closed on server major > 17 with "bump PG_IMAGE in both workflows"; contract test enforces equal `postgres:17` |
| Public repo leaks metadata | Manifest inside the age envelope; summaries only sizes/duration/ciphertext hash/table count; secret masked by Actions |
| No backup-failure alerting | Out of scope; a red scheduled run is the only signal; documented |
| `age`/`jq` availability on runner | `age` from Ubuntu archive, `jq` preinstalled; install step fails loudly if absent |
| A failed drill blocks PRs after branch protection | Intentional; fix or revert; drill has no external network and a health-checked service |

---

## 8. Rollback

- **Code rollback:** `git revert <merge-commit>` (or delete the five new files + revert the
  `.env.example` block). No migrations, app code, `ci.yml`, `package.json`, or `vitest.config.ts` are
  touched, so rollback is a clean file revert.
- **Scheduled backup:** reverting `backup.yml` removes the schedule; already-uploaded artifacts expire
  within 30 days. The `BACKUP_POSTGRES_URL` secret and `BACKUP_AGE_RECIPIENT` variable may remain
  unused; deleting them is an operator action.
- **Drill:** delete `restore-drill.yml`; remove it from required checks if it was added. `ci.yml` is
  unaffected.
- **Data:** no migration or data mutation is performed by this plan; a failed restore only touches the
  operator's scratch database (or the drill's disposable service).
- **Key rotation:** rotating `BACKUP_AGE_RECIPIENT` does not invalidate existing artifacts if the old
  private key is retained; otherwise old artifacts are unrecoverable by design.

---

## 9. Handoff checklist

1. M1: write `backup.sh` + `backup.yml` + `.env.example` block; run the local commands; hand to
   security/CI reviewer.
2. M2: write `restore.sh` + `restore.md`; run the local commands; hand to DB/ops reviewer.
3. M3: write `drill-seed.sql` + `restore-drill.yml` + `tests/contract/backup-restore.test.ts`; run
   `npx vitest run tests/contract/backup-restore.test.ts`; hand to test/CI reviewer.
4. Push the branch; require `restore-drill` green; record the run id and `restore_drill_seconds` in
   the PR body (A5 evidence).
5. Operator-only, not part of the PR: set `BACKUP_POSTGRES_URL` and `BACKUP_AGE_RECIPIENT`; custody
   the age private key; configure branch protection; run the live drill from the runbook.

**Definition of done:** A1–A8 each have the evidence above; the drill is green; `npm run test`,
`npm run lint`, `npm run typecheck`, YAML parse, and `bash -n` pass; no source file outside the
`touches` sets changed.
