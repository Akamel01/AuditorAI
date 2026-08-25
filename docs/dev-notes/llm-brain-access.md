---
title: LLM brain access research (R6)
date: 2026-08-22
agent: researcher-brain-access
status: complete
---

# LLM "brain" access for AuditorAI's runtime audit pipeline

Question: how does a Vercel serverless function programmatically invoke the model
`ox-alpha` (model id `opencode/x-preview-f-free`, served via opencode) at runtime?

**Legend:** VERIFIED = confirmed against a cited primary/official source. INFERENCE =
reasoned from verified facts but not directly documented; needs a smoke test before we
rely on it. UNVERIFIED = claimed by secondary sources only.

---

## Q1 — Does opencode offer a hosted API gateway? Base URL + auth?

**VERIFIED. Yes — "OpenCode Zen".**

- Official docs: <https://opencode.ai/docs/zen/> (last updated 2026-08-21): "OpenCode Zen is an AI gateway that gives you access to these models… You are charged per request and you can add credits to your account."
- You sign in at <https://opencode.ai/auth>, add billing details, and copy an **API key**. Free models require the same key (no separate free key tier documented).
- **Base URL:** `https://opencode.ai/zen/v1` — confirmed by models.dev provider record (`provider.opencode`: `api: https://opencode.ai/zen/v1`, `env: OPENCODE_API_KEY`, SDK `@ai-sdk/openai-compatible`, <https://models.dev/providers/opencode/>) and by Docker's official provider docs (<https://docs.docker.com/ai/docker-agent/providers/opencode-zen>: `curl https://opencode.ai/zen/v1/models`).
- Endpoint shape is **per-model-family** (official Zen docs endpoints table):
  - OpenAI-compatible chat completions → `https://opencode.ai/zen/v1/chat/completions`
  - OpenAI Responses API → `https://opencode.ai/zen/v1/responses`
  - Anthropic Messages → `https://opencode.ai/zen/v1/messages`
  - Model catalog → `GET https://opencode.ai/zen/v1/models`
- **Auth mechanism:** API key transmitted as `Authorization: Bearer <OPENCODE_API_KEY>`. The official docs don't spell out the header; this is corroborated by multiple independent implementations that proxy Zen with the key as a Bearer token (AsimAftab/opencode-zen-gateway, Baronco/opencode-openwebui-gateway) and by opencode's general auth.json behavior ("OpenCode automatically passes the key as a `Bearer` token in the `Authorization` header", community config guide). Treat the exact header as VERIFIED-by-corroboration; a one-line curl smoke test confirms it.
- There is also a second plan-flavored base URL `https://opencode.ai/zen/go/v1` used by the paid "OpenCode Go" subscription (UNVERIFIED — seen only in a third-party repo README, Baronco/opencode-openwebui-gateway). Not needed for our use case.
- A separate "Console" inference gateway exists at console.opencode.ai advertising one gateway for OpenAI/Anthropic/Gemini-style calls (observed in search results only — UNVERIFIED, not researched further).

## Q2 — Is `x-preview-f-free` callable through it? Rate limits / free-tier terms?

**VERIFIED. Yes.**

- The official Zen endpoints table lists it explicitly: **Ox Alpha Free | `x-preview-f-free` | `https://opencode.ai/zen/v1/chat/completions` | `@ai-sdk/openai-compatible`** (<https://opencode.ai/docs/zen/>).
- Pricing table lists Ox Alpha Free: Input **Free**, Output **Free**, Cached Read **Free**.
- Privacy note (official): "**Ox Alpha Free** is a stealth model that's free on OpenCode **for a limited time**. Its provider follows a **zero-retention policy** and does not use your data for model training." — relevant to AuditorAI's evidence/provenance discipline; unlike most other free Zen models (Big Pickle, MiMo-V2.5 Free, Hy3 Free, Nemotron free tiers), Ox Alpha Free is NOT listed among the exceptions that train on your data.
- In opencode config the full id is `opencode/x-preview-f-free` (models doc format `provider_id/model_id`, <https://opencode.ai/docs/models/>).
- models.dev metadata (fetched live from <https://models.dev/api.json>, 2026-08-22): name **"Ox Alpha Free (Unlimited)"**, description "Stealth reasoning model for coding, agentic tasks, and tool use", release date 2026-08-21.
- A public X post (2026-08-21) asks opencode whether `x-preview-f-free` is the internal id of "Ox Alpha"; no denial found, and the system prompt of this very research agent declares itself ox-alpha with model id `opencode/x-preview-f-free`. Consistent, though not officially documented (corroborated only).

**Rate limits / terms: UNVERIFIED numerically.**

- No published RPM/RPD numbers exist in the official Zen docs for free models. The models.dev display name "(Unlimited)" suggests generous/no hard request cap — INFERENCE from a name, not a term of service.
- Community report (~40 tok/s output speed, slow vs DeepSeek v4 Flash) — UNVERIFIED anecdote.
- Known soft constraints: the free period is explicitly time-limited ("limited time"), so the model can be withdrawn or moved to paid without notice (the Zen docs already run a deprecation table for other models). Design for graceful degradation regardless.

## Q3 — Headless/server mode: `opencode serve`

**VERIFIED. It exists** (<https://opencode.ai/docs/server>):

- `opencode serve [--port] [--hostname] [--cors]` runs a headless HTTP server exposing an **OpenAPI 3.1 spec** at `/doc`; default port `4096`, default hostname `127.0.0.1`.
- **Auth:** set `OPENCODE_SERVER_PASSWORD` to enable HTTP basic auth (username defaults to `opencode`, overridable via `OPENCODE_SERVER_USERNAME`). Applies to `serve` and `web`. Without it there is NO auth.
- External clients can call it (it powers IDE plugins and `opencode attach` / `opencode run --attach http://host:4096`). Binding `--hostname 0.0.0.0` makes it network-reachable; docs/community guidance warns this exposes an agent that edits files and runs shell — never expose unauthenticated.
- Always-on host feasibility (Fly.io / Railway / Oracle free VM): technically straightforward — it's a single static binary/process serving HTTP — INFERENCE on hosting specifics (no official deployment guide found). Latency/cold-start characteristics on small VMs unknown.

**Important architectural caveat (INFERENCE from the documented API surface):**
`opencode serve` exposes **agent/session APIs** (create session, send message, list sessions, file/find tools, TUI control), i.e., it drives the *full coding agent* with tool use and filesystem context. It is not a raw `/chat/completions` proxy. For a runtime "brain" call inside an audit pipeline we want a stateless completion call with structured JSON out — using `serve` would drag along session state, tool permissions, and a working-directory concept, plus another always-on host and its own auth surface. Verdict: viable escape hatch, wrong default plane. The Zen hosted endpoint gives us the same underlying model with one HTTPS call and zero infrastructure.

## Q4 — Vision support (base64 image inputs)?

**VERIFIED at the capability level.** models.dev entry for `x-preview-f-free` (live fetch, 2026-08-22):

```json
"attachment": true,
"modalities": { "input": ["text", "image", "video"], "output": ["text"] }
```

Community corroboration: a Chinese-language post dated 2026-08-21 describes X-Preview-F Free as having strong multimodal processing ("多模态处理能力强大") — UNVERIFIED secondary source, consistent with the above.

**INFERENCE (needs smoke test):** because the model is served through the OpenAI-compatible `chat/completions` surface, images should be passed as standard OpenAI content parts:

```json
{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
```

No official Zen doc page documents multimodal request formatting for this stealth model specifically. Plan a one-request smoke test before wiring scheme drawings/plans into findings generation. Video input is claimed in metadata; assume text+image only until tested.

## Q5 — Effort / reasoning-level controls?

**VERIFIED that controls exist; exact wire parameter is INFERENCE.**

- models.dev entry for `x-preview-f-free`: `"reasoning": true`, `"reasoning_options": [{"type": "effort", "values": ["low", "high", "max"]}]`, `"temperature": true`, `"structured_output": true`, `"tool_call": true`.
- In opencode these surface as **variants** (CLI `--variant <level>`, "Model reasoning effort (e.g., high, max, minimal)", <https://dev.opencode.ai/docs/cli>; TUI variant switcher, <https://opencode.ai/docs/models/>).
- Mechanically, variants map to per-provider request options in opencode's provider transform layer; for `@ai-sdk/openai-compatible` providers the effort variant serializes to the OpenAI-style `reasoning_effort` body field (evidence: anomalyco/opencode issue #34278 shows openai-compatible branches emitting `reasoning_effort` values on the wire, and the AI SDK convention `reasoningEffort` → `reasoning_effort`). So the likely raw call is:

```json
POST https://opencode.ai/zen/v1/chat/completions
{
  "model": "x-preview-f-free",
  "messages": [...],
  "reasoning_effort": "high",
  "temperature": 0.2
}
```

  Whether Zen's stealth backend accepts `reasoning_effort`, or expects a variant-suffixed model id (e.g. `x-preview-f-free@high`) or ignores it silently, is **undocumented — verify empirically**. Temperature is supported per metadata; note many reasoning models prefer/force temperature 1 — treat non-default temperature as best-effort.

## Q6 — Fallbacks: alternative OpenAI-compatible providers with free tiers

All three are zero-dependency `fetch` targets suitable for Vercel functions.

### 6.1 OpenRouter — `https://openrouter.ai/api/v1/chat/completions` (Bearer key)

- **Rate limits (VERIFIED via OpenRouter's own help center, <https://openrouter.zendesk.com/hc/en-us/articles/39501163636379>):** free models = **20 req/min**; daily = **50 req/day** if lifetime credits purchased `< $10`, **1000 req/day** once you've ever bought $10 of credits (one-time, non-expiring). Account-wide, not per-model. 429s carry `X-RateLimit-*` headers.
- Model pool rotates weekly (~25–29 `:free` models mid-2026); examples current as of Jul–Aug 2026: `nvidia/nemotron-3-ultra:free`, `tencent/hy3:free`, `poolside/laguna-m.1:free`(?), `cohere/north-mini-code:free`(?), `deepseek/deepseek-r1:free`. Exact ids churn — resolve at runtime via `GET /models` filtered on `pricing.prompt == "0"` rather than hardcoding. (Pool names VERIFIED via secondary roundups; some id suffixes INFERENCE.)
- Caveats: lowest routing priority (throttled first under capacity pressure); some free endpoints may log/train on prompts — filter providers accordingly. Never hardcode a free id into production paths.

### 6.2 Google AI Studio (Gemini API) — `https://generativelanguage.googleapis.com/v1beta/...` (also OpenRouter-proxied)

- **Free tier (VERIFIED via official pages, cross-checked Aug 2026):** Gemini 3.x Flash-class models free of charge; representative limits ~**10–15 RPM, 250K–1M TPM, 1,000–1,500 RPD** depending on model (e.g., Gemini 3 Flash ≈ 10 RPM / 250K TPM / 1,500 RPD; sources: <https://ai.google.dev/gemini-api/docs/rate-limits>, <https://ai.google.dev/gemini-api/docs/pricing>, plus consistent third-party trackers). Limits are per-project, RPD resets midnight Pacific.
- Strong vision support natively; excellent structured-output (JSON schema) support — good fit as the *compliance-check* workhorse fallback.
- **Critical caveat for AuditorAI:** Google's free tier explicitly **uses prompts/outputs to improve products** ("Used to improve our products: Yes" on the pricing page). Client project inputs (scheme data) going to a training pipeline may violate our evidence/confidentiality posture — flag before enabling; paid tier removes this.

### 6.3 Groq — `https://api.groq.com/openai/v1/chat/completions` (Bearer key)

- **Free tier (VERIFIED via Groq docs-derived tables, cross-checked 2026):** per-model limits, e.g. `llama-3.3-70b-versatile` 30 RPM / 12K TPM / **1K req/day** / 100K TPD; `openai/gpt-oss-120b` 30 RPM / 8K TPM / 1K RPD / 200K TPD; `llama-3.1-8b-instant` 30 RPM / **14.4K req/day** / 500K TPD. No credit card. Response headers expose remaining quota (`x-ratelimit-*`), but NOT daily counts — track client-side.
- Fastest tokens/sec of the three (LPU), fully OpenAI-compatible; weaker on long-context reasoning than the primary; text-only models listed (vision via `meta-llama/llama-4-scout` exists but quota-limited).

---

## Recommendation

Ranked for the runtime plane given: Vercel serverless caller, zero-dep `fetch` client preferred, free-tier-first.

1. **Primary: OpenCode Zen direct — `POST https://opencode.ai/zen/v1/chat/completions`, `Authorization: Bearer ${OPENCODE_API_KEY}`, `model: "x-preview-f-free"`.** Zero infrastructure, one HTTPS call from the function, exactly the mandated brain model, $0, zero-retention provider (best privacy posture of any free option surveyed), 1M-token context covers whole Audit Context bundles, native vision (pending smoke test) for scheme drawings, effort control for cheap-vs-deep finding passes. Wrap in a thin provider interface so the base URL/model/key are env-config.
   **Mandatory pre-build smoke tests (30 min):** (a) Bearer auth + plain completion; (b) `reasoning_effort` accepted/ignored/error; (c) base64 `image_url` content part round-trip; (d) behavior under rapid-fire requests (probe undocumented rate limits ourselves before launch week).
2. **Secondary/fallback #1: OpenRouter free pool** behind the same interface (`https://openrouter.ai/api/v1`, dynamic `:free` model resolution). Accept the 50/day (or 1000/day after one-time $10 credit) caps — enough for dev/staging and emergency prod failover, not sustained load. Prefer providers whose data policy forbids training.
3. **Fallback #2: Groq** (`gpt-oss-120b` or `llama-3.3-70b-versatile`) for volume-tolerant, non-sensitive sub-steps (title/summary/classification), respecting 1K RPD.
4. **Not recommended for runtime: `opencode serve`** on an always-on host. Works (verified headless HTTP + basic auth), but it fronts the full agent/session/tool stack rather than raw completions, adds a second always-on surface to secure, and buys nothing over the hosted Zen endpoint. Revisit only if Zen ever gates programmatic API access to the stealth model behind interactive CLI use.
5. **Google AI Studio free tier: hold.** Generous and vision-strong, but free-tier data-training terms conflict with handling client scheme data; keep as documented contingency for non-confidential workloads or move straight to paid if ever needed.

**Risk register:** `x-preview-f-free` is a limited-time stealth model — it WILL eventually change or disappear. Mitigate via the provider-interface seam + fallback chain above, and pin nothing else to its quirks (variant naming, wire params) outside one adapter module.
