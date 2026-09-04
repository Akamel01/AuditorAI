// Persistence store seam (ADR-0001): DataStore adapters and singleton.
// This module owns the transport-level seam only. Key scheme lives in keys.ts;
// entity stores (ProjectStore, ArtifactTrail, IssueLedger) share this seam.
import { createHash } from "node:crypto";

/** The store itself is unreachable/unhealthy: transport failure, non-2xx REST
 *  status, auth rejection, malformed response. Never used for absent keys —
 *  those resolve to null so "missing" stays distinguishable from "down". */
export class StoreUnavailableError extends Error {
  constructor(detail: string) {
    super(`storage unavailable: ${detail}`);
    this.name = "StoreUnavailableError";
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
  /** SET NX EX — true if set (OK), false if already exists. Used for harvest:lock. */
  setIfAbsent?(key: string, value: string, ttlSeconds: number): Promise<boolean>;
}

export class MemoryStore implements DataStore {
  readonly kind = "memory" as const;
  private m = new Map<string, string>();
  private t = new Map<string, ReturnType<typeof setTimeout>>();
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
    const tm = this.t.get(key);
    if (tm) {
      clearTimeout(tm);
      this.t.delete(key);
    }
  }
  async delByPrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const k of [...this.m.keys()]) {
      if (k.startsWith(prefix)) {
        this.m.delete(k);
        const tm = this.t.get(k);
        if (tm) {
          clearTimeout(tm);
          this.t.delete(k);
        }
        n += 1;
      }
    }
    return n;
  }
  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (this.m.has(key)) return false;
    this.m.set(key, JSON.stringify(value));
    if (ttlSeconds > 0) {
      const tm = setTimeout(() => {
        this.m.delete(key);
        this.t.delete(key);
      }, ttlSeconds * 1000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((tm as any).unref) (tm as any).unref();
      this.t.set(key, tm);
    }
    return true;
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
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      res = await fetch(this.baseUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(command),
        cache: "no-store",
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new StoreUnavailableError(e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
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

  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const json = await this.call(["SET", key, value, "NX", "EX", String(ttlSeconds)]);
    // Upstash returns "OK" when set, null when not set
    return json.result === "OK";
  }
}

let storeSingleton: DataStore | null = null;

function createFallbackStore(): DataStore {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return new MemoryStore();
  const kv = new KvRestStore(url, token);
  const fallback = new MemoryStore();
  return {
    kind: "kv" as const,
    async put(key: string, value: unknown) {
      try {
        await kv.put(key, value);
      } catch {
        await fallback.put(key, value);
      }
    },
    async get<T>(key: string) {
      try {
        return await kv.get<T>(key);
      } catch {
        return fallback.get<T>(key);
      }
    },
    async getMany<T>(keys: string[]) {
      try {
        return await kv.getMany<T>(keys);
      } catch {
        return fallback.getMany<T>(keys);
      }
    },
    async keys(prefix: string) {
      try {
        return await kv.keys(prefix);
      } catch {
        return fallback.keys(prefix);
      }
    },
    async del(key: string) {
      try {
        await kv.del(key);
      } catch {
        return fallback.del(key);
      }
    },
    async delByPrefix(prefix: string) {
      try {
        return await kv.delByPrefix(prefix);
      } catch {
        return fallback.delByPrefix(prefix);
      }
    },
    async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
      try {
        return await kv.setIfAbsent(key, value, ttlSeconds);
      } catch {
        return fallback.setIfAbsent(key, value, ttlSeconds);
      }
    },
  };
}

export function getDataStore(): DataStore {
  if (!storeSingleton) {
    storeSingleton = createFallbackStore();
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
