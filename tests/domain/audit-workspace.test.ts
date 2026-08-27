// C7 audit-workspace: injected recording api adapter verifies PATCH payload
// shapes and index-stable batching. No DOM mount — pure domain contract
// tests. Preserves buildFindingUpdate and promoteCandidate semantics verbatim.
import { describe, expect, it } from "vitest";
import {
  buildPosture,
  buildPromotion,
  issue,
  load,
  promote,
  promoteOne,
  saveFinding,
  setQuestionAddressed,
} from "@/domain/audit-workspace";
import { CONSENT_VERSION, DEFAULT_AUDITOR_PSEUDONYM } from "@/domain/outcome-contracts";
import type { AuditIssue, AuditResult, CandidateFindingRecord } from "@/domain/types";

// ── recording adapter ──────────────────────────────────────────────────
type Call = { path: string; init?: { method?: string; json?: unknown } };
function recordingAdapter(responses: Map<string, unknown>) {
  const calls: Call[] = [];
  const api = async <T>(path: string, init?: { method?: string; json?: unknown }): Promise<T> => {
    calls.push({ path, init });
    const key = `${init?.method ?? "GET"} ${path}`;
    const fallback = `GET ${path}`;
    const res = (responses.get(key) ?? responses.get(fallback)) as T;
    if (res === undefined) throw new Error(`no stub for ${key}`);
    return res;
  };
  return { api: api as typeof api, calls };
}

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
    rationale: "derived",
    recommendation: "Extend the splay to 2x2x120.",
    producer: "safety-reasoning-agent",
    ...over,
  };
}

function auditFixture(): AuditResult {
  return {
    audit_id: "AUD-P-1-S1",
    project_id: "P-1",
    jurisdiction: "UK",
    framework_name: "DMRB GG 119",
    native_stage_id: "uk:S1",
    native_stage_display_name: "Stage 1",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    mapping_confidence: "authoritative",
    ran_at: "2026-08-23T00:00:00.000Z",
    input_manifest: [],
    findings: [],
    missing_information: [],
    audit_questions: [],
    limitations: [],
    odd_declaration_version: "1.0.1",
    odd_status: "in",
    odd_stamp: null,
    odd_floor_satisfied: null,
    disclaimer: "d",
  };
}

describe("audit-workspace: load", () => {
  it("fetches audit and issues in parallel and returns both", async () => {
    const audit = auditFixture();
    const issues: AuditIssue[] = [{ revision: 1, issued_at: "2026-08-23T00:00:00.000Z", issued_by: "auditor", result: audit }];
    const responses = new Map<string, unknown>([
      ["GET /api/projects/P-1/audits/AUD-1", { audit }],
      ["GET /api/projects/P-1/audits/AUD-1/issues", { issues }],
    ]);
    const { api, calls } = recordingAdapter(responses);
    const res = await load("P-1", "AUD-1", api);
    expect(res.audit).toEqual(audit);
    expect(res.issues).toEqual(issues);
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.path).sort()).toEqual([
      "/api/projects/P-1/audits/AUD-1",
      "/api/projects/P-1/audits/AUD-1/issues",
    ]);
  });
});

describe("audit-workspace: saveFinding", () => {
  it("PATCHes finding_updates via buildFindingUpdate — status present when given, blank text as null", async () => {
    const audit = auditFixture();
    const responses = new Map<string, unknown>([["PATCH /api/projects/P-1/audits/AUD-1", { audit }]]);
    const { api, calls } = recordingAdapter(responses);
    await saveFinding(
      { projectId: "P-1", auditId: "AUD-1", findingId: "F-1", recommendation: "R", reviewerNote: "n", reviewerStatus: "accepted" },
      api,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      path: "/api/projects/P-1/audits/AUD-1",
      init: { method: "PATCH", json: { finding_updates: [{ finding_id: "F-1", reviewer_status: "accepted", recommendation: "R", reviewer_note: "n" }] } },
    });
  });

  it("omits reviewer_status key when no status action (save edits) — blank strings become null", async () => {
    const audit = auditFixture();
    const responses = new Map<string, unknown>([["PATCH /api/projects/P-1/audits/AUD-1", { audit }]]);
    const { api, calls } = recordingAdapter(responses);
    await saveFinding(
      { projectId: "P-1", auditId: "AUD-1", findingId: "F-1", recommendation: "", reviewerNote: "" },
      api,
    );
    const payload = (calls[0].init?.json as { finding_updates: Record<string, unknown>[] }).finding_updates[0];
    expect(payload).toEqual({ finding_id: "F-1", recommendation: null, reviewer_note: null });
    expect(Object.prototype.hasOwnProperty.call(payload, "reviewer_status")).toBe(false);
  });

  it("whitespace-only text is preserved verbatim, not nulled (buildFindingUpdate contract)", async () => {
    const audit = auditFixture();
    const responses = new Map<string, unknown>([["PATCH /api/projects/P-1/audits/AUD-1", { audit }]]);
    const { api, calls } = recordingAdapter(responses);
    await saveFinding(
      { projectId: "P-1", auditId: "AUD-1", findingId: "F-1", recommendation: "  ", reviewerNote: "\t" },
      api,
    );
    const payload = (calls[0].init?.json as { finding_updates: Record<string, unknown>[] }).finding_updates[0];
    expect(payload.recommendation).toBe("  ");
    expect(payload.reviewer_note).toBe("\t");
  });

  it("returns the patched audit result", async () => {
    const patched = { ...auditFixture(), audit_id: "AUD-PATCHED" };
    const responses = new Map<string, unknown>([["PATCH /api/projects/P-1/audits/AUD-1", { audit: patched }]]);
    const { api } = recordingAdapter(responses);
    const res = await saveFinding({ projectId: "P-1", auditId: "AUD-1", findingId: "F-1", recommendation: "R", reviewerNote: "n" }, api);
    expect(res.audit_id).toBe("AUD-PATCHED");
  });
});

describe("audit-workspace: setQuestionAddressed", () => {
  it("PATCHes question_marked with the exact toggled entry", async () => {
    const audit = auditFixture();
    const responses = new Map<string, unknown>([["PATCH /api/projects/P-1/audits/AUD-1", { audit }]]);
    const { api, calls } = recordingAdapter(responses);
    await setQuestionAddressed({ projectId: "P-1", auditId: "AUD-1", questionId: "Q-1", addressed: true }, api);
    expect(calls[0]).toEqual({
      path: "/api/projects/P-1/audits/AUD-1",
      init: { method: "PATCH", json: { question_marked: [{ question_id: "Q-1", addressed: true }] } },
    });
  });
});

describe("audit-workspace: buildPosture", () => {
  it("logged-in yields versioned consent; declined yields {declined:true}", () => {
    expect(buildPosture(true, "auditor-z9")).toEqual({ consent: { version: CONSENT_VERSION }, auditor_pseudonym: "auditor-z9" });
    expect(buildPosture(false, "auditor-z9")).toEqual({ consent: { declined: true }, auditor_pseudonym: "auditor-z9" });
  });
  it("blank pseudonym falls back to DEFAULT_AUDITOR_PSEUDONYM and trims", () => {
    expect(buildPosture(true, "  ")).toEqual({ consent: { version: CONSENT_VERSION }, auditor_pseudonym: DEFAULT_AUDITOR_PSEUDONYM });
    expect(buildPosture(true, "  auditor-z9  ").auditor_pseudonym).toBe("auditor-z9");
  });
});

describe("audit-workspace: buildPromotion (diff semantics mirror promoteCandidate)", () => {
  const orig = candidate();

  it("accept carries no edited fields", () => {
    const p = buildPromotion(0, "accept", orig, { statementText: orig.statement.text, category: orig.category, recommendation: orig.recommendation ?? "", evidenceIdsText: "EV-UK-002", note: "" });
    expect(p).toEqual({ index: 0, action: "accept" });
  });

  it("reject carries only trimmed reviewer_note when present", () => {
    const p = buildPromotion(2, "reject", orig, { statementText: "ignored", category: "ignored", recommendation: "ignored", evidenceIdsText: "ignored", note: "  confirmed on site  " });
    expect(p).toEqual({ index: 2, action: "reject", reviewer_note: "confirmed on site" });
  });

  it("reject with blank note carries no reviewer_note", () => {
    const p = buildPromotion(0, "reject", orig, { statementText: "", category: "", recommendation: "", evidenceIdsText: "", note: "   " });
    expect(p).toEqual({ index: 0, action: "reject" });
  });

  it("accept_with_edits includes only actual diffs — unchanged values are non-edits", () => {
    // All identical → only reviewer_note diff travels (and here blank)
    const pSame = buildPromotion(0, "accept_with_edits", orig, {
      statementText: orig.statement.text,
      category: orig.category,
      recommendation: orig.recommendation ?? "",
      evidenceIdsText: orig.evidence.map((e) => e.evidence_id).join(", "),
      note: "",
    });
    expect(pSame).toEqual({ index: 0, action: "accept_with_edits" });
  });

  it("accept_with_edits — edited_statement only when trimmed non-empty and changed", () => {
    const p = buildPromotion(0, "accept_with_edits", orig, {
      statementText: "  revised text  ",
      category: orig.category,
      recommendation: orig.recommendation ?? "",
      evidenceIdsText: orig.evidence.map((e) => e.evidence_id).join(", "),
      note: "",
    });
    expect(p.edited_statement).toBe("revised text");
    // Empty string is non-edit
    const pEmpty = buildPromotion(0, "accept_with_edits", orig, {
      statementText: "   ",
      category: orig.category,
      recommendation: orig.recommendation ?? "",
      evidenceIdsText: orig.evidence.map((e) => e.evidence_id).join(", "),
      note: "",
    });
    expect(pEmpty.edited_statement).toBeUndefined();
    // Same as original is non-edit
    const pSameText = buildPromotion(0, "accept_with_edits", orig, {
      statementText: orig.statement.text,
      category: orig.category,
      recommendation: orig.recommendation ?? "",
      evidenceIdsText: orig.evidence.map((e) => e.evidence_id).join(", "),
      note: "",
    });
    expect(pSameText.edited_statement).toBeUndefined();
  });

  it("accept_with_edits — category diff trimmed", () => {
    const p = buildPromotion(0, "accept_with_edits", orig, {
      statementText: orig.statement.text,
      category: "  markings  ",
      recommendation: orig.recommendation ?? "",
      evidenceIdsText: orig.evidence.map((e) => e.evidence_id).join(", "),
      note: "",
    });
    expect(p.edited_category).toBe("markings");
    // Empty category is non-edit
    const pEmpty = buildPromotion(0, "accept_with_edits", orig, {
      statementText: orig.statement.text,
      category: "   ",
      recommendation: orig.recommendation ?? "",
      evidenceIdsText: orig.evidence.map((e) => e.evidence_id).join(", "),
      note: "",
    });
    expect(pEmpty.edited_category).toBeUndefined();
  });

  it("accept_with_edits — recommendation diff respects null-original trimming", () => {
    const cNoRec = candidate({ recommendation: null });
    const p = buildPromotion(0, "accept_with_edits", cNoRec, {
      statementText: cNoRec.statement.text,
      category: cNoRec.category,
      recommendation: "Extend the splay before opening.",
      evidenceIdsText: "",
      note: "",
    });
    expect(p.edited_recommendation).toBe("Extend the splay before opening.");
    // Same trimmed value as candidate (with null) is non-edit
    const pSame = buildPromotion(0, "accept_with_edits", orig, {
      statementText: orig.statement.text,
      category: orig.category,
      recommendation: `  ${orig.recommendation}  `,
      evidenceIdsText: orig.evidence.map((e) => e.evidence_id).join(", "),
      note: "",
    });
    expect(pSame.edited_recommendation).toBeUndefined();
  });

  it("accept_with_edits — evidence ids diff via JSON.stringify identity", () => {
    const cMulti = candidate({ evidence: [{ evidence_id: "EV-UK-002", quote: null, use: "supports_concern" }, { evidence_id: "EV-UK-009", quote: null, use: "supports_concern" }] });
    // Same set joined differently but trimmed equality
    const pSame = buildPromotion(0, "accept_with_edits", cMulti, {
      statementText: cMulti.statement.text,
      category: cMulti.category,
      recommendation: cMulti.recommendation ?? "",
      evidenceIdsText: "EV-UK-002, EV-UK-009",
      note: "",
    });
    expect(pSame.edited_evidence_ids).toBeUndefined();
    // Different order or subset travels
    const pDiff = buildPromotion(0, "accept_with_edits", cMulti, {
      statementText: cMulti.statement.text,
      category: cMulti.category,
      recommendation: cMulti.recommendation ?? "",
      evidenceIdsText: "EV-UK-002",
      note: "",
    });
    expect(pDiff.edited_evidence_ids).toEqual(["EV-UK-002"]);
    // Whitespace trimming and empty filtering
    const pTrim = buildPromotion(0, "accept_with_edits", cMulti, {
      statementText: cMulti.statement.text,
      category: cMulti.category,
      recommendation: cMulti.recommendation ?? "",
      evidenceIdsText: "  EV-UK-002 ,  , EV-UK-009  ",
      note: "",
    });
    expect(pTrim.edited_evidence_ids).toBeUndefined(); // trimmed set equals original
  });

  it("accept_with_edits carries trimmed reviewer_note plus diffs", () => {
    const p = buildPromotion(1, "accept_with_edits", orig, {
      statementText: " revised ",
      category: orig.category,
      recommendation: orig.recommendation ?? "",
      evidenceIdsText: orig.evidence.map((e) => e.evidence_id).join(", "),
      note: "  confirmed  ",
    });
    expect(p).toMatchObject({ index: 1, action: "accept_with_edits", edited_statement: "revised", reviewer_note: "confirmed" });
  });
});

describe("audit-workspace: promote (PATCH payload shapes)", () => {
  it("single promotion PATCH shape carries candidate_promotions + consent + pseudonym", async () => {
    const audit = auditFixture();
    const responses = new Map<string, unknown>([["PATCH /api/projects/P-1/audits/AUD-1", { audit }]]);
    const { api, calls } = recordingAdapter(responses);
    const c = candidate();
    const promo = buildPromotion(0, "accept_with_edits", c, {
      statementText: "revised",
      category: c.category,
      recommendation: "Extend the splay before opening.",
      evidenceIdsText: c.evidence.map((e) => e.evidence_id).join(", "),
      note: "checked",
    });
    const posture = buildPosture(true, "auditor-z9");
    await promoteOne("P-1", "AUD-1", promo, posture, api);
    expect(calls[0].path).toBe("/api/projects/P-1/audits/AUD-1");
    const json = calls[0].init?.json as Record<string, unknown>;
    expect(json.candidate_promotions).toEqual([promo]);
    expect(json.consent).toEqual({ version: CONSENT_VERSION });
    expect(json.auditor_pseudonym).toBe("auditor-z9");
  });

  it("declined consent shape is {declined:true}, pseudonym still travels", async () => {
    const audit = auditFixture();
    const responses = new Map<string, unknown>([["PATCH /api/projects/P-1/audits/AUD-1", { audit }]]);
    const { api, calls } = recordingAdapter(responses);
    const promo = { index: 0, action: "accept" } as const;
    await promote({ projectId: "P-1", auditId: "AUD-1", promotions: [promo], posture: buildPosture(false, "auditor-z9") }, api);
    const json = calls[0].init?.json as Record<string, unknown>;
    expect(json.consent).toEqual({ declined: true });
    expect(json.auditor_pseudonym).toBe("auditor-z9");
  });

  it("index-stable batching: multiple promotions keep caller indexes verbatim in payload (server sorts descending)", async () => {
    const audit = auditFixture();
    const responses = new Map<string, unknown>([["PATCH /api/projects/P-1/audits/AUD-1", { audit }]]);
    const { api, calls } = recordingAdapter(responses);
    const c0 = candidate({ category: "visibility" });
    // Simulate three pending; promote indexes 0 and 2 together — server must handle splice stability,
    // client just ships original indexes without shifting.
    const p0 = buildPromotion(0, "accept", c0, { statementText: c0.statement.text, category: c0.category, recommendation: c0.recommendation ?? "", evidenceIdsText: c0.evidence.map((e) => e.evidence_id).join(", "), note: "" });
    const p2 = { index: 2, action: "reject" as const, reviewer_note: "no" };
    // Also test promote with explicit array ordering [0,2] — wire keeps that order
    await promote({ projectId: "P-1", auditId: "AUD-1", promotions: [p0, p2], posture: buildPosture(true, "auditor-a1") }, api);
    const json = calls[0].init?.json as { candidate_promotions: { index: number }[] };
    expect(json.candidate_promotions.map((p) => p.index)).toEqual([0, 2]);
    // A second call with reverse input order preserves it too
    const { api: api2, calls: calls2 } = recordingAdapter(responses);
    await promote({ projectId: "P-1", auditId: "AUD-1", promotions: [p2, p0], posture: buildPosture(true, "auditor-a1") }, api2);
    expect((calls2[0].init?.json as { candidate_promotions: { index: number }[] }).candidate_promotions.map((p) => p.index)).toEqual([2, 0]);
  });

  it("batch promotions each carry their own edit whitelist — no cross-contamination", async () => {
    const audit = auditFixture();
    const responses = new Map<string, unknown>([["PATCH /api/projects/P-1/audits/AUD-1", { audit }]]);
    const { api, calls } = recordingAdapter(responses);
    const c = candidate();
    const pAccept = buildPromotion(1, "accept", c, { statementText: c.statement.text, category: c.category, recommendation: c.recommendation ?? "", evidenceIdsText: c.evidence.map((e) => e.evidence_id).join(", "), note: "" });
    const pEdit = buildPromotion(0, "accept_with_edits", c, { statementText: "new text", category: c.category, recommendation: c.recommendation ?? "", evidenceIdsText: c.evidence.map((e) => e.evidence_id).join(", "), note: "n" });
    await promote({ projectId: "P-1", auditId: "AUD-1", promotions: [pAccept, pEdit], posture: buildPosture(true, "auditor-a1") }, api);
    const ps = (calls[0].init?.json as { candidate_promotions: Record<string, unknown>[] }).candidate_promotions;
    expect(ps[0]).toEqual({ index: 1, action: "accept" });
    expect(ps[1]).toMatchObject({ index: 0, action: "accept_with_edits", edited_statement: "new text", reviewer_note: "n" });
  });

  it("returns patched audit", async () => {
    const patched = { ...auditFixture(), findings: [{} as never] };
    const responses = new Map<string, unknown>([["PATCH /api/projects/P-1/audits/AUD-1", { audit: patched }]]);
    const { api } = recordingAdapter(responses);
    const res = await promoteOne("P-1", "AUD-1", { index: 0, action: "accept" }, buildPosture(true, "auditor-a1"), api);
    expect(res.findings).toHaveLength(1);
  });
});

describe("audit-workspace: issue", () => {
  it("POSTs to issues path and returns revision", async () => {
    const audit = auditFixture();
    const issueRes = { revision: 2, result: audit };
    const responses = new Map<string, unknown>([["POST /api/projects/P-1/audits/AUD-1/issues", { issue: issueRes }]]);
    const { api, calls } = recordingAdapter(responses);
    const res = await issue("P-1", "AUD-1", api);
    expect(calls[0].path).toBe("/api/projects/P-1/audits/AUD-1/issues");
    expect(calls[0].init?.method).toBe("POST");
    expect(res).toEqual(issueRes);
  });
});
