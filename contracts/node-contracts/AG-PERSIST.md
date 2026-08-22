# Node Contract: Persistence Receipt

```yaml
node_id: AG-PERSIST
role: Store the finalized audit behind the DataStore seam
purpose: >-
  Write the completed AuditResult via Repository.saveAudit and emit the storage receipt consumed by
  listings and replays.
determinism_class: deterministic
producer: repository
context:
  domain_context: >-
    Audit Artifacts persist attributable outputs (CONTEXT.md); the receipt is the durable pointer
    enabling replay (N3 refines key scheme).
  jurisdiction_context: Workspace namespacing by hashed key preserves tenant isolation (workspaceHash).
  project_context: Keyed ws:{ws}:audit:{projectId}:{auditId}.
  upstream_artifacts:
    - report.bundle
  relevant_decisions:
    - ADR-0001 platform baseline (seams) memory/KV adapters swappable by env
  evidence_required: none
contract:
  inputs: report_bundle.json
  outputs: SharedState.persistence_ref + artifact payload_kind=persistence.receipt
  invariants:
    - Save-then-get round-trip returns an identical AuditResult.
    - MemoryStore (dev/tests) and KvRestStore (prod) are behaviorally interchangeable.
  allowed_mutations:
    - persistence_ref
  forbidden_actions:
    - Persisting pre-adjudication drafts as final audits.
    - Bypassing the Repository with direct KV writes.
  acceptance_criteria:
    - Integration flow test asserts create→list→get equality.
    - Live smoke proved cross-request persistence on production KV.
tools:
  allowed:
    - read policy pack
    - read project record
  preferred:
    - pure functions over SharedState slices
state:
  reads:
    - report_bundle
  writes:
    - persistence_ref
verification:
  required_checks:
    - tests/integration/flow.test.ts persistence legs.
failure:
  retry_policy: One retry on transient store failure; then error out — never partial state.
  escalation_policy: Store outage surfaces via serverError; the client retains an in-memory copy for manual export.
```
