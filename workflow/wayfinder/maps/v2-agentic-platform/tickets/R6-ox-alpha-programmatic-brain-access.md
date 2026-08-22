---
id: R6
title: ox-alpha programmatic brain access
type: research
hitl: false
status: closed
assignee:
blocked_by: []
blocks: [R7]
created: 2026-08-22
resolved: 2026-08-22
---

## Question

How can AuditorAI invoke ox-alpha/opencode programmatically at runtime? Investigate: opencode Zen / gateway OpenAI-compatible endpoints for x-preview-f-free; auth + free-tier limits; vision (image input) support; serverless reachability from Vercel; opencode serve headless HTTP mode as fallback plane. Write findings to docs/research/llm-brain-access.md only.

## Resolution

Resolved 2026-08-22 by researcher-brain-access subagent; findings in [docs/research/llm-brain-access.md](../../../../../docs/research/llm-brain-access.md).

Key verified facts:
1. **OpenCode Zen** is a hosted OpenAI-compatible gateway: base `https://opencode.ai/zen/v1`, `Authorization: Bearer $OPENCODE_API_KEY` (key from opencode.ai/auth). Model `x-preview-f-free` ("Ox Alpha Free") listed at `/chat/completions`: Free tier, 1M context, zero-retention — but limited-time stealth model, no published rate limits.
2. **Vision: YES** (models.dev metadata: text/image/video input) — request format needs one smoke test.
3. **Effort control**: documented as variants low/high/max + temperature; exact wire param undocumented (verify empirically).
4. `opencode serve` exists (port 4096, basic auth) but exposes agent/session APIs, not raw completions — wrong plane for stateless runtime calls.
5. Fallbacks behind same interface: OpenRouter free pool (20 RPM/50 day), Google AI Studio (Gemini Flash ~10 RPM), Groq (~30 RPM).

Recommendation carried to R7: direct Zen fetch adapter from Vercel functions, OpenRouter→Groq fallbacks, four smoke tests before wiring.
