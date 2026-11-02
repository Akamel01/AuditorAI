# Validation report — ticket #56 (re-scoped 2026-10-25)

Date: 2026-11-02 · Validator: autoforge-validator · Read-only except this file.
Environment: no Docker, no `age`, no `psql` (`command -v` → `no-docker`, `no-age`), so all behavioral
claims are bounded by the CI-only drill. No git/vault mutations; no source edits.

## Verdict

**GO (CI-gated)** — **6 PASS / 2 CI-ONLY / 0 FAIL**.

Every locally provable criterion and every ticket rule passes. A2/A5 behavior is provable only by the
GitHub Actions `restore-drill`; the branch is not pushed (no remote `oc/56`, workflow lookup 404), so
no run id or measurement exists. Merge gate: a green `restore-drill` run with `counts_match=true`,
`rls_probe=pass`, and `restore_drill_seconds < 14400`; record the run id + seconds in the PR. No defect
found that requires replanning M1/M2/M3.

## Acceptance criteria

| AC | Status | Evidence (current files / quoted output) |
|---|---|---|
| **A1** Daily scheduled Action + `pg_dump` + secret name in `.env.example` and runbook | **PASS** | `backup.yml:4-6` `schedule`/`cron: "17 3 * * *"` + `workflow_dispatch`; `:25-31` runs `scripts/backup/backup.sh` with `:28` `secrets.BACKUP_POSTGRES_URL`; `.env.example:65,68` empty `BACKUP_POSTGRES_URL=` / `BACKUP_AGE_RECIPIENT=`; `restore.md:15` names the secret. `backup.sh:68` is `pg_dump --format=custom --schema=public …`. |
| **A2** age encryption before upload; public key from repo variable; private key never in repo | **CI-ONLY** (static checks pass) | `backup.sh:106` `tar -C "$workdir" -cf - dump.pgcustom manifest.json \| age -r "$BACKUP_AGE_RECIPIENT" -o "$envelope"`; upload is a later workflow step after `backup.sh` (`backup.yml:25-40`). Public key: `backup.yml:29` `vars.BACKUP_AGE_RECIPIENT`; `.env.example:66-67` says private key is operator-held. `grep -RIn 'AGE-SECRET-KEY' .github scripts docs .env.example` → `NONE`. Decrypt/encrypt round-trip unproven locally; the drill is the only proof. |
| **A3** Off-Supabase storage (Actions artifact), 30-day retention | **PASS** | `backup.yml:32-40`: `actions/upload-artifact@v4`, `path: backup-out/*.tar.age`, `retention-days: 30`, `if-no-files-found: error`, `if: success()`, after the backup step. Artifacts live in GitHub Actions, not Supabase. |
| **A4** `docs/runbooks/restore.md`: fetch, decrypt, restore into fresh DB, verify row counts and RLS | **PASS** | Fetch `restore.md:19-22` (`gh run list`/`gh run download`); decrypt `:26-32` (`age -d`, `tar -xf`, `sha256sum -c`); fresh DB `:34-56` (`createdb`, empty-`public` query, expect `0`); restore `:58-73` (`restore.sh` or manual `pg_restore --schema=public …` + `0003_roles`/`0004_seats_invites`/`0005_audit_trail` + `ANALYZE`); verify `:75-79` (counts vs manifest, RLS catalog 10/10, role invariant, probe, `restore_seconds`). |
| **A5** CI drill on disposable Postgres seeded with migrations 0001-0005; measured restore time recorded | **CI-ONLY** (structure passes) | `restore-drill.yml:43-48` applies `0001 0002 0003 0004 0005` in order; `:49-50` applies `drill-seed.sql`; `:51-54` ephemeral `age-keygen`; `:69-70` timer before download; `:76-85` timed restore, `restore_drill_seconds` to `$GITHUB_STEP_SUMMARY`, fail at `>= 14400`. No run exists: `gh run list …--workflow restore-drill.yml` → `HTTP 404: workflow restore-drill.yml not found on the default branch`; `git ls-remote --heads origin oc/56` → empty. OD-4 resolves the issue's "0001–0004" wording to 0005 (current head); the brief accepts 0001–0005. |
| **A6** No real DB connection, no account creation, no real secrets anywhere | **PASS** | Only URLs in the ticket files are `postgresql://postgres:drill@localhost:5432/…` (`restore-drill.yml:22-24`) and the `<scratch-url>` placeholder (`restore.md:38`); no `supabase.co`, `pooler.supabase.com`, `/home/oc`, `AGE-SECRET-KEY`, `ghp_`, `github_pat_`, or JWT shapes in implementation files. App never reads the two names (`grep -RIn` over `src` → `APP_HAS_NONE`). Fail-closed exits 1 before any Docker/DB call. The scheduled production job connecting via the operator secret is the intended runtime, not a validation connection. |
| **A7** PITR documented as paid upgrade path only, not implemented | **PASS** | `restore.md:3` "Full-project disaster recovery requires Supabase Pro + PITR add-on; that is not built here"; `:97-99` "PITR / Not implemented. Paid upgrade path = Supabase Pro + PITR add-on". `grep -RIn 'PITR' scripts/backup .github/workflows` → no hits. |
| **A8** RPO 24 h / RTO 4 h stated and consistent with implementation | **PASS** | `restore.md:7-8` states RPO 24 h (daily 03:17 UTC, 30-day retention) and RTO 4 h (CI drill + operator live drill); `backup.yml:5` daily cron `17 3 * * *`; `restore-drill.yml:19` 250-min timeout (reachable 14400 s gate) and `:85` `>= 14400` fail. No contradiction. |

## Command evidence (quoted output)

```text
$ node -e '… yaml.parse(backup.yml); yaml.parse(restore-drill.yml) …'
yaml-ok
$ bash -n scripts/backup/backup.sh && bash -n scripts/backup/restore.sh
BACKUP_SYNTAX_OK
RESTORE_SYNTAX_OK
$ env -u BACKUP_POSTGRES_URL -u BACKUP_AGE_RECIPIENT bash scripts/backup/backup.sh
::error::BACKUP_POSTGRES_URL is required                       (exit 1, before Docker/DB)
$ BACKUP_POSTGRES_URL=x BACKUP_AGE_RECIPIENT=not-a-key bash scripts/backup/backup.sh
::error::BACKUP_AGE_RECIPIENT must start with age1             (exit 1)
$ env -u RESTORE_DATABASE_URL -u BACKUP_AGE_IDENTITY -u ENVELOPE bash scripts/backup/restore.sh
::error::RESTORE_DATABASE_URL is required                      (exit 1, before Docker/DB)
$ RESTORE_DATABASE_URL=x BACKUP_AGE_IDENTITY=/nonexistent ENVELOPE=/nonexistent bash scripts/backup/restore.sh
::error::BACKUP_AGE_IDENTITY is not readable                   (exit 1)
$ npx vitest run tests/contract/backup-restore.test.ts
Test Files  1 passed (1); Tests  82 passed (82)
$ npm run lint          → LINT_EXIT=0
$ npm run typecheck     → TYPECHECK_EXIT=0
$ npm run test
Test Files  1 failed | 106 passed (107)
Tests       1 failed | 1293 passed | 2 skipped (1296)
FAIL tests/domain/pipeline-latency.test.ts > G-14 per-stage latency > renders the report deterministically…
Error: Test timed out in 5000ms.
$ npx vitest run tests/domain/pipeline-latency.test.ts
Test Files  1 passed (1); Tests  2 passed (2)                  (787 ms)
$ npx vitest run --exclude tests/contract/backup-restore.test.ts
Test Files  106 passed (106); Tests  1212 passed | 2 skipped
$ npx vitest run tests/domain/pipeline-latency.test.ts tests/contract/backup-restore.test.ts
Test Files  2 passed (2); Tests  84 passed (84)
$ gh run list --repo Akamel01/AuditorAI --workflow restore-drill.yml
HTTP 404: workflow restore-drill.yml not found on the default branch
$ git ls-remote --heads origin oc/56
(empty)
```

Full-suite note: two consecutive `npm run test` runs failed only on the pre-existing
`pipeline-latency` 5 s timeout under parallel load; the test passes alone and with the contract test
excluded. Reported, not hidden; not attributable to ticket #56 (see M3 review note 6).

Grep evidence: `backup.yml:5` cron, `:28` secret, `:29` variable, `:38` `retention-days: 30`, `:39`
`if-no-files-found: error`; `restore-drill.yml:46` `0001…0005`, `:82` `GITHUB_STEP_SUMMARY`, `:85`
`14400`; `backup.sh:106` `age -r`; `restore.sh:105` `pg_restore --schema=public`, `:108-110`
`0003/0004/0005`, `:132` `counts_match=true`, `:147` `rls_catalog=10/10`, `:162` `rls_role=pass`,
`:191` `rls_probe=pass`, `:196` `restore_seconds`. `TENANT_POSTGRES_URL` appears only as the error
text in `backup.sh:51` and the re-point instruction in `restore.md:83`; neither script reads it.

## Scope / security

- `git status --porcelain`: new files are exactly the 7 ticket paths; modified product-adjacent paths
  are `.env.example` and `.gitignore` only. No `src/`, `supabase/`, `ci.yml`, `package.json`, or
  `vitest.config.ts` changes; no other ticket's work. `.autoforge/*` changes are orchestration state.
- `.gitignore` adds `backup-out/` (validated file set; a hygiene addition outside M1's original
  3-path touch set — M1 review note 4; not app/schema).
- No real endpoint, account, or secret: endpoint grep is empty except the disposable localhost drill
  URLs and `<…>` placeholders. `/home/oc` occurs only inside the test's negative assertions
  (`tests/contract/backup-restore.test.ts:45,92,126`); no functional absolute path.
- No PITR code; the drill creates no account and uses an ephemeral key; no DB connection was made in
  this validation (Docker/age absent).
- Read-only honored: this report is the only file written; no git or vault commands that mutate.

## Residual risks / conditions

1. **A2/A5 behavior (CI-ONLY).** Push `oc/56`, get a green `restore-drill`, record run id +
   `restore_drill_seconds`; do not merge on local static evidence alone.
2. **Full-suite flake.** `pipeline-latency` 5 s timeout under full parallel load (2/2 full runs in
   this validation); passes alone, in a 2-file run, and with the contract test excluded. Pre-existing /
   environmental; the plan's "`npm run test` passes" is not cleanly reproducible here.
3. **Drill's untested assumptions** (likely CI failure modes): `pg_restore --schema=public` filtering
   the `CREATE SCHEMA public` TOC entry, `--network host` reaching the published service port, the
   same-job artifact round-trip, and apt `age`. All are CI-only; if red, fix M3 only.
4. **RLS probe false-fail:** it requires the first two workspaces (by `created_at, id`) to have ≥1
   project each. The seed guarantees it; a production restore may not. The runbook records a skip only
   when fewer than two workspaces exist; a mismatch stops the run.
5. Seed audit-trail hashes are shape-valid, not a valid chain, and the drill does not run
   `verifyAuditTrail` (OD-4 scope).
6. `state/production-harvest-proof.json` is rewritten by `npm run test` (harvest-test side effect);
   pre-existing tracked evidence file, not a ticket deliverable — exclude it from the ticket commit.
7. No backup-failure alerting; the expired-artifact RPO gap is documented, not automated.

## Recommendation

**GO**, conditional on the CI drill. If `restore-drill` is red, re-enter **M3 only** (workflow/seed/
test); the M1/M2 artifact and interface contracts are consistent. A5 stays CI-ONLY until a green run
id and `restore_drill_seconds` are recorded.
