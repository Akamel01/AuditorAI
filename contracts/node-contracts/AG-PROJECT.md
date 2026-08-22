# Node Contract: Project Intake

```yaml
node_id: AG-PROJECT
role: Anchor one audit run to its Project record
purpose: >-
  Load and freeze the Project record (id, jurisdiction/framework/stage selection, recorded input
  values with their §14 states) as this run's immutable input.
determinism_class: deterministic
producer: domain-engine
context:
  domain_context: >-
    The Project is the umbrella record for one auditing effort (CONTEXT.md). This node only reads
    what already exists; it decides nothing.
  jurisdiction_context: Jurisdiction comes from the record verbatim; validated for presence only.
  project_context: Runs against exactly one Scheme's Project per audit.
  upstream_artifacts:
    - project.record from storage
  relevant_decisions:
    - ADR-0001 platform baseline (seams)
  evidence_required: none — operates on recorded data only
contract:
  inputs: persisted Project record (Repository.getProject)
  outputs: SharedState.project_input + artifact payload_kind=project.record
  invariants:
    - Record must exist; a missing id is a hard failure, never an empty run.
    - >-
      input_values are copied as-is; states are not re-resolved here (that is AG-MANIFEST's
      business).
  allowed_mutations:
    - project_input
  forbidden_actions:
    - Mutating the stored Project.
    - Applying defaults to absent inputs.
  acceptance_criteria:
    - project_input.project_id equals the requested id.
    - Slice round-trips byte-identically through serialize/deserialize.
tools:
  allowed:
    - read policy pack
    - read project record
  preferred:
    - pure functions over SharedState slices
state:
  reads:
    - storage
  writes:
    - project_input
verification:
  required_checks:
    - Golden-fixture runs GF-1..GF-5 begin from this slice unchanged.
failure:
  retry_policy: None needed (single read).
  escalation_policy: Missing record fails the run as not-found via API error mapping.
```
