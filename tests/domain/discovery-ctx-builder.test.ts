import { describe, it, expect } from "vitest";
import { buildDiscoveryCtx, UnknownCellKeyError, DEPRECATED_PROVIDERS } from "@/discovery/harvest";

// Hermetic stubs: no FS, no network.
const ODD = JSON.stringify({ cells: [{ jurisdiction_id: "uk", canonical_stage: ["PRELIMINARY_DESIGN"] }] });
const GAPS = JSON.stringify({ gaps_ranked: ["uk:S1", "us:PRELIM"] });
const DEPS = {
  readFileSync: (p: string) => {
    if (p.endsWith("odd.json")) return ODD;
    if (p.endsWith("odd-coverage.json")) return GAPS;
    if (p.endsWith("dedupe-index.json")) throw new Error("no index");
    throw new Error("unexpected read " + p);
  },
  cwd: () => "/repo",
  listProviderIds: () => ["seed-portals", "brave-search", "google-cse", "agent-reach-search"],
  providerEnabled: (id: string) => id === "seed-portals",
};

describe("buildDiscoveryCtx (M-A2 single derivation)", () => {
  it("same input both paths → identical providerIds/query", () => {
    const a = buildDiscoveryCtx({ live: true, cellKey: "uk:PRELIMINARY_DESIGN" }, DEPS);
    const b = buildDiscoveryCtx({ live: true, cellKey: "uk:PRELIMINARY_DESIGN" }, DEPS);
    expect(a.providerIds).toEqual(b.providerIds);
    expect(a.query).toEqual(b.query);
    expect(a.providerIds).toContain("seed-portals");
    // agent-reach-search carve-out preserved even though providerEnabled is false
    expect(a.providerIds).toContain("agent-reach-search");
    // DEPRECATED excluded in live mode
    for (const d of DEPRECATED_PROVIDERS) expect(a.providerIds).not.toContain(d);
    expect(a.query.jurisdictions).toEqual(["UK"]);
  });

  it("null cellKey derives gaps-aware query, static fallback when unreadable", () => {
    const g = buildDiscoveryCtx({ live: false, cellKey: null }, DEPS);
    expect(g.query.jurisdictions).toEqual(["UK", "US"]);
    expect(g.providerIds).toEqual(["seed-portals"]);
    const s = buildDiscoveryCtx({ live: false, cellKey: null }, { ...DEPS, readFileSync: () => { throw new Error("no fs"); } });
    expect(s.query.jurisdictions).toEqual(["UK", "US", "CA", "AE", "INT"]);
  });

  it("unknown cellKey throws; validateCellKey:false tolerates (stream)", () => {
    expect(() => buildDiscoveryCtx({ live: true, cellKey: "xx:NOPE" }, DEPS)).toThrow(UnknownCellKeyError);
    const t = buildDiscoveryCtx({ live: true, cellKey: "xx:NOPE", validateCellKey: false }, DEPS);
    expect(t.query.jurisdictions).toEqual(["INT"]);
  });
});
