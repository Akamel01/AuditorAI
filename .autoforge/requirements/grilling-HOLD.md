# Grilling HOLD: R1–R4 + M1–M8 (persistence/frontier and agentic-architecture gates)

Scope: grief-test of the HOLD frontier defined in tracker-index.md and MAP references. All references cited inline. Read-only citations are included. The goal is to decide a minimal viable path per ponytail ladder, with self-approve where feasible and HITL/FOG gates where not.

Cited inputs and relevant context:
- R1–R4: Cross-instance persistence and harvest correctness gates from OPS-RESIDUAL map: Cross-instance harvest lock; Ledger KV ordering; Regression tests for in-process lock; Production harvest proof bundle. See tracker-index.md lines 3-20 and MAP.md lines 41-45. (R1: 3-4; R2: 8-11; R3: 13-15; R4: 18-20; MAP: 41-45)
- M1–M8: v2/v3 agentic platform and architecture deepening path; see tracker-index.md lines 103-140 for M1–M8 entries. (M1: 103-105; M2: 108-111; M3: 113-115; M4: 118-121; M5: 123-126; M6: 128-131; M7: 133-139; M8: 138-140)
- Additional context: vault DET, AGENTS.md determinism rules, and CHARTER constraints as described in the architecture reports and MAPs.

## HOLD: R1 — Cross-instance harvest lock via Vercel KV atomic SET NX
- What is asked (verbatim): Cross-instance harvest lock via Vercel KV atomic SET NX. Status BLOCKED (R1). See tracker-index.md: R1; MAP.md: 41-42.
- Hidden implications and risks:
  - Current harvest.ts uses a process-local HARVEST_LOCK; cross-instance coordination is not implemented, risking concurrent harvest runs across serverless instances.
  - KV-based lock requires careful TTL/lease semantics and a safe unlock path to avoid deadlocks in failure modes.
  - Determinism: any distributed lock must be reconciled with vault/state locking and determinism gates.
  - Reversibility: must be possible to revert to a purely local lock if needed.
- MV plan (minimal viable implementation):
  1) Introduce a distributed harvest lock key in Vercel KV or Upstash KV, e.g. harvest:lock, with a short TTL (e.g. 120s) and NX semantics to acquire only when absent.
  2) Extend Harvest flow in executeJob to attempt to acquire the distributed lock before D00-QUEUED; if acquired, proceed; on completion or error, release lock (DEL harvest:lock) or let TTL expire if path crashes.
  3) Maintain the existing process-local HARVEST_LOCK as a fast-path guard within a single process, so MV remains backward-compatible for single-instance runs.
  4) Add a small guard to ensure only the instance that holds the lock can write to the shared ledger/registry within the same job boundary.
  5) Document rollback path: revert KV lock usage; revert to process-local only by removing KV code and use only HARVEST_LOCK again.
  6) Tests: a minimal regression test harness simulating two concurrent harvest invocations to ensure only one proceeds when KV lock is present; ensure proper logging and job state in both branches.
- Self-approve: Yes (MV minimal wiring under KV lock is reversible; no code-paths removed; can revert by removal).
-Gate: HITL/FOG if KV gateway not available or if the KV integration creates cross-region timing hazards; otherwise MV is acceptable.
- Citations: tracker-index.md (R1) 3-4; MAP.md (R1) 41-42.

## HOLD: R2 — Ledger KV ordering + orphan-key recovery
- What is asked (verbatim): Ledger KV ordering + orphan-key recovery (R2). See tracker-index.md lines 8-11; MAP.md lines 42-43.
- Hidden implications and risks:
  - The current code relies on a linear, per-key ledger without explicit orphan-key recovery behavior described in code.
  - Orphan keys could arise during concurrent publishes or crash/restart; must be recoverable deterministically.
  - Any change must preserve existing determinism constraints and not destabilize the vault/state interaction.
- MV plan (minimal viable implementation):
  1) Ensure ledger tail sequencing is strictly increasing and persisted atomically alongside discovery state (e.g., a single tail counter persisted in the same commit path).
  2) Implement a compact orphan-key recovery step that scans the tail for any missing sequence entries and performs a no-op repair write to close gaps, deterministically idempotent.
  3) Introduce a small test that simulates interruption and restart to verify the tail remains monotonic and that orphan recovery is triggered and no-op-detected when gaps are absent.
  4) Keep the existing KV-backed store as the canonical source; ensure that KV writes and local file-backed stores (for tests) stay in sync.
- Self-approve: Yes (MV changes are local to the ledger-persist path; reversibility is straightforward by reverting ledger.ts changes).
-Gate: HITL/FOG if orphan-key recovery risks corrupting existing ledger state or if tail sequencing requires a broader schema migration; otherwise MV acceptable.
- Citations: tracker-index.md (R2) 8-11; MAP.md (R2) 42-43.

## HOLD: R3 — Regression tests for in-process lock + callback dedup
- What is asked (verbatim): Regression tests for in-process lock + callback dedup (R3). See tracker-index.md lines 13-15.
- Hidden implications and risks:
  - Tests exist to ensure the in-process lock and dedup logic behaves in both success and failure modes; tests should run under CI with V2 determinism gates.
  - Introducing tests requires stable APIs; risk of flaking if mocks are not deterministic.
- MV plan (minimal viable implementation):
  1) Add a small unit/integration test in src/discovery/ or a dedicated tests/harvest.test.ts that spawns concurrent harvest invocations and asserts the HARVEST_LOCK is respected and only one path updates the ledger and job state.
  2) Cover the callback dedup path by simulating repeated callbacks with identical payloads and ensuring only a single dedup artifact is persisted.
  3) Tie tests to existing test harness and ensure CI gate passes without affecting production behavior.
- Self-approve: Yes (tests are non-invasive and reversible; they only verify existing behavior and guard rails).
-Gate: HITL/FOG if tests rely on KV-backed locks or external dependencies; otherwise MV safe.
- Citations: tracker-index.md (R3) 13-15.

## HOLD: R4 — Production harvest proof bundle (Vercel KV + daemon)
- What is asked (verbatim): Production harvest proof bundle (Vercel KV + daemon) (R4). See tracker-index.md lines 18-20.
- Hidden implications and risks:
  - A proof bundle needs to be tamper-evident and reproducible; requires a canonical digest and a durable path to read-back in production.
  - Need to coordinate between KV store, audit daemon, and vault views to ensure consistent rollouts and reversions.
- MV plan (minimal viable implementation):
  1) Define a compact HarvestProofBundle structure (timestamp, jobId, ledger-digest, state-digest, and a small manifest). Persist this bundle to a deterministic path (e.g., state/production-harvest-proof.json) and backwrite to KV as a single atomically updated object if possible.
  2) Extend the daemon to emit this bundle on successful harvest completion, and ensure a reversible path by enabling a simple rollback mechanism that deletes the proof bundle and re-derives its digest from the persisted ledger.
  3) Add a CI/regression test that asserts the bundle exists after a run and can be read back with the correct payload.
- Self-approve: Yes (MV is small, tightly scoped, reversible; no changes to the core discovery path required; gate can be implemented as a toggle in the producer path).
-Gate: HITL/FOG if the environment does not provide a durable path for proofs; otherwise MV is acceptable.
- Citations: tracker-index.md (R4) 18-20; MAP.md (R4) 44-45.

## HOLD: M1–M8 — v2/v3 agentic platform & architecture deepening (M1–M8)
- What is asked (verbatim): M1–M8 tickets from tracker-index.md refer to evolution in the v2/v3 agentic platform and broader architecture deepening (M1..M8). See tracker-index.md lines 103-140 for M1–M8; MAPs/v2-agentic-platform/MAP.md and MAPs/v3-architecture-deepening contain related narratives.
- Hidden implications and risks:
  - These tickets imply significant architectural shifts and agentic workflow capabilities; attempting MV without a full domain model and ADRs risks scope creep and regressions.
  - Current gates indicate these are BLOCKED and require explicit owner decisions; attempting to pre-commit could violate the owner’s loop-based execution strategy.
- Staging decision: HITL/FOG gate (not MV) – the recommended posture is to keep these in scope for owner-driven ADRs and plan-per-phase, with a formal ADR and a commit gate. Only after domain modeling clarifies interfaces and dependencies should MV be attempted.
- Citations: tracker-index.md M1: 103-105; M2: 108-111; M3: 113-115; M4: 118-121; M5: 123-126; M6: 128-131; M7: 133-139; M8: 138-140.

## 7 0ther notes
- The HOLDs are currently BLOCKED by prior validation gating (GO plan). This grilling document captures MV options and gates; the next step is to align with owner’s ADRs/logs and finalize the gating strategy for each item.
- If ownership approves any MV paths, we will record explicit self-approval lines in this file and, if needed, a per-HOLD ADR document for change traceability.

## Output artifacts
- This file documents the grilling decisions and provides a concrete path toward MV where possible, with clear escalation gates.
- Path to this artifact: .autoforge/requirements/grilling-HOLD.md

End of HOLD grilling document.
