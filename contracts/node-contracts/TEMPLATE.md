# Node Contract Template

Every important node — development-graph or audit-graph — gets a contract of this
shape. No informal instruction replaces a node contract.

```yaml
node_id:
role:
purpose:

context:
  domain_context:
  jurisdiction_context:
  project_context:
  upstream_artifacts:
  relevant_decisions:
  evidence_required:

contract:
  inputs:
  outputs:
  invariants:
  allowed_mutations:
  forbidden_actions:
  acceptance_criteria:

tools:
  allowed:
  preferred:

state:
  reads:
  writes:

verification:
  required_checks:

failure:
  retry_policy:
  escalation_policy:
```
