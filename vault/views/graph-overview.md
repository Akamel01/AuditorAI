---
generated: true
type: graph-overview
source: state/graph-state.json
source_hash: b33d4421d6fe
---
# Audit graph (§19)

Bounded-context pipeline the product executes.

## Nodes

- **AG-PROJECT** — Project record: metadata + stage_selection + input_values
  - impl: `src/domain/types.ts Project`
- **AG-STAGE-SELECT** — Jurisdiction→Framework→NativeStage resolution with eligibility checks
  - impl: `src/domain/packs.ts requireStage/getPack`
- **AG-MANIFEST** — Input normalization to §14/§27 states
  - impl: `engine.runAudit manifest stage`
- **AG-RULES** — Deterministic completeness/process/eligibility rules from pack
  - impl: `engine.runAudit rules stage`
- **AG-QUESTIONS** — Stage-relevant audit questions surfaced for human reasoning
  - impl: `engine.runAudit questions stage`
- **AG-FINDINGS** — Candidate findings as compliance_question drafts (ADR-0003 kinds)
  - impl: `engine.makeProcessFinding/makeEligibilityFinding`
- **AG-AI-CANDIDATES** — Bounded AI candidate findings — OFF in MVP, seam reserved
  - impl: `src/lib/ai.ts (OffAiAdapter default)`
- **AG-ADJUDICATION** — Human review: reviewer_status workflow + wording discipline enforcement
  - impl: `PATCH /api/projects/[id]/audits/[auditId]`
- **AG-EVIDENCE-LINKS** — Every normative claim traceable to evidence registry ids
  - impl: `src/lib/evidence.ts`
- **AG-REPORT** — Deterministic report rendering (MD/JSON/print-PDF)
  - impl: `src/lib/report.ts renderReportMarkdown`
- **AG-PERSIST** — Versioned storage behind DataStore seam
  - impl: `src/lib/persistence.ts Repository`

## Edges

- AG-PROJECT → AG-STAGE-SELECT (DATA): stage_selection
- AG-STAGE-SELECT → AG-MANIFEST (CONTRACT): pack inputs ∩ native stage
- AG-MANIFEST → AG-RULES (DATA): input states
- AG-RULES → AG-FINDINGS (DATA): compliance_question drafts
- AG-RULES → AG-EVIDENCE-LINKS (EVIDENCE): rule evidence_ids
- AG-QUESTIONS → AG-ADJUDICATION (CONTEXT): questions for human reasoning
- AG-AI-CANDIDATES → AG-ADJUDICATION (FEEDBACK): bounded candidates (disabled by default)
- AG-ADJUDICATION → AG-REPORT (CONTROL): reviewed findings only
- AG-REPORT → AG-PERSIST (DATA): AuditResult artifact
