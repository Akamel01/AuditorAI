# Node Contract: Human Adjudication

```yaml
node_id: AG-ADJUDICATION
role: 'Human review: reviewer_status workflow + wording discipline enforcement'
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
    - findings.deterministic
  upstream_nodes:
    - AG-QUESTIONS
    - AG-AI-CANDIDATES
  downstream_nodes:
    - AG-REPORT
  relevant_decisions:
    - ADR-0003 finding model wording discipline
  evidence_required: Reviewer notes may add evidence references; edits preserve the original text trail.
contract:
  inputs: >-
    rule_results.findings + human decisions. Candidate findings are display-only context today: they
    are produced evidence-gated, validated by AG-EVIDENCE-LINKS, and dropped before the assembled
    report; this node does not consume them.
  outputs: >-
    SharedState.adjudication + artifact payload_kind=adjudication.decisions
    (validation_status=verified once applied)
  invariants:
    - No finding reaches the final set without explicit reviewer_status other than draft.
    - Wording violations block save (UI dialog); violations are recorded, never silently stripped.
    - accepted_with_edits keeps both text versions for auditability.
    - >-
      A decision targeting an unknown finding_id is never silently dropped: it is recorded in
      skipped_decision_refs and surfaces under AuditResult limitations.
  allowed_mutations:
    - adjudication
  forbidden_actions:
    - Auto-accepting any finding.
    - Weakening the wording gate under any flag.
    - Dropping decisions on unknown finding ids without recording them.
  acceptance_criteria:
    - Browser e2e proves clean adjudication persists and banned wording is rejected via dialog.
    - Designer disagreement flows onward via the response report (UK EV-UK-016), outside this node.
    - A rogue finding_id decision appears verbatim under result limitations.
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
    - adjudication
verification: {}
failure:
  retry_policy: 'Human-driven: not applicable.'
  escalation_policy: Disagreement escalates to the designer response process, out of node scope.
```
