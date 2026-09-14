// Pure health aggregation helpers for discovery/harvest health.
// This module purposely contains no side effects and accepts only input data
// derived from the KV/fileledger. It is safe to unit-test in isolation.
import type { LedgerEntry } from "./ledger";
import { getDataStore } from "@/lib/persistence/store";
import { HARVEST_LOCK_KEY } from "./harvest-lock";
import { getLedgerTailKV } from "./ledger";
import { listJobs } from "./jobs";
import type { DataStore } from "@/lib/persistence";

export interface HarvestHealth {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastHits: number | null;
  degraded: boolean;
}

// Extended HarvestHealth for bridge/workflow routing: expose four extra
// read-bridged fields and KV-backed lock state. This keeps the core
// aggregation pure (4 fields) while allowing the HTTP route to surface
// richer diagnostics when the KV seam is available.
export interface HarvestHealthBridge extends HarvestHealth {
  lastRunStatus: string | null; // status of the latest discovery job
  indexedEntriesCount: number; // total number of indexed ledger entries
  lockHolder: string | null; // value stored in harvest:lock
  lockAcquiredAt: string | null; // parsed timestamp from lockHolder if possible
}

/**
 * Purely derive a lightweight harvest health snapshot from a list of
 * discovery ledger entries. The ledger entries originate from the
 * discovery/harvest path and carry an "at" timestamp and a
 * payload_kind. We treat any non-empty ledger as indicating activity and
 * surface a best-effort health picture.
 */
export function aggregateHarvestHealth(entries?: LedgerEntry[] | null): HarvestHealth {
  if (!entries || entries.length === 0) {
    return {
      lastRunAt: null,
      lastSuccessAt: null,
      lastHits: null,
      degraded: false,
    };
  }

  // lastRunAt: latest timestamp across all ledger entries
  let lastRunAt: string | null = null;
  for (const e of entries) {
    if (!e?.at) continue;
    if (!lastRunAt) {
      lastRunAt = e.at;
      continue;
    }
    const a = Date.parse(e.at);
    const b = Date.parse(lastRunAt);
    if (!Number.isNaN(a) && !Number.isNaN(b) && a > b) {
      lastRunAt = e.at;
    }
  }

  // lastHits: count how many ledger entries are discovery_hits
  const lastHits = entries.filter((e) => e?.payload_kind === "discovery_hits").length;

  // lastSuccessAt: if we have any hits, reuse lastRunAt as a reasonable proxy
  const lastSuccessAt = lastHits > 0 ? lastRunAt : null;

  // Degraded is a best-effort boolean; the ledger does not encode failure
  // state for health in this simplistic model, so default to false.
  const degraded = false;

  return {
    lastRunAt,
    lastSuccessAt,
    lastHits: lastHits ?? null,
    degraded,
  };
}

// Bridge helper: derive an 8-field harvest health snapshot from the KV seam when
// available. Falls back to the pure shape when the KV seam cannot be read.
// Optional fallbackEntries (e.g. file-ledger rows read by the caller) backfill the
// base fields when the KV tail is empty; the bridge itself performs no FS reads.
export async function bridgeHarvestHealth(store?: DataStore, limit = 50, fallbackEntries?: LedgerEntry[] | null): Promise<HarvestHealthBridge> {
  // Start from the pure health surface derived from the ledger tail
  let tailRes: { entries: LedgerEntry[]; total: number } = { entries: [], total: 0 };
  try {
    tailRes = await getLedgerTailKV(limit, store);
  } catch {
    tailRes = { entries: [], total: 0 };
  }
  const entries = tailRes.entries.length > 0 ? tailRes.entries : (fallbackEntries ?? []);
  const base = aggregateHarvestHealth(entries);

  // lastRunStatus: status of the latest job, if any
  let lastRunStatus: string | null = null;
  try {
    const latest = await listJobs(1, undefined, store);
    if (latest.jobs && latest.jobs.length > 0) {
      lastRunStatus = latest.jobs[0].status ?? null;
    }
  } catch {
    lastRunStatus = null;
  }

  // indexedEntriesCount: ledger tail total, or fallback length when KV tail is empty
  const indexedEntriesCount = tailRes.total > 0 ? tailRes.total : entries.length;

  // lock information from KV harvest lock; parse timestamp from the holder string
  let lockHolder: string | null = null;
  let lockAcquiredAt: string | null = null;
  try {
    const ds = store ?? getDataStore();
    const v = await ds.get<string>(HARVEST_LOCK_KEY);
    if (v) {
      lockHolder = v;
      // ponytail: parse only the default holder-<epochMs> shape; jobId holders
      // (e.g. job_<base36>_<rand> from executeJob) leave lockAcquiredAt null —
      // do not couple to the opaque holder format.
      const m = /holder-(\d+)/.exec(v);
      if (m && m[1]) {
        const ts = Number(m[1]);
        if (!Number.isNaN(ts)) lockAcquiredAt = new Date(ts).toISOString();
      }
    }
  } catch {
    lockHolder = null;
    lockAcquiredAt = null;
  }

  return {
    ...base,
    lastRunStatus,
    indexedEntriesCount,
    lockHolder,
    lockAcquiredAt,
  } as HarvestHealthBridge;
}
