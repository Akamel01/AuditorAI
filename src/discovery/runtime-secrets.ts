// Runtime secret overrides for agent reach (H11) — server-side only.
// Lets the Mission Control AI Harvest tab enable live reach without
// redeploying env: overrides persist in DataStore (KV on Vercel, memory
// locally) under discovery:runtime-secrets. Only presence booleans are ever
// exposed via the admin-gated API; values never leave the process.
import type { DataStore } from "@/lib/persistence";
import { getDataStore } from "@/lib/persistence/store";

const KEY = "discovery:runtime-secrets";
const MAX_LEN = 500;

export interface RuntimeSecrets {
  enabled: boolean;
  exaKey: string | null;
  opencodeKey: string | null;
}

export interface RuntimePresence {
  enabled: boolean;
  hasExaKey: boolean;
  hasOpencodeKey: boolean;
  live: boolean;
}

const EMPTY: RuntimeSecrets = { enabled: false, exaKey: null, opencodeKey: null };

type Stored = { enabled?: boolean; exaKey?: string; opencodeKey?: string };

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, MAX_LEN) : null;
}

export async function getRuntimeSecrets(store?: DataStore): Promise<RuntimeSecrets> {
  const s = store ?? getDataStore();
  let doc: Stored | null = null;
  try {
    doc = await s.get<Stored>(KEY);
  } catch {
    return EMPTY;
  }
  if (!doc || typeof doc !== "object") return EMPTY;
  return {
    enabled: doc.enabled === true,
    exaKey: clean(doc.exaKey),
    opencodeKey: clean(doc.opencodeKey),
  };
}

export interface RuntimeSecretsPatch {
  enabled?: boolean;
  exaKey?: string;
  opencodeKey?: string;
}

/** Patch semantics: undefined = keep, "" = clear, value = set (trimmed, capped). */
export async function setRuntimeSecrets(patch: RuntimeSecretsPatch, store?: DataStore): Promise<RuntimeSecrets> {
  const s = store ?? getDataStore();
  const cur = await getRuntimeSecrets(s);
  const next: Stored = {};
  const enabled = patch.enabled ?? cur.enabled;
  if (enabled) next.enabled = true;
  if (patch.exaKey !== undefined) {
    const c = clean(patch.exaKey);
    if (c) next.exaKey = c;
  } else if (cur.exaKey) {
    next.exaKey = cur.exaKey;
  }
  if (patch.opencodeKey !== undefined) {
    const c = clean(patch.opencodeKey);
    if (c) next.opencodeKey = c;
  } else if (cur.opencodeKey) {
    next.opencodeKey = cur.opencodeKey;
  }
  await s.put(KEY, next);
  return getRuntimeSecrets(s);
}

export async function clearRuntimeSecrets(store?: DataStore): Promise<void> {
  const s = store ?? getDataStore();
  try {
    await s.del(KEY);
  } catch {
    /* best-effort */
  }
}

export async function runtimeSecretPresence(store?: DataStore): Promise<RuntimePresence> {
  const r = await getRuntimeSecrets(store);
  const hasExaKey = r.exaKey !== null;
  const hasOpencodeKey = r.opencodeKey !== null;
  return { enabled: r.enabled, hasExaKey, hasOpencodeKey, live: r.enabled && hasExaKey && hasOpencodeKey };
}
