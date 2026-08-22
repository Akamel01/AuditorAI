# Shared State & Artifact Envelope (N1)

The single source of truth for what audit-pipeline nodes read and write. Node
contracts in this folder reference slice names defined here — nothing else.
Types are TypeScript-shaped pseudocode; the implementing types arrive with N2.

## SharedState

```ts
interface SharedState {
  project_input: ProjectInputSlice;      // AG-PROJECT writes; everyone may read
  stage_context: StageContextSlice;      // AG-STAGE-SELECT writes
  input_manifest: ManifestSlice;         // AG-MANIFEST writes
  rule_results: RuleResultsSlice;        // AG-RULES writes
  audit_questions: QuestionsSlice;       // AG-QUESTIONS writes
  candidate_findings: CandidatesSlice | null;  // AG-AI-CANDIDATES writes; absent when AI off
  adjudication: AdjudicationSlice;       // AG-ADJUDICATION writes
  evidence_linkset: EvidenceLinksetSlice;// AG-EVIDENCE-LINKS writes
  report_bundle: ReportBundleSlice;      // AG-REPORT writes
  persistence_ref: PersistenceRefSlice;  // AG-PERSIST writes
}
```

A node reads any slice but **may write only the slice(s) its contract names**.
Slices are additive: a write replaces that slice whole; nodes never patch
another node's slice in place.

### Slice shapes (decision-rich parts only)

```ts
// Mirrors src/domain Project as loaded for one run
type ProjectInputSlice = Pick<Project, "project_id" | "jurisdiction" | "framework"
  | "stage_selection" | "input_values">;

// What buildAuditContext derives today (engine.ts buildAuditContext)
type StageContextSlice = {
  jurisdiction; framework_name; native_stage_id;
  canonical_stages; mapping_confidence;   // Confidence label, CONTEXT.md
};

type ManifestSlice = ManifestEntry[];     // engine.ts lines "Input manifest"

type RuleResultsSlice = {
  missing_information: MissingInformationQuestion[];  // MI-* questions
  deterministic_findings: Finding[];                  // process + eligibility compliance_questions
};

type QuestionsSlice = AuditResult["audit_questions"]; // addressed:false at emission

type CandidatesSlice = CandidateFinding[];  // ai.ts bounded type; producer-labelled

type AdjudicationSlice = {
  final_findings: Finding[];                // reviewer_status resolved per finding
  wording_violations: { finding_id; violations }[];  // validateRecommendationWording gate
};

type EvidenceLinksetSlice = {
  evidence_ids: string[];                   // union across manifest/rules/questions/findings
  registry: "state/evidence-registry.json"; // provenance target
};

type ReportBundleSlice = { json: AuditResult; markdown: string; disclaimer: string };
type PersistenceRefSlice = { audit_id: string; store_key: string; stored_at: string };
```

## AuditArtifact envelope

Every node execution emits artifacts of this shape (CONTEXT.md: *Audit Artifact*):

```ts
type AuditArtifact<P = unknown> = {
  artifact_id: string;          // ART-<node>-<seq>
  node_id: AgNodeId;            // e.g. "AG-RULES"
  producer: ProducerId;         // below
  version: number;              // monotonically increasing per audit run
  created_at: string;           // ISO-8601
  validation_status: "draft" | "verified" | "rejected";
  payload_kind: PayloadKind;    // one fixed kind per emitting node
  payload: P;
};
```

`payload_kind` is a closed set, one primary emitter each:
`project.record`, `context.snapshot`, `manifest.table`, `rules.results`,
`questions.set`, `findings.deterministic`, `candidates.ai`,
`adjudication.decisions`, `evidence.linkset`, `report.bundle`,
`persistence.receipt`.

## Producers

| ProducerId | Meaning |
|---|---|
| `domain-engine` | Deterministic code path (engine.ts) |
| `safety-reasoning-agent` | AI adapter emitting bounded candidates only |
| `finding-adjudicator` + auditor-human | Human review decisions, applied by code |
| `report-builder` | Report assembly |
| `repository` | Persistence layer |

## Doctrine bindings (non-negotiable)

1. Deterministic nodes: identical inputs ⇒ identical outputs. `ran_at` is the
   only caller-injected variance and lives outside payloads.
2. The AI node emits `CandidateFinding[]` exclusively — never findings with
   resolved `reviewer_status`, never risk scores presented as assessments.
3. Compliance ≠ safety everywhere; passing checks implies nothing about safety.
4. Every normative claim carries `evidence_ids` resolvable in the registry.
