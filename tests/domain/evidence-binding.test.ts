// G-11 evidence-binding rule (pure domain): the gate that decides whether a
// draft's report content binds to evidence that resolves.
// The registry lookup is the real one (src/lib/evidence.ts reads the compiled
// state/evidence-registry.json); the file is only ever read, never mutated.
import { describe, expect, it } from "vitest";
import { evaluateEvidenceBinding } from "@/domain/evidence-binding";
import type {
  AuditResult,
  CandidateFindingRecord,
  Finding,
  FindingEvidence,
} from "@/domain/types";

/** A real, resolvable registry id. */
const RESOLVED_ID = "EV-IN-001";
/** Deliberately unresolvable. */
const UNRESOLVED_ID = "E-9-not-in-registry";

function finding(id: string, evidence: FindingEvidence[] = [], validation?: Finding["validation"]): Finding {
  return {
    finding_id: id,
    kind: "safety_concern",
    category: "geometry",
    location: null,
    road_users: ["cyclists"],
    scenario: null,
    statement: { text: "finding text", normative_basis_note: null },
    evidence,
    assumptions: [],
    risk_components: { severity: null, likelihood: null, exposure: null, scale_id: null },
    confidence: { label: "high", basis: "deterministic" },
    rationale: "",
    recommendation: null,
    source_trace: [],
    reviewer_status: "draft",
    reviewer_note: null,
    ...(validation ? { validation } : {}),
  };
}

function result(findings: Finding[], candidate_findings?: CandidateFindingRecord[]): AuditResult {
  return {
    audit_id: "AUD-P-1-S1",
    project_id: "P-1",
    jurisdiction: "UK",
    framework_name: "DMRB GG 119",
    native_stage_id: "uk:S1",
    native_stage_display_name: "Stage 1",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    mapping_confidence: "authoritative",
    ran_at: "2026-08-23T12:00:00.000Z",
    input_manifest: [],
    findings,
    missing_information: [],
    audit_questions: [],
    limitations: [],
    odd_declaration_version: "1.0.1",
    odd_status: "in",
    odd_stamp: null,
    odd_floor_satisfied: null,
    disclaimer: "d",
    ...(candidate_findings ? { candidate_findings } : {}),
  };
}

describe("evaluateEvidenceBinding (G-11)", () => {
  it("flags a finding citing an evidence id that does not resolve", () => {
    const violations = evaluateEvidenceBinding(
      result([
        finding("F-1", [{ evidence_id: UNRESOLVED_ID, quote: null, use: "context" }]),
      ]),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe("unresolved-evidence-id");
    expect(violations[0].finding_id).toBe("F-1");
    expect(violations[0].detail).toBe(UNRESOLVED_ID);
  });

  it("flags an auto-flagged finding and carries its annotation reasons in the detail", () => {
    const violations = evaluateEvidenceBinding(
      result([
        finding("F-2", [], {
          status: "auto-flagged",
          reasons: ["unknown-evidence-id:E-9"],
        }),
      ]),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe("auto-flagged-hallucination");
    expect(violations[0].finding_id).toBe("F-2");
    expect(violations[0].detail).toBe("unknown-evidence-id:E-9");
  });

  it("reports one violation per finding per kind, in findings order", () => {
    const violations = evaluateEvidenceBinding(
      result([
        finding("F-3", [
          { evidence_id: UNRESOLVED_ID, quote: null, use: "context" },
          { evidence_id: "E-10-not-in-registry", quote: null, use: "context" },
        ], { status: "auto-flagged", reasons: ["unknown-evidence-id:E-9"] }),
      ]),
    );
    expect(violations.map((v) => v.kind)).toEqual([
      "unresolved-evidence-id",
      "auto-flagged-hallucination",
    ]);
  });

  it("reports nothing for a clean finding", () => {
    const violations = evaluateEvidenceBinding(
      result([
        finding("F-4", [{ evidence_id: RESOLVED_ID, quote: null, use: "context" }]),
      ]),
    );
    expect(violations).toEqual([]);
  });

  it("never examines pending candidates (ADR-0006)", () => {
    const flaggedCandidate: CandidateFindingRecord = {
      kind: "safety_concern",
      category: "visibility",
      location: null,
      road_users: ["cyclists"],
      scenario: null,
      statement: { text: "candidate text", normative_basis_note: null },
      evidence: [{ evidence_id: UNRESOLVED_ID, quote: null, use: "context" }],
      assumptions: [],
      rationale: "",
      recommendation: null,
      producer: "safety-reasoning-agent",
      validation: { status: "auto-flagged", reasons: ["unknown-evidence-id:E-9"] },
    };
    const violations = evaluateEvidenceBinding(result([], [flaggedCandidate]));
    expect(violations).toEqual([]);
  });
});
