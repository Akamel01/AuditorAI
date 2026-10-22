# Deployment

Target: **Vercel free (Hobby) tier** — ADR-0001. Docker explicitly out of scope. Production is `main` — Vercel auto-deploys from `main` (no manual promotion).

main is production: every push to `main` auto-deploys to production (`auditorai-gamma.vercel.app`, `auditorai-auditor-ai1.vercel.app`, region `iad1`). No manual promotion; Vercel auto-deploys is the source of truth.

- Discovery harvest: a `discovery-harvest` schedule (cron/GitHub Action) runs harvest and pushes `data(discovery): harvest … [skip ci]` to `main` (updates `state/discovery-ledger.json`, `state/odd-coverage.json`). Schedule is defined in `.github/workflows/` discovery-harvest; main remains production.
- Eval gates: thresholds and judge prompts are doctrine-frozen; see `docs/validation/eval-gates.md:15-38` and `AGENTS.md` Eval gates — §2 trigger paths require a fresh Tier-1 archive, judge flakes prefer `--topup <runId>`.

## Option A — Dashboard integration (simplest)

1. Push to `main` (this repo is already on GitHub).
2. In [vercel.com](https://vercel.com) → *Add New Project* → import `Akamel01/AuditorAI`.
3. Framework preset **Next.js** is auto-detected; click **Deploy**.
4. Add environment variables in Project → Settings → Environment Variables:
   - `KV_REST_API_URL`, `KV_REST_API_TOKEN` — from an [Upstash](https://upstash.com)
     free Redis (or Vercel Marketplace KV). Without them the app still builds and runs,
     but persistence falls back to per-instance memory (documented behavior).
   - `ADMIN_KEY` *(optional, developer-only)* — gates the `/dev` page and `/api/dev/*`
     routes. Leave unset in production unless developer tooling is wanted; routes
     fail closed (unset key is indistinguishable from a wrong one).
   - `TENANT_STORE` — the cutover switch. The Postgres tenant path runs ONLY
     when this is `postgres`; leave it empty to keep the legacy KV store with
     the "database not configured" notice (see *Tenant store* below).
   - `TENANT_POSTGRES_URL` — pooled connection string the app actually uses
     for the tenant store, pointed at the `auditorai_app` role of a Supabase
     Postgres project in region `ca-central-1` (see *Tenant store* below).
   - `POSTGRES_URL` — platform-injected owner credentials (the platform links
     the Supabase project). The app never reads it: the owner bypasses RLS.

## Tenant store — operator action before the merge (ACTION-1)

The tenant store is **Supabase Postgres, region `ca-central-1`**, pinned in
[`supabase/migrations/0001_tenant_schema.sql`](../supabase/migrations/0001_tenant_schema.sql:1).
All nine tenant tables carry row-level security, enabled and forced, and the
application reaches the database as the non-bypass `auditorai_app` role.

**No agent applies the SQL.** The operator procedure — apply
`0001` → `0002` → `0003` in order, set the `auditorai_app` password out of
band, set `TENANT_POSTGRES_URL`, run the KV → Postgres migration (dry run,
then apply), and flip `TENANT_STORE=postgres` **last** — is in
[`supabase/README.md`](../supabase/README.md).

**Ordering (ACTION-1).** The merge auto-deploys to Production: every push to
`main` auto-deploys (region `iad1`, see line 5 above). The tenant path is
**explicit** (`TENANT_STORE=postgres` + `TENANT_POSTGRES_URL`), so the merge
is safe by construction. The operator still performs ACTION-1 — schema, role,
`TENANT_POSTGRES_URL`, the KV → Postgres migration, then the switch — to reach
the intended state.

**Until that is done the deployed code does not fail.** Until
`TENANT_STORE=postgres` is set the app never touches Postgres at all — it
keeps the Upstash path (no 42P01 probe), so the merge is safe by construction.
Once the switch is on but the schema is missing, the credential lookup hits a
schema that does not exist (SQLSTATE `42P01`), the request degrades to the
legacy KV store, and the UI shows the plain "database not configured" notice
(`src/lib/db-notice.ts`). That is a **notice, not a 503** — the request still
succeeds with HTTP 200. The other case is different: a configured but
unreachable database fails closed with 503 (`src/lib/db/errors.ts`), and a
revoked credential answers 401.

Cutover is per workspace, not per deployment: Postgres serves a workspace only
once that workspace's credential resolves. The sub-processor register is
[`docs/compliance/sub-processor-register.md`](compliance/sub-processor-register.md).

## Option B — Automatic deploys from CI

Set repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
(Vercel → Project → Settings → General → "Git" / CLI instructions). The
[`deploy.yml`](../.github/workflows/deploy.yml) workflow then builds and promotes
production deployments on every push to `main`; it skips cleanly while secrets are absent. Production remains `main` Vercel auto-deploys.

## Post-deploy verification

- Open the deployment URL → landing page renders with the professional-responsibility
  disclaimer.
- Create a project (workspace key auto-provisioned in browser localStorage).
- Run an audit on UK Stage 2 with missing inputs → missing-information artifacts appear;
  findings are compliance questions only; report downloads as `.md`.

## Security notes

- No secrets in git; runtime config arrives via environment variables only.
- Workspace key: generated client-side (`crypto.randomUUID`), transmitted per request,
  stored server-side only as a SHA-256 prefix used for key namespacing.
- Uploads: ≤10 MB, extension allow-list (.pdf/.txt/.md), PDF magic-byte check, extracted
  text capped at 200k chars; original files are never persisted.
- AI adapter is OFF by default; enabling it later adds provider keys as env vars and never
  grants AI nodes authority over final findings.
