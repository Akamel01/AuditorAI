GH#42 | Akamel01/AuditorAI#42 | Research: enterprise-readiness gap audit of AuditorAI today | out-of-scope | non-frontier
GH#44 | Akamel01/AuditorAI#44 | Capability claims bounded at issuance, not only in the report text (G-10) | out-of-scope | non-frontier
GH#45 | Akamel01/AuditorAI#45 | Evidence binding enforced at issuance, not only in flight (G-11) | out-of-scope | non-frontier
GH#46 | Akamel01/AuditorAI#46 | Schema validation at every trust boundary (G-6) | out-of-scope | non-frontier
GH#47 | Akamel01/AuditorAI#47 | Inventoried, pinned and scanned runtime dependencies (G-7) | out-of-scope | non-frontier
GH#48 | Akamel01/AuditorAI#48 | Health and readiness routes, structured logs and failure alerting (G-12) | out-of-scope | non-frontier
GH#49 | Akamel01/AuditorAI#49 | Per-stage latency with a recorded p50 and p95 (G-14) | out-of-scope | non-frontier
GH#50 | Akamel01/AuditorAI#50 | Which identity and tenant model: who issues user identity, and how is a tenant established? (G-1, G-2, G-5) | out-of-scope | non-frontier
GH#51 | Akamel01/AuditorAI#51 | Where does tenant data live: hosting, Canadian data residency and the backup model? (G-8, G-4, G-3) | out-of-scope | non-frontier
GH#53 | Akamel01/AuditorAI#53 | Supabase Postgres in ca-central-1 as the tenant store, with row-level security (G-2, G-8) | out-of-scope | non-frontier
GH#54 | Akamel01/AuditorAI#54 | Named-user accounts and seats with Supabase Auth; an actor id on every issuance (G-1, G-5) | in-scope | frontier
GH#55 | Akamel01/AuditorAI#55 | Append-only, hash-chained audit trail with a verify routine and a per-firm export (G-3) | out-of-scope | non-frontier
GH#56 | Akamel01/AuditorAI#56 | Daily backups with point-in-time recovery, RPO 24 h, RTO 4 h, and a rehearsed restore (G-4) | out-of-scope | non-frontier
GH#60 | Akamel01/AuditorAI#60 | Harvest round 2: free, wide search for public Canadian RSAs with agent-reach | out-of-scope | non-frontier
GH#62 | Akamel01/AuditorAI#62 | Stage classifier: map real-world RSA titles to ODD stages, so T3 documents reach their cells | out-of-scope | non-frontier
local:.scratch/readiness-framework/07 | .scratch/readiness-framework/issues/07-waiting-owner-acquisitions.md | 07 — WAITING: owner-gated acquisitions (PIARC account, HSM, TAC CRSAG, ADG-18/RTA) | out-of-scope | non-frontier
wayfinder:ops-residual/R1-cross-instance-harvest-lock | workflow/wayfinder/maps/ops-residual/tickets/R1-cross-instance-harvest-lock.md | Cross-instance harvest lock via Vercel KV atomic SET NX | out-of-scope | non-frontier
wayfinder:ops-residual/R10-dedupe-write-authority | workflow/wayfinder/maps/ops-residual/tickets/R10-dedupe-write-authority.md | `state/dedupe-index.json` write authority (KV-truth vs file fallback) | out-of-scope | non-frontier
wayfinder:ops-residual/R11-drop-stale-comments | workflow/wayfinder/maps/ops-residual/tickets/R11-drop-stale-comments.md | Hardening — drop speculative source comments | out-of-scope | non-frontier
wayfinder:ops-residual/R12-autoforge-storage-policy | workflow/wayfinder/maps/ops-residual/tickets/R12-autoforge-storage-policy.md | AutoForge staging — exclude `.autoforge/` from committed tree | out-of-scope | non-frontier
wayfinder:ops-residual/R13-eval-gate-freshness | workflow/wayfinder/maps/ops-residual/tickets/R13-eval-gate-freshness.md | Eval gate §2 freshness automation | out-of-scope | non-frontier
wayfinder:ops-residual/R14-tier1-housekeeping | workflow/wayfinder/maps/ops-residual/tickets/R14-tier1-housekeeping.md | Tier-1 archive script housekeeping | out-of-scope | non-frontier
wayfinder:ops-residual/R15-docs-production-deploy-refresh | workflow/wayfinder/maps/ops-residual/tickets/R15-docs-production-deploy-refresh.md | README + CONTRIBUTING refresh Production deploy section | out-of-scope | non-frontier
wayfinder:ops-residual/R16-brave-quota-degradation | workflow/wayfinder/maps/ops-residual/tickets/R16-brave-quota-degradation.md | Brave Search quota degraded — graceful fallback + monitoring | out-of-scope | non-frontier
wayfinder:ops-residual/R17-evidence-reconciliation-automation | workflow/wayfinder/maps/ops-residual/tickets/R17-evidence-reconciliation-automation.md | Evidence bundle reconciliation + HEAD anchoring automation | out-of-scope | non-frontier
wayfinder:ops-residual/R18-bento-verification | workflow/wayfinder/maps/ops-residual/tickets/R18-bento-verification.md | Bento components merge verification — safety, conflicts, functional purpose | out-of-scope | non-frontier
wayfinder:ops-residual/R19-wayfinder-plumbing-traceability | workflow/wayfinder/maps/ops-residual/tickets/R19-wayfinder-plumbing-traceability.md | Wayfinder plumbing traceability — ticket index + Mission Control board | out-of-scope | non-frontier
wayfinder:ops-residual/R2-ledger-improve-indexing | workflow/wayfinder/maps/ops-residual/tickets/R2-ledger-improve-indexing.md | Ledger KV ordering + orphan-key recovery | out-of-scope | non-frontier
wayfinder:ops-residual/R3-regression-tests | workflow/wayfinder/maps/ops-residual/tickets/R3-regression-tests.md | Regression tests for in-process lock + callback dedup | out-of-scope | non-frontier
wayfinder:ops-residual/R4-production-harvest-proof | workflow/wayfinder/maps/ops-residual/tickets/R4-production-harvest-proof.md | Production harvest proof bundle | out-of-scope | non-frontier
wayfinder:ops-residual/R5-server-cancel | workflow/wayfinder/maps/ops-residual/tickets/R5-server-cancel.md | Stop/Cancel server endpoint | out-of-scope | non-frontier
wayfinder:ops-residual/R6-pagination-trim | workflow/wayfinder/maps/ops-residual/tickets/R6-pagination-trim.md | Pagination across large job index | out-of-scope | non-frontier
wayfinder:ops-residual/R7-refresh-parity | workflow/wayfinder/maps/ops-residual/tickets/R7-refresh-parity.md | Refresh parity for parent reload on manual click | out-of-scope | non-frontier
wayfinder:ops-residual/R8-harvest-health-route | workflow/wayfinder/maps/ops-residual/tickets/R8-harvest-health-route.md | Health route exposes harvest-health sub-object | out-of-scope | non-frontier
wayfinder:ops-residual/R9-discovery-doctor-json | workflow/wayfinder/maps/ops-residual/tickets/R9-discovery-doctor-json.md | Discovery doctor JSON contract for CI | out-of-scope | non-frontier
wayfinder:v2-agentic-platform/F2-blob-storage-escape-hatch | workflow/wayfinder/maps/v2-agentic-platform/tickets/F2-blob-storage-escape-hatch.md | Blob-storage escape hatch for image attachments | out-of-scope | non-frontier
wayfinder:v2-agentic-platform/F3-vault-sync-conflict-ux | workflow/wayfinder/maps/v2-agentic-platform/tickets/F3-vault-sync-conflict-ux.md | Vault sync-conflict UX | out-of-scope | non-frontier
wayfinder:v3-architecture-deepening/F1-candidate-findings-review-ux | workflow/wayfinder/maps/v3-architecture-deepening/tickets/F1-candidate-findings-review-ux.md | Real candidate-findings review UX — roadmap commitment | out-of-scope | non-frontier
wayfinder:v3-architecture-deepening/F4-postgres-adapter | workflow/wayfinder/maps/v3-architecture-deepening/tickets/F4-postgres-adapter.md | Postgres adapter as third DataStore | out-of-scope | non-frontier
wayfinder:v6-horizon/H3-corpus-growth-100 | workflow/wayfinder/maps/v6-horizon/tickets/H3-corpus-growth-100.md | corpus-growth-100 | out-of-scope | non-frontier
