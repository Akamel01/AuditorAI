# Tracker Index — loop-3 refresh (2026-09-14, orchestrator-written from verified discovery findings)

GitHub: 0 open issues (prior sweep; discovery re-confirmed).
Closed maps: ai-harvest-stream (H1–H13), harvest-verification (HV1–HV9), mvp, ops-residual (R1–R19), rsa-corpus (C1–C10).

## Open tickets (8, all gated tripwires — zero agent-executable work without owner/trigger)
[wayfinder:v2-agentic-platform] F1-quote-bearing-baselines — OPEN, hitl, unassigned, blocked_by=[] blocks=[F4]; gate OPENED 2026-09-13 via 20/20 chat ratification; remaining: fresh Tier-1 + zero-drop verify BLOCKED on Zen judge 401 (Keychain auditorai/opencode rejected, no spend). Evidence: F1-quote-bearing-baselines.md:6,9 + ## Progress.
[wayfinder:v2-agentic-platform] F2-blob-storage-escape-hatch — OPEN, blocked_by=[]; needs BLOB_LIMIT_TRIGGER (absent; attachment seam has byte caps + tests). Evidence: F2-blob-storage-escape-hatch.md:6,8,22.
[wayfinder:v2-agentic-platform] F3-vault-sync-conflict-ux — OPEN, hitl, blocked_by=[]; needs VAULT_CONFLICT_TRIGGER (absent; vault-sync --check exit 0). Evidence: F3-vault-sync-conflict-ux.md:6,8,22.
[wayfinder:v2-agentic-platform] F4-report-generation-assists — OPEN, hitl, blocked_by=[F1]; needs OWNER_ASSIST_SCHEMA_AND_QUALITY_INTERPRETATION + FRESH_TIER_1_ARCHIVE. Evidence: F4-report-generation-assists.md:6,8,22.
[wayfinder:v3-architecture-deepening] F1-candidate-findings-review-ux — OPEN, hitl, blocked_by=[]; needs FLAG_2_PRODUCT_COMMITMENT (owner decision). Evidence: F1-candidate-findings-review-ux.md:6,8,22.
[wayfinder:v3-architecture-deepening] F2-audit-history-retention-policy — OPEN, hitl, blocked_by=[]; needs FLAG_1_RETENTION_AUTHORITY (owner decision). Evidence: F2-audit-history-retention-policy.md:6,8,22.
[wayfinder:v3-architecture-deepening] F3-rsc-initial-page-data — OPEN, blocked_by=[]; needs RSC_MEASURABLE_TARGET_AND_RISK_ACCEPTANCE (no target set). Evidence: F3-rsc-initial-page-data.md:6,8,22.
[wayfinder:v3-architecture-deepening] F4-postgres-adapter — OPEN, hitl, blocked_by=[]; needs PHASE_3_KEY_SCHEME_AND_POSTGRES_AUTHORITY (not granted). Evidence: F4-postgres-adapter.md:6,8,22.

## Notes
- ops-seamless-verify T2: worktree shows status resolved (foreign parallel-session edit, uncommitted); HEAD shows blocked. Not in open set either way; owning session to commit + update wayfinder-tickets.test.ts:143 (expects blocked).
- Frontier (open+unassigned+blockers-terminal): v2 F2/F3, v3 F1/F2/F3/F4 (F1 v2 unassigned but judge-blocked; F4 blocked by F1).
