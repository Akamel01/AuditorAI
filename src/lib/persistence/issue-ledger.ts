// IssueLedger — audit-issue hat of the former Repository.
// Shares the DataStore seam; owns IssueRevisionConflictError and sequential
// write-once revision semantics (ADR-0004).
import type { AuditIssue, AuditResult } from "@/domain/types";
import type { DataStore } from "./store";
import { withPersistenceSingleWriter } from "./single-writer";
import * as Keys from "./keys";
import { artifactSeqOf } from "./keys";

export class IssueRevisionConflictError extends Error {
  constructor(detail: string) {
    super(`issue revision conflict: ${detail}`);
    this.name = "IssueRevisionConflictError";
  }
}

/** Portable pre-rollback backup envelope for one audit's issue lineage. */
export interface IssueLineageExport {
  format: "issue-lineage/export@1";
  exported_at: string;
  workspace: string;
  project_id: string;
  audit_id: string;
  issues: AuditIssue[];
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

  // ---- Retention (F2) ------------------------------------------------------
  // Issued revisions are NEVER purged: this class exposes no delete API by
  // design, so no TTL sweep can remove an issue key. Rollback runs through
  // export/restore below, and restore itself is write-once (an existing
  // revision that differs aborts instead of overwriting).

  /** Portable pre-rollback backup envelope for one audit's issue lineage. */
  async exportIssueLineage(
    ws: string,
    projectId: string,
    auditId: string,
  ): Promise<IssueLineageExport> {
    return withPersistenceSingleWriter(async () => ({
      format: "issue-lineage/export@1",
      exported_at: new Date().toISOString(),
      workspace: ws,
      project_id: projectId,
      audit_id: auditId,
      issues: await this.listIssues(ws, projectId, auditId),
    }));
  }

  /** Roll back an issue lineage from an export envelope. Re-puts missing
   *  revisions only: byte-identical replays skip, conflicting replays throw
   *  IssueRevisionConflictError — a restore can never rewrite history. */
  async restoreIssueLineage(
    ws: string,
    backup: IssueLineageExport,
  ): Promise<{ restored: number; skipped: number }> {
    if (backup.format !== "issue-lineage/export@1" || backup.workspace !== ws) {
      throw new Error("issue lineage export does not match this workspace");
    }
    return withPersistenceSingleWriter(async () => {
      let restored = 0;
      let skipped = 0;
      for (const issue of backup.issues) {
        const key = Keys.issueKey(ws, backup.project_id, backup.audit_id, issue.revision);
        const existing = await this.store.get<AuditIssue>(key);
        if (existing === null) {
          await this.store.put(key, issue);
          restored += 1;
        } else if (JSON.stringify(existing) === JSON.stringify(issue)) {
          skipped += 1;
        } else {
          throw new IssueRevisionConflictError(
            `revision ${issue.revision} differs from the stored issue (write-once)`,
          );
        }
      }
      return { restored, skipped };
    });
  }
}
