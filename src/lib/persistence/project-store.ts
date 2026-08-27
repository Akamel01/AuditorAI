// ProjectStore — project / audit / attachment hats of the former Repository.
// Shares the DataStore seam; owns no key literals (imports from keys.ts).
import type { Attachment, AuditResult, Project } from "@/domain/types";
import type { DataStore } from "./store";
import * as Keys from "./keys";

export class UnknownAttachmentError extends Error {
  constructor(id: string) {
    super(`unknown attachment ${id}`);
    this.name = "UnknownAttachmentError";
  }
}

export class ProjectStore {
  constructor(private store: DataStore) {}

  // ---- Projects -----------------------------------------------------------

  async saveProject(ws: string, project: Project) {
    await this.store.put(Keys.projectKey(ws, project.project_id), project);
  }
  async getProject(ws: string, id: string): Promise<Project | null> {
    return this.store.get<Project>(Keys.projectKey(ws, id));
  }
  async listProjects(ws: string): Promise<Project[]> {
    const keys = await this.store.keys(Keys.projectsPrefix(ws));
    const loaded = await this.store.getMany<Project>(keys);
    return loaded
      .filter((p): p is Project => p !== null)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  // ---- Audits --------------------------------------------------------------

  async saveAudit(ws: string, audit: AuditResult) {
    await this.store.put(Keys.auditKey(ws, audit.project_id, audit.audit_id), audit);
  }
  async getAudit(ws: string, projectId: string, auditId: string): Promise<AuditResult | null> {
    return this.store.get<AuditResult>(Keys.auditKey(ws, projectId, auditId));
  }
  async listAudits(ws: string, projectId: string): Promise<AuditResult[]> {
    const keys = await this.store.keys(Keys.auditsPrefix(ws, projectId));
    const loaded = await this.store.getMany<AuditResult>(keys);
    return loaded
      .filter((a): a is AuditResult => a !== null)
      .sort((a, b) => b.ran_at.localeCompare(a.ran_at));
  }

  // ---- Attachments -----------------------------------------------------------

  async saveAttachment(ws: string, attachment: Attachment) {
    await this.store.put(
      Keys.attachmentKey(ws, attachment.project_id, attachment.attachment_id),
      attachment,
    );
  }
  async getAttachment(ws: string, projectId: string, id: string): Promise<Attachment | null> {
    return this.store.get<Attachment>(Keys.attachmentKey(ws, projectId, id));
  }
  async listAttachments(ws: string, projectId: string): Promise<Attachment[]> {
    const keys = await this.store.keys(Keys.attachmentsPrefix(ws, projectId));
    const loaded = await this.store.getMany<Attachment>(keys);
    return loaded
      .filter((a): a is Attachment => a !== null)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  /** Delete an attachment record and repair Project.input_values references as
   *  one operation: the id is stripped from every referencing input and emptied
   *  attachment arrays are removed. updated_at advances only when something
   *  changed. Throws UnknownAttachmentError when no such record exists. */
  async deleteAttachment(ws: string, projectId: string, id: string): Promise<void> {
    const existing = await this.getAttachment(ws, projectId, id);
    if (!existing) throw new UnknownAttachmentError(id);
    await this.store.del(Keys.attachmentKey(ws, projectId, id));

    const project = await this.getProject(ws, projectId);
    if (!project) return;
    let touched = false;
    for (const v of Object.values(project.input_values)) {
      if (v.attachments?.includes(id)) {
        v.attachments = v.attachments.filter((a) => a !== id);
        if (v.attachments.length === 0) delete v.attachments;
        touched = true;
      }
    }
    if (touched) {
      project.updated_at = new Date().toISOString();
      await this.saveProject(ws, project);
    }
  }
}
