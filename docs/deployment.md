# Deployment

Target: **Vercel free (Hobby) tier** — ADR-0001. Docker explicitly out of scope.

## Option A — Dashboard integration (simplest)

1. Push to `main` (this repo is already on GitHub).
2. In [vercel.com](https://vercel.com) → *Add New Project* → import `Akamel01/AuditorAI`.
3. Framework preset **Next.js** is auto-detected; click **Deploy**.
4. Add environment variables in Project → Settings → Environment Variables:
   - `KV_REST_API_URL`, `KV_REST_API_TOKEN` — from an [Upstash](https://upstash.com)
     free Redis (or Vercel Marketplace KV). Without them the app still builds and runs,
     but persistence falls back to per-instance memory (documented behavior).

## Option B — Automatic deploys from CI

Set repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
(Vercel → Project → Settings → General → "Git" / CLI instructions). The
[`deploy.yml`](../.github/workflows/deploy.yml) workflow then builds and promotes
production deployments on every push to `main`; it skips cleanly while secrets are absent.

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
