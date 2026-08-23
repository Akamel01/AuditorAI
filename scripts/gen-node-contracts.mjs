// N1 generator (#1): emits node contracts via js-yaml (valid-by-construction),
// validates each by re-parsing, and writes the folder README index. Node
// identity (ids, roles, edges) is single-sourced from state/graph-state.json;
// this file carries only contract-specific content keyed by node id.
import yaml from "js-yaml";
import fs from "node:fs";
import { fromRoot } from "./lib/paths.mjs";

const DIR = "contracts/node-contracts";

const GRAPH = JSON.parse(fs.readFileSync(fromRoot("state", "graph-state.json"), "utf8"));
const AUDIT_NODES = new Map(GRAPH.graphs.audit_graph.nodes.map((n) => [n.id, n]));
const AUDIT_EDGES = GRAPH.graphs.audit_graph.edges;

function checkGraphAlignment(C) {
  const failures = [];
  for (const nid of Object.keys(C)) {
    if (!AUDIT_NODES.has(nid)) failures.push(`contract ${nid} has no audit_graph node in state/graph-state.json`);
  }
  for (const nid of AUDIT_NODES.keys()) {
    if (!C[nid]) failures.push(`audit_graph node ${nid} has no contract entry in scripts/gen-node-contracts.mjs`);
  }
  if (failures.length) {
    console.error("GRAPH/CONTRACT MISMATCH:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}

function edgeEndpoints(nid) {
  return {
    upstream_nodes: AUDIT_EDGES.filter((e) => e.to === nid).map((e) => e.from),
    downstream_nodes: AUDIT_EDGES.filter((e) => e.from === nid).map((e) => e.to),
  };
}

const ADR = {
  1: "ADR-0001 platform baseline (seams)",
  2: "ADR-0002 canonical stage model",
  3: "ADR-0003 finding model",
};

const C = {};

C["AG-PROJECT"] = {
  purpose: "Load and freeze the Project record (id, jurisdiction/framework/stage selection, recorded input values with their §14 states) as this run's immutable input.",
  det: "deterministic", producer: "domain-engine",
  domain: "The Project is the umbrella record for one auditing effort (CONTEXT.md). This node only reads what already exists; it decides nothing.",
  juris: "Jurisdiction comes from the record verbatim; validated for presence only.",
  project: "Runs against exactly one Scheme's Project per audit.",
  upstream: ["project.record from storage"],
  adrs: [ADR[1]],
  ev: ["none — operates on recorded data only"],
  inputs: "persisted Project record (Repository.getProject)",
  outputs: "SharedState.project_input + artifact payload_kind=project.record",
  invariants: [
    "Record must exist; a missing id is a hard failure, never an empty run.",
    "input_values are copied as-is; states are not re-resolved here (that is AG-MANIFEST's business).",
  ],
  mutations: ["project_input"],
  forbidden: ["Mutating the stored Project.", "Applying defaults to absent inputs."],
  accept: [
    "project_input.project_id equals the requested id.",
    "Slice round-trips byte-identically through serialize/deserialize.",
  ],
  reads: ["storage"], writes: ["project_input"],
  checks: ["Golden-fixture runs GF-1..GF-5 begin from this slice unchanged."],
  retry: "None needed (single read).",
  escalate: "Missing record fails the run as not-found via API error mapping.",
};

C["AG-STAGE-SELECT"] = {
  purpose: "Validate stage_selection against the jurisdiction pack: native stage exists, is in MVP scope, and carries its canonical-stage mapping plus confidence label.",
  det: "deterministic", producer: "domain-engine",
  domain: "Native Stage vs Canonical Stage is ADR-0002 law; bare stage numbers have NO cross-jurisdiction meaning [EV-CA-006].",
  juris: "Exceptions are data, not code: UAE combined Stage 1/2, UK has no Stage 0, US uses named phases.",
  project: "Uses only project_input.stage_selection.",
  upstream: ["project.record"],
  adrs: [ADR[2]],
  ev: ["Pack exceptions carry evidence_ids surfaced on rejection (max 3; engine requireStage)."],
  inputs: "project_input.stage_selection + jurisdiction policy pack",
  outputs: "SharedState.stage_context + artifact payload_kind=context.snapshot; throws StageNotEligibleError when ineligible",
  invariants: [
    "canonical_stages subset of {FEASIBILITY_CONCEPT, PRELIMINARY_DESIGN, DETAILED_DESIGN}.",
    "mapping_confidence in {authoritative, interpreted, inferred} — never hidden from users.",
    "mvp_scope=false stages are ineligible and reported with display_name.",
  ],
  mutations: ["stage_context"],
  forbidden: ["Silently substituting a different stage when selection fails.", "Dropping confidence labels for UI convenience."],
  accept: [
    "Every golden fixture's jurisdiction resolves its declared stage.",
    "Unknown stage id raises StageNotEligibleError carrying exception evidence_ids.",
  ],
  reads: ["project_input"], writes: ["stage_context"],
  checks: ["Jurisdiction exception stages (UAE S0 / combined S12, UK absence of S0) stay covered by tests."],
  retry: "Deterministic: no retry.",
  escalate: "Ineligibility surfaces as user-facing 422 through serverError mapping.",
};

C["AG-MANIFEST"] = {
  purpose: "Filter the pack's input requirements to those applying to the selected native stage and resolve each stored input value into a manifest state.",
  det: "deterministic", producer: "domain-engine",
  domain: "Requirement levels (required/recommended/optional) drive downstream completeness rules; resolution logic lives in engine resolveState.",
  juris: "Requirement levels come from the jurisdiction pack — never harmonized across jurisdictions.",
  project: "Reads project_input.input_values keyed by input_id.",
  upstream: ["context.snapshot"],
  adrs: [ADR[2]],
  ev: ["Each manifest entry carries evidence_ids justifying the requirement itself."],
  inputs: "stage_context + pack.inputs + project_input.input_values",
  outputs: "SharedState.input_manifest + artifact payload_kind=manifest.table",
  invariants: [
    "'provided' with a blank value downgrades to the level-appropriate missing state (required_missing / recommended_missing / optional_missing / unknown).",
    "conditional_on is preserved for later evaluation.",
    "Entries exist only for inputs whose stage_ids include the selected stage.",
  ],
  mutations: ["input_manifest"],
  forbidden: ["Inventing inputs not present in the pack.", "Marking anything provided without recorded value/evidence."],
  accept: [
    "GF fixtures reproduce manifest tables byte-stably.",
    "Downgrade rules unit-tested per requirement level.",
  ],
  reads: ["stage_context", "project_input"], writes: ["input_manifest"],
  checks: ["Property test: every rule-referenced input_id exists in manifest, else the rule is inert."],
  retry: "Deterministic: no retry.",
  escalate: "Malformed packs are caught by schema validation at CI time, not here.",
};

C["AG-RULES"] = {
  purpose: "Run all applicable pack rules against the manifest: completeness rules raise missing-information questions; process and eligibility rules raise compliance-question findings.",
  det: "deterministic", producer: "domain-engine",
  domain: "Compliance findings are categorically distinct from safety concerns (CONTEXT.md); nothing here assesses physical safety.",
  juris: "Rule sets are per-jurisdiction pack data evaluated by one identical engine.",
  project: "Operates purely on input_manifest states.",
  upstream: ["manifest.table"],
  adrs: [ADR[3]],
  ev: ["Rules carry evidence_ids merged (deduplicated) into questions and findings."],
  inputs: "input_manifest + pack.rules filtered by applies_to_native_stage_ids",
  outputs: "SharedState.rule_results + artifact payload_kind=rules.results",
  invariants: [
    "Same manifest yields same results, always.",
    "output_discipline rules are NOT evaluated here (enforced at adjudication save via validateRecommendationWording).",
    "Eligibility conditions surface as human-confirmable compliance questions, never silent pass/fail.",
  ],
  mutations: ["rule_results"],
  forbidden: ["Any network/AI access.", "Assigning severity/likelihood/exposure scores (stay null per ADR-0003)."],
  accept: [
    "GF-1 process-gap finding reproduces identically.",
    "Completeness deduplicates evidence_ids with Set semantics.",
  ],
  reads: ["input_manifest"], writes: ["rule_results"],
  checks: ["Engine rule coverage stays green after the N2 refactor."],
  retry: "Deterministic: no retry.",
  escalate: "Malformed rule shapes are a pack-schema/CI concern.",
};

C["AG-FINDINGS"] = {
  purpose: "Give process/eligibility outcomes their full Finding form: ids, statement, evidence links, assumptions, rationale, source_trace, reviewer_status=draft.",
  det: "deterministic", producer: "domain-engine",
  domain: "Finding anatomy follows CONTEXT.md and finding.schema.json: typed, reviewable, provenance-carrying, uncertainty-explicit.",
  juris: "normative_basis_note records applicability at the native stage id.",
  project: "finding_id embeds rule_id + stage for cross-jurisdiction uniqueness.",
  upstream: ["rules.results"],
  adrs: [ADR[3]],
  ev: ["evidence entries use use=defines_requirement (process) or use=context (eligibility)."],
  inputs: "rule_results.deterministic_findings (raw outcomes)",
  outputs: "Finalized Finding[] within rule_results + artifact payload_kind=findings.deterministic",
  invariants: [
    "All findings validate against finding.schema.json.",
    "reviewer_status starts at draft; risk_components all null; recommendation stays null until a human decides.",
  ],
  mutations: ["rule_results"],
  forbidden: ["Emitting kind=safety_concern from deterministic rules.", "Pre-filling recommendations."],
  accept: [
    "Contract tests bind these exact objects to the committed finding schema.",
    "source_trace.origin === deterministic_rule on every emitted finding.",
  ],
  reads: ["rule_results"], writes: ["rule_results"],
  checks: ["Schema contract tests bind engine output to committed schemas."],
  retry: "Deterministic: no retry.",
  escalate: "A schema violation is a build failure, never runtime coercion.",
};

C["AG-QUESTIONS"] = {
  purpose: "Filter pack.audit_questions by overlap between applies_to_canonical and the stage's canonical_stages; emit them unanswered for the auditor's worksheet.",
  det: "deterministic", producer: "domain-engine",
  domain: "Questions are the framework's structured examination instrument — distinct from rule-derived missing-information questions.",
  juris: "Selection rides the canonical mapping, so question sets follow stage semantics per jurisdiction.",
  project: "addressed=false at emission; humans answer during review.",
  upstream: ["context.snapshot"],
  adrs: [ADR[2]],
  ev: ["source_note and optional road_users carried through untouched."],
  inputs: "stage_context.canonical_stages + pack.audit_questions",
  outputs: "SharedState.audit_questions + artifact payload_kind=questions.set",
  invariants: [
    "Only questions whose canonical set intersects the stage's appear.",
    "Question text and topic are quoted pack content, never paraphrased.",
  ],
  mutations: ["audit_questions"],
  forbidden: ["Auto-answering questions.", "Filtering by anything other than canonical-stage overlap."],
  accept: [
    "GF-2 question counts stable across runs.",
    "No question appears whose applies_to_canonical excludes the stage.",
  ],
  reads: ["stage_context"], writes: ["audit_questions"],
  checks: ["Jurisdiction tests assert expected question membership per stage."],
  retry: "Deterministic: no retry.",
  escalate: "N/A.",
  post: `
## Inference contract (locked by A2)

- **Decision — AI-proposed missing-information questions: ALLOWED (declared, dormant).**
  When activated, AI may propose missing-information questions bounded to the exact
  \`MissingInformationQuestion\` shape; each must cite registry-resolvable \`evidence_ids\`,
  enter as draft requiring human confirmation, and be visibly marked AI-proposed.
  Emission stays within payload_kind \`questions.set\` (\`validation_status=draft\`,
  \`ai_proposed: true\` marker on the artifact payload); the deterministic pack-derived
  questions are never replaced or filtered by AI output.
- **Dormant today:** nothing emits this yet; behavior tests assert emitted kinds stay a
  subset of declared kinds, so activation later cannot silently widen the boundary.
- **Recommendation drafting: REJECTED for now** — deferred until the eval corpus shows a
  quality baseline (deferred fog item). Free-text narrative generation and final
  determinations remain forbidden everywhere.
`,
};

C["AG-AI-CANDIDATES"] = {
  purpose: "When the AiAdapter seam is enabled, produce CandidateFinding[] grounded in the audit context; candidates are labelled, evidence-gated advisory artifacts for human review, never pre-approved.",
  det: "ai-bounded", producer: "safety-reasoning-agent",
  domain: "AI proposes bounded candidate artifacts only; adjudication disposes. Nothing AI-generated reaches a final determination (workflow doctrine).",
  juris: "Candidates must cite jurisdiction-appropriate evidence_ids or be flagged assumption-only.",
  project: "Context = stage_context + manifest + questions (+ attachments once vision lands, M3).",
  upstream: ["context.snapshot", "manifest.table", "questions.set"],
  adrs: [ADR[1] + " — adapter OFF by default"],
  ev: ["Evidence summaries reference registry ids; invented clause numbers are forbidden."],
  inputs: "stage_context, input_manifest, audit_questions (+ adapter config)",
  outputs: "SharedState.candidate_findings + artifact payload_kind=candidates.ai (validation_status=draft always)",
  invariants: [
    "Adapter OFF (default) means empty slice and zero provider calls.",
    "Emitted type is exactly CandidateFinding (the bounded pick of Finding fields in src/lib/ai.ts).",
    "Every candidate carries producer=safety-reasoning-agent (adapters cannot self-label).",
    "Candidates are display-only today: their evidence ids are validated by AG-EVIDENCE-LINKS, they never merge into the final finding set, and the candidate slice is dropped before the assembled AuditResult.",
  ],
  mutations: ["candidate_findings"],
  forbidden: [
    "Writing directly to rule_results or final findings.",
    "Producing severity/likelihood numbers framed as assessments.",
    "Retrying indefinitely on provider failure.",
  ],
  accept: [
    "OffAiAdapter path returns an empty array with no network I/O (unit-tested).",
    "Malformed model output is rejected at the boundary, yielding empty + logged reason.",
  ],
  reads: ["stage_context", "input_manifest", "audit_questions"],
  writes: ["candidate_findings"],
  checks: ["Fake-fetch unit tests cover happy/malformed/timeout paths (A1)."],
  retry: "At most one repair attempt on invalid JSON, then degrade to empty.",
  escalate: "Repeated provider failure trips a circuit-breaker and reports a degraded status artifact.",
  post: `
## Inference contract (locked by A2)

- **Bounded emission:** this node emits exactly \`CandidateFinding[]\` (payload_kind
  \`candidates.ai\`, \`validation_status=draft\` when live, \`rejected\` when refusing). No other
  artifact kind may originate here.
- **Producer identity is enforced at the boundary:** adapters cannot self-label; both the
  adapter (\`ZenAiAdapter\`) and the pipeline (\`generateCandidatesLive\`) overwrite \`producer\`
  to \`safety-reasoning-agent\`.
- **Uniform refusal semantics** (deterministic path unaffected in every case):
  - Adapter OFF (default): null slice, zero provider calls, no artifact.
  - Enabled but only sync context available: null slice + rejected artifact recording the skip.
  - Live failure (transport/schema after one repair retry/budget exhaustion): null slice +
    rejected artifact carrying the reason.
- **Live driver:** inference conducts through \`AuditPipeline.runAllLive\`; the sync batch
  fold never performs provider calls.
- **Budgets (R7):** per-call timeout ≤60 s; ≤3 calls per audit run; 0–5 candidate
  findings per audit run (prompt cap); circuit-breaker after
  repeated failures; fallback chain Zen→OpenRouter→Groq behind env config.
- **Vision (M3) pre-declaration:** prompt user-content accepts image blocks; candidates
  citing attachments must reference \`attachment_ids\` considered. Wiring arrives with M3.
`,
};

C["AG-ADJUDICATION"] = {
  purpose: "Record per-finding reviewer_status transitions (accepted / accepted_with_edits / rejected), enforce recommendation wording discipline, and finalize the finding set.",
  det: "human", producer: "finding-adjudicator + auditor-human",
  domain: "The Auditor holds final professional responsibility (CONTEXT.md); software assists here but never concludes.",
  juris: "UK practice bans vague wording ('consider') in recommendations [EV-UK-015]; enforced canonically via validateRecommendationWording (banned words: consider, must).",
  project: "Decisions attach to finding_id within this audit only.",
  upstream: ["findings.deterministic"],
  adrs: [ADR[3] + " wording discipline"],
  ev: ["Reviewer notes may add evidence references; edits preserve the original text trail."],
  inputs: "rule_results.findings + human decisions. Candidate findings are display-only context today: they are produced evidence-gated, validated by AG-EVIDENCE-LINKS, and dropped before the assembled report; this node does not consume them.",
  outputs: "SharedState.adjudication + artifact payload_kind=adjudication.decisions (validation_status=verified once applied)",
  invariants: [
    "No finding reaches the final set without explicit reviewer_status other than draft.",
    "Wording violations block save (UI dialog); violations are recorded, never silently stripped.",
    "accepted_with_edits keeps both text versions for auditability.",
    "A decision targeting an unknown finding_id is never silently dropped: it is recorded in skipped_decision_refs and surfaces under AuditResult limitations.",
  ],
  mutations: ["adjudication"],
  forbidden: ["Auto-accepting any finding.", "Weakening the wording gate under any flag.", "Dropping decisions on unknown finding ids without recording them."],
  accept: [
    "Browser e2e proves clean adjudication persists and banned wording is rejected via dialog.",
    "Designer disagreement flows onward via the response report (UK EV-UK-016), outside this node.",
    "A rogue finding_id decision appears verbatim under result limitations.",
  ],
  reads: ["rule_results"], writes: ["adjudication"],
  retry: "Human-driven: not applicable.",
  escalate: "Disagreement escalates to the designer response process, out of node scope.",
};

C["AG-EVIDENCE-LINKS"] = {
  purpose: "Union evidence_ids across manifest, rules, questions, findings and candidates; verify each resolves in the compiled evidence registry before reporting.",
  det: "deterministic", producer: "domain-engine",
  domain: "Every normative claim carries registry provenance (CONTEXT.md Evidence); unresolvable ids mean broken provenance, not softer claims.",
  juris: "Registry entries are jurisdiction-flagged; links never harmonize meanings across jurisdictions.",
  project: "Linkset scoped to this audit's artifacts.",
  upstream: ["all prior artifacts"],
  adrs: [ADR[3]],
  ev: ["The registry itself: state/evidence-registry.json, compiled by scripts/compile-evidence.mjs."],
  inputs: "All slices carrying evidence_ids",
  outputs: "SharedState.evidence_linkset + artifact payload_kind=evidence.linkset",
  invariants: [
    "Every referenced id resolves in the registry; failures list the offending ids.",
    "The registry compiles via scripts/compile-evidence.mjs and is never hand-edited.",
  ],
  mutations: ["evidence_linkset"],
  forbidden: ["Dropping unresolvable ids silently.", "Rewriting quotes or sources."],
  accept: [
    "CI evidence-determinism job green (recompilation byte-stable).",
    "Zero unresolved ids across golden fixtures.",
  ],
  reads: ["every slice"], writes: ["evidence_linkset"],
  checks: ["scripts/validate-state.mjs + evidence determinism CI job."],
  retry: "Deterministic: no retry.",
  escalate: "Unresolved ids fail the run loudly — provenance is a hard gate.",
};

C["AG-REPORT"] = {
  purpose: "Assemble the final AuditResult (adjudicated findings, questions, limitations, disclaimer) and render its Markdown form for download/print.",
  det: "deterministic", producer: "report-builder",
  domain: "Reports carry the DISCLAIMER verbatim: assistance, not professional judgment; compliance outputs never imply safety.",
  juris: "Limitations include framework-specific notes (e.g., GG 119 assigns no severity scores [EV-UK-024]).",
  project: "audit_id format AUD-<project>-<stage>; ran_at injected by caller.",
  upstream: ["adjudication.decisions", "evidence.linkset"],
  adrs: [ADR[3]],
  ev: ["Reports cite evidence by id; readers resolve via the registry."],
  inputs: "adjudication.final_findings + all slices",
  outputs: "SharedState.report_bundle + artifact payload_kind=report.bundle",
  invariants: [
    "Identical slices produce byte-identical markdown apart from rendered timestamps.",
    "Disclaimer string equals engine.DISCLAIMER exactly.",
    "Non-authoritative mapping-confidence warnings appear under limitations.",
  ],
  mutations: ["report_bundle"],
  forbidden: ["Omitting unaccepted findings from the record (they appear with their status).", "Softening limitation language."],
  accept: [
    "Report API e2e returns both forms; browser-print PDF path works.",
    "Snapshot test pins disclaimer + limitations sections.",
  ],
  reads: ["all slices"], writes: ["report_bundle"],
  checks: ["Integration flow covers the report leg."],
  retry: "Deterministic: no retry.",
  escalate: "Rendering failure is a plain 500 — no partial reports ship.",
};

C["AG-PERSIST"] = {
  purpose: "Write the completed AuditResult via Repository.saveAudit and emit the storage receipt consumed by listings and replays.",
  det: "deterministic", producer: "repository",
  domain: "Audit Artifacts persist attributable outputs (CONTEXT.md); the receipt is the durable pointer enabling replay (N3 refines key scheme).",
  juris: "Workspace namespacing by hashed key preserves tenant isolation (workspaceHash).",
  project: "Keyed ws:{ws}:audit:{projectId}:{auditId}.",
  upstream: ["report.bundle"],
  adrs: [ADR[1] + " memory/KV adapters swappable by env"],
  ev: ["none"],
  inputs: "report_bundle.json",
  outputs: "SharedState.persistence_ref + artifact payload_kind=persistence.receipt",
  invariants: [
    "Save-then-get round-trip returns an identical AuditResult.",
    "MemoryStore (dev/tests) and KvRestStore (prod) are behaviorally interchangeable.",
  ],
  mutations: ["persistence_ref"],
  forbidden: ["Persisting pre-adjudication drafts as final audits.", "Bypassing the Repository with direct KV writes."],
  accept: [
    "Integration flow test asserts create→list→get equality.",
    "Live smoke proved cross-request persistence on production KV.",
  ],
  reads: ["report_bundle"], writes: ["persistence_ref"],
  checks: ["Integration flow tests cover the persistence legs."],
  retry: "One retry on transient store failure; then error out — never partial state.",
  escalate: "Store outage surfaces via serverError; the client retains an in-memory copy for manual export.",
};

const TITLES = {
  "AG-PROJECT": "Project Intake",
  "AG-STAGE-SELECT": "Stage Resolution & Eligibility",
  "AG-MANIFEST": "Input Manifest",
  "AG-RULES": "Deterministic Rule Evaluation",
  "AG-FINDINGS": "Deterministic Findings Shaping",
  "AG-QUESTIONS": "Audit Question Selection",
  "AG-AI-CANDIDATES": "AI Candidate Generation (bounded)",
  "AG-ADJUDICATION": "Human Adjudication",
  "AG-EVIDENCE-LINKS": "Evidence Linkset Validation",
  "AG-REPORT": "Report Assembly",
  "AG-PERSIST": "Persistence Receipt",
};

checkGraphAlignment(C);

let ok = true;
let written = 0;
for (const nid of Object.keys(C)) {
  const c = C[nid];
  const node = AUDIT_NODES.get(nid);
  const doc = {
    node_id: nid,
    role: node.role,
    purpose: c.purpose,
    determinism_class: c.det,
    producer: c.producer,
    context: {
      domain_context: c.domain,
      jurisdiction_context: c.juris,
      project_context: c.project,
      upstream_artifacts: c.upstream,
      ...edgeEndpoints(nid),
      relevant_decisions: c.adrs,
      evidence_required: c.ev.join(" "),
    },
    contract: {
      inputs: c.inputs,
      outputs: c.outputs,
      invariants: c.invariants,
      allowed_mutations: c.mutations,
      forbidden_actions: c.forbidden,
      acceptance_criteria: c.accept,
    },
    tools: { allowed: ["read policy pack", "read project record"], preferred: ["pure functions over SharedState slices"] },
    state: { reads: c.reads, writes: c.writes },
    verification: { required_checks: c.checks },
    failure: { retry_policy: c.retry, escalation_policy: c.escalate },
  };
  const body = yaml.dump(doc, { lineWidth: 100, noRefs: true });
  const md = `# Node Contract: ${TITLES[nid]}\n\n\`\`\`yaml\n${body}\`\`\`\n${c.post ?? ""}`;
  // inline validation: round-trip must parse and carry mandatory fields
  const back = yaml.load(md.match(/```yaml\n([\s\S]*?)```/)[1]);
  if (back.node_id !== nid || back.role !== node.role || !back.contract?.invariants?.length || !["deterministic","ai-bounded","human"].includes(back.determinism_class)) {
    ok = false; console.error("VALIDATION FAIL", nid);
  }
  fs.writeFileSync(`${DIR}/${nid}.md`, md);
  written++;
}
console.log(ok ? `ALL ${written} CONTRACTS WRITTEN + VALIDATED` : "FAILURES PRESENT");

// README index
const rows = Object.keys(C).map((nid) =>
  `| ${nid} | ${TITLES[nid]} | ${C[nid].det} | ${C[nid].reads.join(", ")} | ${C[nid].writes.join(", ")} | ${C[nid].outputs.split("payload_kind=")[1]?.split(" ")[0] ?? "—"} | ${C[nid].producer} |`
).join("\n");
fs.writeFileSync(`${DIR}/README.md`, `# Audit Graph Node Contracts (N1)

One contract per audit_graph node (see state/graph-state.json). Shared slice
names and the AuditArtifact envelope are defined in [SHARED-STATE.md](SHARED-STATE.md).
Template shape: [TEMPLATE.md](TEMPLATE.md). Determinism classes: deterministic /
ai-bounded / human. Doctrine: deterministic-first; AI proposes bounded candidates,
adjudication disposes; compliance ≠ safety.

| Node | Title | Class | Reads | Writes | Emits | Producer |
|---|---|---|---|---|---|---|
${rows}
`);
console.log("README index written");
