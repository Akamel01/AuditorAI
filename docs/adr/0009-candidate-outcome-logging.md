# ADR-0009: CandidateOutcome logging — append-only local JSONL, explicit edit whitelist, pseudonymous auditors

- Status: Accepted
- Date: 2026-08-25
- Deciders: owner (live grilling, learning-architecture wave), ORCH
- Context artifacts: `src/domain/pipeline/nodes/adjudication.ts`, ADR-0006,
  `state/sample-corpus.json` (ADR-0007), learning-architecture handoff §10

## Context

The flywheel's raw material is what auditors do with AI candidates: accept, accept with
edits, reject. None of it was captured. Logging design had to respect the liability
model (auditor work products are sensitive), stay deterministic-friendly, and feed
Phase-2 curation without becoming a training-data swamp.

## Decision

1. **Storage:** append-only JSONL under `state/candidate-outcomes/YYYY-MM.jsonl`,
   gitignored. Raw auditor work products never enter git history. Only sanitized
   aggregates (rates, counts) and owner-approved curated exemplars may be committed.
2. **Row schema (versioned via `schema_version`):**
   `{outcome_id, schema_version, occurred_at, project_id, audit_id, odd_stamp,
   jurisdiction, native_stage_id, canonical_stage, adapter_id, prompt_hash,
   fewshot_ids[], candidate (full snapshot), action: accept|accept_with_edits|reject,
   edited_fields?, note?, auditor_pseudonym, consent_version}`.
3. **Edits are an explicit whitelist:** `{statement_text?, category?,
   recommendation?, evidence_ids?}` — diffable, schema-versioned, no derived-field
   noise. Other changes require a schema_version bump first.
4. **Identity:** pseudonymous stable auditor id (e.g., `auditor-a1`); real identity
   mapping lives outside the log. Every row records `consent_version`;
   retention TTL default 2 years, purge on auditor request.
5. **Capture point:** adjudication resolution (the moment the human gate decides) —
   one row per candidate decision, written best-effort; logging failure never blocks
   or corrupts the audit result.

## Consequences

- PromotionRate / rejection-reason analysis become queryable the day logging lands.
- Curation (ADR-0011 flow) reads only rows with `action=accept_with_edits|accept`.
- The log is the sole admissable evidence source for any future fine-tune gate check
  (ADR-0013); synthetic or back-filled outcomes are inadmissible.
