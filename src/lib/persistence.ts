// Persistence seam (ADR-0001): callers depend on this interface only.
// Adapters: in-memory (tests/dev), Upstash/Vercel-KV REST (production free tier).
// Swapping stores = env change, never code change.
import { createHash } from "node:crypto";
import type { AuditResult, Project } from "@/domain/types";

export interface DataStore {
  put(key: string, value: unknown): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  keys(prefix: string): Promise<string[]>;
}

export class MemoryStore implements DataStore {
  private m = new Map<string, string>();
  async put(key: string, value: unknown) {
    this.m.set(key, JSON.stringify(value));
  }
  async get<T>(key: string): Promise<T | null> {
    const raw = this.m.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async keys(prefix: string): Promise<string[]> {
    return [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

/** Vercel KV / Upstash share the REST protocol; no SDK dependency needed. */
export class KvRestStore implements DataStore {
  constructor(private baseUrl: string, private token: string) {}

  private async call(command: unknown[]): Promise<{ result?: unknown } | null> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { result?: unknown };
  }

  async put(key: string, value: unknown): Promise<void> {
    await this.call(["SET", key, JSON.stringify(value)]);
  }

  async get<T>(key: string): Promise<T | null> {
    const json = await this.call(["GET", key]);
    const raw = json?.result;
    return typeof raw === "string" ? (JSON.parse(raw) as T) : null;
  }

  async keys(prefix: string): Promise<string[]> {
    const json = await this.call(["KEYS", `${prefix}*`]);
    return Array.isArray(json?.result) ? (json.result as string[]).sort() : [];
  }
}

export function getDataStore(): DataStore {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) return new KvRestStore(url, token);
  return new MemoryStore(); // dev/test fallback — product stays fully functional
}

export function workspaceHash(workspaceKey: string): string {
  // The workspace key is the bearer credential (kept client-side); records are
  // namespaced only by its hash.
  return createHash("sha256").update(workspaceKey).digest("hex").slice(0, 16);
}

const P = (ws: string, id: string) => `ws:${ws}:project:${id}`;
const A = (ws: string, pid: string, aid: string) => `ws:${ws}:audit:${pid}:${aid}`;

/** Workspace-scoped repository over the store seam. */
export class Repository {
  constructor(private store: DataStore) {}

  async saveProject(ws: string, project: Project) {
    await this.store.put(P(ws, project.project_id), project);
  }
  async getProject(ws: string, id: string): Promise<Project | null> {
    return this.store.get<Project>(P(ws, id));
  }
  async listProjects(ws: string): Promise<Project[]> {
    const keys = await this.store.keys(`ws:${ws}:project:`);
    const out: Project[] = [];
    for (const k of keys) {
      const p = await this.store.get<Project>(k);
      if (p) out.push(p);
    }
    return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  async saveAudit(ws: string, audit: AuditResult) {
    await this.store.put(A(ws, audit.project_id, audit.audit_id), audit);
  }
  async getAudit(ws: string, projectId: string, auditId: string): Promise<AuditResult | null> {
    return this.store.get<AuditResult>(A(ws, projectId, auditId));
  }
  async listAudits(ws: string, projectId: string): Promise<AuditResult[]> {
    const keys = await this.store.keys(`ws:${ws}:audit:${projectId}:`);
    const out: AuditResult[] = [];
    for (const k of keys) {
      const a = await this.store.get<AuditResult>(k);
      if (a) out.push(a);
    }
    return out.sort((a, b) => b.ran_at.localeCompare(a.ran_at));
  }
}

