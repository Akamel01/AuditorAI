// Candidate review over the real API surface: promotions persist on the
// stored draft, wording violations are rejected loudly, and issuance over
// unreviewed candidates appends the loud limitation to the snapshot only.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PATCH as patchAudit } from "@/app/api/projects/[projectId]/audits/[auditId]/route";
import { POST as postIssue } from "@/app/api/projects/[projectId]/audits/[auditId]/issues/route";
import { MemoryStore, Repository, setDataStoreForTests, workspaceHash } from "@/lib/persistence";
import type { AuditResult } from "@/domain/types";

const T0 = "2026-08-23T00:00:00.000Z";
const KEY = "candidate-e2e-key-00000001";
const H = { "x-workspace-key": KEY, "content-type": "application/json" };
const WS = workspaceHash(KEY);

function req(method: string, body?: unknown) {
  return new Request(`http://local/api/projects/P-1/audits/AUD-P-1-S1`, {
    method,
    headers: H,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function draftWithCandidates(): AuditResult {
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
    odd_declaration_version: "1.0.1",
    odd_status: "in",
    odd_stamp: null,
    odd_floor_satisfied: null,
    disclaimer: "d",
    candidate_findings: [
      {
        kind: "safety_concern",
        category: "visibility",
        location: null,
        road_users: ["cyclists"],
        scenario: null,
        statement: { text: "sight lines restricted", normative_basis_note: null },
        evidence: [],
        assumptions: [],
        rationale: "",
        recommendation: null,
        producer: "safety-reasoning-agent",
      },
      {
        kind: "compliance_question",
        category: "markings",
        location: null,
        road_users: [],
        scenario: null,
        statement: { text: "unverified marking spec", normative_basis_note: null },
        evidence: [],
        assumptions: [],
        rationale: "",
        recommendation: null,
        producer: "safety-reasoning-agent",
      },
    ],
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

async function seed() {
  await repo.saveAudit(WS, draftWithCandidates());
}

function params() {
  return { params: Promise.resolve({ projectId: "P-1", auditId: "AUD-P-1-S1" }) };
}

describe("PATCH /audits/[auditId] candidate_promotions", () => {
  it("promotes with edits; stored draft gains F-AI finding and loses the entry", async () => {
    await seed();
    const res = await patchAudit(
      req("PATCH", {
        candidate_promotions: [
          {
            index: 0,
            action: "accept_with_edits",
            edited_recommendation: "Extend the visibility splay before opening.",
            reviewer_note: "confirmed on site",
          },
        ],
      }),
      params(),
    );
    expect(res.status).toBe(200);
    const { audit } = (await res.json()) as { audit: AuditResult };
    expect(audit.findings).toHaveLength(1);
    expect(audit.findings[0].finding_id).toBe("F-AI-001");
    expect(audit.findings[0].reviewer_note).toBe("confirmed on site");
    expect(audit.findings[0].source_trace[0].origin).toBe("ai_candidate");
    expect(audit.candidate_findings).toHaveLength(1);

    const stored = await repo.getAudit(WS, "P-1", "AUD-P-1-S1");
    expect(stored?.findings).toHaveLength(1);
  });

  it("banned wording is rejected loudly without half-applying", async () => {
    await seed();
    const res = await patchAudit(
      req("PATCH", {
        candidate_promotions: [{ index: 0, action: "accept_with_edits", edited_recommendation: "Consider the splay." }],
      }),
      params(),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("banned wording");
    const stored = await repo.getAudit(WS, "P-1", "AUD-P-1-S1");
    expect(stored?.findings).toHaveLength(0);
    expect(stored?.candidate_findings).toHaveLength(2);
  });

  it("unknown index fails naming the index", async () => {
    await seed();
    const res = await patchAudit(
      req("PATCH", { candidate_promotions: [{ index: 7, action: "accept" }] }),
      params(),
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("unknown candidate index 7");
  });
});

describe("POST /audits/[auditId]/issues over unreviewed candidates", () => {
  it("freezes loudly: limitation lands in the issue, never in the draft", async () => {
    await seed();
    const res = await postIssue(req("POST"), params());
    expect(res.status).toBe(201);
    const { issue } = (await res.json()) as { issue: { revision: number; result: AuditResult } };
    expect(issue.revision).toBe(1);
    expect(issue.result.limitations.some((l) => l.startsWith("2 AI-generated candidate findings were not reviewed"))).toBe(true);
    // Frozen snapshot excludes pending candidates themselves (never report members).
    expect(issue.result.candidate_findings).toBeUndefined();

    const draft = await repo.getAudit(WS, "P-1", "AUD-P-1-S1");
    expect(draft?.limitations).toHaveLength(0);
    expect(draft?.candidate_findings).toHaveLength(2);
  });

  it("rejecting everything then issuing produces no candidate limitation", async () => {
    await seed();
    await patchAudit(
      req("PATCH", {
        candidate_promotions: [
          { index: 0, action: "reject" },
          { index: 1, action: "reject" },
        ],
      }),
      params(),
    );
    const res = await postIssue(req("POST"), params());
    const { issue } = (await res.json()) as { issue: { result: AuditResult } };
    expect(issue.result.limitations).toHaveLength(0);
  });
});
