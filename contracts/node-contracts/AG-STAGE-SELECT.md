# Node Contract: Stage Resolution & Eligibility

```yaml
node_id: AG-STAGE-SELECT
role: Resolve Native Stage to canonical stages with confidence, or reject eligibility
purpose: >-
  Validate stage_selection against the jurisdiction pack: native stage exists, is in MVP scope, and
  carries its canonical-stage mapping plus confidence label.
determinism_class: deterministic
producer: domain-engine
context:
  domain_context: >-
    Native Stage vs Canonical Stage is ADR-0002 law; bare stage numbers have NO cross-jurisdiction
    meaning [EV-CA-006].
  jurisdiction_context: 'Exceptions are data, not code: UAE combined Stage 1/2, UK has no Stage 0, US uses named phases.'
  project_context: Uses only project_input.stage_selection.
  upstream_artifacts:
    - project.record
  relevant_decisions:
    - ADR-0002 canonical stage model
  evidence_required: Pack exceptions carry evidence_ids surfaced on rejection (max 3; engine requireStage).
contract:
  inputs: project_input.stage_selection + jurisdiction policy pack
  outputs: >-
    SharedState.stage_context + artifact payload_kind=context.snapshot; throws StageNotEligibleError
    when ineligible
  invariants:
    - canonical_stages subset of {FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN, DETAILED_DESIGN}.
    - mapping_confidence in {authoritative, interpreted, inferred} — never hidden from users.
    - mvp_scope=false stages are ineligible and reported with display_name.
  allowed_mutations:
    - stage_context
  forbidden_actions:
    - Silently substituting a different stage when selection fails.
    - Dropping confidence labels for UI convenience.
  acceptance_criteria:
    - Every golden fixture's jurisdiction resolves its declared stage.
    - Unknown stage id raises StageNotEligibleError carrying exception evidence_ids.
tools:
  allowed:
    - read policy pack
    - read project record
  preferred:
    - pure functions over SharedState slices
state:
  reads:
    - project_input
  writes:
    - stage_context
verification:
  required_checks:
    - tests/jurisdiction/* cover exception stages (UAE S0 / combined S12, UK absence of S0).
failure:
  retry_policy: 'Deterministic: no retry.'
  escalation_policy: Ineligibility surfaces as user-facing 422 through serverError mapping.
```
