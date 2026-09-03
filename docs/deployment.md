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
