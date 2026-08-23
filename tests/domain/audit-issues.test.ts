// ADR-0004 issue semantics over the store seam: sequential write-once
// revisions, permanent retention, and full isolation from later draft runs.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, Repository, setDataStoreForTests } from "@/lib/persistence";
import type { AuditResult } from "@/domain/types";

const WS = "wshash";
const NOW = "2026-08-23T12:00:00.000Z";

function draft(auditId: string, marker: string): AuditResult {
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
      },
    ],
    missing_information: [],
    audit_questions: [],
    limitations: [],
    disclaimer: "d",
  };
}

let repo: Repository;

beforeEach(() => {
  setDataStoreForTests(new MemoryStore());
  repo = new Repository(new MemoryStore());
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
