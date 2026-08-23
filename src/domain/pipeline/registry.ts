// Pipeline registry: node order + descriptors. The registry is the runtime
// source of truth the dev tab reads; descriptor edges are a superset of the
// declarative graph in state/graph-state.json (audit_graph).
import { AG_NODE_IDS } from "@/domain/pipeline/types";
import type {
  AgNodeId,
  NodeDescriptor,
  NodeFn,
} from "@/domain/pipeline/types";
import { runProject } from "@/domain/pipeline/nodes/project";
import { runStageSelect } from "@/domain/pipeline/nodes/stage-select";
import { runManifest } from "@/domain/pipeline/nodes/manifest";
import { runRules } from "@/domain/pipeline/nodes/rules";
import { runFindings } from "@/domain/pipeline/nodes/findings";
import { runQuestions } from "@/domain/pipeline/nodes/questions";
import { runAiCandidates } from "@/domain/pipeline/nodes/ai-candidates";
import { runAdjudication } from "@/domain/pipeline/nodes/adjudication";
import { runEvidenceLinks } from "@/domain/pipeline/nodes/evidence-links";
import { runReport } from "@/domain/pipeline/nodes/report";

/** Nodes executed by runAll — everything except the storage receipt. */
export const BATCH_NODES: AgNodeId[] = AG_NODE_IDS.filter((id) => id !== "AG-PERSIST");

/** Sync node functions; AG-PERSIST is async and lives behind pipeline.persistRun. */
export const NODE_FNS: Record<Exclude<AgNodeId, "AG-PERSIST">, NodeFn> = {
  "AG-PROJECT": runProject,
  "AG-STAGE-SELECT": runStageSelect,
  "AG-MANIFEST": runManifest,
  "AG-RULES": runRules,
  "AG-FINDINGS": runFindings,
  "AG-QUESTIONS": runQuestions,
  "AG-AI-CANDIDATES": runAiCandidates,
  "AG-ADJUDICATION": runAdjudication,
  "AG-EVIDENCE-LINKS": runEvidenceLinks,
  "AG-REPORT": runReport,
};

export const DESCRIPTORS: NodeDescriptor[] = [
  {
    id: "AG-PROJECT",
    name: "Project Intake",
    node_class: "deterministic",
    reads: [],
    writes: ["project_input"],
    emits: "project.record",
    depends_on: [],
    executed_in_batch: true,
    summary: "Copies the stored Project record into the pipeline verbatim.",
  },
  {
    id: "AG-STAGE-SELECT",
    name: "Stage Resolution & Eligibility",
    node_class: "deterministic",
    reads: ["project_input"],
    writes: ["stage_context"],
    emits: "context.snapshot",
    depends_on: ["AG-PROJECT"],
    executed_in_batch: true,
    summary: "Jurisdiction→Framework→NativeStage resolution with eligibility checks.",
  },
  {
    id: "AG-MANIFEST",
    name: "Input Manifest",
    node_class: "deterministic",
    reads: ["stage_context", "project_input"],
    writes: ["input_manifest"],
    emits: "manifest.table",
    depends_on: ["AG-STAGE-SELECT"],
    executed_in_batch: true,
    summary: "Input normalization to §14/§27 states for the selected native stage.",
  },
  {
    id: "AG-RULES",
    name: "Deterministic Rule Evaluation",
    node_class: "deterministic",
    reads: ["stage_context", "input_manifest"],
    writes: ["rule_results"],
    emits: "rules.results",
    depends_on: ["AG-MANIFEST"],
    executed_in_batch: true,
    summary: "Completeness/process/eligibility rules from the policy pack; no scores.",
  },
  {
    id: "AG-FINDINGS",
    name: "Deterministic Findings Shaping",
    node_class: "deterministic",
    reads: ["rule_results"],
    writes: ["rule_results"],
    emits: "findings.deterministic",
    depends_on: ["AG-RULES"],
    executed_in_batch: true,
    summary: "Gates raw rule outcomes into schema-valid draft findings.",
  },
  {
    id: "AG-QUESTIONS",
    name: "Audit Question Selection",
    node_class: "deterministic",
    reads: ["stage_context"],
    writes: ["audit_questions"],
    emits: "questions.set",
    depends_on: ["AG-STAGE-SELECT"],
    executed_in_batch: true,
    summary: "Stage-relevant audit questions surfaced for human reasoning.",
  },
  {
    id: "AG-AI-CANDIDATES",
    name: "AI Candidate Generation",
    node_class: "ai-bounded",
    reads: ["stage_context", "input_manifest", "audit_questions", "rule_results", "project_input"],
    writes: ["candidate_findings"],
    emits: "candidates.ai",
    depends_on: [],
    executed_in_batch: true,
    summary:
      "Bounded AI candidate findings via the AiAdapter seam; OFF default emits null slice with zero provider calls.",
  },
  {
    id: "AG-ADJUDICATION",
    name: "Human Adjudication",
    node_class: "human",
    reads: ["rule_results"],
    writes: ["adjudication"],
    emits: "adjudication.decisions",
    depends_on: ["AG-FINDINGS", "AG-AI-CANDIDATES", "AG-QUESTIONS"],
    executed_in_batch: true,
    summary:
      "Human review workflow + wording discipline; batch mode carries drafts forward unverified; decisions on unknown finding ids are recorded under limitations.",
  },
  {
    id: "AG-EVIDENCE-LINKS",
    name: "Evidence Linkset Validation",
    node_class: "deterministic",
    reads: [
      "input_manifest",
      "rule_results",
      "candidate_findings",
      "adjudication",
    ],
    writes: ["evidence_linkset"],
    emits: "evidence.linkset",
    depends_on: ["AG-RULES", "AG-ADJUDICATION"],
    executed_in_batch: true,
    summary: "Every normative claim traceable to evidence-registry ids; unresolved ids fail loud.",
  },
  {
    id: "AG-REPORT",
    name: "Report Assembly",
    node_class: "deterministic",
    reads: ["project_input", "stage_context", "input_manifest", "rule_results", "audit_questions", "adjudication"],
    writes: ["report_bundle"],
    emits: "report.bundle",
    depends_on: ["AG-ADJUDICATION"],
    executed_in_batch: true,
    summary: "Deterministic report assembly (JSON literal + Markdown rendering).",
  },
  {
    id: "AG-PERSIST",
    name: "Persistence Receipt",
    node_class: "deterministic",
    reads: ["report_bundle"],
    writes: ["persistence_ref"],
    emits: "persistence.receipt",
    depends_on: ["AG-REPORT"],
    executed_in_batch: false,
    summary: "Versioned storage behind the DataStore seam; step-mode only.",
  },
];
