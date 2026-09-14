# Grilling report for loop-3 tickets (read-only artifact)

Summary
- The eight open tickets across v2-agentic-platform (F1–F4) and v3-architecture-deepening (F1–F4) are all gated. None are executable without owner-triggered gates or fresh Tier-1 validation passes. The current evidence indicates blockers include missing operator keys, absent triggers, and pending owner/product decisions. The parallel track to improve architecture via improve-codebase-architecture is acknowledged but cannot execute gated work without gate fulfillment.

Per-ticket verdict lines below mark whether the ticket is executable now and what ungating would entail. All references below cite the mapped gate names and the PLAN/MAP sources surfaced in the tracker.

Notes on scope and constraints used for grilling
- All eight tickets are HITL-blocked or gated by explicit owner/product decisions or hidden flags.
- Gate semantics are drawn from docs/validation/eval-gates.md (Tier-1 and Tier-2 gates) and the tracker-index.md open-tickets section.
- The analysis assumes no mutations to repository state are allowed; only planning and risk articulation are produced per the read-only constraint.

----

## Executable-now verdicts and ungating conditions

Ticket: v2 F1 — F1-quote-bearing-baselines.md
- What it asks: Provide owner-supplied verbatim INT evidence for GF-6..GF-10 baseline/fixture records to satisfy evidence grounding; currently blocked awaiting source and acceptance rubric.
- Hidden requirements/risks: verbatim quotes essential (evidence_grounding=2); Tier-1 fresh archive and zero-drop eval must pass; 401 judge-key issue pending resolution (OPENCODE_API_KEY). If key is fixed, a fresh tier-1 run must pass and quotes verified; otherwise release cannot proceed.
- Dependencies: F4 resolution; M1/M2 references in MAP and PLAN; needs OWNER_GF_SOURCE_AND_ACCEPTANCE.
- Measured risk: high: without valid Tier-1 evaluation and owner acceptance, no progress. Key threat is judge gateway key failure causing repeated re-run costs.
- Executable-now? No. Ungating condition: supply valid owner-sourced GF evidence and a fresh Tier-1 archive with passes; fix judge key; then run tier1-archive.mjs --rebase --topup <runId> and re-verify quotes. See M1.
- Suggested ungating trigger: owner provides accepted GF source material and rubric alignment; judge gateway key corrected; Tier-1 pass achieved; then F1 proceeds.

Ticket: v2 F2 — F2-blob-storage-escape-hatch.md
- What it asks: If Upstash limits block data-URL images, add a second attachment implementation behind Attachment/Repository seam; currently fog until fresh limit probe.
- Hidden requirements/risks: requires BLOB_LIMIT_TRIGGER and BLOB_OWNER_SECURITY_AND_ROLLBACK to be opened; absent trigger means no migration; needs adapter behind Repository and proper migration/rollback handling; lock for single-writer; authorization/expiry/cleanup.
- Dependencies: M2 plan touch; M2 gate presence.
- Executable-now? No. Ungating condition: both BLOB_LIMIT_TRIGGER and BLOB_OWNER_SECURITY_AND_ROLLBACK exist and are satisfied; implement behind Repository edge-case adapters; ensure migration and rollback safe; then proceed.

Ticket: v2 F3 — F3-vault-sync-conflict-ux.md
- What it asks: Add deterministic path/hash/diff diagnostics for vault divergence and fail-closed on human resolution when conflict arises; current gating until trigger.
- Hidden requirements/risks: VAULT_CONFLICT_TRIGGER_AND_OWNER needed; deterministic fixtures, byte-identical compile; fail-closed instructions; acquire vault-state-single-writer lock.
- Dependencies: M3 touches in MAP; F1 gating interplay; tie to vault sync process.
- Executable-now? No. Ungating condition: trigger VAULT_CONFLICT_TRIGGER_AND_OWNER; provide deterministic divergent-path fixture; run vault-sync.mjs --check; then allow fall-through.

Ticket: v2 F4 — F4-report-generation-assists.md
- What it asks: After M1 gate and owner approval, pilot typed-draft report/recommendation drafting assists with OFF mode; preserve provenance and determinism of canonical report.
- Hidden requirements/risks: requires OWNER_ASSIST_SCHEMA_AND_QUALITY_INTERPRETATION and FRESH_TIER_1_ARCHIVE; changes to scripts and domain types; avoid editing render/pipeline contracts; requires newer Tier-1 if prompt/schema changes; risk of provenance drift.
- Dependencies: F1 gate; M4 references; MAP/M1/M4 references; M1 gating context in plan.
- Executable-now? No. Ungating condition: open OWNER_ASSIST_SCHEMA... and FRESH_TIER_1_ARCHIVE; update targeted modules (ai.ts, inference.ts, candidate-review) with a fresh Tier-1; ensure no edits to renderReportMarkdown or contracts; Tier-1 pass required.

Ticket: v3 F1 — F1-candidate-findings-review-ux.md
- What it asks: Roadmap commitment to make candidate-findings review UX smaller/usable as auditor-reviewable work items; patch live workspace, pending Flag-2 product decision and bottleneck evidence.
- Hidden requirements/risks: FLAG_2_PRODUCT_COMMITMENT and LIVE_REVIEW_BOTTLENECK; must patch several UI files and acquire page-workspace-single-writer lock.
- Dependencies: MAP references; M5 gating in PLAN; need live usage evidence.
- Executable-now? No. Ungating condition: FLAG_2_PRODUCT_COMMITMENT and LIVE_REVIEW_BOTTLENECK opened; apply patch and acquire required lock; then proceed with evaluation.

Ticket: v3 F2 — F2-audit-history-retention-policy.md
- What it asks: Define narrowly scoped retention for drafts/issues/artifacts/outcomes; policy/enforcement only; block on FLAG_1 authority.
- Hidden requirements/risks: TTL/purge/export/legal rules; authorization; rollback backups; tests ensuring immutability; requires persistence-single-writer lock.
- Dependencies: ADR lifecycle already implemented; MAP and PLAN references.
- Executable-now? No. Ungating condition: obtain FLAG_1_RETENTION_AUTHORITY; implement policy enforcement then proceed with tests and backups.

Ticket: v3 F3 — F3-rsc-initial-page-data.md
- What it asks: Spike measurable SEO/TTFB/loading target; generate server initial snapshot while preserving API mutations; idiomatic risk assessment; fog until target.
- Hidden requirements/risks: requires RSC_MEASURABLE_TARGET_AND_RISK_ACCEPTANCE; observable before/after performance; lock with M5; ensure no repository divergence.
- Dependencies: M7; PLAN map references.
- Executable-now? No. Ungating condition: secure RSC_MEASURABLE_TARGET_AND_RISK_ACCEPTANCE; run probe; measure SEO/TTFB; ensure no divergence; then proceed.

Ticket: v3 F4 — F4-postgres-adapter.md
- What it asks: After Phase-3 ownership, add a third DataStore adapter and remove memory-only split-brain; requires Phase-3 key-scheme ownership.
- Hidden requirements/risks: PHASE_3_KEY_SCHEME_AND_POSTGRES_AUTHORITY; prove contract matrix and no silent memory; use single writer lock; migration/backup planning.
- Dependencies: M8 references; MAP references; plan touch.
- Executable-now? No. Ungating condition: PHASE_3_KEY_SCHEME_AND_POSTGRES_AUTHORITY granted; implement memory/KV/Postgres contract matrix; enable Postgres adapter; ensure there is no silent fallback.

----

Escalation and owner-facing gaps
- All eight tickets require either owner decisions or external triggers. The eval-gates policy doc confirms Tier-1 gating and the need for verbatim grounding quotes; several tickets hinge on fresh Tier-1 archives, key access, or explicit product/owner commitments. The absence of an OPENCODE_API_KEY key (judge) blocks Tier-1, and the tracker shows no executable work without owner actions.
- Risks include: cost/time tied to Tier-1 cycles, gating dependencies across F1/F4 and the v3 flags, potential test/test-suite churn when gating is lifted, and cross-ticket lock management (per-plan writer locks). Without ungating plans, architecture-improvement tickets via improve-codebase-architecture remain non-executable in this pass.
- Dependencies among gates: F1 and F4 in v2 are algebraically connected to Tier-1/Eval; v3 gates depend on FLAG and PHASE keys. eval-gates.md indicates maximum freshness window; gating must be re-archived after Tier-1 passes to maintain freshness.

## Recommendations
- Do not attempt code changes now. Prepare ungating packages: supply required owner decisions, obtain fresh Tier-1 archives, and sort required keys (judge, OPENCODE_API_KEY). When gates are opened, execute the Architecture-improvement tickets in a controlled worktree and gate them through the orch pipeline.
- Document explicit ungating criteria per ticket in the tracker, including exact sources of truth for quotes, fixture paths, and lock types.
- Ensure that the parallel ticketing for NEW architecture improvements uses the improve-codebase-architecture skill in a gated mode, and aligns with the PLAN surfaces in .autoforge/plans/plan.md.

----

Artifact path for this grilling: .autoforge/requirements/grilling.md
