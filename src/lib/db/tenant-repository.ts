// The tenant repository interface — the ONE seam the routes call
// (architecture report-t53.md §4.3, decision D16).
//
// It is EXACTLY the instance-method surface of the legacy Repository
// (src/lib/persistence.ts:100-201) MINUS:
//   - replayPlan          (dev-only, :199-201),
//   - pruneArtifactTrail  (private, :203-205),
//   - every STATIC key helper (:58-96).
//
// The legacy Repository class therefore satisfies this interface structurally,
// so src/lib/persistence.ts needs NO edit — the two adapters are
// interchangeable behind this type (D16).
//
// Server-only: domain types only, no client code, no secret.

import type { MemberRole } from "@/lib/db/claim";
import type { Attachment, AuditIssue, AuditResult, Project } from "@/domain/types";
import type { AuditArtifact } from "@/domain/pipeline/types";
import type { ActorId } from "@/domain/actor";

export interface TenantRepository {
  // ---- Projects ------------------------------------------------------------
  saveProject(ws: string, project: Project, actor?: ActorId): Promise<void>;
  getProject(ws: string, id: string): Promise<Project | null>;
  listProjects(ws: string): Promise<Project[]>;

  // ---- Audits --------------------------------------------------------------
  saveAudit(ws: string, audit: AuditResult, actor?: ActorId): Promise<void>;
  getAudit(ws: string, projectId: string, auditId: string): Promise<AuditResult | null>;
  listAudits(ws: string, projectId: string): Promise<AuditResult[]>;

  // ---- Audit issues (ADR-0004) ----------------------------------------------
  saveIssue(
    ws: string,
    projectId: string,
    auditId: string,
    result: AuditResult,
    issuedAtIso: string,
    actor?: ActorId,
  ): Promise<AuditIssue>;
  getIssue(
    ws: string,
    projectId: string,
    auditId: string,
    rev: number,
  ): Promise<AuditIssue | null>;
  listIssues(ws: string, projectId: string, auditId: string): Promise<AuditIssue[]>;

  // ---- Attachments ----------------------------------------------------------
  saveAttachment(ws: string, attachment: Attachment, actor?: ActorId): Promise<void>;
  getAttachment(ws: string, projectId: string, id: string): Promise<Attachment | null>;
  listAttachments(ws: string, projectId: string): Promise<Attachment[]>;
  /** Delete an attachment AND repair Project.input_values references as one
   *  operation. Throws UnknownAttachmentError when no such record exists. */
  deleteAttachment(ws: string, projectId: string, id: string, actor?: ActorId): Promise<void>;

  // ---- Node-artifact persistence (N3) ---------------------------------------
  /** Store the full artifact trail of one audit run, pruning the previous trail
   *  to a summary record first (retention policy). */
  saveArtifactTrailFor(
    ws: string,
    identity: { projectId: string; auditId: string },
    artifacts: AuditArtifact[],
    actor?: ActorId,
  ): Promise<{ stored: number }>;
  getArtifact(
    ws: string,
    projectId: string,
    auditId: string,
    nodeId: string,
    seq: number,
  ): Promise<AuditArtifact | null>;
  listArtifacts(ws: string, projectId: string, auditId: string): Promise<AuditArtifact[]>;
}

/** The tenant identity a Postgres session runs under. It is produced in ONE
 *  place — resolveTenant (src/lib/db/identity.ts) — and carried here unchanged.
 *  `legacyHash` is the existing 16-hex workspaceHash of the presented
 *  credential: the ONE derivation point (D10), reused by the legacy KV
 *  namespace and by the Postgres credential row. */
export interface TenantSession {
  /** The server-assigned workspace uuid (public.workspaces.id). */
  workspaceId: string;
  /** The subject the credential is bound to (public.workspace_members.subject_id). */
  subjectId: string;
  /** The 16-hex workspaceHash of the presented credential. */
  legacyHash: string;
  /** DB-sourced role of the acting subject (OD11). */
  role: MemberRole | null;
  /** DB-sourced email of the acting subject. */
  email: string | null;
}
