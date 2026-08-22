# Security & Privacy Review — §35 pre-deployment pass

Date: 2026-08-22 · Reviewer: ORCH (security-privacy role)

| Control | Status | Notes |
|---|---|---|
| No secrets in Git | PASS | `.env.example` placeholders only; history clean |
| Environment variables | PASS | `KV_REST_API_URL/TOKEN`, `AI_ADAPTER`, `AI_PROVIDER_API_KEY` via Vercel env |
| Upload validation | PASS | 10 MB cap; extension allow-list (.pdf/.txt/.md); `%PDF-` magic-byte check; extracted text capped at 200k chars; original files never persisted (`src/lib/extract.ts`) |
| Sanitization | PASS | NUL stripping on extraction; React escaping everywhere; reports rendered from typed structures, not raw HTML |
| Workspace access model | PASS | Bearer-style `x-workspace-key`; server persists only a SHA-256 prefix hash for namespacing |
| Endpoint protection | PASS | All `/api/*` require workspace key → 401 otherwise; stage eligibility failures → 422 |
| CORS | PASS | Next.js same-origin defaults; no cross-origin API surface configured |
| Rate limiting | DEFERRED | In-memory per-instance limiters are ineffective on serverless; KV-backed limiter listed as pre-public hardening |
| Prompt/tool isolation | PASS | AI adapter OFF by default; bounded candidate artifact types only; no tool execution by LLM nodes |
| Persistence upgrade seam | PASS | `DataStore{put,get,keys}` — DB swap without touching callers |
| Sensitive-data assumptions | DOCUMENTED | Anonymous workspaces, no accounts/PII; demo data only |

Gate: acceptable for prototype deployment carrying non-sensitive data.
Rate limiting is mandatory before any public or multi-user use.
