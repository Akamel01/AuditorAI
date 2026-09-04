import { describe, test, expect } from "vitest";
import { createHarvestProofBundle, sha256Hex } from "@/discovery/proof-bundle";

describe("R4 proof bundle", () => {
  test("ledgerDigest === sha256(JSON.stringify(entries))", () => {
    const entries = [{ seq: 1, at: "2026-09-03T00:00:00Z", payload_kind: "test", data: { a: 1 } }] as unknown as import("@/discovery/ledger").LedgerEntry[];
    const bundle = createHarvestProofBundle(entries, { jobId: "test" });
    expect(bundle.ledgerDigest).toBe(sha256Hex(JSON.stringify(entries)));
  });
  test("dedupeDigest deduped", () => {
    const entries = [
      { seq: 1, at: "2026-09-03T00:00:00Z", payload_kind: "test", data: { a: 1 } },
      { seq: 1, at: "2026-09-03T00:00:00Z", payload_kind: "test", data: { a: 1 } },
    ] as unknown as import("@/discovery/ledger").LedgerEntry[];
    const bundle = createHarvestProofBundle(entries);
    const deduped = [...new Map(entries.map((e) => [JSON.stringify(e), e])).values()];
    expect(bundle.dedupeDigest).toBe(sha256Hex(JSON.stringify(deduped)));
  });
});
