# AuditorAI tenant store — Supabase Postgres (ca-central-1)

This directory holds the paste-ready SQL for the ticket's tenant store: the
schema (9 tenant tables), the row-level-security policies, and the
non-bypass application role. Region: **ca-central-1** (pinned in the `0001`
header).

Nothing in the application imports these files. **No agent ever applies them.**
They are applied by the operator, by hand, to the live project.

## Files (apply in this order)

| File | What it does |
|---|---|
| `migrations/0001_tenant_schema.sql` | 9 tenant tables: `workspaces`, `workspace_members`, `workspace_credentials`, `projects`, `audits`, `audit_issues`, `attachments`, `artifacts`, `artifact_summaries` |
| `migrations/0002_rls_policies.sql` | `ENABLE` + `FORCE ROW LEVEL SECURITY` on all 9 tables, the three claim helpers, and every policy |
| `migrations/0003_roles.sql` | creates `auditorai_app` (NOSUPERUSER, NOBYPASSRLS, owns nothing) and grants it DML + `USAGE` + `EXECUTE` |

`0002` and `0003` depend on `0001`; `0003` grants execute on functions created
by `0002`. Do not reorder, do not skip. The migrations are re-runnable:
`0002` drops each policy before recreating it, so a re-apply is safe.

## Operator procedure

```bash
# 0. prerequisites: the operator's shell has the connection string; it is never in the repo
export POSTGRES_URL_NON_POOLING='<operator-supplied direct connection string>'

# 1. apply in order (the Supabase SQL editor accepts the same three files pasted in this order)
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_tenant_schema.sql
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_rls_policies.sql
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -f supabase/migrations/0003_roles.sql

# 2. set the app role's password OUT OF BAND (never in a repo file, never pasted into a ticket)
psql "$POSTGRES_URL_NON_POOLING" -v ON_ERROR_STOP=1 -c "alter role auditorai_app password '<operator-chosen>';"

# 3. point POSTGRES_URL at the auditorai_app role (pooled); keep POSTGRES_URL_NON_POOLING on the owner
```

### ORDERING — operator ACTION-1 (do this BEFORE the merge reaches Production)

**The merge auto-deploys.** Every push to `main` auto-deploys to production
(`docs/deployment.md:5` — Vercel, region `iad1`). So the operator applies
`0001 → 0002 → 0003` **and repoints `POSTGRES_URL` at the `auditorai_app`
role** *before* the merge reaches Production.

If the code lands first, the credential lookup fails against a schema that does
not exist (`SQLSTATE 42P01`) and the app degrades to the legacy KV store with
the "database not configured" notice — that is the designed behaviour, not a
failure, but it is not the intended state. ACTION-1 is an **action**, not a
question.

The same ordering applies to the KV → Postgres migration: run it after the
deploy (dry run first, then `--apply --confirm-target`), because a migrated
workspace is only served once its credential row exists.

## The role invariant (and the one escape hatch)

The tenant connection MUST be the `auditorai_app` role: NOSUPERUSER,
NOBYPASSRLS, and the owner of nothing. `FORCE ROW LEVEL SECURITY` binds a
plain table owner (a superuser or `BYPASSRLS` role still bypasses it). The
operator's owner credentials in Supabase are privileged, so that connection
— and any service-role key — reads every tenant's rows: keep it out of the
request path. The isolation guarantee comes from the app role, not from the
policies alone. The application sets it transaction-locally on every
transaction (`set local role auditorai_app`).

**`DB_ALLOW_OWNER=1` — out-of-band operator escape hatch.** If `POSTGRES_URL`
still names the owner role, the pool factory refuses to build. The operator can
bypass that refusal by exporting `DB_ALLOW_OWNER=1` in the process environment
(it is deliberately not a project env name and is not listed in
`.env.example`).

> **Using `DB_ALLOW_OWNER=1` VOIDS the isolation guarantee.** It runs the
> tenant path as a role that owns the tables and therefore bypasses RLS, so
> every policy in `0002` becomes a no-op and one workspace can read another's
> rows. It exists so the operator can unblock a deployment during an incident;
> it is not a supported configuration. Fix `POSTGRES_URL` instead.

`POSTGRES_URL` must be repointed at the `auditorai_app` role — with the
password set in step 2 — for the isolation guarantee to hold.

## How the identity reaches the database

The tenant identity travels as two transaction-local GUCs, set with
`set_config(..., true)` inside the same transaction as the query (the Supabase
pooler is transaction-pooled, so a session-level `SET` would be discarded):

| GUC | Set by | Read by |
|---|---|---|
| `request.jwt.claims` | `{"sub": "<subject>", "workspace_id": "<uuid>"}` | `public.app_claim_subject()`, `public.app_claim_workspace_id()` |
| `request.credential_hash` | the presented credential's 16-hex `workspaceHash(key)` | `public.app_claim_credential_hash()` |

The `workspace_credentials` policies are keyed on the **second** GUC and
reference **no table**, so the credential row is visible to its own lookup
without any policy recursion.

## Reverse path

- **Cutover rollback:** delete the workspace's `workspace_credentials` row (an
  owner action via `POSTGRES_URL_NON_POOLING`, not an app-role one) — the
  credential no longer resolves and the legacy KV store serves that workspace
  again. Nothing else is touched.
- **Schema rollback:** `drop table` in reverse order
  (`artifact_summaries`, `artifacts`, `attachments`, `audit_issues`, `audits`,
  `projects`, `workspace_credentials`, `workspace_members`, `workspaces`).
  This destroys only the Postgres copy; the KV source is never destroyed by any
  code path.
