# Frontier Ticket Index — 2026-10-21 (branch oc/40)

Rule (TRACKER.md:60,37): frontier = open + unassigned + all `blocked_by` closed + `hitl: false`. Wayfinder paths: under `workflow/wayfinder/maps/`.

## Frontier tickets

- [GH:Akamel01/AuditorAI#40] #40 — Harvest Track A: fetch Canadian RSA docs — open — blocked_by=none — github.com/Akamel01/AuditorAI/issues/40
- [wayfinder:ops-residual/R1] R1 — Cross-instance harvest lock (KV SET NX) — open — blocked_by=[] — ops-residual/tickets/R1-cross-instance-harvest-lock.md
- [wayfinder:ops-residual/R2] R2 — Ledger KV ordering + orphan-key recovery — open — blocked_by=[] — ops-residual/tickets/R2-ledger-improve-indexing.md
- [wayfinder:ops-residual/R3] R3 — Regression tests: lock + dedup — open — blocked_by=[] — ops-residual/tickets/R3-regression-tests.md
- [wayfinder:ops-residual/R5] R5 — Stop/Cancel server endpoint — open — blocked_by=[] — ops-residual/tickets/R5-server-cancel.md
- [wayfinder:ops-residual/R6] R6 — Pagination across large job index — open — blocked_by=[] — ops-residual/tickets/R6-pagination-trim.md
- [wayfinder:ops-residual/R7] R7 — Refresh parity on manual reload — open — blocked_by=[] — ops-residual/tickets/R7-refresh-parity.md
- [wayfinder:ops-residual/R8] R8 — Health route: harvest-health sub-object — open — blocked_by=[] — ops-residual/tickets/R8-harvest-health-route.md
- [wayfinder:ops-residual/R9] R9 — Discovery doctor JSON contract — open — blocked_by=[] — ops-residual/tickets/R9-discovery-doctor-json.md
- [wayfinder:ops-residual/R10] R10 — dedupe-index.json write authority — open — blocked_by=[] — ops-residual/tickets/R10-dedupe-write-authority.md
- [wayfinder:ops-residual/R11] R11 — Drop speculative source comments — open — blocked_by=[] — ops-residual/tickets/R11-drop-stale-comments.md
- [wayfinder:ops-residual/R12] R12 — Exclude .autoforge/ from commits — open — blocked_by=[] — ops-residual/tickets/R12-autoforge-storage-policy.md
- [wayfinder:ops-residual/R14] R14 — Tier-1 archive housekeeping — open — blocked_by=[] — ops-residual/tickets/R14-tier1-housekeeping.md
- [wayfinder:ops-residual/R15] R15 — README+CONTRIBUTING deploy refresh — open — blocked_by=[] — ops-residual/tickets/R15-docs-production-deploy-refresh.md
- [wayfinder:ops-residual/R16] R16 — Brave quota: fallback + monitoring — open — blocked_by=[] — ops-residual/tickets/R16-brave-quota-degradation.md
- [wayfinder:ops-residual/R17] R17 — Evidence reconciliation + HEAD anchoring — open — blocked_by=[] — ops-residual/tickets/R17-evidence-reconciliation-automation.md
- [wayfinder:ops-residual/R18] R18 — Bento merge verification — open — blocked_by=[] — ops-residual/tickets/R18-bento-verification.md
- [wayfinder:ops-residual/R19] R19 — Wayfinder plumbing traceability — open — blocked_by=[] — ops-residual/tickets/R19-wayfinder-plumbing-traceability.md
- [wayfinder:v2-agentic-platform/F2] F2 — Blob-storage escape hatch — open — blocked_by=[] — v2-agentic-platform/tickets/F2-blob-storage-escape-hatch.md

Frontier total: 19

## Non-frontier tickets (one-word reason)

- local:.scratch/learning-loop/issues/01–06 — resolved
- local:.scratch/readiness-framework/issues/01–06 — resolved; 07 — hitl
- wayfinder:ai-harvest-stream/H1–H13 — closed
- wayfinder:harvest-verification/HV1–HV9 — closed
- wayfinder:mvp/G1–G4,R1–R5,T1 — closed
- wayfinder:rsa-corpus/C1–C10 — closed
- wayfinder:v2-agentic-platform/D1,E2,F1,F4,M1,N1,R6 — closed; A1,A2,D2,D3,E1,E3,E4,E5,M2,M3,N2,N3,R7,V1,V2,V3 — resolved; F3 — hitl
- wayfinder:v3-architecture-deepening/F2,F3 — closed; F1,F4 — hitl
- wayfinder:v4-harvest-deepening/A1–A5 — closed
- wayfinder:v5-edge-cleanup-piarc/T1–T5 — closed
- wayfinder:v6-horizon/H1,H2,H4,H5,H6,H7 — closed; H3 — hitl
- wayfinder:ops-residual/R4,R13 — hitl
- wayfinder:ops-seamless-verify/T1 — resolved; T2 — blocked-by-T1
- GH:#41 — hitl (wayfinder:map index, no state label)
- GH:#42 — hitl (wayfinder:research, no state label, no output yet)

---

# Tracker Index — ticket #53 discovery (2026-10-21)

**Full index for ticket #53** (Supabase Postgres tenant store with RLS) —
[`tracker-index-t53.md`](tracker-index-t53.md). Every open ticket found, with source prefix:

- `gh #53` — Supabase Postgres in ca-central-1 as the tenant store, with row-level security (G-2, G-8) — **THIS TICKET**; open, unassigned, `blocked-by:` empty; **blocks #54 and #56**; parent #41
- `gh #41` — Map: AuditorAI to enterprise production — Canada first — open (`wayfinder:map`); **parent of #53**; decided #50 + #51
- `gh #54` — Named-user accounts and seats with Supabase Auth; an actor id on every issuance (G-1, G-5) — open; **blocked by #53**; blocks #55
- `gh #55` — Append-only, hash-chained audit trail with a verify routine and a per-firm export (G-3) — open; **blocked by #54**
- `gh #56` — Daily backups with point-in-time recovery, RPO 24 h, RTO 4 h, and a rehearsed restore (G-4) — open; **blocked by #53**
- `gh #47` — Inventoried, pinned and scanned runtime dependencies (G-7) — open; not blocked; relevant (new runtime dependency lands in this inventory)
- `gh #48` — Health and readiness routes, structured logs and failure alerting (G-12) — open; not blocked; relevant ("database not configured" signal)
- `gh #46` — Schema validation at every trust boundary (G-6) — open; not blocked; relevant (new trust boundary)
- `gh #44` — Capability claims bounded at issuance, not only in the report text (G-10) — open; not relevant
- `gh #49` — Per-stage latency with a recorded p50 and p95 (G-14) — open; not relevant
- `gh #40` — Harvest Track A: fetch the public Canadian RSA documents named in the harvesting plan — open; not relevant
- `gh #50` — Which identity and tenant model (G-1, G-2, G-5) — **CLOSED**; decided: Supabase Auth + Postgres ca-central-1, RLS as the tenant wall
- `gh #51` — Where does tenant data live: hosting, residency, backups (G-8, G-4, G-3) — **CLOSED**; decided: Supabase Postgres ca-central-1, PITR RPO 24 h / RTO 4 h
- `wayfinder:v3-architecture-deepening` F4-postgres-adapter — Postgres adapter as third `DataStore` — **frontier** (open, unassigned, `blocked_by: []`), HITL-gated on `PHASE_3_KEY_SCHEME_AND_POSTGRES_AUTHORITY`; same subject as #53
- `wayfinder:v2-agentic-platform` F2-blob-storage-escape-hatch — Blob-storage escape hatch for image attachments — **frontier**; constrains where attachment payloads live
- `wayfinder:ops-residual` R1-cross-instance-harvest-lock — Cross-instance harvest lock via Vercel KV atomic SET NX — **frontier**; pins a KV dependency the migration touches
- `wayfinder:v3-architecture-deepening` F1-candidate-findings-review-ux — Real candidate-findings review UX — **frontier**, HITL-gated; not relevant
- `wayfinder:v2-agentic-platform` F3-vault-sync-conflict-ux — Vault sync-conflict UX — **frontier**, HITL-gated; not relevant
- `wayfinder:mvp` G1-stack-hosting — Stack + free hosting choice — **closed**; decided Next.js/Vercel + hosted-KV behind a seam (ADR-0001), which #53 amends
- `wayfinder:mvp` G3-mvp-scope — MVP scope boundary — **closed**; "anonymous workspace keys — auto-provisioned key per workspace" is the model #53 replaces
- `wayfinder:v2-agentic-platform` D1-admin-auth-seam-for-developer-surfaces — Admin auth seam — **closed**; the fail-closed identity pattern #53's tenant auth mirrors
- `wayfinder:v2-agentic-platform` M1-image-storage-constraints-plus-decision — Image storage constraints — **closed**; KV payload caps #53 inherits or replaces
- `wayfinder:v3-architecture-deepening` F3-rsc-initial-page-data — RSC/server-render initial page data from Repository — **closed**; already depends on the `Repository` surface #53 reimplements
