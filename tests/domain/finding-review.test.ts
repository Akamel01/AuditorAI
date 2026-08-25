// Reviewer adjudication policy (ADR-0003): status action vocabulary excludes
// draft, buildFindingUpdate is the single construction point for a
// finding_updates PATCH entry, and applyFindingUpdates / applyQuestionMarks are
// the pure edit kernels lifted verbatim from the PATCH audit route (backlog
// C3) — every branch below mirrors a route behavior, zero drift.
import { describe, expect, it } from "vitest";
import {
  REVIEWER_STATUS_ACTIONS,
  applyFindingUpdates,
  applyQuestionMarks,
  buildFindingUpdate,
  type FindingUpdateEntry,
} from "@/domain/finding-review";
import type { AuditResult, Finding } from "@/domain/types";

const T0 = "2026-08-23T00:00:00.000Z";
const FID = "F-R-UK-PREVRESP-uk-S2";
const QID = "Q-PREVRESP-1";

function finding(over: Partial<Finding> = {}): Finding {
  return {
    finding_id: FID,
    kind: "compliance_question",
    category: "process",
    location: null,
    road_users: [],
    scenario: null,
    statement: { text: "Stage 1 response not evidenced", normative_basis_note: null },
    evidence: [],
    assumptions: [],
    risk_components: { severity: null, likelihood: null, exposure: null, scale_id: null },
    confidence: { label: "high", basis: "deterministic rule" },
    rationale: "required input missing",
    recommendation: "Obtain the Stage 1 response report.",
    source_trace: [{ origin: "deterministic_rule", rule_id: "UK-PREVRESP" }],
    reviewer_status: "draft",
    reviewer_note: null,
    ...over,
  };
}

function question(): AuditResult["audit_questions"][number] {
  return {
    question_id: QID,
    text: "Were Stage 1 recommendations addressed?",
    topic: "process",
    applies_to_canonical: ["PRELIMINARY_DESIGN"],
    road_users: [],
    source_note: null,
    addressed: false,
  };
}

function draft(): AuditResult {
  return {
    audit_id: "AUD-P-1-S2",
    project_id: "P-1",
    jurisdiction: "UK",
    framework_name: "DMRB GG 119",
    native_stage_id: "uk:S2",
    native_stage_display_name: "Stage 2",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    mapping_confidence: "authoritative",
    ran_at: T0,
    input_manifest: [],
    findings: [finding()],
    missing_information: [],
    audit_questions: [question()],
    limitations: [],
    odd_declaration_version: "1.0.1",
    odd_status: "in",
    odd_stamp: null,
    odd_floor_satisfied: null,
    disclaimer: "d",
  };
}

describe("REVIEWER_STATUS_ACTIONS", () => {
  it("offers exactly the four auditor actions, never draft", () => {
    expect([...REVIEWER_STATUS_ACTIONS]).toEqual([
      "accepted",
      "accepted_with_edits",
      "rejected",
      "escalated",
    ]);
  });
});

describe("buildFindingUpdate", () => {
  const cases: {
    name: string;
    input: Parameters<typeof buildFindingUpdate>[0];
    expected: Record<string, unknown>;
  }[] = [
    {
      name: "status action present → reviewer_status included",
      input: { finding_id: "F-1", reviewer_status: "accepted_with_edits", recommendation: "R", reviewer_note: "n" },
      expected: { finding_id: "F-1", reviewer_status: "accepted_with_edits", recommendation: "R", reviewer_note: "n" },
    },
    {
      name: "no status (save edits) → reviewer_status key absent",
      input: { finding_id: "F-1", recommendation: "R", reviewer_note: "" },
      expected: { finding_id: "F-1", recommendation: "R", reviewer_note: null },
    },
    {
      name: "blank recommendation and note are stored as null",
      input: { finding_id: "F-2", reviewer_status: "rejected", recommendation: "", reviewer_note: "" },
      expected: { finding_id: "F-2", reviewer_status: "rejected", recommendation: null, reviewer_note: null },
    },
    {
      name: "undefined text fields become null",
      input: { finding_id: "F-3" },
      expected: { finding_id: "F-3", recommendation: null, reviewer_note: null },
    },
    {
      name: "whitespace-only text is preserved verbatim, not nulled",
      input: { finding_id: "F-4", recommendation: "  ", reviewer_note: "\t" },
      expected: { finding_id: "F-4", recommendation: "  ", reviewer_note: "\t" },
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(buildFindingUpdate(c.input)).toEqual(c.expected);
    });
  }

  it("emits no reviewer_status key when omitted (server leaves draft untouched)", () => {
    const update = buildFindingUpdate({ finding_id: "F-5" });
    expect(Object.prototype.hasOwnProperty.call(update, "reviewer_status")).toBe(false);
  });
});

describe("applyFindingUpdates — rejections", () => {
  const cases: {
    name: string;
    updates: FindingUpdateEntry[];
    message: string;
  }[] = [
    {
      name: "unknown finding id fails loudly naming it",
      updates: [{ finding_id: "F-GHOST", reviewer_status: "accepted" }],
      message: "unknown finding F-GHOST",
    },
    {
      name: "banned wording rejects the edit naming the single violation",
      updates: [
        { finding_id: FID, recommendation: "Consider reviewing the Stage 1 response report" },
      ],
      message: "recommendation uses banned wording: consider",
    },
    {
      name: "multiple banned words are joined into one message",
      updates: [{ finding_id: FID, recommendation: "You must consider the splay." }],
      message: "recommendation uses banned wording: consider, must",
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(applyFindingUpdates(draft(), c.updates)).toEqual({
        ok: false,
        error: { status: 400, message: c.message },
      });
    });
  }

  it("a valid earlier entry is not half-applied when a later one fails", () => {
    const original = draft();
    const snapshot = JSON.parse(JSON.stringify(original));
    const out = applyFindingUpdates(original, [
      { finding_id: FID, reviewer_status: "accepted" },
      { finding_id: "F-GHOST", recommendation: "Widen the splay by 2 m." },
    ]);
    expect(out.ok).toBe(false);
    expect(JSON.parse(JSON.stringify(original))).toEqual(snapshot);
  });
});

describe("applyFindingUpdates — field application", () => {
  const cases: {
    name: string;
    update: FindingUpdateEntry;
    expected: Record<string, unknown>;
  }[] = [
    {
      name: "reviewer_status transition applies verbatim",
      update: { finding_id: FID, reviewer_status: "accepted_with_edits" },
      expected: { reviewer_status: "accepted_with_edits" },
    },
    {
      name: "clean replacement recommendation passes the gate and lands",
      update: { finding_id: FID, recommendation: "Obtain the Stage 1 report and log agreed actions." },
      expected: { recommendation: "Obtain the Stage 1 report and log agreed actions." },
    },
    {
      name: "null clears the stored recommendation",
      update: { finding_id: FID, recommendation: null },
      expected: { recommendation: null },
    },
    {
      name: "empty-string recommendation stores verbatim without tripping the gate (route parity)",
      update: { finding_id: FID, recommendation: "" },
      expected: { recommendation: "" },
    },
    {
      name: "reviewer_note set",
      update: { finding_id: FID, reviewer_note: "checked against Stage 1 pack" },
      expected: { reviewer_note: "checked against Stage 1 pack" },
    },
    {
      name: "null reviewer_note clears",
      update: { finding_id: FID, reviewer_note: null },
      expected: { reviewer_note: null },
    },
    {
      name: "location set",
      update: { finding_id: FID, location: "chicane 3" },
      expected: { location: "chicane 3" },
    },
    {
      name: "severity lands on risk_components.severity only",
      update: { finding_id: FID, severity: "medium" },
      expected: {
        risk_components: { severity: "medium", likelihood: null, exposure: null, scale_id: null },
      },
    },
    {
      name: "likelihood lands on risk_components.likelihood only",
      update: { finding_id: FID, likelihood: "low" },
      expected: {
        risk_components: { severity: null, likelihood: "low", exposure: null, scale_id: null },
      },
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const out = applyFindingUpdates(draft(), [c.update]);
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      const f = out.value.findings.find((x) => x.finding_id === FID);
      expect(f).toMatchObject(c.expected);
    });
  }

  it("one entry can carry several fields at once", () => {
    const out = applyFindingUpdates(draft(), [
      {
        finding_id: FID,
        reviewer_status: "rejected",
        recommendation: "Record the agreed actions before Stage 3.",
        severity: "high",
      },
    ]);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const f = out.value.findings[0];
    expect(f.reviewer_status).toBe("rejected");
    expect(f.recommendation).toBe("Record the agreed actions before Stage 3.");
    expect(f.risk_components.severity).toBe("high");
    expect(f.risk_components.likelihood).toBeNull();
  });

  it("entries apply across multiple findings in order", () => {
    const d = draft();
    d.findings.push(finding({ finding_id: "F-R-UK-SPEED-uk-S2" }));
    const out = applyFindingUpdates(d, [
      { finding_id: FID, reviewer_status: "accepted" },
      { finding_id: "F-R-UK-SPEED-uk-S2", reviewer_status: "escalated" },
    ]);
    expect(out.ok && out.value.findings.map((f) => f.reviewer_status)).toEqual([
      "accepted",
      "escalated",
    ]);
  });

  it("empty update list yields an equal draft as a fresh object", () => {
    const d = draft();
    const out = applyFindingUpdates(d, []);
    expect(out.ok && out.value).toEqual(d);
    expect(out.ok && out.value !== d).toBe(true);
  });

  it("never mutates the input draft (purity)", () => {
    const original = draft();
    const snapshot = JSON.parse(JSON.stringify(original));
    applyFindingUpdates(original, [
      {
        finding_id: FID,
        reviewer_status: "accepted_with_edits",
        recommendation: "Extend the right-turn lane by 40 m.",
        severity: "medium",
      },
    ]);
    expect(JSON.parse(JSON.stringify(original))).toEqual(snapshot);
  });
});

describe("applyQuestionMarks", () => {
  it("marks a question addressed", () => {
    const out = applyQuestionMarks(draft(), [{ question_id: QID, addressed: true }]);
    expect(out.ok && out.value.audit_questions[0].addressed).toBe(true);
  });

  it("records a question as not addressed (flag-and-show, never removal)", () => {
    const out = applyQuestionMarks(draft(), [{ question_id: QID, addressed: false }]);
    expect(out.ok && out.value.audit_questions[0].addressed).toBe(false);
    expect(out.ok && out.value.audit_questions).toHaveLength(1);
  });

  it("unknown question id fails loudly naming it", () => {
    expect(
      applyQuestionMarks(draft(), [{ question_id: "Q-GHOST", addressed: true }]),
    ).toEqual({
      ok: false,
      error: { status: 400, message: "unknown question Q-GHOST" },
    });
  });

  it("empty mark list yields an equal draft as a fresh object", () => {
    const d = draft();
    const out = applyQuestionMarks(d, []);
    expect(out.ok && out.value).toEqual(d);
    expect(out.ok && out.value !== d).toBe(true);
  });

  it("never mutates the input draft (purity)", () => {
    const original = draft();
    const snapshot = JSON.parse(JSON.stringify(original));
    applyQuestionMarks(original, [{ question_id: QID, addressed: true }]);
    expect(JSON.parse(JSON.stringify(original))).toEqual(snapshot);
  });
});
