# Grilling — Ticket #56 (daily age-encrypted pg_dump backup + restore drill)

Repo: `Akamel01/AuditorAI` · branch `oc/56` · HEAD `0e26570` · artifact only, no source edits.

**Role.** Adversary of the ticket's re-scoped wording. Every repo claim carries `path:line`. Decisions below are concrete enough for a planner to encode.

---

## Decisions

### D1 — Secret/variable names and fail-closed behavior
- GitHub **secret** `BACKUP_POSTGRES_URL` = owner-role, direct (non-pooled) connection string; must NOT be `TENANT_POSTGRES_URL` (app role would back up only its own rows). `.env.example` gets a documenting block mirroring `POSTGRES_URL_NON_POOLING` (`:70-80`).
- GitHub **variable** `BACKUP_AGE_RECIPIENT` = age public key (`age1…`). Private key stays operator-held; never in repo.
- Backup workflow **fails closed** when either is unset (exit 1 with message), unlike `deploy.yml:12-17` which skips cleanly. Rationale: a silent skip reports a successful RPO that never happened; a red run is the honest signal. Drill does not need either (it generates an ephemeral age keypair in CI).

### D2 — Storage: Actions artifact, 30-day retention
- `actions/upload-artifact@v4` with `retention-days: 30` (default 90; must be explicit). Artifact name `auditorai-backup-<run_id>.dump.age`, plus `auditorai-backup-<run_id>.manifest.json` (per-table row counts + sha256 of dump).
- Upload step guarded `if: success()` so a failed dump/encrypt leaves no stale artifact. Release assets rejected: no auto-expiry, needs release plumbing (out of scope).

### D3 — pg_dump client/version and flags
- Client: `postgresql-client-16` installed on runner (`apt-get`), pinned to Supabase server major; document server version in runbook; if skew, use `postgres:16` container client.
- Flags: `pg_dump --format=custom --no-owner --no-privileges --no-acl --compress=9`. Custom format enables parallel `pg_restore`; `--no-*` makes restore portable to a fresh cluster that lacks the dump's roles. Roles are NOT dumped (recreated by migrations 0003).

### D4 — Restore runbook verification and role re-creation
- Order on a fresh DB: apply `0001→0005` (`supabase/README.md:13-22`) → `pg_restore --data-only --no-owner --no-privileges` → verify.
- `auditorai_app` comes back from `0003_roles.sql:12-19` + `0005` grants; dump contributes no privileges.
- Verification: (a) catalog assertion — all 10 tables (`0001:32-132` + `0005:8`) have `relrowsecurity AND relforcerowsecurity` (`0002:39-56`, `0005:40-41`); (b) role assertion — `auditorai_app` NOSUPERUSER/NOBYPASSRLS (`0003:12-19`); (c) behavioral cross-tenant probe — as `auditorai_app`, insert a row under workspace A's GUCs, switch to workspace B's GUCs, assert 0 rows, cleanup; (d) row counts vs `manifest.json`.

### D5 — Drill design
- Separate workflow `.github/workflows/restore-drill.yml`, triggered on `pull_request`, `push: branches [main]`, `workflow_dispatch`. (Not folded into `ci.yml` to keep RTO measurement isolated.)
- Seed disposable Postgres 16 service container with migrations `0001–0005` (orchestrator directive overrides ticket's `0001–0004`; `0005` adds 10th table + grants).
- Round-trip: pg_dump seeded DB → age encrypt with ephemeral keypair (`age-keygen`) → age decrypt → pg_restore into second fresh DB → verify. Measures restore phase (decrypt+restore+verify) with `time`; writes seconds to `$GITHUB_STEP_SUMMARY` and fails if ≥ 14400 (RTO 4 h). Ephemeral keypair means no operator secret dependency.

### D6 — Failure modes
| Mode | Mitigation |
|---|---|
| Missing `BACKUP_POSTGRES_URL` / `BACKUP_AGE_RECIPIENT` | Fail closed (D1) |
| pg_dump auth/network failure | Job fails before upload; no artifact |
| Partial artifact | `if: success()` on upload (D2) |
| Retention expiry | 30 d explicit; RPO 24 h means older dumps intentionally expire — documented |
| Drill flakiness | Service-container health check; pin image digest; no external network |

### D7 — Scope boundaries (NOT built)
PITR (documented paid upgrade only, Supabase Pro + PITR add-on), real DB connections, account creation, real secret handling, app/ORM changes, schema changes, other tickets (#90/#89/#75/#41), threshold/judge-prompt edits.

---

## Acceptance checks (maps to A1–A8)

- A1: `.github/workflows/backup.yml` exists, cron daily, uses `secrets.BACKUP_POSTGRES_URL`; name present in `.env.example`.
- A2: dump piped through `age -r "$BACKUP_AGE_RECIPIENT"` before `upload-artifact`; variable documented.
- A3: `retention-days: 30`; artifact off-Supabase.
- A4: `docs/runbooks/restore.md` with fetch/decrypt/restore/verify steps.
- A5: `restore-drill.yml` seeds `0001–0005`, round-trips, records seconds.
- A6: grep confirms no real host/secret in repo/CI; drill uses service container only.
- A7: runbook states PITR = Supabase Pro + PITR add-on, not implemented.
- A8: RPO 24 h / RTO 4 h stated in runbook + workflow.

**Open questions:** none (operator-only items — actual secret values, age private key custody, Supabase server major version — are documented as operator inputs, not decisions).
