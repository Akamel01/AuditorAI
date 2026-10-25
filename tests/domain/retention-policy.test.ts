// F2 audit-history retention policy over the store seams: drafts ephemeral
// (rerun overwrites), issued revisions NEVER purged (export/restore rollback
// is write-once), artifacts latest-full/prior-summary, outcomes 730d TTL.
// MemoryStore throughout — state/ is never touched.
import { describe, expect, it } from "vitest";
import {
  IssueLedger,
  IssueRevisionConflictError,
  ArtifactTrail,
  MemoryStore,
  ProjectStore,
  Repository,
} from "@/lib/persistence";
import {
  RETENTION_POLICY,
  RETENTION_TTL_DAYS,
  exportOutcomeRows,
  isOutcomeExpired,
  partitionOutcomesByTtl,
} from "@/domain/outcomes";
import type { AuditResult, CandidateOutcomeRow } from "@/domain/types";
import type { AuditArtifact } from "@/domain/pipeline/types";

const WS = "wshash-f2";
const P = "P-1";
const A = "AUD-P-1-S1";
const NOW = "2026-09-16T00:00:00.000Z";
const daysAgo = (n: number): string =>
  new Date(Date.parse(NOW) - n * 24 * 60 * 60 * 1000).toISOString();

function draft(marker: string): AuditResult {
  return {
    audit_id: A,
    project_id: P,
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
    odd_declaration_version: "1.0.1",
    odd_status: "in",
    odd_stamp: null,
    odd_floor_satisfied: null,
    disclaimer: "d",
  };
}

function art(node: string, seq: number): AuditArtifact {
  return {
    artifact_id: `ART-${node.replace("AG-", "")}-${seq}`,
    node_id: node,
    producer: "domain-engine",
    version: seq,
    created_at: "2026-08-22T00:00:00.000Z",
    validation_status: "verified",
    payload_kind: "rules.results",
    payload: { note: "demo" },
  } as AuditArtifact;
}

function row(id: string, occurred_at: string): CandidateOutcomeRow {
  return {
    outcome_id: id,
    schema_version: "1.0.0",
    occurred_at,
    project_id: P,
    audit_id: A,
    odd_stamp: null,
    jurisdiction: "UK",
    native_stage_id: "uk:S1",
    canonical_stage: "PRELIMINARY_DESIGN",
    adapter_id: null,
    prompt_hash: null,
    fewshot_ids: [],
    candidate: {
      kind: "compliance_question",
      category: "crossings",
      location: null,
      road_users: [],
      scenario: null,
      statement: { text: "crossing demand unmet", normative_basis_note: null },
      evidence: [{ evidence_id: "EV-UK-009", quote: null, use: "defines_requirement" }],
      assumptions: [],
      rationale: "r",
      recommendation: null,
      producer: "safety-reasoning-agent",
    },
    action: "reject",
    auditor_pseudonym: "auditor-a1",
    consent_version: "1.0",
  };
}

describe("retention policy (F2)", () => {
  it("declares the per-class policy: drafts ephemeral, issued never, outcomes 730d", () => {
    expect(RETENTION_TTL_DAYS).toBe(730);
    expect(RETENTION_POLICY.drafts).toMatch(/ephemeral/);
    expect(RETENTION_POLICY.issues).toMatch(/never purged/);
    expect(RETENTION_POLICY.artifacts).toMatch(/latest full/);
    expect(RETENTION_POLICY.outcomes).toContain("730");
  });

  it("drafts are ephemeral: a rerun overwrites the stored draft", async () => {
    const projects = new ProjectStore(new MemoryStore());
    await projects.saveAudit(WS, draft("first"));
    await projects.saveAudit(WS, draft("second"));
    expect((await projects.getAudit(WS, P, A))?.findings[0].statement.text).toBe("second");
    expect(await projects.listAudits(WS, P)).toHaveLength(1);
  });

  it("rollback: exported issued lineage restores byte-identical after store loss", async () => {
    const store = new MemoryStore();
    const ledger = new IssueLedger(store);
    await ledger.saveIssue(WS, P, A, draft("a"), NOW);
    await ledger.saveIssue(WS, P, A, draft("b"), "2026-09-17T00:00:00.000Z");

    const backup = await ledger.exportIssueLineage(WS, P, A);
    expect(backup.format).toBe("issue-lineage/export@1");
    expect(backup.issues.map((i) => i.revision)).toEqual([1, 2]);
    const snapshot = JSON.parse(JSON.stringify(backup.issues)) as unknown[];

    await store.delByPrefix(Repository.issuesPrefix(WS, P, A));
    expect(await ledger.listIssues(WS, P, A)).toHaveLength(0);

    expect(await ledger.restoreIssueLineage(WS, backup)).toEqual({ restored: 2, skipped: 0 });
    expect(await ledger.listIssues(WS, P, A)).toEqual(snapshot);
    // Idempotent replay: identical revisions skip instead of rewriting.
    expect(await ledger.restoreIssueLineage(WS, backup)).toEqual({ restored: 0, skipped: 2 });
  });

  it("restore refuses to rewrite history: conflicting revisions abort write-once", async () => {
    const store = new MemoryStore();
    const ledger = new IssueLedger(store);
    await ledger.saveIssue(WS, P, A, draft("a"), NOW);
    const backup = await ledger.exportIssueLineage(WS, P, A);

    await store.put(Repository.issueKey(WS, P, A, 1), { ...backup.issues[0], issued_at: "tampered" });
    await expect(ledger.restoreIssueLineage(WS, backup)).rejects.toBeInstanceOf(
      IssueRevisionConflictError,
    );
    // The failed restore changed nothing.
    expect((await ledger.getIssue(WS, P, A, 1))?.issued_at).toBe("tampered");
    await expect(ledger.restoreIssueLineage("other-ws", backup)).rejects.toThrow(/workspace/);
  });

  it("TTL sweeps (artifact prune, outcome partition) cannot touch issued revisions", async () => {
    const store = new MemoryStore();
    const ledger = new IssueLedger(store);
    const trail = new ArtifactTrail(store);
    await ledger.saveIssue(WS, P, A, draft("issued"), NOW);
    await trail.saveArtifactTrailFor(WS, { projectId: P, auditId: A }, [art("AG-RULES", 1)]);
    // Rerun prune + outcome TTL pass over the same store.
    await trail.saveArtifactTrailFor(WS, { projectId: P, auditId: A }, [art("AG-REPORT", 1)]);
    const { expired } = partitionOutcomesByTtl([row("OUT-old", daysAgo(731))], NOW);
    expect(expired).toHaveLength(1);

    const issues = await ledger.listIssues(WS, P, A);
    expect(issues).toHaveLength(1);
    expect(issues[0].result.findings[0].statement.text).toBe("issued");
  });

  it("artifacts keep latest-full plus prior-summary, and export both", async () => {
    const store = new MemoryStore();
    const trail = new ArtifactTrail(store);
    await trail.saveArtifactTrailFor(WS, { projectId: P, auditId: A }, [
      art("AG-RULES", 1),
      art("AG-FINDINGS", 1),
    ]);
    await trail.saveArtifactTrailFor(WS, { projectId: P, auditId: A }, [art("AG-REPORT", 1)]);

    expect((await trail.listArtifacts(WS, P, A)).map((a) => a.node_id)).toEqual(["AG-REPORT"]);
    expect((await trail.getArtifactSummary(WS, P, A))?.artifact_count).toBe(2);

    const backup = await trail.exportArtifactTrail(WS, P, A);
    expect(backup.format).toBe("artifact-trail/export@1");
    expect(backup.artifacts).toHaveLength(1);
    expect(backup.summary?.artifact_count).toBe(2);
  });

  it("outcomes expire strictly after 730d; unparseable rows are retained", () => {
    expect(isOutcomeExpired(daysAgo(729), NOW)).toBe(false);
    expect(isOutcomeExpired(daysAgo(730), NOW)).toBe(false);
    expect(isOutcomeExpired(daysAgo(731), NOW)).toBe(true);
    expect(isOutcomeExpired("not-a-date", NOW)).toBe(false);

    const { retained, expired } = partitionOutcomesByTtl(
      [row("OUT-729", daysAgo(729)), row("OUT-730", daysAgo(730)), row("OUT-731", daysAgo(731))],
      NOW,
    );
    expect(retained.map((r) => r.outcome_id)).toEqual(["OUT-729", "OUT-730"]);
    expect(expired.map((r) => r.outcome_id)).toEqual(["OUT-731"]);
  });

  it("expired outcome rows round-trip through the export envelope", () => {
    const { expired } = partitionOutcomesByTtl([row("OUT-731", daysAgo(731))], NOW);
    const env = exportOutcomeRows(expired, NOW);
    expect(env.format).toBe("candidate-outcomes/export@1");
    expect(env.schema_version).toBe("1.0.0");
    expect(env.rows).toEqual(expired);
    expect(JSON.parse(JSON.stringify(env)).rows).toHaveLength(1);
  });
});
