# Investigation: Remaining Frontier (R5, R6, R7, R9, R10, R11, R15, R19)

- Objective: surface hidden issues, missed edge cases, or architecture degradation not fully captured by the self-approval proofs in M-R5..M-R19. Provide evidence-backed hypotheses, quick falsifiers, and a GO/REPLAN recommendation with loop-back phases.

Based on the repo evidence and the provided inputs, eight frontier modules are currently deemed self-approving (GO). See the validation report for the per-module verdicts and evidence map. See: .autoforge/validation/report-remaining.md (verbatim). Evidence citations below reference file:line sources.

Evidence snapshot (high level):
- Final verdict for R5, R6, R7, R9, R10, R11, R15, R19 is GO (self-approve TRUE) per the plan. See the final verdict block in the report: Overall: GO for R5, R6, R7, R9, R10, R11, R15, R19. (report-remaining.md:42-44).
- The eight modules touch a mix of discovery/harvest plumbing, wayfinder integration, and repo docs. Evidence refs show touched artifacts and plan mappings (report-remaining.md:15-40).
- The codebase itself encodes several design choices related to KV vs file seedStore (MemoryStore fallback), a process-local harvest lock, and a paginated, cursor-based list API. See: src/discovery/jobs.ts (KV vs FS fallback) and src/discovery/harvest.ts (HARVEST_LOCK and per-node sequencing).

- Key code anchors (for quick falsification):
  - KV vs MemoryStore / DataStore seam and dual storage path
  - Cursor-based pagination with cap and cursor behavior
  - Process-local harvest lock and cross-process risks
  - Dedupe persistence with FSO fallback and KV mirroring
  - Discovery doctor JSON shape checks and secret resolution
  - Wayfinder tickets loading and parity with index build
  - Secrets handling and provider health UI parity
  - Documentation and deployment gating around discovery harvest

Ranked hypotheses (investigate-first style):
1) Potential cross-process or multi-instance split-brain in harvest results / ledger parity
- Evidence: harvest.ts documents a process-local HARVEST_LOCK with no cross-process locking; KV path offers a separate mirror but there is no distributed lock. See HARVEST_LOCK at lines 99-105 and its usage at 149-156, 253-255. This could yield race conditions if two workers harvest concurrently in a multi-process or serverless scenario. (src/discovery/harvest.ts:99-105, 149-156, 253-255)
- Quick falsifier: run two concurrent harvests in a test harness with a mocked KV store and verify that the resulting ledger/dedupe state remains consistent and no duplicate entries are produced.

2) KV vs MemoryStore split-brain risk for dedupe-index and discovery-logs state
- Evidence: load/save of dedupe index uses KV first (loadDedupeIndexAsync, saveDedupeIndex) with a file seed fallback; writeQueue serialized writes protect against concurrent file writes, but there is no cross-process synchronization. See dedupe-persist.ts: loadFrom KV sync path 21-28, 51-60, 62-70, 79-87, 89-97, 104-107. The code documents EROFS handling for KV-truth fallback in saveDedupeIndex with warnings. (src/discovery/dedupe-persist.ts:21-28, 51-60, 62-70, 79-87, 104-107)
- Quick falsifier: simulate concurrent dedupe persistence across two workers to confirm deterministic results and no data loss when FS isn’t writable.

3) Cursor handling edge cases in listJobs could still surface stale cursors in rare race windows
- Evidence: listJobs caps at 20; if cursor found, it returns after idx+1..idx+cap, otherwise latest page; if page empty, it returns latest; if cursor not found, returns latest page. See 230-241, 243-251, 252-273. (src/discovery/jobs.ts)
- Quick falsifier: create a sequence of updates such that the index shrinks (prunes old jobs) while a consumer holds a stale cursor; verify nextCursor/page content remains stable.

4) ROFS and file-system write guards may hide failures in heavy-test/dev scenarios
- Evidence: dedupe-persist.ts uses writeFileSync with a broad catch; on EROFS/ENOENT it logs a warning but continues. This is by design to tolerate read-only environments; ensure there is no data loss in actual production upgrades. (src/discovery/dedupe-persist.ts:63-77)
- Quick falsifier: simulate a read-only FS and verify the KV mirror path still yields a consistent end state, and the file seed is skipped as intended.

5) Discovery doctor JSON shape checks and secret resolution logic may miss edge cases in provider shapes or deployments
- Evidence: scripts/discovery-doctor.ts contains shape() heuristics for certain keys and a JSON mode; it also prints missing secrets when env vars are unset. (scripts/discovery-doctor.ts:64-69, 7-14, 18-19)
- Quick falsifier: introduce corrupted secrets or unexpected shapes and verify doctor exits non-zero or prints proper diagnostics.

6) Wayfinder ticket indexing/parity logic could drift if map tickets change without index rebuild
- Evidence: loadTicketsFromTree reads tickets from maps and constructs a ticket index; indexWayfinderTickets relies on classifyTickets and buildTicketIndex. See 144-167, 169-189. (src/wayfinder/tickets.ts)
- Quick falsifier: modify map tickets (e.g., remove a ticket key) and verify index rebuild catches the duplicate keys and parity changes.

7) Provider-health UI expectations vs real health data can drift if future engines are added or environment changes
- Evidence: provider-health.tsx defines EXPECTED provider list and badges; future providers or secret misconfig can cause mismatch. See lines 51-56 and 63-69. (src/app/dev/mission-control/_components/provider-health.tsx)
- Quick falsifier: add a hypothetical provider and verify the UI updates without breaking existing expectations.

8) Docs, secrets, and vault determinism are historically tricky in multi-branch workflows
- Evidence: README and docs reference vault determinism guidance and deployment steps; changes to docs/deployment.md and AGENTS vault sync are external to eight modules but impact repeatability. See README.md 49-59, docs/deployment.md 7-9. (README.md, docs/deployment.md)

Artifacts touched by this investigation (evidence anchors you can follow):
- Validation: .autoforge/validation/report-remaining.md (verbatim; contains module verdicts and evidence mapping)
- Execution: .autoforge/execution/M-R*.md (module briefs; see R5..R19 references in the report)
- Core storage paths and KV vs FS: src/discovery/jobs.ts, src/discovery/harvest.ts, src/discovery/dedupe-persist.ts
- Discovery doctor: scripts/discovery-doctor.ts
- Wayfinder: src/wayfinder/tickets.ts, README.md for map/ticket context
- Docs/deploy: docs/deployment.md
- Provider health UI: src/app/dev/mission-control/_components/provider-health.tsx

- Also note: an explicit plan-propagation artifact exists at .autoforge/validation/ops-loop-remaining.json (referenced in report-remaining.md). (report-remaining.md:48-49)

Recommendation: GO for all eight frontier modules remains valid, but to strengthen operational rigor you should consider the following loop-back phases (REPLAN):

Phase 1 — Cross-process safety and guard rails (1–2 sprints)
- Implement a distributed harvest lock (KV-based) to prevent cross-instance races, replacing the purely process-local HARVEST_LOCK. Add a guard in harvest() that uses a KV key to acquire a lease or atomic flag; ensure lock release in finally.
- Extend dedupe-persist to have a true transactional mirror between file seed and KV store, with a deterministic reconciliation path if one fails.

Phase 2 — Cursor robustness and test coverage (1 sprint)
- Add tests for listJobs cursor edge cases (stale cursor, missing cursor, empty pages) and test the 20-entry cap boundary.
- Add tests around dedupe persistence under read-only fs conditions and KV fallback.

Phase 3 — Shape & contract hardening (1 sprint)
- Extend scripts/discovery-doctor.ts with explicit JSON schema checks and stronger secret-shape tests; ensure containerized environments don’t silently skip checks.
- Add a small contract test that validates the shape of discovery JSON output against a formal schema.

Phase 4 — Documentation sync and governance (ongoing)
- Ensure deployment/docs reflect current governance for discovery-harvest and vault-determinism, and that tests cover the updated policy. See docs/deployment.md and README.md touchpoints.

Conclusion: The eight frontier modules currently pass self-approval gates, but the observable attack surface includes cross-process races in harvest, KV vs file seeds drift, ROFS tolerance, and test gaps around discovery doctor shapes and Wayfinder parity. These risks are low-probability but nonzero in production scale; applying Phase 1 changes will keep the system resilient while staying within the lazy, minimal-diff philosophy of the project.

Artifact path: .autoforge/validation/investigation-remaining.md

Citations (selected):
- Final verdict (GO for eight): report-remaining.md:42-44
- Module touch map and evidence refs: report-remaining.md:15-40
- KV vs MemoryStore and MemoryStore fallback: src/discovery/jobs.ts (imports and comments) and data-store usage (src/discovery/jobs.ts:8-9, 3-5)
- Harvest lock and concurrency: src/discovery/harvest.ts:99-105, 149-156, 253-255
- Dedupe persistence with KV and EROFS guard: src/discovery/dedupe-persist.ts:18-20, 63-77, 104-107
- Discovery doctor JSON shape and secrets: scripts/discovery-doctor.ts:7-11, 64-69
- Wayfinder tickets parsing and indexing: src/wayfinder/tickets.ts:144-167, 191-193
- Provider-health status badges: src/app/dev/mission-control/_components/provider-health.tsx:51-56, 63-69
- Documentation anchors: README.md 58-59; docs/deployment.md 7-9
