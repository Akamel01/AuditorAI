# Node Contract: Report Assembly

```yaml
node_id: AG-REPORT
role: Render the audited result into JSON + Markdown report bundle
purpose: >-
  Assemble the final AuditResult (adjudicated findings, questions, limitations, disclaimer) and
  render its Markdown form for download/print.
determinism_class: deterministic
producer: report-builder
context:
  domain_context: >-
    Reports carry the DISCLAIMER verbatim: assistance, not professional judgment; compliance outputs
    never imply safety.
  jurisdiction_context: >-
    Limitations include framework-specific notes (e.g., GG 119 assigns no severity scores
    [EV-UK-024]).
  project_context: audit_id format AUD-<project>-<stage>; ran_at injected by caller.
  upstream_artifacts:
    - adjudication.decisions
    - evidence.linkset
  relevant_decisions:
    - ADR-0003 finding model
  evidence_required: Reports cite evidence by id; readers resolve via the registry.
contract:
  inputs: adjudication.final_findings + all slices
  outputs: SharedState.report_bundle + artifact payload_kind=report.bundle
  invariants:
    - Identical slices produce byte-identical markdown apart from rendered timestamps.
    - Disclaimer string equals engine.DISCLAIMER exactly.
    - Non-authoritative mapping-confidence warnings appear under limitations.
  allowed_mutations:
    - report_bundle
  forbidden_actions:
    - Omitting unaccepted findings from the record (they appear with their status).
    - Softening limitation language.
  acceptance_criteria:
    - Report API e2e returns both forms; browser-print PDF path works.
    - Snapshot test pins disclaimer + limitations sections.
tools:
  allowed:
    - read policy pack
    - read project record
  preferred:
    - pure functions over SharedState slices
state:
  reads:
    - all slices
  writes:
    - report_bundle
verification:
  required_checks:
    - tests/integration flow report leg.
failure:
  retry_policy: 'Deterministic: no retry.'
  escalation_policy: Rendering failure is a plain 500 — no partial reports ship.
```
