// Pure health aggregation helpers for discovery/harvest health.
// This module purposely contains no side effects and accepts only input data
// derived from the KV/fileledger. It is safe to unit-test in isolation.
import type { LedgerEntry } from "./ledger";

export interface HarvestHealth {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastHits: number | null;
  degraded: boolean;
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
