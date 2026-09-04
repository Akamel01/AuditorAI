// Harvest distributed lock — cross-instance via Vercel KV SET NX EX 120
// Process-local HARVEST_LOCK remains fast-path; this module adds KV truth.
// ponytail: global lock 120s TTL ceiling; per-cell locks if throughput matters
import { getDataStore } from "@/lib/persistence/store";
import type { DataStore } from "@/lib/persistence/store";

export const HARVEST_LOCK_KEY = "harvest:lock";
export const HARVEST_LOCK_TTL_SECONDS = 120;

export async function acquireHarvestLock(
  store: DataStore = getDataStore(),
  ttlSeconds: number = HARVEST_LOCK_TTL_SECONDS,
  holder: string = `holder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
): Promise<{ acquired: boolean; holder: string; release: () => Promise<void> }> {
  const key = HARVEST_LOCK_KEY;
  try {
    const fn = store.setIfAbsent?.bind(store);
    if (!fn) return { acquired: true, holder, release: async () => {} };
    const acquired = await fn(key, holder, ttlSeconds);
    if (!acquired) {
      return { acquired: false, holder, release: async () => {} };
    }
    return {
      acquired: true,
      holder,
      release: async () => {
        try {
          const cur = await store.get<string>(key);
          if (cur === holder) await store.del(key);
        } catch {}
      },
    };
  } catch {
    // best-effort: if KV unavailable, allow local lock to decide
    return { acquired: true, holder, release: async () => {} };
  }
}

export class StoreUnavailableError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "StoreUnavailableError";
  }
}
