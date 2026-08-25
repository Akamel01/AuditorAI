# Node Contract: Evidence Use Audit (deterministic)

```yaml
node_id: AG-EVIDENCE-USE-AUDIT
role: Deterministic citation-hygiene audit for candidates/findings
purpose: >-
  Enforce citation presence on normative claims, producer/source_trace integrity,
  and supports_concern direction via salient-token overlap; annotate failures only.
determinism_class: deterministic
producer: system
context:
  domain_context: >-
    ADR-0010 companion to AG-HALLUCINATION-CHECK; soft unverifiable-relation flags
    never hard-fail. Runs identically with AI OFF for baseline audits.
  jurisdiction_context: Citation adequacy judged within the selected pack's rules.
  project_context: Operates after hallucination check in the same batch stage.
  upstream_artifacts:
    - context.snapshot
    - evidence.registry
    - candidates.validation
reads:
  - context.snapshot
  - evidence.registry
  - candidates.validation
writes:
  - candidates.audit
  - validation_summary.evidence_use
independence: not_applicable
failure_mode: annotate-and-continue (never blocks the audit)
```
