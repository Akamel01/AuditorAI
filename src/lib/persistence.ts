// Persistence seam (ADR-0001): callers depend on this interface only.
// Adapters: in-memory (tests/dev), Upstash/Vercel-KV REST (production free tier).
// Swapping stores = env change, never code change. Repository owns the physical
// key scheme exclusively; no other module assembles or parses storage keys.
import { createHash } from "node:crypto";
import type { Attachment, AuditIssue, AuditResult, Project } from "@/domain/types";
import type { AuditArtifact } from "@/domain/pipeline/types";

/** The store itself is unreachable/unhealthy: transport failure, non-2xx REST
 *  status, auth rejection, malformed response. Never used for absent keys —
 *  those resolve to null so "missing" stays distinguishable from "down". */
export class StoreUnavailableError extends Error {
  constructor(detail: string) {
    super(`storage unavailable: ${detail}`);
    this.name = "StoreUnavailableError";
  }
}

export class UnknownAttachmentError extends Error {
  constructor(id: string) {
    super(`unknown attachment ${id}`);
    this.name = "UnknownAttachmentError";
  }
}

export interface DataStore {
  readonly kind: "memory" | "kv";
  put(key: string, value: unknown): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  getMany<T>(keys: string[]): Promise<(T | null)[]>;
  keys(prefix: string): Promise<string[]>;
  del(key: string): Promise<void>;
  /** Delete every key under prefix; resolves with the deleted count. KV has
   *  no atomic multi-delete, so this is ordered best-effort per key. */
  delByPrefix(prefix: string): Promise<number>;
}

export class MemoryStore implements DataStore {
  readonly kind = "memory" as const;
  private m = new Map<string, string>();
  async put(key: string, value: unknown) {
    this.m.set(key, JSON.stringify(value));
  }
  async get<T>(key: string): Promise<T | null> {
    const raw = this.m.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }
  async keys(prefix: string): Promise<string[]> {
    return [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
  async del(key: string): Promise<void> {
    this.m.delete(key);
  }
  async delByPrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const k of [...this.m.keys()]) {
      if (k.startsWith(prefix)) {
        this.m.delete(k);
        n += 1;
      }
    }
    return n;
  }
}

/** Vercel KV / Upstash share the REST protocol; no SDK dependency needed. */
export class KvRestStore implements DataStore {
  readonly kind = "kv" as const;
  constructor(private baseUrl: string, private token: string) {}

  /** Upstash REST accepts ONE flat command per request; pipeline-form bodies
   *  ([[..],[..]]) are rejected as a malformed single command (M1 storage
   *  probes, issue #6). Batching therefore means concurrent individual
   *  commands, never a pipelined body. */
  private async call(command: unknown[]): Promise<{ result?: unknown }> {
    let res: Response;
    try {
      res = await fetch(this.baseUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(command),
        cache: "no-store",
      });
    } catch (e) {
      throw new StoreUnavailableError(e instanceof Error ? e.message : String(e));
    }
    if (!res.ok) throw new StoreUnavailableError(`REST ${res.status}`);
    let json: { result?: unknown; error?: unknown };
    try {
      json = (await res.json()) as { result?: unknown; error?: unknown };
    } catch {
      throw new StoreUnavailableError("malformed REST response body");
    }
    if (json.error !== undefined && json.error !== null) {
      throw new StoreUnavailableError(String(json.error));
    }
    return json;
  }

  async put(key: string, value: unknown): Promise<void> {
    await this.call(["SET", key, JSON.stringify(value)]);
  }

  async get<T>(key: string): Promise<T | null> {
    const json = await this.call(["GET", key]);
    const raw = json.result;
    return typeof raw === "string" ? (JSON.parse(raw) as T) : null;
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }

  async keys(prefix: string): Promise<string[]> {
    const json = await this.call(["KEYS", `${prefix}*`]);
    return Array.isArray(json.result) ? (json.result as string[]).sort() : [];
  }

  async del(key: string): Promise<void> {
    await this.call(["DEL", key]);
  }

  async delByPrefix(prefix: string): Promise<number> {
    const matches = await this.keys(prefix);
    await Promise.all(matches.map((k) => this.del(k)));
    return matches.length;
  }
}

let storeSingleton: DataStore | null = null;

function createFallbackStore(): DataStore {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return new MemoryStore();
  const kv = new KvRestStore(url, token);
  return {
    kind: "kv-with-fallback" as const,
    async put(key: string, value: unknown) {
      try { await kv.put(key, value); }
      catch { await new MemoryStore().put(key, value); }
    },
    async get<T>(key: string) {
      try { return await kv.get<T>(key); }
      catch { return new MemoryStore().get<T>(key); }
    },
    async getMany<T>(keys: string[]) {
      try { return await kv.getMany<T>(keys); }
      catch { return new MemoryStore().getMany<T>(keys); }
    },
    async keys(prefix: string) {
      try { return await kv.keys(prefix); }
      catch { return new MemoryStore().keys(prefix); }
    },
    async del(key: string) {
      try { await kv.del(key); }
      catch { await new MemoryStore().del(key); }
    },
    async delByPrefix(prefix: string) {
      try { return await kv.delByPrefix(prefix); }
      catch { return new MemoryStore().delByPrefix(prefix); }
    },
  };
}

export function getDataStore(): DataStore {
  if (!storeSingleton) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    storeSingleton =
      url && token ? new KvRestStore(url, token) : new MemoryStore();
  }
  return storeSingleton;
}

/** Test-only seam: drop or replace the ambient singleton so suites stay
 *  hermetic regardless of ambient env. Pass null to re-derive from env. */
export function setDataStoreForTests(store: DataStore | null): void {
  storeSingleton = store;
}

export function workspaceHash(workspaceKey: string): string {
  // The workspace key is the bearer credential (kept client-side); records are
  // namespaced only by its hash.
  return createHash("sha256").update(workspaceKey).digest("hex").slice(0, 16);
}

/** N3: per-artifact byte cap at write time (Upstash 10 MiB request cap measured
 * in M1; 512 KB keeps a wide margin while covering any node payload). */
export const MAX_ARTIFACT_BYTES = 512 * 1000;

export class ArtifactTooLargeError extends Error {
  constructor(nodeId: string, seq: number, bytes: number) {
    super(`artifact ${nodeId}#${seq} is ${bytes} bytes; cap is ${MAX_ARTIFACT_BYTES}`);
    this.name = "ArtifactTooLargeError";
  }
}

/** Summary record kept for pruned (non-latest) runs. */
export interface ArtifactSummary {
  audit_id: string;
  ran_at: string;
  artifact_count: number;
  nodes: { node_id: string; payload_kind: string; validation_status: string }[];
  pruned_at: string;
}

const artifactSeqOf = (key: string): number => {
  const n = Number.parseInt(key.slice(key.lastIndexOf(":") + 1), 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

export class IssueRevisionConflictError extends Error {
  constructor(detail: string) {
    super(`issue revision conflict: ${detail}`);
    this.name = "IssueRevisionConflictError";
  }
}

/** Workspace-scoped repository over the store seam. Sole owner of the physical
 *  key scheme (ADR-0001): everything else addresses records through these
 *  static helpers or through repository methods. */
export class Repository {
  constructor(private store: DataStore) {}

  // ---- Key scheme ---------------------------------------------------------

  static projectKey(ws: string, projectId: string): string {
    return `ws:${ws}:project:${projectId}`;
  }
  static projectsPrefix(ws: string): string {
    return `ws:${ws}:project:`;
  }
  static auditKey(ws: string, projectId: string, auditId: string): string {
    return `ws:${ws}:audit:${projectId}:${auditId}`;
  }
  static auditsPrefix(ws: string, projectId: string): string {
    return `ws:${ws}:audit:${projectId}:`;
  }
  static attachmentKey(ws: string, projectId: string, attachmentId: string): string {
    return `ws:${ws}:attachment:${projectId}:${attachmentId}`;
  }
  static attachmentsPrefix(ws: string, projectId: string): string {
    return `ws:${ws}:attachment:${projectId}:`;
  }
  static artifactKey(
    ws: string,
    projectId: string,
    auditId: string,
    nodeId: string,
    seq: number,
  ): string {
    return `ws:${ws}:art:${projectId}:${auditId}:${nodeId}:${seq}`;
  }
  static artifactTrailPrefix(ws: string, projectId: string, auditId: string): string {
    return `ws:${ws}:art:${projectId}:${auditId}:`;
  }
  static artifactSummaryKey(ws: string, projectId: string, auditId: string): string {
    return `${Repository.artifactTrailPrefix(ws, projectId, auditId)}_summary`;
  }
  static issueKey(ws: string, projectId: string, auditId: string, rev: number): string {
    return `ws:${ws}:issue:${projectId}:${auditId}:${rev}`;
  }
  static issuesPrefix(ws: string, projectId: string, auditId: string): string {
    return `ws:${ws}:issue:${projectId}:${auditId}:`;
  }

  // ---- Projects ------------------------------------------------------------

  async saveProject(ws: string, project: Project) {
    await this.store.put(Repository.projectKey(ws, project.project_id), project);
  }
  async getProject(ws: string, id: string): Promise<Project | null> {
    return this.store.get<Project>(Repository.projectKey(ws, id));
  }
  async listProjects(ws: string): Promise<Project[]> {
    const keys = await this.store.keys(Repository.projectsPrefix(ws));
    const loaded = await this.store.getMany<Project>(keys);
    return loaded
      .filter((p): p is Project => p !== null)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  // ---- Audits --------------------------------------------------------------

  async saveAudit(ws: string, audit: AuditResult) {
    await this.store.put(Repository.auditKey(ws, audit.project_id, audit.audit_id), audit);
  }
  async getAudit(ws: string, projectId: string, auditId: string): Promise<AuditResult | null> {
    return this.store.get<AuditResult>(Repository.auditKey(ws, projectId, auditId));
  }
  async listAudits(ws: string, projectId: string): Promise<AuditResult[]> {
    const keys = await this.store.keys(Repository.auditsPrefix(ws, projectId));
    const loaded = await this.store.getMany<AuditResult>(keys);
    return loaded
      .filter((a): a is AuditResult => a !== null)
      .sort((a, b) => b.ran_at.localeCompare(a.ran_at));
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
    const prior = await this.listIssues(ws, projectId, auditId);
    const revision = (prior[prior.length - 1]?.revision ?? 0) + 1;
    const key = Repository.issueKey(ws, projectId, auditId, revision);
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
    return this.store.get<AuditIssue>(Repository.issueKey(ws, projectId, auditId, rev));
  }

  async listIssues(ws: string, projectId: string, auditId: string): Promise<AuditIssue[]> {
    const prefix = Repository.issuesPrefix(ws, projectId, auditId);
    const keys = await this.store.keys(prefix);
    keys.sort((a, b) => artifactSeqOf(a) - artifactSeqOf(b));
    const loaded = await this.store.getMany<AuditIssue>(keys);
    return loaded.filter((i): i is AuditIssue => i !== null);
  }

  // ---- Attachments -----------------------------------------------------------

  async saveAttachment(ws: string, attachment: Attachment) {
    await this.store.put(
      Repository.attachmentKey(ws, attachment.project_id, attachment.attachment_id),
      attachment,
    );
  }
  async getAttachment(ws: string, projectId: string, id: string): Promise<Attachment | null> {
    return this.store.get<Attachment>(Repository.attachmentKey(ws, projectId, id));
  }
  async listAttachments(ws: string, projectId: string): Promise<Attachment[]> {
    const keys = await this.store.keys(Repository.attachmentsPrefix(ws, projectId));
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
    await this.store.del(Repository.attachmentKey(ws, projectId, id));

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

  // ---- Node-artifact persistence (N3) -----------------------------------------

  /** Store the full artifact trail of one audit run under
   *  ws:{ws}:art:{projectId}:{auditId}:{nodeId}:{seq}; prune any previous full
   *  trail for the same audit to a summary record first (retention policy). */
  async saveArtifactTrailFor(
    ws: string,
    identity: { projectId: string; auditId: string },
    artifacts: AuditArtifact[],
  ) {
    await this.pruneArtifactTrail(ws, identity.projectId, identity.auditId);

    let seq = 0;
    for (const art of artifacts) {
      seq += 1;
      const bytes = Buffer.byteLength(JSON.stringify(art));
      if (bytes > MAX_ARTIFACT_BYTES) {
        throw new ArtifactTooLargeError(art.node_id, seq, bytes);
      }
      await this.store.put(
        Repository.artifactKey(ws, identity.projectId, identity.auditId, art.node_id, seq),
        art,
      );
    }
    return { stored: seq };
  }

  async getArtifact(
    ws: string,
    projectId: string,
    auditId: string,
    nodeId: string,
    seq: number,
  ): Promise<AuditArtifact | null> {
    return this.store.get<AuditArtifact>(
      Repository.artifactKey(ws, projectId, auditId, nodeId, seq),
    );
  }

  async listArtifacts(ws: string, projectId: string, auditId: string): Promise<AuditArtifact[]> {
    const prefix = Repository.artifactTrailPrefix(ws, projectId, auditId);
    const keys = (await this.store.keys(prefix)).filter((k) => !k.endsWith(":_summary"));
    // Trail order is the global write seq encoded in the key tail; numeric
    // ordering survives seq >= 10 where lexicographic order breaks.
    keys.sort((a, b) => artifactSeqOf(a) - artifactSeqOf(b));
    const loaded = await this.store.getMany<AuditArtifact>(keys);
    return loaded.filter((a): a is AuditArtifact => a !== null);
  }

  /** Replay rule: verified artifacts are trusted as-is; anything else must be
   *  regenerated deterministically before use. */
  replayPlan(artifacts: AuditArtifact[]): { trusted: AuditArtifact[]; regenerate: AuditArtifact[] } {
    return {
      trusted: artifacts.filter((a) => a.validation_status === "verified"),
      regenerate: artifacts.filter((a) => a.validation_status !== "verified"),
    };
  }

  private async pruneArtifactTrail(ws: string, projectId: string, auditId: string) {
    const prior = await this.listArtifacts(ws, projectId, auditId);
    if (prior.length === 0) return;
    const summary: ArtifactSummary = {
      audit_id: auditId,
      ran_at: String(prior[0].created_at ?? ""),
      artifact_count: prior.length,
      nodes: prior.map((a) => ({
        node_id: a.node_id,
        payload_kind: a.payload_kind,
        validation_status: a.validation_status,
      })),
      pruned_at: new Date().toISOString(),
    };
    // Ordered deletes (KV has no atomic multi-op): clear the old trail and any
    // stale summary first, then commit the fresh summary last.
    await this.store.delByPrefix(Repository.artifactTrailPrefix(ws, projectId, auditId));
    await this.store.put(Repository.artifactSummaryKey(ws, projectId, auditId), summary);
  }
}
