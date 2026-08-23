# Node Contract: Evidence Linkset Validation

```yaml
node_id: AG-EVIDENCE-LINKS
role: Every normative claim traceable to evidence registry ids
purpose: >-
  Union evidence_ids across manifest, rules, questions, findings and candidates; verify each
  resolves in the compiled evidence registry before reporting.
determinism_class: deterministic
producer: domain-engine
context:
  domain_context: >-
    Every normative claim carries registry provenance (CONTEXT.md Evidence); unresolvable ids mean
    broken provenance, not softer claims.
  jurisdiction_context: Registry entries are jurisdiction-flagged; links never harmonize meanings across jurisdictions.
  project_context: Linkset scoped to this audit's artifacts.
  upstream_artifacts:
    - all prior artifacts
  upstream_nodes:
    - AG-RULES
  downstream_nodes: []
  relevant_decisions:
    - ADR-0003 finding model
  evidence_required: 'The registry itself: state/evidence-registry.json, compiled by scripts/compile-evidence.mjs.'
contract:
  inputs: All slices carrying evidence_ids
  outputs: SharedState.evidence_linkset + artifact payload_kind=evidence.linkset
  invariants:
    - Every referenced id resolves in the registry; failures list the offending ids.
    - The registry compiles via scripts/compile-evidence.mjs and is never hand-edited.
  allowed_mutations:
    - evidence_linkset
  forbidden_actions:
    - Dropping unresolvable ids silently.
    - Rewriting quotes or sources.
  acceptance_criteria:
    - CI evidence-determinism job green (recompilation byte-stable).
    - Zero unresolved ids across golden fixtures.
tools:
  allowed:
    - read policy pack
    - read project record
  preferred:
    - pure functions over SharedState slices
state:
  reads:
    - every slice
  writes:
    - evidence_linkset
verification:
  required_checks:
    - scripts/validate-state.mjs + evidence determinism CI job.
failure:
  retry_policy: 'Deterministic: no retry.'
  escalation_policy: Unresolved ids fail the run loudly — provenance is a hard gate.
```
