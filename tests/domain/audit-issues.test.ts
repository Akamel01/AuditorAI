// ADR-0004 issue semantics over the store seam: sequential write-once
// revisions, permanent retention, and full isolation from later draft runs.
// G-11: the evidence-binding gate at issuance, over the real API surface.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as postIssue } from "@/app/api/projects/[projectId]/audits/[auditId]/issues/route";
import { MemoryStore, Repository, setDataStoreForTests, workspaceHash } from "@/lib/persistence";
import type { AuditResult, Finding } from "@/domain/types";

const WS = "wshash";
const NOW = "2026-08-23T12:00:00.000Z";

function draft(
  auditId: string,
  marker: string,
  validation?: Finding["validation"],
): AuditResult {
  return {
    audit_id: auditId,
    project_id: "P-1",
    jurisdiction: "UK",
    framework_name: "DMRB GG 119",
    native_stage_id: "uk:S1",
    native_stage_display_name: "Stage 1",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    mapping_confidence: "authoritative",
    ran_at: NOW,
    input_manifest: [],
    findings: [
      {
        finding_id: `F-${marker}`,
        kind: "safety_concern",
        category: "geometry",
        location: null,
        road_users: ["cyclists"],
        scenario: null,
        statement: { text: marker, normative_basis_note: null },
        evidence: [],
        assumptions: [],
        risk_components: { severity: null, likelihood: null, exposure: null, scale_id: null },
        confidence: { label: "high", basis: "deterministic" },
        rationale: "",
        recommendation: null,
        source_trace: [],
        reviewer_status: "draft",
        reviewer_note: null,
        ...(validation ? { validation } : {}),
      },
    ],
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

let repo: Repository;

beforeEach(() => {
  const store = new MemoryStore();
  setDataStoreForTests(store);
  repo = new Repository(store);
});

afterEach(() => {
  setDataStoreForTests(null);
});

describe("audit issues (ADR-0004)", () => {
  it("issues sequentially numbered revisions per audit line", async () => {
    const i1 = await repo.saveIssue(WS, "P-1", "AUD-P-1-S1", draft("AUD-P-1-S1", "a"), NOW);
    const i2 = await repo.saveIssue(
      WS,
      "P-1",
      "AUD-P-1-S1",
      draft("AUD-P-1-S1", "b"),
      "2026-08-24T00:00:00.000Z",
    );
    expect(i1.revision).toBe(1);
    expect(i2.revision).toBe(2);
    expect(i2.issued_at).toBe("2026-08-24T00:00:00.000Z");
  });

  it("numbers independent audits independently", async () => {
    await repo.saveIssue(WS, "P-1", "AUD-P-1-S1", draft("AUD-P-1-S1", "a"), NOW);
    const other = await repo.saveIssue(WS, "P-1", "AUD-P-1-S2", draft("AUD-P-1-S2", "b"), NOW);
    expect(other.revision).toBe(1);
  });

  it("issued snapshots are frozen: later draft edits never alter them", async () => {
    const frozenDraft = draft("AUD-P-1-S1", "at-issue");
    await repo.saveIssue(WS, "P-1", "AUD-P-1-S1", frozenDraft, NOW);
    await repo.saveAudit(WS, { ...frozenDraft, findings: [] });
    const issues = await repo.listIssues(WS, "P-1", "AUD-P-1-S1");
    expect(issues).toHaveLength(1);
    expect(issues[0].result.findings[0].statement.text).toBe("at-issue");
  });

  it("lists revisions in ascending numeric order (survives rev >= 10)", async () => {
    for (let n = 0; n < 12; n += 1) {
      await repo.saveIssue(WS, "P-1", "AUD-P-1-S1", draft("AUD-P-1-S1", `r${n}`), NOW);
    }
    const issues = await repo.listIssues(WS, "P-1", "AUD-P-1-S1");
    expect(issues.map((i) => i.revision)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(issues[9].result.findings[0].statement.text).toBe("r9");
  });

  it("getIssue resolves a single revision; absent revisions resolve to null", async () => {
    await repo.saveIssue(WS, "P-1", "AUD-P-1-S1", draft("AUD-P-1-S1", "a"), NOW);
    expect((await repo.getIssue(WS, "P-1", "AUD-P-1-S1", 1))?.revision).toBe(1);
    expect(await repo.getIssue(WS, "P-1", "AUD-P-1-S1", 2)).toBeNull();
  });
});

// G-11: evidence binding is enforced AT issuance. A draft whose finding still
// carries the ADR-0010 auto-flag cannot be issued unless a named reviewer
// records an override, and that override is visible in the issued record.
describe("evidence binding at issuance (G-11)", () => {
  const KEY = "g11-workspace-key-0001";
  const WS_RT = workspaceHash(KEY);
  const AUDIT_ID = "AUD-P-1-S1";
  const FLAG: Finding["validation"] = {
    status: "auto-flagged",
    reasons: ["unknown-evidence-id:E-9"],
  };

  function issueRequest(body?: unknown): Request {
    return new Request("http://localhost/api/projects/P-1/audits/AUD-P-1-S1/issues", {
      method: "POST",
      headers: { "x-workspace-key": KEY },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  const ctx = { params: Promise.resolve({ projectId: "P-1", auditId: AUDIT_ID }) };

  it("refuses to issue a draft whose finding is auto-flagged, and writes nothing", async () => {
    await repo.saveAudit(WS_RT, draft(AUDIT_ID, "flagged", FLAG));

    const res = await postIssue(issueRequest(), ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("evidence binding not satisfied");
    expect(body.violations).toEqual([
      { finding_id: "F-flagged", kind: "auto-flagged-hallucination", detail: FLAG!.reasons.join(",") },
    ]);
    expect(await repo.listIssues(WS_RT, "P-1", AUDIT_ID)).toHaveLength(0);
  });

  it("issues when a named reviewer records an override, and shows it in the issued record", async () => {
    await repo.saveAudit(WS_RT, draft(AUDIT_ID, "flagged", FLAG));

    const res = await postIssue(
      issueRequest({
        evidence_override: { auditor_pseudonym: "auditor-a1", note: "checked the source" },
      }),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const override = body.issue.result.evidence_override;
    expect(override.auditor_pseudonym).toBe("auditor-a1");
    expect(override.note).toBe("checked the source");
    expect(override.reasons).toEqual([
      "auto-flagged-hallucination:F-flagged:unknown-evidence-id:E-9",
    ]);
    expect(override.overridden_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // The override is visible on the stored record too, not only in the response.
    const stored = await repo.listIssues(WS_RT, "P-1", AUDIT_ID);
    expect(stored).toHaveLength(1);
    expect(stored[0].result.evidence_override?.auditor_pseudonym).toBe("auditor-a1");
  });

  it("refuses an override that names no reviewer", async () => {
    await repo.saveAudit(WS_RT, draft(AUDIT_ID, "flagged", FLAG));

    const res = await postIssue(
      issueRequest({ evidence_override: { auditor_pseudonym: "   " } }),
      ctx,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(
      "invalid evidence_override.auditor_pseudonym: expected a non-empty string",
    );
    expect(await repo.listIssues(WS_RT, "P-1", AUDIT_ID)).toHaveLength(0);
  });

  it("issues a clean draft unchanged: no override on the record", async () => {
    await repo.saveAudit(WS_RT, draft(AUDIT_ID, "clean"));

    const res = await postIssue(issueRequest(), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.issue.result.evidence_override).toBeUndefined();
    expect(body.issue.result.findings[0].statement.text).toBe("clean");
  });
});
