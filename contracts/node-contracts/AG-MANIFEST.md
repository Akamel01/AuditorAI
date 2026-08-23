# Node Contract: Input Manifest

```yaml
node_id: AG-MANIFEST
role: Input normalization to §14/§27 states
purpose: >-
  Filter the pack's input requirements to those applying to the selected native stage and resolve
  each stored input value into a manifest state.
determinism_class: deterministic
producer: domain-engine
context:
  domain_context: >-
    Requirement levels (required/recommended/optional) drive downstream completeness rules;
    resolution logic lives in engine resolveState.
  jurisdiction_context: Requirement levels come from the jurisdiction pack — never harmonized across jurisdictions.
  project_context: Reads project_input.input_values keyed by input_id.
  upstream_artifacts:
    - context.snapshot
  upstream_nodes:
    - AG-STAGE-SELECT
  downstream_nodes:
    - AG-RULES
  relevant_decisions:
    - ADR-0002 canonical stage model
  evidence_required: Each manifest entry carries evidence_ids justifying the requirement itself.
contract:
  inputs: stage_context + pack.inputs + project_input.input_values
  outputs: SharedState.input_manifest + artifact payload_kind=manifest.table
  invariants:
    - >-
      'provided' with a blank value downgrades to the level-appropriate missing state
      (required_missing / recommended_missing / optional_missing / unknown).
    - conditional_on is preserved for later evaluation.
    - Entries exist only for inputs whose stage_ids include the selected stage.
  allowed_mutations:
    - input_manifest
  forbidden_actions:
    - Inventing inputs not present in the pack.
    - Marking anything provided without recorded value/evidence.
  acceptance_criteria:
    - GF fixtures reproduce manifest tables byte-stably.
    - Downgrade rules unit-tested per requirement level.
tools:
  allowed:
    - read policy pack
    - read project record
  preferred:
    - pure functions over SharedState slices
state:
  reads:
    - stage_context
    - project_input
  writes:
    - input_manifest
verification:
  required_checks:
    - 'Property test: every rule-referenced input_id exists in manifest, else the rule is inert.'
failure:
  retry_policy: 'Deterministic: no retry.'
  escalation_policy: Malformed packs are caught by schema validation at CI time, not here.
```
