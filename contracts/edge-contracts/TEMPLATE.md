# Edge Contract Template

Edges are typed; anonymous dependencies are forbidden.

Allowed types: `CONTROL DATA CONTEXT CONTRACT DEPENDENCY EVIDENCE VALIDATION FEEDBACK
ESCALATION SPAWN MERGE LOOP`.

```yaml
edge_id:
type:                  # one of the allowed types
from_node:
to_node:
payload:               # what actually flows
guarantees:            # invariants the producer promises the consumer
consumer_obligations:  # what the consumer must do to stay valid
failure_semantics:     # what happens when the payload is missing/rejected
```
