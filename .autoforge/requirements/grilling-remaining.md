## Grilling — Remaining frontier tickets (R5–R15, R19) and T2

Scope: read-only interrogation of open frontier items in workflow/wayfinder maps for ops-residual. Each ticket is summarized, with hidden/adjacent requirements, risks, dependencies, and recommended actions. Self-approval flags note whether evidence supports immediate acceptance without further changes.

References (ticket sources cited inline):
- R5: R5-server-cancel.md → Stop/Cancel server endpoint (OPEN) [R5 text: acceptance criteria, interfaces] (R5-server-cancel.md:16-27, 28-31) 
- R6: R6-pagination-trim.md → Pagination across large job index (OPEN) (R6-pagination-trim.md:16-21, 27-30)
- R7: R7-refresh-parity.md → Refresh parity for parent reload on manual click (OPEN) (R7-refresh-parity.md:16-23, 26-29)
- R8: R8-harvest-health-route.md → Health route exposes harvest-health sub-object (OPEN) (R8-harvest-health-route.md:16-22, 27-30)
- R9: R9-discovery-doctor-json.md → Discovery doctor JSON contract for CI (OPEN) (R9-discovery-doctor-json.md:16-25, 27-29)
- R10: R10-dedupe-write-authority.md → state/dedupe-index.json write authority (OPEN) (R10-dedupe-write-authority.md:16-25, 27-31)
- R11: R11-drop-stale-comments.md → Hardening — drop speculative source comments (OPEN) (R11-drop-stale-comments.md:16-22, 27-29)
- R12: R12-autoforge-storage-policy.md → AutoForge storage policy (OPEN) (R12-autoforge-storage-policy.md:16-25, 27-30)
- R13: R13-eval-gate-freshness.md → Eval gate freshness automation (OPEN) (R13-eval-gate-freshness.md:16-21, 27-30)
- R14: R14-tier1-housekeeping.md → Tier-1 archive script housekeeping (OPEN) (R14-tier1-housekeeping.md:16-23, 27-30)
- R15: R15-docs-production-deploy-refresh.md → README/CONTRIBUTING production deploy refresh (OPEN) (R15-docs-production-deploy-refresh.md:16-22, 27-30)
- R19: R19-wayfinder-plumbing-traceability.md → Wayfinder plumbing traceability (OPEN) (R19-wayfinder-plumbing-traceability.md:29-36, 38-43)
- T2: plan.md entry — Ops-seamless-verify (CLOSED in plan) (plan.md:98-100)

Note on the scope of this grilling: R5–R15 and R19 are OPEN frontier work; T2 is CLOSED per Plan v2/v3 (see PLAN.md). The grilling also covers infra hazards noted in MAP.md and CHARTER. Where relevant, related guidance is cited from vault CHARTER and plan sections.

### 1) R5 — Stop/Cancel server endpoint
- What the ticket asks: implement a server-side cancel endpoint so the UI Stop button accurately reflects cancellation of in-flight harvest (OPEN). See R5.md for details on interface expectations and acceptance criteria.
- Hidden/adjacent requirements to surface: idempotent cancel handling, admin-key security on the endpoint, front-end integration path, and behavior when cancellation happens mid-node. Cross-talk with R1 (distributed lock) and the local-stop behavior is implied in the map.
- Key dependencies and risks: adds a new API surface; must align with existing src/discovery/jobs.ts update pattern; requires updating provider-health.tsx to surface status. See interfaces noted in R5.md (R5-server-cancel.md:24-27).
- Recommendations: scope a minimal endpoint, add tests for in-memory store, and coordinate with vault determinism gates for acceptance gating.
- Self-approve: false
- Escalations: none identified beyond standard API safety checks.
- Evidence refs: R5.md lines 16-27; R5.md 29-31; R5.md 24-27.

### 2) R6 — Pagination across large job index
- What the ticket asks: fix pagination to avoid lossy pages when the cursor falls outside the current scan window (OPEN). See R6.md for acceptance criteria requiring stable nextCursor behavior.
- Hidden requirements: aKV-backed index scan or sorted scan as a source of truth, and a documented truncation policy on overflow. Cross-dependency with R2 and R10 for indexing semantics.
- Risks: changes to paging could affect existing clients; need to maintain API shape. See R6.md 17-26 for interfaces.
- Recommendations: implement a stable paging layer using KV-tail or a sorted scan, with explicit nextCursor semantics and tests for cursor present/missing/past. Coordinate with existing vault/datasource interfaces.
- Self-approve: false
- Escalations: none.
- Evidence refs: R6.md:16-26; R6.md:28-30.

### 3) R7 — Refresh parity for parent reload on manual click
- What the ticket asks: surface the reason Refresh bypasses dedup via structured tooltip (OPEN).
- Hidden requirements: reuse existing tooltip mechanism; avoid new abstractions; accessibility considerations; minimal change.
- Recommendations: implement title or aria-label on the Refresh control; test with screen-reader-like checks.
- Self-approve: false
- Evidence refs: R7.md:16-29.

### 4) R8 — Health route harvest-health sub-object
- What the ticket asks: extend GET /api/dev/health with harvestHealth metadata (OPEN).
- Hidden requirements: define shape and derive from existing interfaces (getLedgerTailKV, getDataStore, jobs.listLatest) and add harvestHealthSummary in a new module. See R8.md lines 17-26.
- Recommendations: add a naive derivation module, wire into health route tests, ensure robust behavior when KV is unavailable.
- Self-approve: false
- Evidence refs: R8.md:16-25; R8.md:27-30.

### 5) R9 — Discovery doctor JSON contract for CI
- What the ticket asks: add a --json contract for discovery doctor output (OPEN).
- Hidden requirements: stable JSON shape for CI consumption; define fields like providers[].id, enabled, hostsOk, sampleHits, totals, etc.
- Recommendations: implement a --json branch in discovery-doctor.ts with deterministic output, add unit tests.
- Self-approve: false
- Evidence refs: R9.md:16-24; R9.md:27-29.

### 6) R10 — Dedupe index write authority (KV-truth vs file fallback)
- What the ticket asks: prefer KV as source of truth for dedupe index, avoid forking via file fallback on ROFS (OPEN).
- Hidden requirements: new KV-first load path; optional DISCOVERY_DEDUPE_INDEX_KEY; file mirror is best-effort in dev.
- Recommendations: implement KV-first loading and mirror behavior, add tests for ROFS and normal FS.
- Self-approve: false
- Evidence refs: R10.md:18-25; R10.md:27-31.

### 7) R11 — Hardening: drop speculative source comments
- What the ticket asks: remove stale internal comments that reference removed helpers (OPEN).
- Hidden requirements: ensure no references to removed code; maintain as-needed documentation.
- Recommendations: prune stale comments; run typecheck.
- Self-approve: false
- Evidence refs: R11.md:16-22; R11.md:27-29.

### 8) R12 — AutoForge storage policy
- What the ticket asks: decide whether .autoforge/ should be committed or ignored (OPEN).
- Hidden requirements: policy alignment with CHARTER; update AGENTS.md with storage policy.
- Recommendations: pick one policy and document in AGENTS.md; update .gitignore accordingly.
- Self-approve: false
- Evidence refs: R12.md:16-25; R12.md:27-30.

### 9) R13 — Eval gate §2 freshness automation
- What the ticket asks: automate freshness gate in CI (OPEN).
- Hidden requirements: define max-age from doctrine; implement gate script and GitHub Action; test coverage for fresh/stale.
- Recommendations: add a gate script and CI step as described; align with docs/validation/eval-gates.md.
- Self-approve: false
- Evidence refs: R13.md:16-23; R13.md:27-30.

### 10) R14 — Tier-1 archive script housekeeping
- What the ticket asks: clean up Tier-1 archive script comments to reflect current behavior (OPEN).
- Hidden requirements: keep documentation path references stable; ensure top-level doc matches doctrine without behavior change.
- Recommendations: update header comments and cross-reference docs.
- Self-approve: false
- Evidence refs: R14.md:16-23; R14.md:27-30.

### 11) R15 — README + CONTRIBUTING refresh Production deploy section
- What the ticket asks: align docs with actual production deploy workflow (OPEN).
- Hidden requirements: ensure production flow is described consistently with AGENTS.md evaluation gates; avoid command reordering.
- Recommendations: update READMEs accordingly; reference docs/deploy if present.
- Self-approve: false
- Evidence refs: R15.md:16-21; R15.md:27-30.

### 12) R19 — Wayfinder plumbing traceability — ticket index + Mission Control board
- What the ticket asks: establish a traceable index for Wayfinder tickets and Mission Control board visibility (OPEN).
- Hidden requirements: ensure the ticket index is canonical for ops-residual; harmonize with CLI and board; address drift and local vs GitHub state.
- Recommendations: confirm canonical index ownership; expose an API/CLI equivalent; document the contract in CHARTER/PLAN.
- Self-approve: false
- Evidence refs: R19.md:29-36; R19.md:38-43.

### T2 — Ops-seamless-verify (verification and closure of T2)
- Status note: T2 is CLOSED in Plan v2/v3 (see PLAN.md). This grilling treats T2 as already closed and not requiring changes here (PLAN.md shows T2 closed; see plan.md lines 98-101).
- Evidence refs: .autoforge/plans/plan.md:98-100.

### Gates, risks, and cross-cutting concerns
- Parallel session risks in vault-memory: staging hygiene and per-file commit discipline apply to all tickets in this frontier (see MAP.md notes on staging and vault determinism). Citations: MAP.md lines 14-16 (ladder discipline), 39-41 (locks), 43-45 (Phase sequencing) and CHARTER.md for zone ownership.
- Dependencies across R5–R15/R19 include: shared KV/seam stability, admin-auth requirements, and vault-determinism constraints described in the Plan and MAP docs.
- The plan emphasizes smallest safe change and deletion-first mindset; these tickets should be approached with the ponytail ladder once concrete change touchpoints are known (R5–R15 touch server/routes, health endpoints, and governance surfaces). See PLAN.md and MAP.md (R5 uses admin interface; R8 health route extension; R9 JSON contract, etc.).

### Summary and next steps
- This grilling exposes a coherent set of adjacent concerns that surround the 12 frontier tickets plus the one completed T2 context. The primary actionable path is to translate these questions into concrete experiments and tests within the repo's existing vault-determinism and front-matter governance. See CHARTER.md and PLAN.md for the governance framework and determinism gates.

Artifact path: .autoforge/requirements/grilling-remaining.md
