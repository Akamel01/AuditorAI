# ADR-0001: Platform baseline — Next.js on Vercel, bounded AI adapter, hosted-KV persistence

- **Status:** Accepted
- **Date:** 2026-08-22
- **Decided in:** Wayfinder ticket [G1-stack-hosting](../../workflow/wayfinder/maps/mvp/tickets/G1-stack-hosting.md) (HITL)

## Context

The MVP needs free hosting, no Docker, server-side secret handling for an optional LLM
adapter, and persistence for projects/audits/findings. Deployment choice must not dictate
the domain model.

## Decision

1. **Next.js (App Router) + TypeScript**, deployed on **Vercel free tier**. Server routes
   host deterministic engines and any AI proxying so API keys never reach the browser.
2. **AI is provider-agnostic and OFF by default.** An `AiAdapter` seam exists; adapters may
   emit only bounded artifact types (`CandidateFinding`, `DraftRationale`, `EvidenceSummary`,
   `MissingInformationQuestion`, `PotentialRecommendation`). Deterministic behavior must be
   fully functional with the adapter disabled.
3. **Persistence uses a free-tier hosted KV store behind a Persistence seam.** Callers depend
   on the interface (save/load project & audit aggregates), not the store; swapping to
   browser-local or a database later changes only the adapter.

## Consequences

- Domain model, policy packs, schemas, and the audit graph remain framework-independent;
  Next.js specifics live in thin delivery adapters only.
- Determinism tests run without network or keys.
- Free-tier limits apply to KV usage; acceptable for prototype scale, revisit before real use.
