---
id: N1
title: Audit node contracts (AG-*)
type: grilling
hitl: false
status: closed
issue: #1
assignee:
blocked_by: []
blocks: [N2]
created: 2026-08-22
resolved: 2026-08-22
---

## Question

Instantiate contracts/node-contracts/TEMPLATE.md for every audit_graph node (AG-PROJECT .. AG-PERSIST): typed shared-state slice in/out, bounded artifact types emitted, determinism class (deterministic | ai-bounded | human), producer id. Contracts must be derivable from engine.ts reality and agree with CONTEXT.md's Audit Artifact term.

## Resolution

Resolved 2026-08-22 by ORCH-direct execution (delegation incident per issue #1 comment).

Deliverables in contracts/node-contracts/:
- SHARED-STATE.md — SharedState slices + AuditArtifact envelope + closed payload_kind set + producer vocabulary
- 11 per-node contracts (AG-PROJECT .. AG-PERSIST) instantiating TEMPLATE.md shape with determinism_class in {deterministic x9, ai-bounded (AG-AI-CANDIDATES), human (AG-ADJUDICATION)}
- README.md index table
- Emitted via scripts/gen-node-contracts.mjs using js-yaml; every file round-trip validated (yaml.load -> mandatory fields asserted)

Contracts are grounded in engine.ts reality: stage eligibility/exceptions (requireStage), manifest state-resolution rules, rule kinds (completeness->MI questions; process/eligibility->compliance_question findings), canonical-scoped question selection, wording discipline at adjudication, evidence-linkset as hard provenance gate.
