# Audit Graph Node Contracts (N1)

One contract per audit_graph node (see state/graph-state.json). Shared slice
names and the AuditArtifact envelope are defined in [SHARED-STATE.md](SHARED-STATE.md).
Template shape: [TEMPLATE.md](TEMPLATE.md). Determinism classes: deterministic /
ai-bounded / human. Doctrine: deterministic-first; AI proposes bounded candidates,
adjudication disposes; compliance ≠ safety.

| Node | Title | Class | Reads | Writes | Emits | Producer |
|---|---|---|---|---|---|---|
| AG-PROJECT | Project Intake | deterministic | storage | project_input | project.record | domain-engine |
| AG-STAGE-SELECT | Stage Resolution & Eligibility | deterministic | project_input | stage_context | context.snapshot; | domain-engine |
| AG-MANIFEST | Input Manifest | deterministic | stage_context, project_input | input_manifest | manifest.table | domain-engine |
| AG-RULES | Deterministic Rule Evaluation | deterministic | input_manifest | rule_results | rules.results | domain-engine |
| AG-FINDINGS | Deterministic Findings Shaping | deterministic | rule_results | rule_results | findings.deterministic | domain-engine |
| AG-QUESTIONS | Audit Question Selection | deterministic | stage_context | audit_questions | questions.set | domain-engine |
| AG-AI-CANDIDATES | AI Candidate Generation (bounded) | ai-bounded | stage_context, input_manifest, audit_questions | candidate_findings | candidates.ai | safety-reasoning-agent |
| AG-ADJUDICATION | Human Adjudication | human | rule_results, candidate_findings | adjudication | adjudication.decisions | finding-adjudicator + auditor-human |
| AG-EVIDENCE-LINKS | Evidence Linkset Validation | deterministic | every slice | evidence_linkset | evidence.linkset | domain-engine |
| AG-REPORT | Report Assembly | deterministic | all slices | report_bundle | report.bundle | report-builder |
| AG-PERSIST | Persistence Receipt | deterministic | report_bundle | persistence_ref | persistence.receipt | repository |
