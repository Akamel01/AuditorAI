# Architecture Review — post-implementation (§33)

Date: 2026-08-22 · Method: ORCH walkthrough using codebase-design vocabulary
(Module/Interface/Depth/Seam/Adapter/Leverage/Locality), informed by CONTEXT.md and ADRs.
(HITL HTML-report flow deferred under continuous-execution mandate; findings below.)

## Candidates surfaced and disposition

### 1. Route-param naming drift `[id]` vs `[projectId]` — FIXED ✅

**Problem.** UI pages used `[id]` while API routes used `[projectId]`: the same concept
(Project) carried two names across the delivery seam — a locality leak; navigating between
layers required translation.

**Fix.** `git mv src/app/projects/[id] → [projectId]`; stale `.next/types` purged.

### 2. Report renderer duplication — FIXED ✅

**Problem.** The audit page carried a client-side mirror of the Markdown renderer
(`renderReportMarkdownClient`) alongside the canonical `src/lib/report.ts` — a change to
report structure would need two edits (locality violation, drift risk).

**Fix.** Deleted the mirror; the page imports the canonical pure function directly.

### 3. Engine module size — ACCEPTED (deep, not shallow)

`src/domain/engine.ts` concentrates stage resolution, manifest states, rule execution,
finding factories and wording discipline behind one interface (`runAudit`). Deletion test:
removing it collapses guarantees for all five jurisdictions simultaneously → load-bearing.
Internal seams (factories) keep it navigable.

### 4. Policy packs as data — CONFIRMED deep seam

Adding a jurisdiction requires zero engine changes: a pack file + registry entry. This is
the system's primary leverage point, validated by the interpreted-confidence cases (US,
INT) where only data differed.

## Rejected refactorings

- Splitting `engine.ts` into per-rule micro-modules: would move complexity to callers
  without a second adapter at any seam (hypothetical-seam rule).
- Extracting an HTTP client layer for KV: `KvRestStore` already isolates protocol details;
  further layers add interface without behaviour.

## Residual watch items

- `packs.ts` evidence-integrity gate loads registry per process — fine at current scale;
  revisit if packs grow substantially.
- UI form state is intentionally minimal; if input forms grow complex, introduce a single
  form-state module rather than ad-hoc hooks per component.
