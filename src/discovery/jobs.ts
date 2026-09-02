// Discovery job store — KV-backed via DataStore seam (ADR-0001), file fallback for dev.
// Survives refresh/tab switch via persisted jobId in localStorage; survives Vercel
// function boundary via KV (Upstash/Vercel-KV REST) when available, otherwise via
// state/discovery-jobs.json file (shared across Next.js route bundles where MemoryStore
// is per-function and not shared). Keys owned here only.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDataStore, type DataStore } from "@/lib/persistence";

export type DiscoveryJobStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface DiscoveryJobLog {
  at: string;
  node: string;
  message: string;
}

export interface DiscoveryJob {
  id: string;
  status: DiscoveryJobStatus;
  live: boolean;
  cellKey: string | null;
  providers: string[];
  createdAt: string;
  updatedAt: string;
  logs: DiscoveryJobLog[];
  currentNode: string | null;
  result?: {
    ranAtIso: string;
    coverage: unknown | null;
    queue: unknown[];
    packages: unknown[];
    hits: unknown[];
    matched: unknown[];
    refusals: string[];
    quality: unknown[];
  };
  error?: string | null;
}

const PREFIX = "discovery:job:";
const INDEX_KEY = "discovery:job:index";

function key(id: string): string {
  return `${PREFIX}${id}`;
}

function genId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `job_${Date.now().toString(36)}_${rand}`;
}

function isKv(): boolean {
  try {
    const k = getDataStore().kind;
    return k === "kv";
  } catch {
    return false;
  }
}



function jobsFilePath(): string {
  return path.join(process.cwd(), "state", "discovery-jobs.json");
}

type JobsFile = { index: string[]; jobs: Record<string, DiscoveryJob> };

function readJobsFile(): JobsFile {
  try {
    const p = jobsFilePath();
    if (!existsSync(p)) return { index: [], jobs: {} };
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<JobsFile>;
    return {
      index: Array.isArray(parsed.index) ? parsed.index : [],
      jobs: parsed.jobs && typeof parsed.jobs === "object" ? (parsed.jobs as Record<string, DiscoveryJob>) : {},
    };
  } catch {
    return { index: [], jobs: {} };
  }
}

function writeJobsFile(data: JobsFile): void {
  try {
    const p = jobsFilePath();
    const dir = path.dirname(p);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
  } catch {}
}

async function loadIndex(store?: DataStore): Promise<string[]> {
  if (store) {
    try {
      const idx = await store.get<string[]>(INDEX_KEY);
      return Array.isArray(idx) ? idx : [];
    } catch {
      return [];
    }
  }
  if (isKv()) {
    try {
      const s = getDataStore();
      const idx = await s.get<string[]>(INDEX_KEY);
      return Array.isArray(idx) ? idx : [];
    } catch {
      return [];
    }
  }
  return readJobsFile().index;
}

async function saveIndex(ids: string[], store?: DataStore): Promise<void> {
  if (store) {
    try {
      await store.put(INDEX_KEY, ids);
    } catch {}
    return;
  }
  if (isKv()) {
    try {
      await getDataStore().put(INDEX_KEY, ids);
    } catch {}
    return;
  }
  const data = readJobsFile();
  data.index = ids;
  writeJobsFile(data);
}

export async function createJob(
  input: {
    live: boolean;
    cellKey: string | null;
    providers: string[];
  },
  store?: DataStore,
): Promise<DiscoveryJob> {
  const now = new Date().toISOString();
  const job: DiscoveryJob = {
    id: genId(),
    status: "queued",
    live: input.live,
    cellKey: input.cellKey,
    providers: input.providers,
    createdAt: now,
    updatedAt: now,
    logs: [],
    currentNode: null,
    error: null,
  };
  if (store) {
    await store.put(key(job.id), job);
    const idx = await loadIndex(store);
    if (!idx.includes(job.id)) {
      idx.unshift(job.id);
      const trimmed = idx.slice(0, 20);
      await saveIndex(trimmed, store);
      const toPrune = idx.slice(20);
      for (const old of toPrune) {
        try {
          await store.del(key(old));
        } catch {}
      }
    }
    return job;
  }
  if (isKv()) {
    const s = getDataStore();
    await s.put(key(job.id), job);
    const idx = await loadIndex();
    if (!idx.includes(job.id)) {
      idx.unshift(job.id);
      const trimmed = idx.slice(0, 20);
      await saveIndex(trimmed);
      const toPrune = idx.slice(20);
      for (const old of toPrune) {
        try {
          await s.del(key(old));
        } catch {}
      }
    }
  } else {
    const data = readJobsFile();
    data.jobs[job.id] = job;
    if (!data.index.includes(job.id)) data.index.unshift(job.id);
    data.index = data.index.slice(0, 20);
    // prune old jobs beyond index
    for (const k of Object.keys(data.jobs)) {
      if (!data.index.includes(k)) delete data.jobs[k];
    }
    writeJobsFile(data);
  }
  return job;
}

export async function getJob(id: string, store?: DataStore): Promise<DiscoveryJob | null> {
  if (store) {
    try {
      return await store.get<DiscoveryJob>(key(id));
    } catch {
      return null;
    }
  }
  if (isKv()) {
    try {
      return await getDataStore().get<DiscoveryJob>(key(id));
    } catch {
      return null;
    }
  }
  return readJobsFile().jobs[id] ?? null;
}

// List a page of jobs using a stable cursor strategy.
// - If cursor is provided and exists in the index, return the next page after the cursor.
// - If cursor is provided but not found (trimmed/past), return the latest page (0..limit).
// - If no cursor is provided, return the latest page (0..limit).
// Always return an object with { jobs, nextCursor } where nextCursor is the id of the
// last item in the returned page (or null if the page is empty).
export async function listJobs(
  limit = 10,
  cursor?: string,
  store?: DataStore
): Promise<{ jobs: DiscoveryJob[]; nextCursor: string | null; total: number }> {
  const ids = await loadIndex(store);
  const total = ids.length;
  // determine the ids that should be in this page
  let pageIds: string[];
  if (cursor) {
    const idx = ids.indexOf(cursor);
    if (idx >= 0) {
      pageIds = ids.slice(idx + 1, idx + 1 + limit);
      // if cursor exists but there are no items after it, fall back to latest page
      if (pageIds.length === 0) {
        pageIds = ids.slice(0, limit);
      }
    } else {
      // cursor not found (trimmed past), return latest page
      pageIds = ids.slice(0, limit);
    }
  } else {
    pageIds = ids.slice(0, limit);
  }
  if (pageIds.length === 0) {
    return { jobs: [], nextCursor: null, total };
  }
  // fetch the actual job objects from the chosen storage
  let jobs: DiscoveryJob[] = [];
  if (store) {
    try {
      const found = await store.getMany<DiscoveryJob>(pageIds.map((id) => key(id)));
      jobs = found.filter((j): j is DiscoveryJob => j !== null);
    } catch {
      jobs = [];
    }
  } else if (isKv()) {
    try {
      const s = getDataStore();
      const found = await s.getMany<DiscoveryJob>(pageIds.map((id) => key(id)));
      jobs = found.filter((j): j is DiscoveryJob => j !== null);
    } catch {
      jobs = [];
    }
  } else {
    const data = readJobsFile();
    jobs = pageIds.map((id) => data.jobs[id]).filter((j): j is DiscoveryJob => !!j);
  }
  // compute nextCursor as the last id returned, or null if none
  const nextCursor = pageIds[pageIds.length - 1] ?? null;
  return { jobs, nextCursor, total };
}

export async function updateJob(
  id: string,
  patch: Partial<DiscoveryJob> & { updatedAt?: string },
  store?: DataStore,
): Promise<DiscoveryJob | null> {
  if (store) {
    const cur = await store.get<DiscoveryJob>(key(id));
    if (!cur) return null;
    const next: DiscoveryJob = {
      ...cur,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
      logs: patch.logs ?? cur.logs,
    };
    await store.put(key(id), next);
    return next;
  }
  if (isKv()) {
    const s = getDataStore();
    const cur = await s.get<DiscoveryJob>(key(id));
    if (!cur) return null;
    const next: DiscoveryJob = {
      ...cur,
      ...patch,
      updatedAt: patch.updatedAt ?? new Date().toISOString(),
      logs: patch.logs ?? cur.logs,
    };
    await s.put(key(id), next);
    return next;
  }
  const data = readJobsFile();
  const cur = data.jobs[id];
  if (!cur) return null;
  const next: DiscoveryJob = {
    ...cur,
    ...patch,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
    logs: patch.logs ?? cur.logs,
  };
  data.jobs[id] = next;
  writeJobsFile(data);
  return next;
}

export async function appendLog(id: string, entry: DiscoveryJobLog, store?: DataStore): Promise<void> {
  if (store) {
    const cur = await store.get<DiscoveryJob>(key(id));
    if (!cur) return;
    const logs = [...cur.logs, entry];
    const trimmed = logs.length > 200 ? logs.slice(-200) : logs;
    const next: DiscoveryJob = {
      ...cur,
      logs: trimmed,
      currentNode: entry.node,
      updatedAt: new Date().toISOString(),
    };
    await store.put(key(id), next);
    return;
  }
  if (isKv()) {
    const s = getDataStore();
    const cur = await s.get<DiscoveryJob>(key(id));
    if (!cur) return;
    const logs = [...cur.logs, entry];
    const trimmed = logs.length > 200 ? logs.slice(-200) : logs;
    const next: DiscoveryJob = {
      ...cur,
      logs: trimmed,
      currentNode: entry.node,
      updatedAt: new Date().toISOString(),
    };
    await s.put(key(id), next);
    return;
  }
  const data = readJobsFile();
  const cur = data.jobs[id];
  if (!cur) return;
  const logs = [...cur.logs, entry];
  const trimmed = logs.length > 200 ? logs.slice(-200) : logs;
  data.jobs[id] = { ...cur, logs: trimmed, currentNode: entry.node, updatedAt: new Date().toISOString() };
  writeJobsFile(data);
}

export async function setJobRunning(id: string, node: string | null = null, store?: DataStore): Promise<void> {
  await updateJob(id, { status: "running", currentNode: node }, store);
}

export async function setJobDone(id: string, result: NonNullable<DiscoveryJob["result"]>, store?: DataStore): Promise<void> {
  await updateJob(id, { status: "done", result, currentNode: null, error: null }, store);
}

export async function setJobError(id: string, error: string, store?: DataStore): Promise<void> {
  await updateJob(id, { status: "error", error, currentNode: null }, store);
}
