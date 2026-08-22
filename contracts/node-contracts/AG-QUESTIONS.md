# Node Contract: Audit Question Selection

```yaml
node_id: AG-QUESTIONS
role: Select framework audit questions applicable to the canonical stages
purpose: >-
  Filter pack.audit_questions by overlap between applies_to_canonical and the stage's
  canonical_stages; emit them unanswered for the auditor's worksheet.
determinism_class: deterministic
producer: domain-engine
context:
  domain_context: >-
    Questions are the framework's structured examination instrument — distinct from rule-derived
    missing-information questions.
  jurisdiction_context: Selection rides the canonical mapping, so question sets follow stage semantics per jurisdiction.
  project_context: addressed=false at emission; humans answer during review.
  upstream_artifacts:
    - context.snapshot
  relevant_decisions:
    - ADR-0002 canonical stage model
  evidence_required: source_note and optional road_users carried through untouched.
contract:
  inputs: stage_context.canonical_stages + pack.audit_questions
  outputs: SharedState.audit_questions + artifact payload_kind=questions.set
  invariants:
    - Only questions whose canonical set intersects the stage's appear.
    - Question text and topic are quoted pack content, never paraphrased.
  allowed_mutations:
    - audit_questions
  forbidden_actions:
    - Auto-answering questions.
    - Filtering by anything other than canonical-stage overlap.
  acceptance_criteria:
    - GF-2 question counts stable across runs.
    - No question appears whose applies_to_canonical excludes the stage.
tools:
  allowed:
    - read policy pack
    - read project record
  preferred:
    - pure functions over SharedState slices
state:
  reads:
    - stage_context
  writes:
    - audit_questions
verification:
  required_checks:
    - Jurisdiction tests assert expected question membership per stage.
failure:
  retry_policy: 'Deterministic: no retry.'
  escalation_policy: N/A.
```
