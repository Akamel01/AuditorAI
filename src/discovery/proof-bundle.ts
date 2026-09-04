// R4 Proof bundle — KV truth + file mirror, single KV object ceiling
import { createHash } from "node:crypto";
import type { LedgerEntry } from "./ledger";

export interface HarvestProofBundle {
  ledgerDigest: string;
  dedupeDigest: string;
  capturedAt: string;
  manifest: Record<string, unknown>;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function createHarvestProofBundle(
  entries: LedgerEntry[],
  manifest: Record<string, unknown> = {},
): HarvestProofBundle {
  const ledgerDigest = sha256Hex(JSON.stringify(entries));
  // dedupeDigest: for now same as ledgerDigest deduped via JSON string dedup
  const deduped = [...new Map(entries.map((e) => [JSON.stringify(e), e])).values()];
  const dedupeDigest = sha256Hex(JSON.stringify(deduped));
  return {
    ledgerDigest,
    dedupeDigest,
    capturedAt: new Date().toISOString(),
    manifest,
  };
}
