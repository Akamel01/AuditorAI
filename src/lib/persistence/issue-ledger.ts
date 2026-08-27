// IssueLedger — audit-issue hat of the former Repository.
// Shares the DataStore seam; owns IssueRevisionConflictError and sequential
// write-once revision semantics (ADR-0004).
import type { AuditIssue, AuditResult } from "@/domain/types";
import type { DataStore } from "./store";
import * as Keys from "./keys";
import { artifactSeqOf } from "./keys";

export class IssueRevisionConflictError extends Error {
  constructor(detail: string) {
    super(`issue revision conflict: ${detail}`);
    this.name = "IssueRevisionConflictError";
  }
}

export class IssueLedger {
  constructor(private store: DataStore) {}

  /** Freeze draft results as the next immutable, sequentially numbered issue
   *  revision. Write-once per ADR-0004: an existing revision is never
   *  rewritten, so the computed key must be absent or issuance aborts. */
  async saveIssue(
    ws: string,
    projectId: string,
    auditId: string,
    result: AuditResult,
    issuedAtIso: string,
  ): Promise<AuditIssue> {
    const prior = await this.listIssues(ws, projectId, auditId);
    const revision = (prior[prior.length - 1]?.revision ?? 0) + 1;
    const key = Keys.issueKey(ws, projectId, auditId, revision);
    if ((await this.store.get(key)) !== null) {
      throw new IssueRevisionConflictError(`revision ${revision} already exists`);
    }
    const issue: AuditIssue = {
      revision,
      issued_at: issuedAtIso,
      issued_by: "auditor",
      result,
    };
    await this.store.put(key, issue);
    return issue;
  }

  async getIssue(
    ws: string,
    projectId: string,
    auditId: string,
    rev: number,
  ): Promise<AuditIssue | null> {
    return this.store.get<AuditIssue>(Keys.issueKey(ws, projectId, auditId, rev));
  }

  async listIssues(ws: string, projectId: string, auditId: string): Promise<AuditIssue[]> {
    const prefix = Keys.issuesPrefix(ws, projectId, auditId);
    const keys = await this.store.keys(prefix);
    keys.sort((a, b) => artifactSeqOf(a) - artifactSeqOf(b));
    const loaded = await this.store.getMany<AuditIssue>(keys);
    return loaded.filter((i): i is AuditIssue => i !== null);
  }
}
