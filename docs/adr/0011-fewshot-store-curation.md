# ADR-0011: Few-shot store & curation flow — compiled versioned store, auto-pool with owner gate

- Status: Accepted
- Date: 2026-08-25
- Deciders: owner (live grilling, learning-architecture wave), ORCH
- Context artifacts: `src/lib/fewshot.ts` (per ADR-0008), `state/sample-corpus.json`
  (ADR-0007), ADR-0009, learning-architecture handoff §10

## Context

Few-shot exemplars are the highest-leverage refinement surface, and uncontrolled growth
would silently blur which samples taught the engine (firewall risk, ADR-0007) or let
unreviewed auditor edits become doctrine.

## Decision

1. **Store shape:** `state/few-shot-store.json` — compiled, byte-deterministic,
   CI-checked like the evidence registry; source of truth is curated exemplar records
   (`vault/fewshot/*.md` → compile step) carrying {exemplar_id, sample_ids[],
   jurisdiction, native_stage_id, canonical_stage, candidate_snapshot, provenance
   outcome_id?, approved_by, approved_at}.
2. **Curation flow:** every `accept` / `accept_with_edits` CandidateOutcome enters an
   auto-pool automatically; promotion into the store happens only via owner-approved
   command (single reviewable diff); every promoted exemplar keeps its outcome lineage.
   Rejections never enter the pool but remain analyzable.
3. **Firewall inheritance:** an exemplar inherits the strictest role of its source
   samples; any exemplar traceable to a release-test-role sample is structurally
   impossible (rejected at compile).
4. **Versioning:** store version bumps on every promotion/removal; runs stamp the
   exemplar ids they used (ADR-0008), so quality changes are attributable to specific
   store versions.

## Consequences

- Few-shot growth is auditable commit-by-commit with zero manual file copying.
- The Ballinluig/int-007 identity conflict (readiness map fog) blocks any related
  exemplar until resolved — lineage fields make that check trivial.
