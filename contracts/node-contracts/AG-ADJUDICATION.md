# Node Contract: Human Adjudication

```yaml
node_id: AG-ADJUDICATION
role: Apply auditor/reviewer decisions to candidate and deterministic findings
purpose: >-
  Record per-finding reviewer_status transitions (accepted / accepted_with_edits / rejected),
  enforce recommendation wording discipline, and finalize the finding set.
determinism_class: human
producer: finding-adjudicator + auditor-human
context:
  domain_context: >-
    The Auditor holds final professional responsibility (CONTEXT.md); software assists here but
    never concludes.
  jurisdiction_context: >-
    UK practice bans vague wording ('consider') in recommendations [EV-UK-015]; enforced canonically
    via validateRecommendationWording (banned words: consider, must).
  project_context: Decisions attach to finding_id within this audit only.
  upstream_artifacts:
    - candidates.ai?
    - findings.deterministic
  relevant_decisions:
    - ADR-0003 finding model wording discipline
  evidence_required: Reviewer notes may add evidence references; edits preserve the original text trail.
contract:
  inputs: rule_results.findings + candidate_findings + human decisions
  outputs: >-
    SharedState.adjudication + artifact payload_kind=adjudication.decisions
    (validation_status=verified once applied)
  invariants:
    - No finding reaches the final set without explicit reviewer_status other than draft.
    - Wording violations block save (UI dialog); violations are recorded, never silently stripped.
    - accepted_with_edits keeps both text versions for auditability.
  allowed_mutations:
    - adjudication
  forbidden_actions:
    - Auto-accepting any finding.
    - Weakening the wording gate under any flag.
  acceptance_criteria:
    - Playwright flow proves clean adjudication persists and banned wording is rejected via dialog.
    - Designer disagreement flows onward via the response report (UK EV-UK-016), outside this node.
tools:
  allowed:
    - read policy pack
    - read project record
  preferred:
    - pure functions over SharedState slices
state:
  reads:
    - rule_results
    - candidate_findings
  writes:
    - adjudication
verification:
  required_checks:
    - tests/e2e flow.spec.ts adjudication leg; wording-gate unit tests.
failure:
  retry_policy: 'Human-driven: not applicable.'
  escalation_policy: Disagreement escalates to the designer response process, out of node scope.
```
