# Node Contract: Hallucination Check (deterministic)

```yaml
node_id: AG-HALLUCINATION-CHECK
role: Deterministic post-AI validation — evidence grounding of candidates/findings
purpose: >-
  Verify every AI candidate (or engine finding when AI is OFF) against the compiled
  evidence registry and pack vocabulary; annotate failures, never remove artifacts.
determinism_class: deterministic
producer: system
context:
  domain_context: >-
    ADR-0010: flag-and-show semantics keep the human gate sovereign (ADR-0006).
    Checks are registry/pack lookups only — no model calls.
  jurisdiction_context: Vocabulary membership is judged against the selected pack.
  project_context: Operates on candidates/findings present in shared state.
  upstream_artifacts:
    - context.snapshot
    - evidence.registry
    - candidates.findings
reads:
  - context.snapshot
  - evidence.registry
  - candidates.findings
writes:
  - candidates.validation
  - validation_summary.hallucination
independence: not_applicable
failure_mode: annotate-and-continue (never blocks the audit)
```
