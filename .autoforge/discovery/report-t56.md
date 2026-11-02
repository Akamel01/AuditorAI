# Discovery Report — Ticket #56 (re-scoped 2026-10-25) — daily age-encrypted pg_dump backup + restore drill

Repo: `Akamel01/AuditorAI` · branch `oc/56` · HEAD `0e26570`. Read-only. Every repo claim carries `path:line`; no design proposed.

## Ticket scope (re-scope replaces body)

Source: `gh issue view 56` comment 2026-10-25 (operator re-scope). Build:
1. Scheduled daily logical backup: GitHub Action running `pg_dump` against the tenant DB; connection string from a repo secret (name in `.env.example` + runbook); dump encrypted with `age` before upload; off-Supabase storage (Actions artifact or release asset); 30-day retention.
2. Restore runbook `docs/runbooks/restore.md`: fetch dump → decrypt → restore into fresh DB → verify row counts + RLS.
3. CI restore drill against a disposable Postgres service container seeded with migrations 0001–0005 (issue says 0001–0004; 0005 is current head per orchestrator directive); measured restore time recorded in PR.
4. Live drill against real project = operator-run by hand from runbook.
5. RPO 24 h via daily dump; RTO 4 h via drill timing. PITR = paid upgrade path only (Supabase Pro + PITR add-on), documented, not built.

Rules: never connect to real DB, never create accounts, never handle real secrets.

## Exact acceptance criteria (testable)

- [ ] A1 Daily Action exists and is scheduled; runs `pg_dump` against tenant DB using a secret named in `.env.example` + runbook.
- [ ] A2 Dump is `age`-encrypted before upload; recipient public key supplied by operator; secret name documented.
- [ ] A3 Storage is off-Supabase (artifact or release asset) with 30-day retention.
- [ ] A4 Runbook `docs/runbooks/restore.md` exists with fetch/decrypt/restore/verify-row-counts-and-RLS steps.
- [ ] A5 CI drill runs against disposable Postgres seeded by migrations 0001–0005; records measured restore time.
- [ ] A6 No real DB connection, no account creation, no real secret handling anywhere in repo/CI.
- [ ] A7 PITR documented as paid upgrade path only (Supabase Pro + PITR add-on), not implemented.
- [ ] A8 RPO 24 h / RTO 4 h stated in runbook or workflow.

## Relevant repo facts (path:line)

Workflows:
- `.github/workflows/ci.yml:1-118` — jobs state, evidence, vault, eval-gate, quality, e2e; `quality` runs lint/typecheck/test/build/harvest-verify; e2e sets env keys. No Postgres service container today.
- `.github/workflows/ci-gates.yml:1-33` — R13/R17 gates.
- `.github/workflows/deploy.yml:1-46` — skips cleanly when secrets unset (pattern to mirror for backup secret absence).
- `.githooks/pre-commit:1-60` — lint/typecheck/vault/YAML/harvest-verify; YAML parse via `yaml` devDep.
- `.github/workflows/*.yml` — YAML `name:` with `:` must be quoted (pre-commit check).

Migrations (10 tenant tables; RLS ENABLE+FORCE):
- `supabase/migrations/0001_tenant_schema.sql:14` — tenant tables; 9 base tables (workspaces, workspace_members, workspace_credentials, projects, audits, audit_issues, attachments, artifacts, artifact_summaries).
- `supabase/migrations/0002_rls_policies.sql:39-56` — ENABLE+FORCE RLS on all 9 tables.
- `supabase/migrations/0003_roles.sql:12-19` — `auditorai_app` role (NOSUPERUSER, NOBYPASSRLS, owns nothing); grants DML on 9 tables + EXECUTE on 3 claim helpers (`:44-62`).
- `supabase/migrations/0004_seats_invites.sql:2` — seats/invites; grants split.
- `supabase/migrations/0005_audit_trail.sql:40-41` — 10th table `audit_trail_entries` ENABLE+FORCE RLS.
- `supabase/README.md:13-22` — apply order 0001→0005; operator-only, agents never apply.
- `supabase/README.md:24-52` — operator procedure; password set out of band.

Env / config:
- `.env.example:1-80` — lists runtime env names; tenant store uses `TENANT_POSTGRES_URL` (pooled auditorai_app) and platform-injected `POSTGRES_URL`/`POSTGRES_URL_NON_POOLING` (owner, never read by app). No backup secret name exists yet → must be added.
- `src/lib/db/config.ts` (per #54 report `:30-37`, `:53-67`) — `TENANT_STORE` switch; Postgres path only when set.

Tests / tooling:
- `package.json` — vitest (`tests/**`, `src/**/*.test.ts`), `yaml` devDep, no pg_dump/age/docker locally (confirmed `command -v` returned none).
- `tests/` — no existing backup/restore tests; `tests/e2e/` for Playwright.
- `tests/setup.ts` — test bootstrap.

Docs:
- `docs/runbooks/` does not exist (confirmed `ls` empty).
- `supabase/README.md` documents operator procedures (above).
- `docs/research/enterprise-gap-audit.md` G-4 referenced by ticket #51/#56 (not read here; ticket re-scope is authoritative).

## Constraints / risks

- Secret handling: backup connection string must be a GitHub repo secret, never committed; name must be added to `.env.example` and runbook (ticket). Mirror deploy.yml skip-cleanly pattern when unset.
- pg_dump client vs server version: CI runner's `pg_dump` must match/≥ server major; pin or use `postgres` service image's client. Risk of version skew on restore drill.
- Artifact retention: Actions artifacts default 90 d; must set 30 d explicitly (or use release asset). Retention policy must be enforced in workflow.
- RLS verification: drill must assert RLS enabled+forced on all 10 tables and that `auditorai_app` (or equivalent) cannot bypass; restore into fresh DB must re-apply roles/grants (0003) or verify them.
- No local DB: no pg_dump/age/docker available locally → drill cannot be run locally; must be CI-only; local validation limited to YAML parse + lint/typecheck.
- Migration seeding: issue says 0001–0004, orchestrator directive says seed 0001–0005 (current head). Reconcile in implementation; 0005 adds `audit_trail_entries` (10th table) and grants in 0005.
- Encryption: `age` recipient public key from operator; private key never in repo; decrypt step in runbook uses operator-held key.
- Restore time measurement must be recorded in PR (ticket) → drill job should emit timing (e.g. step summary or artifact).
- Concurrency / partial failure: a failed dump must not leave a stale artifact; use upload only on success.
- Security: workflow must not echo connection string; use `::add-mask::` or rely on GitHub secret masking.

## Out of scope (explicit)

- PITR implementation (paid upgrade only; documented).
- Real DB connections, account creation, real secret handling (ticket rules).
- App code changes / ORM adoption (`POSTGRES_PRISMA_URL` unused by design).
- Schema changes to migrations (seed only).
- Other open tickets (#90, #89, #75, #41) — tracked, not worked this run.
- Threshold/judge-prompt/doctrine edits (frozen).

## Unknowns to resolve in planning

- Exact secret name (ticket leaves to implementer; must pick and document consistently).
- Storage choice: Actions artifact vs release asset (retention/size limits differ).
- Whether drill verifies RLS via SQL assertions or row-count + role checks.
- pg_dump flags (custom format `-Fc` vs plain) for restore speed / RTO.
