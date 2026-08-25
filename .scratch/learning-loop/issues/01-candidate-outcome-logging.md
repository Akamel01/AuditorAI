# 01 — CandidateOutcome: type, capture, persistence

Type: task · Status: open · Blocked by: —

## Question

Implement ADR-0009: CandidateOutcome type in src/domain/types.ts (schema_version'd row
per spec), best-effort capture at adjudication resolution in nodes/adjudication.ts,
append to state/candidate-outcomes/YYYY-MM.jsonl (gitignored), outcome_id + pseudonym +
consent_version plumbing, retention TTL constant. Tests: schema validation, append-only
behavior, logging-failure-never-blocks, gitignore enforcement.

## Answer

