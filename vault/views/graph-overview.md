---
generated: true
type: graph-overview
source: state/graph-state.json
source_hash: 5e6ab77a1d41
---
# Audit graph (§19)

Bounded-context pipeline the product executes.

## Nodes

- **AG-PROJECT** — Copies the stored Project record into the pipeline verbatim.
  - impl: `src/domain/pipeline/nodes/project.ts runProject`
- **AG-STAGE-SELECT** — Jurisdiction→Framework→NativeStage resolution with eligibility checks.
  - impl: `src/domain/pipeline/nodes/stage-select.ts runStageSelect`
- **AG-MANIFEST** — Input normalization to §14/§27 states for the selected native stage.
  - impl: `src/domain/pipeline/nodes/manifest.ts runManifest`
- **AG-RULES** — Completeness/process/eligibility rules from the policy pack; no scores.
  - impl: `src/domain/pipeline/nodes/rules.ts runRules`
- **AG-FINDINGS** — Gates raw rule outcomes into schema-valid draft findings.
  - impl: `src/domain/pipeline/nodes/findings.ts runFindings`
- **AG-QUESTIONS** — Stage-relevant audit questions surfaced for human reasoning.
  - impl: `src/domain/pipeline/nodes/questions.ts runQuestions`
- **AG-AI-CANDIDATES** — Bounded AI candidate findings via the AiAdapter seam; OFF default emits null slice with zero provider calls.
  - impl: `src/domain/pipeline/nodes/ai-candidates.ts runAiCandidates/generateCandidatesLive`
- **AG-HALLUCINATION-CHECK** — Evidence-id existence, normalized quote match and pack-vocabulary membership (ADR-0010); failures annotate auto-flagged, never drop.
  - impl: `src/domain/pipeline/nodes/hallucination-check.ts runHallucinationCheck`
- **AG-EVIDENCE-USE-AUDIT** — Citation presence, producer/source_trace enforcement and use-direction consistency (ADR-0010); failures annotate auto-flagged, never drop.
  - impl: `src/domain/pipeline/nodes/evidence-use-audit.ts runEvidenceUseAudit`
- **AG-ADJUDICATION** — Human review workflow + wording discipline; batch mode carries drafts forward unverified; decisions on unknown finding ids are recorded under limitations.
  - impl: `src/domain/pipeline/nodes/adjudication.ts runAdjudication`
- **AG-EVIDENCE-LINKS** — Every normative claim traceable to evidence-registry ids; unresolved ids fail loud.
  - impl: `src/domain/pipeline/nodes/evidence-links.ts runEvidenceLinks`
- **AG-REPORT** — Deterministic report assembly (JSON literal + Markdown rendering).
  - impl: `src/domain/pipeline/nodes/report.ts runReport`
- **AG-PERSIST** — Versioned storage behind the DataStore seam; step-mode only.
  - impl: `src/domain/pipeline/nodes/persist.ts persistRun`

## Edges

- AG-PROJECT → AG-STAGE-SELECT (DATA): AG-PROJECT hands off project_input
- AG-STAGE-SELECT → AG-MANIFEST (DATA): AG-STAGE-SELECT hands off stage_context
- AG-MANIFEST → AG-RULES (DATA): AG-MANIFEST hands off input_manifest
- AG-RULES → AG-FINDINGS (DATA): AG-RULES hands off rule_results
- AG-STAGE-SELECT → AG-QUESTIONS (DATA): AG-STAGE-SELECT hands off stage_context
- AG-AI-CANDIDATES → AG-HALLUCINATION-CHECK (DATA): AG-AI-CANDIDATES hands off candidate_findings
- AG-HALLUCINATION-CHECK → AG-EVIDENCE-USE-AUDIT (DATA): AG-HALLUCINATION-CHECK hands off candidate_findings, rule_results
- AG-FINDINGS → AG-ADJUDICATION (DATA): AG-FINDINGS hands off rule_results
- AG-AI-CANDIDATES → AG-ADJUDICATION (DEPENDENCY): AG-ADJUDICATION orders after AG-AI-CANDIDATES (no direct slice handoff)
- AG-EVIDENCE-USE-AUDIT → AG-ADJUDICATION (DATA): AG-EVIDENCE-USE-AUDIT hands off rule_results
- AG-QUESTIONS → AG-ADJUDICATION (DEPENDENCY): AG-ADJUDICATION orders after AG-QUESTIONS (no direct slice handoff)
- AG-RULES → AG-EVIDENCE-LINKS (DATA): AG-RULES hands off rule_results
- AG-ADJUDICATION → AG-EVIDENCE-LINKS (DATA): AG-ADJUDICATION hands off adjudication
- AG-ADJUDICATION → AG-REPORT (DATA): AG-ADJUDICATION hands off adjudication
- AG-REPORT → AG-PERSIST (DATA): AG-REPORT hands off report_bundle
