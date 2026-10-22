# Security & Privacy Review — §35 pre-deployment pass

Date: 2026-08-22 · Reviewer: ORCH (security-privacy role)

| Control | Status | Notes |
|---|---|---|
| No secrets in Git | PASS | `.env.example` placeholders only; history clean |
| Environment variables | PASS | `KV_REST_API_URL/TOKEN`, `AI_ADAPTER`, `AI_PROVIDER_API_KEY` via Vercel env |
| Upload validation | PASS | 10 MB cap; extension allow-list (.pdf/.txt/.md); `%PDF-` magic-byte check; extracted text capped at 200k chars; original files never persisted (`src/lib/extract.ts`) |
| Sanitization | PASS | NUL stripping on extraction; React escaping everywhere; reports rendered from typed structures, not raw HTML |
| Workspace access model | PASS | Bearer-style `x-workspace-key`; server persists only a SHA-256 prefix hash for namespacing |
| Endpoint protection | PASS | Three PUBLIC read-only routes need no key (`GET /api/jurisdictions`, `GET /api/jurisdictions/[jur]/stages`, `GET /api/inputs/[jur]` — no tenant data, no mutation); tenant routes require the WORKSPACE key (`x-workspace-key` → 401 otherwise); the `/api/dev/*` family requires the ADMIN key (`x-admin-key` → 401 otherwise); stage eligibility failures → 422. Every route and its gate are enumerated in `contracts/api-surface.json` |
| CORS | PASS | Next.js same-origin defaults; no cross-origin API surface configured |
| Rate limiting | DEFERRED | In-memory per-instance limiters are ineffective on serverless; KV-backed limiter listed as pre-public hardening |
| Prompt/tool isolation | PASS | AI adapter OFF by default; bounded candidate artifact types only; no tool execution by LLM nodes |
| Persistence upgrade seam | PASS | `DataStore{put,get,keys}` — DB swap without touching callers |
| Sensitive-data assumptions | DOCUMENTED | Anonymous workspaces, no accounts/PII; demo data only |

Gate: acceptable for prototype deployment carrying non-sensitive data.
Rate limiting is mandatory before any public or multi-user use.
