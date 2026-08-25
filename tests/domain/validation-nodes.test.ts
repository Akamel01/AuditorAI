// ADR-0010 validation nodes: AG-HALLUCINATION-CHECK + AG-EVIDENCE-USE-AUDIT.
// Flag-and-show semantics (auto-flagged annotations, never dropped), rate
// stamping into validation_summary, AI-off parity on engine findings, and the
// registry reads/writes contract.
import { describe, expect, it } from "vitest";
import { BATCH_NODES, DESCRIPTORS, NODE_FNS } from "@/domain/pipeline/registry";
import {
  AG_NODE_IDS,
  PAYLOAD_KINDS,
  type SharedState,
} from "@/domain/pipeline/types";
import { DefaultAuditPipeline } from "@/domain/pipeline/pipeline";
import { getEvidence, type EvidenceRecord } from "@/lib/evidence";
import type { CandidateFindingRecord, Finding, Project } from "@/domain/types";

/** Registry records carry an optional verbatim quote; the accessor's stored
 *  objects already include it at runtime — widen locally for fixtures. */
function registryQuote(id: string): string {
  return (getEvidence(id) as EvidenceRecord & { quote?: string | null }).quote ?? "";
}

const T0 = "2026-08-25T00:00:00.000Z";

const EVIDENCE_WITH_QUOTE = "EV-IN-015";

function makeProject(): Project {
  return {
    project_id: "P-VAL",
    workspace_key_hash: "test",
    metadata: {
      name: "Validation fixture",
      description: "",
      scheme_summary: "",
      authority: "",
      location: "",
    },
    stage_selection: { jurisdiction: "INT", native_stage_id: "preliminary_design" },
    input_values: {},
    created_at: T0,
    updated_at: T0,
  };
}

const CTX = { ranAtIso: T0, project: makeProject() };

function baseState(): SharedState {
  return {
    stage_context: {
      jurisdiction: "INT",
      framework_name: "PIARC Road Safety Audit Manual",
      native_stage_id: "preliminary_design",
      native_stage_display_name: "Preliminary Design",
      canonical_stages: ["PRELIMINARY_DESIGN"],
      mapping_confidence: "authoritative",
      odd_status: "in",
      odd_declaration_version: "1.0.0",
    },
    rule_results: { missing_information: [], deterministic_findings: [] },
    candidate_findings: [],
  };
}

let runSeq = 0;
function makeCandidate(
  overrides: Partial<CandidateFindingRecord> & { producer?: string },
): CandidateFindingRecord {
  runSeq += 1;
  return {
    kind: "safety_concern",
    category: "junctions_interchanges",
    location: null,
    road_users: ["pedestrians"],
    scenario: null,
    statement: { text: "Junction type suitability for traffic volume", normative_basis_note: null },
    evidence: [
      { evidence_id: "EV-IN-001", quote: null, use: "context" },
    ],
    assumptions: [],
    rationale: `Inference-labelled reasoning ${runSeq}.`,
    recommendation: "Close the mouth.",
    producer: "safety-reasoning-agent",
    ...overrides,
  };
}

function makeEngineFinding(overrides: Partial<Finding>): Finding {
  return {
    finding_id: "F-TEST-001",
    kind: "compliance_question",
    category: "process_continuity",
    location: null,
    road_users: [],
    scenario: null,
    statement: { text: "Required inputs not evidenced.", normative_basis_note: null },
    evidence: [{ evidence_id: "EV-IN-001", quote: null, use: "defines_requirement" }],
    assumptions: [],
    risk_components: { severity: null, likelihood: null, exposure: null, scale_id: null },
    confidence: { label: "high", basis: "Deterministic rule." },
    rationale: "Derived deterministically.",
    recommendation: null,
    source_trace: [{ origin: "deterministic_rule", rule_id: "R-1" }],
    reviewer_status: "draft",
    reviewer_note: null,
    ...overrides,
  };
}

function runCheck(state: SharedState) {
  return new DefaultAuditPipeline().runNode("AG-HALLUCINATION-CHECK", state, CTX);
}

function runAuditNode(state: SharedState) {
  return new DefaultAuditPipeline().runNode("AG-EVIDENCE-USE-AUDIT", state, CTX);
}

describe("registry contract (ADR-0010)", () => {
  it("registers both nodes immediately after AG-AI-CANDIDATES", () => {
    const order = AG_NODE_IDS.indexOf("AG-AI-CANDIDATES");
    expect(AG_NODE_IDS[order + 1]).toBe("AG-HALLUCINATION-CHECK");
    expect(AG_NODE_IDS[order + 2]).toBe("AG-EVIDENCE-USE-AUDIT");
    expect(BATCH_NODES.indexOf("AG-EVIDENCE-USE-AUDIT")).toBeLessThan(
      BATCH_NODES.indexOf("AG-ADJUDICATION"),
    );
    expect(NODE_FNS["AG-HALLUCINATION-CHECK"]).toBeDefined();
    expect(NODE_FNS["AG-EVIDENCE-USE-AUDIT"]).toBeDefined();
  });

  it("declares deterministic descriptors with closed-set payloads", () => {
    for (const id of ["AG-HALLUCINATION-CHECK", "AG-EVIDENCE-USE-AUDIT"] as const) {
      const d = DESCRIPTORS.find((x) => x.id === id);
      expect(d, id).toBeDefined();
      expect(d!.node_class).toBe("deterministic");
      expect(PAYLOAD_KINDS).toContain(d!.emits);
      expect(d!.executed_in_batch).toBe(true);
    }
    const hall = DESCRIPTORS.find((x) => x.id === "AG-HALLUCINATION-CHECK")!;
    expect(hall.writes).toContain("candidate_findings");
    expect(hall.writes).toContain("rule_results");
    expect(hall.writes).toContain("validation_summary");
    const aud = DESCRIPTORS.find((x) => x.id === "AG-EVIDENCE-USE-AUDIT")!;
    expect(aud.reads).toContain("rule_results");
    expect(aud.depends_on).toContain("AG-HALLUCINATION-CHECK");
  });
});

describe("AG-HALLUCINATION-CHECK on candidates", () => {
  it("flags an unknown evidence_id and keeps the candidate visible", () => {
    const candidate = makeCandidate({
      evidence: [{ evidence_id: "EV-NOPE-404", quote: null, use: "context" }],
    });
    const res = runCheck({ ...baseState(), candidate_findings: [candidate] });
    const out = res.patch.candidate_findings![0];
    expect(out.validation?.status).toBe("auto-flagged");
    expect(out.validation?.reasons).toContain("unknown-evidence-id:EV-NOPE-404");
    expect(out.evidence).toEqual(candidate.evidence);
    expect(res.patch.candidate_findings).toHaveLength(1);
  });

  it("flags a quote that does not match the registry record", () => {
    const candidate = makeCandidate({
      evidence: [
        { evidence_id: EVIDENCE_WITH_QUOTE, quote: "entirely different words", use: "supports_concern" },
      ],
      statement: { text: "Junction suitability traffic volume", normative_basis_note: null },
    });
    const res = runCheck({ ...baseState(), candidate_findings: [candidate] });
    expect(res.patch.candidate_findings![0].validation?.reasons).toContain(
      `quote-mismatch:${EVIDENCE_WITH_QUOTE}`,
    );
  });

  it("matches quotes under whitespace normalization", () => {
    const real = registryQuote(EVIDENCE_WITH_QUOTE);
    const candidate = makeCandidate({
      evidence: [
        { evidence_id: EVIDENCE_WITH_QUOTE, quote: `  ${real.replace(" ", "   \n ")}`, use: "context" },
      ],
    });
    const res = runCheck({ ...baseState(), candidate_findings: [candidate] });
    // Clean population ⇒ nothing annotated, nothing rewritten.
    expect(res.patch.candidate_findings).toBeUndefined();
    expect(res.patch.validation_summary).toEqual({ checked: 1, flagged: 0, rate: 0 });
  });

  it("flags categories and road users outside the pack vocabulary", () => {
    const candidate = makeCandidate({
      category: "made_up_category",
      road_users: ["kangaroos"],
    });
    const res = runCheck({ ...baseState(), candidate_findings: [candidate] });
    const reasons = res.patch.candidate_findings![0].validation?.reasons ?? [];
    expect(reasons).toContain("vocabulary-violation:category:made_up_category");
    expect(reasons).toContain("vocabulary-violation:road_user:kangaroos");
  });

  it("leaves clean candidates unannotated and stamps the rate", () => {
    const clean = makeCandidate({});
    const bad = makeCandidate({
      evidence: [{ evidence_id: "EV-NOPE-404", quote: null, use: "context" }],
    });
    const res = runCheck({ ...baseState(), candidate_findings: [clean, bad] });
    expect(res.patch.candidate_findings![0].validation).toBeUndefined();
    expect(res.patch.candidate_findings![1].validation?.status).toBe("auto-flagged");
    expect(res.patch.validation_summary).toEqual({ checked: 2, flagged: 1, rate: 0.5 });
    expect(res.artifacts[0]?.payload).toEqual({ checked: 2, flagged: 1, rate: 0.5 });
  });

  it("writes only declared slices", () => {
    const res = runCheck(baseState());
    expect(Object.keys(res.patch).every((k) =>
      ["candidate_findings", "rule_results", "validation_summary"].includes(k),
    )).toBe(true);
  });
});

describe("AG-EVIDENCE-USE-AUDIT", () => {
  it("flags a normative claim with no citations", () => {
    const candidate = makeCandidate({ evidence: [] });
    const res = runAuditNode({ ...baseState(), candidate_findings: [candidate] });
    expect(res.patch.candidate_findings![0].validation?.reasons).toContain("missing-citation");
  });

  it("enforces the producer field on candidates", () => {
    const bad = makeCandidate({ producer: "skynet" });
    const absent = makeCandidate({});
    delete (absent as unknown as Record<string, unknown>).producer;
    const res = runAuditNode({
      ...baseState(),
      candidate_findings: [bad, absent],
    });
    expect(res.patch.candidate_findings![0].validation?.reasons).toContain("invalid-producer:skynet");
    expect(res.patch.candidate_findings![1].validation?.reasons).toContain("missing-producer");
  });

  it("enforces source_trace on findings per the finding schema", () => {
    const f1 = makeEngineFinding({ finding_id: "F-1", source_trace: [] });
    const f2 = makeEngineFinding({
      finding_id: "F-2",
      source_trace: [{ origin: "vibes" } as unknown as Finding["source_trace"][number]],
    });
    const res = runAuditNode({
      ...baseState(),
      candidate_findings: null,
      rule_results: { missing_information: [], deterministic_findings: [f1, f2] },
    });
    const out = res.patch.rule_results!.deterministic_findings;
    expect(out[0].validation?.reasons).toContain("missing-source-trace");
    expect(out[1].validation?.reasons).toContain("invalid-source-trace-origin:vibes");
  });

  it("checks supports_concern direction via salient token overlap", () => {
    const unrelated = makeCandidate({
      statement: { text: "Surface drainage gradients ponding", normative_basis_note: null },
      evidence: [
        { evidence_id: EVIDENCE_WITH_QUOTE, quote: registryQuote(EVIDENCE_WITH_QUOTE), use: "supports_concern" },
      ],
    });
    const related = makeCandidate({
      statement: { text: "Junction type unsuitable for the traffic volume", normative_basis_note: null },
      evidence: [
        { evidence_id: EVIDENCE_WITH_QUOTE, quote: registryQuote(EVIDENCE_WITH_QUOTE), use: "supports_concern" },
      ],
    });
    const res = runAuditNode({
      ...baseState(),
      candidate_findings: [unrelated, related],
    });
    expect(res.patch.candidate_findings![0].validation?.reasons).toContain(
      `unverifiable-relation:${EVIDENCE_WITH_QUOTE}`,
    );
    expect(res.patch.candidate_findings![1].validation).toBeUndefined();
  });
});

describe("AI-off parity", () => {
  it("audits engine findings under the same rules when candidates are null", () => {
    const flagged = makeEngineFinding({
      finding_id: "F-BAD",
      evidence: [{ evidence_id: "EV-NOPE-404", quote: null, use: "defines_requirement" }],
    });
    const clean = makeEngineFinding({ finding_id: "F-OK" });
    const state: SharedState = {
      ...baseState(),
      candidate_findings: null,
      rule_results: { missing_information: [], deterministic_findings: [clean, flagged] },
    };
    const res = runCheck(state);
    const out = res.patch.rule_results!.deterministic_findings;
    expect(out[0].validation).toBeUndefined();
    expect(out[1].validation?.reasons).toContain("unknown-evidence-id:EV-NOPE-404");
    expect(res.patch.validation_summary).toEqual({ checked: 2, flagged: 1, rate: 0.5 });

    const auditRes = runAuditNode({ ...state, ...res.patch });
    const merged = { ...state, ...res.patch, ...auditRes.patch };
    const byId = new Map(
      (merged.rule_results!.deterministic_findings ?? []).map((f) => [f.finding_id, f]),
    );
    // The audit node adds no further flags beyond the hallucination check's.
    expect(byId.get("F-OK")!.validation).toBeUndefined();
    expect(byId.get("F-BAD")!.validation?.reasons).toEqual([
      "unknown-evidence-id:EV-NOPE-404",
    ]);
    expect(auditRes.artifacts[0]?.payload_kind).toBe("audit.evidence-use");
    expect(auditRes.artifacts[0]?.payload).toEqual({ checked: 2, flagged: 0 });
  });
});
