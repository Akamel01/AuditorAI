// ADR-0006 promotion semantics (pure domain): candidate → Finding minting,
// wording-gate parity with deterministic findings, index-stable batch
// application, purity, and the loud issuance limitation.
import { describe, expect, it } from "vitest";
import type { AuditResult, CandidateFindingRecord } from "@/domain/types";
import {
  applyCandidatePromotions,
  promoteCandidate,
  unreviewedCandidateLimitation,
} from "@/domain/candidate-review";

const T0 = "2026-08-23T00:00:00.000Z";

function candidate(over: Partial<CandidateFindingRecord> = {}): CandidateFindingRecord {
  return {
    kind: "safety_concern",
    category: "visibility",
    location: "junction",
    road_users: ["cyclists"],
    scenario: "conflicting left turn",
    statement: { text: "sight lines restricted", normative_basis_note: null },
    evidence: [{ evidence_id: "EV-UK-002", quote: null, use: "supports_concern" }],
    assumptions: [],
    rationale: "derived from drawings",
    recommendation: "Extend the visibility splay to 2x2x120.",
    producer: "safety-reasoning-agent",
    ...over,
  };
}

function draft(candidates: CandidateFindingRecord[]): AuditResult {
  return {
    audit_id: "AUD-P-1-S1",
    project_id: "P-1",
    jurisdiction: "UK",
    framework_name: "DMRB GG 119",
    native_stage_id: "uk:S1",
    native_stage_display_name: "Stage 1",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    mapping_confidence: "authoritative",
    ran_at: T0,
    input_manifest: [],
    findings: [],
    missing_information: [],
    audit_questions: [],
    limitations: [],
    disclaimer: "d",
    candidate_findings: candidates,
  };
}

describe("promoteCandidate", () => {
  it("mints a sequential F-AI id with explicit provenance and unscored risk", () => {
    const out = promoteCandidate(candidate(), 7);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const f = out.finding;
    expect(f.finding_id).toBe("F-AI-007");
    expect(f.source_trace).toEqual([
      { origin: "ai_candidate", producer: "safety-reasoning-agent" },
    ]);
    expect(f.risk_components).toEqual({ severity: null, likelihood: null, exposure: null, scale_id: null });
    expect(f.confidence.label).toBe("low");
    expect(f.confidence.basis).toMatch(/AI-generated/);
    expect(f.reviewer_status).toBe("accepted");
    // Verbatim copy of candidate substance:
    expect(f.statement.text).toBe("sight lines restricted");
    expect(f.evidence).toEqual([{ evidence_id: "EV-UK-002", quote: null, use: "supports_concern" }]);
    expect(f.recommendation).toBe("Extend the visibility splay to 2x2x120.");
  });

  it("edited statements or recommendations mark accepted_with_edits and pass the wording gate", () => {
    const ok = promoteCandidate(candidate(), 1, { edited_statement: "revised text" });
    expect(ok.ok && ok.finding.reviewer_status).toBe("accepted_with_edits");

    const rec = promoteCandidate(candidate(), 1, {
      edited_recommendation: "Install the visibility splay before opening.",
    });
    expect(rec.ok && rec.finding.recommendation).toBe("Install the visibility splay before opening.");
    expect(rec.ok && rec.finding.reviewer_status).toBe("accepted_with_edits");
  });

  it("banned wording blocks promotion with the violations named", () => {
    const out = promoteCandidate(candidate(), 1, {
      edited_recommendation: "Consider reviewing the splay.",
    });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.error).toContain("banned wording");
    expect(out.error).toContain("consider");
  });
});

describe("applyCandidatePromotions", () => {
  const three = [candidate(), candidate({ category: "crossings" }), candidate({ category: "markings" })];

  it("accept promotes into findings and removes from pending", () => {
    const out = applyCandidatePromotions(draft(three), [{ index: 0, action: "accept" }]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.findings.map((f) => f.finding_id)).toEqual(["F-AI-001"]);
    expect(out.value.candidate_findings).toHaveLength(2);
    expect(out.value.candidate_findings![0].category).toBe("crossings");
  });

  it("reject drops without minting; last pending removal clears the field entirely", () => {
    const one = applyCandidatePromotions(draft([candidate()]), [
      { index: 0, action: "reject" },
    ]);
    expect(one.ok && one.value.candidate_findings).toBeUndefined();
    expect(one.ok && one.value.findings).toHaveLength(0);
  });

  it("batch promotions are index-stable: targets never shift under each other", () => {
    const out = applyCandidatePromotions(draft(three), [
      { index: 0, action: "accept" },
      { index: 2, action: "reject" },
    ]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // Old index 2 (markings) rejected despite splicing at index 0 first.
    expect(out.value.candidate_findings!.map((c) => c.category)).toEqual(["crossings"]);
    expect(out.value.findings[0].category).toBe("visibility");
  });

  it("promotions accumulate across calls with monotonic ids", () => {
    let d = draft(three);
    const first = applyCandidatePromotions(d, [{ index: 0, action: "accept" }]);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    d = first.value;
    const second = applyCandidatePromotions(d, [{ index: 0, action: "accept_with_edits", edited_recommendation: "Widen the splay to 2x2x120." }]);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.findings.map((f) => f.finding_id)).toEqual(["F-AI-001", "F-AI-002"]);
    expect(second.value.findings[1].reviewer_status).toBe("accepted_with_edits");
  });

  it.each([
    [{ index: 9, action: "accept" } as const, "unknown candidate index 9"],
    [{ index: -1, action: "reject" } as const, "unknown candidate index -1"],
  ])("bad promotion %j fails: %s", (promo, error) => {
    expect(applyCandidatePromotions(draft(three), [promo])).toEqual({ ok: false, error });
  });

  it("never mutates the input draft (purity)", () => {
    const original = draft(three);
    const snapshot = JSON.parse(JSON.stringify(original));
    applyCandidatePromotions(original, [
      { index: 0, action: "accept_with_edits", edited_recommendation: "Do X before Y." },
    ]);
    expect(JSON.parse(JSON.stringify(original))).toEqual(snapshot);
  });
});

describe("unreviewedCandidateLimitation", () => {
  it("names the count and is honest about reflection", () => {
    expect(unreviewedCandidateLimitation(1)).toMatch(/^1 AI-generated candidate finding was not reviewed/);
    expect(unreviewedCandidateLimitation(3)).toMatch(/^3 AI-generated candidate findings were not reviewed/);
  });
});
