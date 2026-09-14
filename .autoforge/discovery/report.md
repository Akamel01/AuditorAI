# Discovery Report — loop 3 (2026-09-14)

Objective: proceed with all open/remaining tickets + open new tickets for improved codebase architecture.
Method: read-only refresh of all wayfinder ticket front-matter + prior tracker-index + GitHub state.

## Open-ticket states (all 8 verified by file read 2026-09-14)
- v2 F1 OPEN (F1-quote-bearing-baselines.md:6), blocks F1→F4 (:9), ## Progress gate-OPEN + Tier-1 blocked on judge 401.
- v2 F2 OPEN (:6), blocked_by [] (:8), trigger absent (:22).
- v2 F3 OPEN (:6), blocked_by [] (:8), trigger absent (:22); vault-sync --check exit 0 (prior run).
- v2 F4 OPEN (:6), blocked_by [F1] (:8), needs assist-schema + fresh Tier-1 (:22).
- v3 F1 OPEN hitl (:6), blocked_by [] (:8), needs FLAG_2 (:22).
- v3 F2 OPEN hitl (:6), blocked_by [] (:8), needs FLAG_1 (:22).
- v3 F3 OPEN (:6), blocked_by [] (:8), needs measurable target (:22).
- v3 F4 OPEN hitl (:6), blocked_by [] (:8), needs PHASE_3 authority (:22).
- GitHub: 0 open. Closed maps: ai-harvest-stream, harvest-verification, mvp, ops-residual, rsa-corpus.

## Key finding for planning
Zero open tickets are agent-executable: 4 need owner product decisions (v2 F1-judge-key, v3 F1/F2 flags, v2 F4 assist-schema), 4 need real-world triggers (F2 blob limits, F3 vault conflict, v3 F3 target, v3 F4 phase-3). The executable work this loop = NEW architecture-improvement tickets from the improve-codebase-architecture skill (architect phase), scoped to code hot spots, producing proposal tickets — implementation only where acceptance is self-verifiable without owner gates.

## Risks/constraints for downstream phases
- Worktree dirty with foreign parallel-session edits (incl. T2 resolved flip) — workers must use explicit `touches` allow-lists, never git mutations, never touch state/vault-notes.json or foreign files.
- Judge spend needs valid OPENCODE_API_KEY (current Keychain value 401s) — no judged eval work plannable until owner provides key.
- wayfinder-tickets.test.ts:143 expects T2 blocked; worktree T2 resolved — owning session's commit will need the test update; do not touch tests/ for this.
