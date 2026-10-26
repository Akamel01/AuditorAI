// G-6: the two AUDIT bodies (review PATCH + issuance POST) cross a schema
// trust boundary. Shape errors answer 422; the domain vocabulary (unknown
// ids, banned wording, consent posture, candidate index, reviewer name) keeps
// its 400; and the auth gate still answers 401 BEFORE the body is read.
// Every test uses its own workspace key (>= 16 chars): the rate limiter
// allows 120 requests per key per minute.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PATCH as patchAudit } from "@/app/api/projects/[projectId]/audits/[auditId]/route";
import { POST as postIssue } from "@/app/api/projects/[projectId]/audits/[auditId]/issues/route";
import { MemoryStore, Repository, setDataStoreForTests, workspaceHash } from "@/lib/persistence";
import type { AuditResult } from "@/domain/types";

const AUDIT_ID = "AUD-P-1-S1";
const T0 = "2026-08-23T00:00:00.000Z";

let repo: Repository;
let keySeq = 0;

function newKey(): string {
  keySeq += 1;
  return `body-validation-key-${String(keySeq).padStart(4, "0")}`;
}

/** unbound = the finding cites an evidence id the registry cannot resolve, so
 *  the G-11 evidence-binding rule fires at issuance. */
function baseDraft(unbound = false): AuditResult {
  return {
    audit_id: AUDIT_ID,
    project_id: "P-1",
    jurisdiction: "UK",
    framework_name: "DMRB GG 119",
    native_stage_id: "uk:S1",
    native_stage_display_name: "Stage 1",
    canonical_stages: ["PRELIMINARY_DESIGN"],
    mapping_confidence: "authoritative",
    ran_at: T0,
    input_manifest: [],
    findings: [
      {
        finding_id: "F-1",
        kind: "safety_concern",
        category: "geometry",
        location: null,
        road_users: ["cyclists"],
        scenario: null,
        statement: { text: "sight lines restricted", normative_basis_note: null },
        evidence: unbound
          ? [{ evidence_id: "EV-NOPE", quote: null, use: "context" }]
          : [],
        assumptions: [],
        risk_components: { severity: null, likelihood: null, exposure: null, scale_id: null },
        confidence: { label: "high", basis: "deterministic" },
        rationale: "",
        recommendation: null,
        source_trace: [],
        reviewer_status: "draft",
        reviewer_note: null,
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
    ],
  };
}

async function seed(key: string, unbound = false): Promise<string> {
  const ws = workspaceHash(key);
  await repo.saveAudit(ws, baseDraft(unbound));
  return ws;
}

/** body = the RAW request body: a string is sent verbatim (malformed JSON
 *  included); undefined means no body at all. */
function req(method: string, path: string, key: string | null, body?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key !== null) headers["x-workspace-key"] = key;
  return new Request(`http://local/api/projects/P-1/audits/${AUDIT_ID}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

function patchReq(key: string | null, body?: unknown): Request {
  return req(
    "PATCH",
    "",
    key,
    body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  );
}

function issueReq(key: string | null, body?: unknown): Request {
  return req(
    "POST",
    "/issues",
    key,
    body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  );
}

const ctx = { params: Promise.resolve({ projectId: "P-1", auditId: AUDIT_ID }) };

beforeEach(() => {
  const store = new MemoryStore();
  setDataStoreForTests(store);
  repo = new Repository(store);
});

afterEach(() => {
  setDataStoreForTests(null);
});

describe("PATCH /audits/[auditId] body validation (G-6)", () => {
  it("rejects an off-shape body with 422 naming the offending path", async () => {
    const key = newKey();
    await seed(key);
    const res = await patchAudit(patchReq(key, { finding_updates: "nope" }), ctx);
    expect(res.status).toBe(422);
    const error = ((await res.json()) as { error: string }).error;
    expect(error).toContain("request body failed schema validation");
    expect(error).toContain("/finding_updates");
  });

  it("rejects a reviewer_status outside the schema enum with 422", async () => {
    const key = newKey();
    await seed(key);
    const res = await patchAudit(
      patchReq(key, { finding_updates: [{ finding_id: "F-1", reviewer_status: "bogus" }] }),
      ctx,
    );
    expect(res.status).toBe(422);
    const error = ((await res.json()) as { error: string }).error;
    expect(error).toContain("/finding_updates/0/reviewer_status");
  });

  it("rejects malformed JSON with 422", async () => {
    const key = newKey();
    await seed(key);
    const res = await patchAudit(patchReq(key, "{not json"), ctx);
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toBe("request body is not valid JSON");
  });

  it("answers 401 before the body is read when no workspace key is presented", async () => {
    const res = await patchAudit(patchReq(null, { finding_updates: "nope" }), ctx);
    expect(res.status).toBe(401);
  });

  it("leaves the stored draft unchanged after a rejected body", async () => {
    const key = newKey();
    const ws = await seed(key);
    const res = await patchAudit(patchReq(key, { finding_updates: "nope" }), ctx);
    expect(res.status).toBe(422);
    const stored = await repo.getAudit(ws, "P-1", AUDIT_ID);
    expect(stored?.findings).toHaveLength(1);
    expect(stored?.findings[0].reviewer_status).toBe("draft");
    expect(stored?.candidate_findings).toHaveLength(1);
  });

  it("keeps the domain 400 for a malformed consent posture", async () => {
    const key = newKey();
    await seed(key);
    const res = await patchAudit(
      patchReq(key, {
        candidate_promotions: [{ index: 0, action: "accept" }],
        consent: { nonsense: true },
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("invalid consent");
  });

  it("keeps the domain 400 for an unknown candidate index", async () => {
    const key = newKey();
    await seed(key);
    const res = await patchAudit(
      patchReq(key, { candidate_promotions: [{ index: 7, action: "accept" }] }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("unknown candidate index 7");
  });

  it("keeps the domain 400 for an empty reviewer pseudonym", async () => {
    const key = newKey();
    await seed(key);
    const res = await patchAudit(
      patchReq(key, {
        candidate_promotions: [{ index: 0, action: "accept" }],
        auditor_pseudonym: "   ",
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "invalid auditor_pseudonym: expected a non-empty string",
    );
  });

  it("keeps the domain 400 for an unknown finding id", async () => {
    const key = newKey();
    const ws = await seed(key);
    const res = await patchAudit(
      patchReq(key, {
        finding_updates: [{ finding_id: "F-NOPE", reviewer_status: "accepted" }],
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("unknown finding F-NOPE");
    const stored = await repo.getAudit(ws, "P-1", AUDIT_ID);
    expect(stored?.findings).toHaveLength(1);
    expect(stored?.findings[0].reviewer_status).toBe("draft");
  });

  it("keeps the domain 400 for an unknown question id", async () => {
    const key = newKey();
    const ws = await seed(key);
    const res = await patchAudit(
      patchReq(key, { question_marked: [{ question_id: "Q-NOPE", addressed: true }] }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("unknown question Q-NOPE");
    const stored = await repo.getAudit(ws, "P-1", AUDIT_ID);
    expect(stored?.audit_questions).toHaveLength(0);
  });

  it("keeps the domain 400 for a recommendation with banned wording", async () => {
    const key = newKey();
    const ws = await seed(key);
    const res = await patchAudit(
      patchReq(key, {
        finding_updates: [
          {
            finding_id: "F-1",
            recommendation: "Consider the barrier; the operator must review it.",
          },
        ],
      }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "recommendation uses banned wording: consider, must",
    );
    const stored = await repo.getAudit(ws, "P-1", AUDIT_ID);
    expect(stored?.findings[0].recommendation).toBeNull();
  });

  it("accepts a valid body with 200", async () => {
    const key = newKey();
    const ws = await seed(key);
    const res = await patchAudit(
      patchReq(key, {
        finding_updates: [{ finding_id: "F-1", reviewer_status: "accepted" }],
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    const stored = await repo.getAudit(ws, "P-1", AUDIT_ID);
    expect(stored?.findings[0].reviewer_status).toBe("accepted");
  });
});

describe("POST /audits/[auditId]/issues body validation (G-6)", () => {
  it("rejects an off-shape body with 422 naming the offending path", async () => {
    const key = newKey();
    await seed(key);
    const res = await postIssue(issueReq(key, { evidence_override: 42 }), ctx);
    expect(res.status).toBe(422);
    const error = ((await res.json()) as { error: string }).error;
    expect(error).toContain("request body failed schema validation");
    expect(error).toContain("/evidence_override");
  });

  it("rejects malformed JSON with 422", async () => {
    const key = newKey();
    await seed(key);
    const res = await postIssue(issueReq(key, "{not json"), ctx);
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toBe("request body is not valid JSON");
  });

  it("answers 401 before the body is read when no workspace key is presented", async () => {
    const res = await postIssue(issueReq(null, { evidence_override: 42 }), ctx);
    expect(res.status).toBe(401);
  });

  it("leaves the issue lineage unchanged after a rejected body", async () => {
    const key = newKey();
    const ws = await seed(key);
    const res = await postIssue(issueReq(key, { evidence_override: 42 }), ctx);
    expect(res.status).toBe(422);
    expect(await repo.listIssues(ws, "P-1", AUDIT_ID)).toHaveLength(0);
    const stored = await repo.getAudit(ws, "P-1", AUDIT_ID);
    expect(stored?.candidate_findings).toHaveLength(1);
  });

  it("keeps the domain 400 for an override that names no reviewer", async () => {
    const key = newKey();
    const ws = await seed(key);
    const res = await postIssue(
      issueReq(key, { evidence_override: { auditor_pseudonym: "   " } }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe(
      "invalid evidence_override.auditor_pseudonym: expected a non-empty string",
    );
    expect(await repo.listIssues(ws, "P-1", AUDIT_ID)).toHaveLength(0);
  });

  it("refuses issuance with 400 and the violations array when the findings are not bound to evidence", async () => {
    const key = newKey();
    const ws = await seed(key, true);
    const res = await postIssue(issueReq(key), ctx);
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: string;
      violations: { finding_id: string; kind: string; detail: string }[];
    };
    expect(body.error).toBe("evidence binding not satisfied");
    expect(body.violations.length).toBeGreaterThan(0);
    expect(body.violations[0]).toEqual({
      finding_id: "F-1",
      kind: "unresolved-evidence-id",
      detail: "EV-NOPE",
    });
    expect(await repo.listIssues(ws, "P-1", AUDIT_ID)).toHaveLength(0);
    const stored = await repo.getAudit(ws, "P-1", AUDIT_ID);
    expect(stored?.findings[0].evidence).toHaveLength(1);
  });

  it("issues an EMPTY body with 201 (an absent body stays legal)", async () => {
    const key = newKey();
    const ws = await seed(key);
    const res = await postIssue(issueReq(key), ctx);
    expect(res.status).toBe(201);
    const issues = await repo.listIssues(ws, "P-1", AUDIT_ID);
    expect(issues).toHaveLength(1);
    expect(issues[0].revision).toBe(1);
  });

  it("issues a valid body with 201", async () => {
    const key = newKey();
    const ws = await seed(key);
    const res = await postIssue(
      issueReq(key, { evidence_override: { auditor_pseudonym: "auditor-a1" } }),
      ctx,
    );
    expect(res.status).toBe(201);
    expect(await repo.listIssues(ws, "P-1", AUDIT_ID)).toHaveLength(1);
  });
});
