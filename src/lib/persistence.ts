// Persistence seam (ADR-0001): callers depend on this interface only.
// Adapters: in-memory (tests/dev), Upstash/Vercel-KV REST (production free tier).
// Swapping stores = env change, never code change. Repository owns the physical
// key scheme exclusively; no other module assembles or parses storage keys.
import type { Attachment, AuditIssue, AuditResult, Project } from "@/domain/types";
import type { AuditArtifact } from "@/domain/pipeline/types";
import {
  getDataStore,
  KvRestStore,
  MemoryStore,
  setDataStoreForTests,
  StoreUnavailableError,
  workspaceHash,
} from "./persistence/store";
import type { DataStore } from "./persistence/store";
import * as Keys from "./persistence/keys";
import { ProjectStore, UnknownAttachmentError } from "./persistence/project-store";
import {
  ArtifactTrail,
  ArtifactTooLargeError,
  MAX_ARTIFACT_BYTES,
} from "./persistence/artifact-trail";
import type { ArtifactSummary } from "./persistence/artifact-trail";
import { IssueLedger, IssueRevisionConflictError } from "./persistence/issue-ledger";

// Re-export seam symbols so existing imports from "@/lib/persistence" stay green.
export {
  StoreUnavailableError,
  MemoryStore,
  KvRestStore,
  getDataStore,
  setDataStoreForTests,
  workspaceHash,
};
export type { DataStore };
export { UnknownAttachmentError, ProjectStore };
export { MAX_ARTIFACT_BYTES, ArtifactTooLargeError };
export type { ArtifactSummary };
export { ArtifactTrail, IssueRevisionConflictError, IssueLedger };

/** Workspace-scoped repository over the store seam. Sole owner of the physical
 *  key scheme (ADR-0001): everything else addresses records through these
 *  static helpers or through repository methods. Thin facade over ProjectStore,
 *  ArtifactTrail and IssueLedger sharing one DataStore. */
export class Repository {
  private projectStore: ProjectStore;
  private artifactTrail: ArtifactTrail;
  private issueLedger: IssueLedger;

  constructor(private store: DataStore) {
    this.projectStore = new ProjectStore(store);
    this.artifactTrail = new ArtifactTrail(store);
    this.issueLedger = new IssueLedger(store);
  }

  // ---- Key scheme ---------------------------------------------------------

  static projectKey(ws: string, projectId: string): string {
    return Keys.projectKey(ws, projectId);
  }
  static projectsPrefix(ws: string): string {
    return Keys.projectsPrefix(ws);
  }
  static auditKey(ws: string, projectId: string, auditId: string): string {
    return Keys.auditKey(ws, projectId, auditId);
  }
  static auditsPrefix(ws: string, projectId: string): string {
    return Keys.auditsPrefix(ws, projectId);
  }
  static attachmentKey(ws: string, projectId: string, attachmentId: string): string {
    return Keys.attachmentKey(ws, projectId, attachmentId);
  }
  static attachmentsPrefix(ws: string, projectId: string): string {
    return Keys.attachmentsPrefix(ws, projectId);
  }
  static artifactKey(
    ws: string,
    projectId: string,
    auditId: string,
    nodeId: string,
    seq: number,
  ): string {
    return Keys.artifactKey(ws, projectId, auditId, nodeId, seq);
  }
  static artifactTrailPrefix(ws: string, projectId: string, auditId: string): string {
    return Keys.artifactTrailPrefix(ws, projectId, auditId);
  }
  static artifactSummaryKey(ws: string, projectId: string, auditId: string): string {
    return Keys.artifactSummaryKey(ws, projectId, auditId);
  }
  static issueKey(ws: string, projectId: string, auditId: string, rev: number): string {
    return Keys.issueKey(ws, projectId, auditId, rev);
  }
  static issuesPrefix(ws: string, projectId: string, auditId: string): string {
    return Keys.issuesPrefix(ws, projectId, auditId);
  }

  // ---- Projects ------------------------------------------------------------

  async saveProject(ws: string, project: Project) {
    return this.projectStore.saveProject(ws, project);
  }
  async getProject(ws: string, id: string): Promise<Project | null> {
    return this.projectStore.getProject(ws, id);
  }
  async listProjects(ws: string): Promise<Project[]> {
    return this.projectStore.listProjects(ws);
  }

  // ---- Audits --------------------------------------------------------------

  async saveAudit(ws: string, audit: AuditResult) {
    return this.projectStore.saveAudit(ws, audit);
  }
  async getAudit(ws: string, projectId: string, auditId: string): Promise<AuditResult | null> {
    return this.projectStore.getAudit(ws, projectId, auditId);
  }
  async listAudits(ws: string, projectId: string): Promise<AuditResult[]> {
    return this.projectStore.listAudits(ws, projectId);
  }

  // ---- Audit issues (ADR-0004) ------------------------------------------------

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
    return this.issueLedger.saveIssue(ws, projectId, auditId, result, issuedAtIso);
  }

  async getIssue(
    ws: string,
    projectId: string,
    auditId: string,
    rev: number,
  ): Promise<AuditIssue | null> {
    return this.issueLedger.getIssue(ws, projectId, auditId, rev);
  }

  async listIssues(ws: string, projectId: string, auditId: string): Promise<AuditIssue[]> {
    return this.issueLedger.listIssues(ws, projectId, auditId);
  }

  // ---- Attachments -----------------------------------------------------------

  async saveAttachment(ws: string, attachment: Attachment) {
    return this.projectStore.saveAttachment(ws, attachment);
  }
  async getAttachment(ws: string, projectId: string, id: string): Promise<Attachment | null> {
    return this.projectStore.getAttachment(ws, projectId, id);
  }
  async listAttachments(ws: string, projectId: string): Promise<Attachment[]> {
    return this.projectStore.listAttachments(ws, projectId);
  }

  /** Delete an attachment record and repair Project.input_values references as
   *  one operation: the id is stripped from every referencing input and emptied
   *  attachment arrays are removed. updated_at advances only when something
   *  changed. Throws UnknownAttachmentError when no such record exists. */
  async deleteAttachment(ws: string, projectId: string, id: string): Promise<void> {
    return this.projectStore.deleteAttachment(ws, projectId, id);
  }

  // ---- Node-artifact persistence (N3) -----------------------------------------

  /** Store the full artifact trail of one audit run under
   *  ws:{ws}:art:{projectId}:{auditId}:{nodeId}:{seq}; prune any previous full
   *  trail for the same audit to a summary record first (retention policy). */
  async saveArtifactTrailFor(
    ws: string,
    identity: { projectId: string; auditId: string },
    artifacts: AuditArtifact[],
  ) {
    return this.artifactTrail.saveArtifactTrailFor(ws, identity, artifacts);
  }

  async getArtifact(
    ws: string,
    projectId: string,
    auditId: string,
    nodeId: string,
    seq: number,
  ): Promise<AuditArtifact | null> {
    return this.artifactTrail.getArtifact(ws, projectId, auditId, nodeId, seq);
  }

  async listArtifacts(ws: string, projectId: string, auditId: string): Promise<AuditArtifact[]> {
    return this.artifactTrail.listArtifacts(ws, projectId, auditId);
  }

  /** Replay rule: verified artifacts are trusted as-is; anything else must be
   *  regenerated deterministically before use. */
  replayPlan(artifacts: AuditArtifact[]): { trusted: AuditArtifact[]; regenerate: AuditArtifact[] } {
    return this.artifactTrail.replayPlan(artifacts);
  }

  private async pruneArtifactTrail(ws: string, projectId: string, auditId: string) {
    return this.artifactTrail.pruneArtifactTrail(ws, projectId, auditId);
  }
}
