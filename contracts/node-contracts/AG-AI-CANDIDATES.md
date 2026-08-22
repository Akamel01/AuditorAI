# Node Contract: AI Candidate Generation (bounded)

```yaml
node_id: AG-AI-CANDIDATES
role: Optionally generate AI-proposed candidate findings for human adjudication
purpose: >-
  When the AiAdapter seam is enabled, produce CandidateFinding[] grounded in the audit context;
  candidates join adjudication labelled, never pre-approved.
determinism_class: ai-bounded
producer: safety-reasoning-agent
context:
  domain_context: >-
    AI proposes bounded candidate artifacts only; adjudication disposes. Nothing AI-generated
    reaches a final determination (workflow doctrine).
  jurisdiction_context: Candidates must cite jurisdiction-appropriate evidence_ids or be flagged assumption-only.
  project_context: Context = stage_context + manifest + questions (+ attachments once vision lands, M3).
  upstream_artifacts:
    - context.snapshot
    - manifest.table
    - questions.set
  relevant_decisions:
    - ADR-0001 platform baseline (seams) — adapter OFF by default
  evidence_required: Evidence summaries reference registry ids; invented clause numbers are forbidden.
contract:
  inputs: stage_context, input_manifest, audit_questions (+ adapter config)
  outputs: >-
    SharedState.candidate_findings + artifact payload_kind=candidates.ai (validation_status=draft
    always)
  invariants:
    - Adapter OFF (default) means empty slice and zero provider calls.
    - >-
      Emitted type is exactly CandidateFinding (the bounded pick of Finding fields in
      src/lib/ai.ts).
    - Every candidate carries producer=safety-reasoning-agent and enters adjudication as draft.
  allowed_mutations:
    - candidate_findings
  forbidden_actions:
    - Writing directly to rule_results or final findings.
    - Producing severity/likelihood numbers framed as assessments.
    - Retrying indefinitely on provider failure.
  acceptance_criteria:
    - OffAiAdapter path returns an empty array with no network I/O (unit-tested).
    - Malformed model output is rejected at the boundary, yielding empty + logged reason.
tools:
  allowed:
    - read policy pack
    - read project record
  preferred:
    - pure functions over SharedState slices
state:
  reads:
    - stage_context
    - input_manifest
    - audit_questions
  writes:
    - candidate_findings
verification:
  required_checks:
    - 'Fake-fetch unit tests for happy/malformed/timeout paths arrive with issue #12 (A1).'
failure:
  retry_policy: At most one repair attempt on invalid JSON, then degrade to empty.
  escalation_policy: Repeated provider failure trips a circuit-breaker and reports a degraded status artifact.
```
