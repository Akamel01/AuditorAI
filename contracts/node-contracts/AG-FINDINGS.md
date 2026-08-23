# Node Contract: Deterministic Findings Shaping

```yaml
node_id: AG-FINDINGS
role: Candidate findings as compliance_question drafts (ADR-0003 kinds)
purpose: >-
  Give process/eligibility outcomes their full Finding form: ids, statement, evidence links,
  assumptions, rationale, source_trace, reviewer_status=draft.
determinism_class: deterministic
producer: domain-engine
context:
  domain_context: >-
    Finding anatomy follows CONTEXT.md and finding.schema.json: typed, reviewable,
    provenance-carrying, uncertainty-explicit.
  jurisdiction_context: normative_basis_note records applicability at the native stage id.
  project_context: finding_id embeds rule_id + stage for cross-jurisdiction uniqueness.
  upstream_artifacts:
    - rules.results
  upstream_nodes:
    - AG-RULES
  downstream_nodes: []
  relevant_decisions:
    - ADR-0003 finding model
  evidence_required: evidence entries use use=defines_requirement (process) or use=context (eligibility).
contract:
  inputs: rule_results.deterministic_findings (raw outcomes)
  outputs: Finalized Finding[] within rule_results + artifact payload_kind=findings.deterministic
  invariants:
    - All findings validate against finding.schema.json.
    - >-
      reviewer_status starts at draft; risk_components all null; recommendation stays null until a
      human decides.
  allowed_mutations:
    - rule_results
  forbidden_actions:
    - Emitting kind=safety_concern from deterministic rules.
    - Pre-filling recommendations.
  acceptance_criteria:
    - Contract tests bind these exact objects to the committed finding schema.
    - source_trace.origin === deterministic_rule on every emitted finding.
tools:
  allowed:
    - read policy pack
    - read project record
  preferred:
    - pure functions over SharedState slices
state:
  reads:
    - rule_results
  writes:
    - rule_results
verification:
  required_checks:
    - Schema contract tests bind engine output to committed schemas.
failure:
  retry_policy: 'Deterministic: no retry.'
  escalation_policy: A schema violation is a build failure, never runtime coercion.
```
