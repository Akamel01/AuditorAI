// The Postgres implementation of the tenant repository
// (architecture report-t53.md §4.3). Server-only.
//
// Two rules shape every statement here:
//
//  1. ISOLATION IS RLS's JOB (decision D19). The application SQL carries NO
//     workspace_id predicate — the claim GUC scopes the row set. A filter in
//     the application would make the isolation proof vacuous: the pglite suite
//     runs the SAME unfiltered statement under two claims and sees two
//     different row sets. The only place a workspace filter appears is the
//     credential/membership resolution (src/lib/db/identity.ts).
//
//  2. ONE TRANSACTION PER OPERATION (decision D13). Every method opens its
//     own transaction and sets the claim inside it:
//       begin; set local role auditorai_app;
//       select set_config('request.jwt.claims', $1, true);   -- is_local = true
//       <work>; commit;
//     `set local role` and the transaction preamble belong to the seam
//     (src/lib/db/sql.ts); the claim GUC is this module's. The third argument
//     of set_config is TRUE because the Supabase pooler is transaction-pooled
//     and would discard a session-level setting.
//
// The `ws` handle of the interface is accepted for parity with the legacy
// Repository; it does NOT scope anything here (RLS does). It is used only to
// restore Project.workspace_key_hash, which the schema does not store.

import type { Attachment, AuditIssue, AuditResult, Project } from "@/domain/types";
import type { AuditArtifact } from "@/domain/pipeline/types";
import { UnknownAttachmentError } from "@/lib/persistence/project-store";
import {
  ArtifactTooLargeError,
  MAX_ARTIFACT_BYTES,
  type ArtifactSummary,
} from "@/lib/persistence/artifact-trail";
import { IssueRevisionConflictError } from "@/lib/persistence/issue-ledger";
import type { SqlClient } from "./sql";
import type { TenantRepository, TenantSession } from "./tenant-repository";
import { asDatabaseUnavailable, claimsJson, sqlStateOf } from "./identity";
import type { ActorId } from "@/domain/actor";

interface ProjectRow {
  project_id: string;
  metadata: Project["metadata"];
  stage_selection: Project["stage_selection"];
  input_values: Project["input_values"];
  created_at: Date | string;
  updated_at: Date | string;
}

/** A timestamptz column back to the ISO string the domain types use. */
function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** A transport failure (no SQLSTATE) is an outage; a SQL error carries a
 *  SQLSTATE and keeps its own shape. The typed domain errors keep theirs, and
 *  a programming error is never disguised as an outage. */
function asStoreError(err: unknown): unknown {
  if (
    err instanceof UnknownAttachmentError ||
    err instanceof IssueRevisionConflictError ||
    err instanceof ArtifactTooLargeError
  ) {
    return err;
  }
  if (err instanceof TypeError || err instanceof RangeError || err instanceof ReferenceError) {
    return err;
  }
  if (sqlStateOf(err)) return err;
  return asDatabaseUnavailable(err);
}

export class PostgresTenantRepository implements TenantRepository {
  constructor(
    private readonly client: SqlClient,
    private readonly session: TenantSession,
  ) {}

  /** One transaction per operation, with the claim set inside it (D13). */
  private async withClaim<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    try {
      return await this.client.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [
          claimsJson(this.session.subjectId, this.session.workspaceId, this.session.role, this.session.email),
        ]);
        return await fn(tx);
      });
    } catch (err) {
      throw asStoreError(err);
    }
  }

  private toProject(row: ProjectRow, ws: string): Project {
    return {
      project_id: row.project_id,
      workspace_key_hash: ws,
      metadata: row.metadata,
      stage_selection: row.stage_selection,
      input_values: row.input_values,
      created_at: iso(row.created_at),
      updated_at: iso(row.updated_at),
    };
  }

  // ---- Projects ------------------------------------------------------------

  async saveProject(_ws: string, project: Project, _actor?: ActorId): Promise<void> {
    await this.withClaim(async (tx) => {
      await tx.query(
        `insert into public.projects
           (workspace_id, project_id, metadata, stage_selection, input_values, created_at, updated_at)
         values ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::timestamptz, $7::timestamptz)
         on conflict (workspace_id, project_id) do update
           set metadata = excluded.metadata,
               stage_selection = excluded.stage_selection,
               input_values = excluded.input_values,
               created_at = excluded.created_at,
               updated_at = excluded.updated_at`,
        [
          this.session.workspaceId,
          project.project_id,
          JSON.stringify(project.metadata),
          JSON.stringify(project.stage_selection),
          JSON.stringify(project.input_values),
          project.created_at,
          project.updated_at,
        ],
      );
    });
  }

  async getProject(ws: string, id: string): Promise<Project | null> {
    const rows = await this.withClaim(async (tx) => {
      const res = await tx.query<ProjectRow>(
        `select project_id, metadata, stage_selection, input_values, created_at, updated_at
           from public.projects
          where project_id = $1`,
        [id],
      );
      return res.rows;
    });
    const row = rows[0];
    return row ? this.toProject(row, ws) : null;
  }

  async listProjects(ws: string): Promise<Project[]> {
    const rows = await this.withClaim(async (tx) => {
      const res = await tx.query<ProjectRow>(
        `select project_id, metadata, stage_selection, input_values, created_at, updated_at
           from public.projects
          order by updated_at desc`,
      );
      return res.rows;
    });
    return rows.map((row) => this.toProject(row, ws));
  }

  // ---- Audits --------------------------------------------------------------

  async saveAudit(_ws: string, audit: AuditResult, _actor?: ActorId): Promise<void> {
    await this.withClaim(async (tx) => {
      await tx.query(
        `insert into public.audits (workspace_id, project_id, audit_id, ran_at, payload)
         values ($1, $2, $3, $4::timestamptz, $5::jsonb)
         on conflict (workspace_id, project_id, audit_id) do update
           set ran_at = excluded.ran_at,
               payload = excluded.payload`,
        [
          this.session.workspaceId,
          audit.project_id,
          audit.audit_id,
          audit.ran_at,
          JSON.stringify(audit),
        ],
      );
    });
  }

  async getAudit(_ws: string, projectId: string, auditId: string): Promise<AuditResult | null> {
    const rows = await this.withClaim(async (tx) => {
      const res = await tx.query<{ payload: AuditResult }>(
        "select payload from public.audits where project_id = $1 and audit_id = $2",
        [projectId, auditId],
      );
      return res.rows;
    });
    return rows[0]?.payload ?? null;
  }

  async listAudits(_ws: string, projectId: string): Promise<AuditResult[]> {
    return this.withClaim(async (tx) => {
      const res = await tx.query<{ payload: AuditResult }>(
        "select payload from public.audits where project_id = $1 order by ran_at desc",
        [projectId],
      );
      return res.rows.map((r) => r.payload);
    });
  }

  // ---- Audit issues (ADR-0004) ---------------------------------------------

  /** Write-once: the revision is part of the primary key, so a concurrent
   *  issuance cannot overwrite history — the insert simply returns no row and
   *  the conflict is raised (issue-ledger.ts:43-45). */
  async saveIssue(
    _ws: string,
    projectId: string,
    auditId: string,
    result: AuditResult,
    issuedAtIso: string,
    _actor?: ActorId,
  ): Promise<AuditIssue> {
    return this.withClaim(async (tx) => {
      const prior = await tx.query<{ revision: number }>(
        "select coalesce(max(revision), 0) as revision from public.audit_issues where project_id = $1 and audit_id = $2",
        [projectId, auditId],
      );
      const revision = Number(prior.rows[0]?.revision ?? 0) + 1;
      const issue: AuditIssue = {
        revision,
        issued_at: issuedAtIso,
        issued_by: "auditor",
        result,
      };
      const inserted = await tx.query<{ revision: number }>(
        `insert into public.audit_issues
           (workspace_id, project_id, audit_id, revision, issued_at, issued_by, payload)
         values ($1, $2, $3, $4, $5::timestamptz, $6, $7::jsonb)
         on conflict (workspace_id, project_id, audit_id, revision) do nothing
         returning revision`,
        [
          this.session.workspaceId,
          projectId,
          auditId,
          revision,
          issuedAtIso,
          issue.issued_by,
          JSON.stringify(issue),
        ],
      );
      if (inserted.rows.length === 0) {
        throw new IssueRevisionConflictError(`revision ${revision} already exists`);
      }
      return issue;
    });
  }

  async getIssue(
    _ws: string,
    projectId: string,
    auditId: string,
    rev: number,
  ): Promise<AuditIssue | null> {
    const rows = await this.withClaim(async (tx) => {
      const res = await tx.query<{ payload: AuditIssue }>(
        "select payload from public.audit_issues where project_id = $1 and audit_id = $2 and revision = $3",
        [projectId, auditId, rev],
      );
      return res.rows;
    });
    return rows[0]?.payload ?? null;
  }

  async listIssues(_ws: string, projectId: string, auditId: string): Promise<AuditIssue[]> {
    return this.withClaim(async (tx) => {
      const res = await tx.query<{ payload: AuditIssue }>(
        "select payload from public.audit_issues where project_id = $1 and audit_id = $2 order by revision asc",
        [projectId, auditId],
      );
      return res.rows.map((r) => r.payload);
    });
  }

  // ---- Attachments ----------------------------------------------------------

  async saveAttachment(_ws: string, attachment: Attachment, _actor?: ActorId): Promise<void> {
    await this.withClaim(async (tx) => {
      await tx.query(
        `insert into public.attachments
           (workspace_id, project_id, attachment_id, created_at, payload)
         values ($1, $2, $3, $4::timestamptz, $5::jsonb)
         on conflict (workspace_id, project_id, attachment_id) do update
           set created_at = excluded.created_at,
               payload = excluded.payload`,
        [
          this.session.workspaceId,
          attachment.project_id,
          attachment.attachment_id,
          attachment.created_at,
          JSON.stringify(attachment),
        ],
      );
    });
  }

  async getAttachment(_ws: string, projectId: string, id: string): Promise<Attachment | null> {
    const rows = await this.withClaim(async (tx) => {
      const res = await tx.query<{ payload: Attachment }>(
        "select payload from public.attachments where project_id = $1 and attachment_id = $2",
        [projectId, id],
      );
      return res.rows;
    });
    return rows[0]?.payload ?? null;
  }

  async listAttachments(_ws: string, projectId: string): Promise<Attachment[]> {
    return this.withClaim(async (tx) => {
      const res = await tx.query<{ payload: Attachment }>(
        "select payload from public.attachments where project_id = $1 order by created_at asc",
        [projectId],
      );
      return res.rows.map((r) => r.payload);
    });
  }

  /** Delete the attachment AND repair Project.input_values references as ONE
   *  operation (project-store.ts:68-91). The KV's delByPrefix has no
   *  transactional equivalent and is NOT ported. Throws
   *  UnknownAttachmentError when no such record exists. */
  async deleteAttachment(_ws: string, projectId: string, id: string, _actor?: ActorId): Promise<void> {
    await this.withClaim(async (tx) => {
      const deleted = await tx.query<{ attachment_id: string }>(
        "delete from public.attachments where project_id = $1 and attachment_id = $2 returning attachment_id",
        [projectId, id],
      );
      if (deleted.rows.length === 0) {
        throw new UnknownAttachmentError(id);
      }
      const project = await tx.query<{ input_values: Project["input_values"] }>(
        "select input_values from public.projects where project_id = $1 for update",
        [projectId],
      );
      const row = project.rows[0];
      if (!row) return;
      const inputValues = row.input_values ?? {};
      let touched = false;
      for (const value of Object.values(inputValues)) {
        if (value.attachments?.includes(id)) {
          value.attachments = value.attachments.filter((a) => a !== id);
          if (value.attachments.length === 0) delete value.attachments;
          touched = true;
        }
      }
      if (!touched) return;
      await tx.query(
        "update public.projects set input_values = $1::jsonb, updated_at = $2::timestamptz where project_id = $3",
        [JSON.stringify(inputValues), new Date().toISOString(), projectId],
      );
    });
  }

  // ---- Node-artifact persistence (N3) ---------------------------------------

  /** Store the full artifact trail of one audit run; prune the previous trail
   *  to its summary row first (artifact-trail.ts:87-105). The 512 000-byte cap
   *  is enforced BEFORE any insert and raises ArtifactTooLargeError
   *  (artifact-trail.ts:10,44-47). */
  async saveArtifactTrailFor(
    _ws: string,
    identity: { projectId: string; auditId: string },
    artifacts: AuditArtifact[],
    _actor?: ActorId,
  ): Promise<{ stored: number }> {
    const sized: { art: AuditArtifact; seq: number }[] = [];
    let seq = 0;
    for (const art of artifacts) {
      seq += 1;
      const bytes = Buffer.byteLength(JSON.stringify(art));
      if (bytes > MAX_ARTIFACT_BYTES) {
        throw new ArtifactTooLargeError(art.node_id, seq, bytes);
      }
      sized.push({ art, seq });
    }

    await this.withClaim(async (tx) => {
      const prior = await tx.query<{ payload: AuditArtifact }>(
        "select payload from public.artifacts where project_id = $1 and audit_id = $2 order by seq asc",
        [identity.projectId, identity.auditId],
      );
      if (prior.rows.length > 0) {
        const trail = prior.rows.map((r) => r.payload);
        const summary: ArtifactSummary = {
          audit_id: identity.auditId,
          ran_at: String(trail[0]?.created_at ?? ""),
          artifact_count: trail.length,
          nodes: trail.map((a) => ({
            node_id: a.node_id,
            payload_kind: a.payload_kind,
            validation_status: a.validation_status,
          })),
          pruned_at: new Date().toISOString(),
        };
        await tx.query("delete from public.artifacts where project_id = $1 and audit_id = $2", [
          identity.projectId,
          identity.auditId,
        ]);
        await tx.query(
          `insert into public.artifact_summaries
             (workspace_id, project_id, audit_id, pruned_at, payload)
           values ($1, $2, $3, $4::timestamptz, $5::jsonb)
           on conflict (workspace_id, project_id, audit_id) do update
             set pruned_at = excluded.pruned_at,
                 payload = excluded.payload`,
          [
            this.session.workspaceId,
            identity.projectId,
            identity.auditId,
            summary.pruned_at,
            JSON.stringify(summary),
          ],
        );
      }
      for (const { art, seq: s } of sized) {
        await tx.query(
          `insert into public.artifacts
             (workspace_id, project_id, audit_id, node_id, seq, payload)
           values ($1, $2, $3, $4, $5, $6::jsonb)
           on conflict (workspace_id, project_id, audit_id, node_id, seq) do update
             set payload = excluded.payload`,
          [
            this.session.workspaceId,
            identity.projectId,
            identity.auditId,
            art.node_id,
            s,
            JSON.stringify(art),
          ],
        );
      }
    });
    return { stored: seq };
  }

  async getArtifact(
    _ws: string,
    projectId: string,
    auditId: string,
    nodeId: string,
    seq: number,
  ): Promise<AuditArtifact | null> {
    const rows = await this.withClaim(async (tx) => {
      const res = await tx.query<{ payload: AuditArtifact }>(
        "select payload from public.artifacts where project_id = $1 and audit_id = $2 and node_id = $3 and seq = $4",
        [projectId, auditId, nodeId, seq],
      );
      return res.rows;
    });
    return rows[0]?.payload ?? null;
  }

  async listArtifacts(_ws: string, projectId: string, auditId: string): Promise<AuditArtifact[]> {
    return this.withClaim(async (tx) => {
      const res = await tx.query<{ payload: AuditArtifact }>(
        "select payload from public.artifacts where project_id = $1 and audit_id = $2 order by seq asc",
        [projectId, auditId],
      );
      return res.rows.map((r) => r.payload);
    });
  }
}
