# Node Contract: Deterministic Rule Evaluation

```yaml
node_id: AG-RULES
role: Evaluate completeness / process / eligibility rules
purpose: >-
  Run all applicable pack rules against the manifest: completeness rules raise missing-information
  questions; process and eligibility rules raise compliance-question findings.
determinism_class: deterministic
producer: domain-engine
context:
  domain_context: >-
    Compliance findings are categorically distinct from safety concerns (CONTEXT.md); nothing here
    assesses physical safety.
  jurisdiction_context: Rule sets are per-jurisdiction pack data evaluated by one identical engine.
  project_context: Operates purely on input_manifest states.
  upstream_artifacts:
    - manifest.table
  relevant_decisions:
    - ADR-0003 finding model
  evidence_required: Rules carry evidence_ids merged (deduplicated) into questions and findings.
contract:
  inputs: input_manifest + pack.rules filtered by applies_to_native_stage_ids
  outputs: SharedState.rule_results + artifact payload_kind=rules.results
  invariants:
    - Same manifest yields same results, always.
    - >-
      output_discipline rules are NOT evaluated here (enforced at adjudication save via
      validateRecommendationWording).
    - >-
      Eligibility conditions surface as human-confirmable compliance questions, never silent
      pass/fail.
  allowed_mutations:
    - rule_results
  forbidden_actions:
    - Any network/AI access.
    - Assigning severity/likelihood/exposure scores (stay null per ADR-0003).
  acceptance_criteria:
    - GF-1 process-gap finding reproduces identically.
    - Completeness deduplicates evidence_ids with Set semantics.
tools:
  allowed:
    - read policy pack
    - read project record
  preferred:
    - pure functions over SharedState slices
state:
  reads:
    - input_manifest
  writes:
    - rule_results
verification:
  required_checks:
    - tests/domain/engine.test.ts rule coverage stays green after the N2 refactor.
failure:
  retry_policy: 'Deterministic: no retry.'
  escalation_policy: Malformed rule shapes are a pack-schema/CI concern.
```
