// Harvest unit tests — verifies extraction from route via MemoryStore seam.
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStore } from "@/lib/persistence";
import { harvest, executeJob, themeFor, fixtureDocsFor, JUR_MAP, UnknownCellKeyError } from "@/discovery/harvest";
import { getJob } from "@/discovery/jobs";
import type { MatchAssignment } from "@/discovery/types";

function makeOddJson(cells: { jurisdiction_id: string; canonical_stage: string[] }[] = [
  { jurisdiction_id: "uk", canonical_stage: ["PRELIMINARY_DESIGN"] },
  { jurisdiction_id: "usa", canonical_stage: ["DETAILED_DESIGN"] },
  { jurisdiction_id: "canada", canonical_stage: ["FEASIBILITY_CONCEPT"] },
]): string {
  return JSON.stringify({ cells });
}

function mockRead(map: Record<string, string>) {
  return (p: string, _enc: string) => {
    for (const [k, v] of Object.entries(map)) if (p.endsWith(k)) return v;
    throw new Error(`ENOENT ${p}`);
  };
}

describe("harvest helpers", () => {
  it("themeFor maps stage fragments to themes", () => {
    expect(themeFor("uk:DETAILED_DESIGN")).toBe("final design road safety audit");
    expect(themeFor("canada:FEASIBILITY_CONCEPT")).toBe("feasibility concept road safety audit");
    expect(themeFor("uk:PRELIMINARY_DESIGN")).toBe("preliminary design road safety audit");
    expect(themeFor("something-else")).toBe("preliminary design road safety audit");
  });

  it("JUR_MAP resolves directory ids to jurisdiction codes", () => {
    expect(JUR_MAP["uk"]).toBe("UK");
    expect(JUR_MAP["usa"]).toBe("US");
    expect(JUR_MAP["canada"]).toBe("CA");
    expect(JUR_MAP["ae"]).toBe("AE");
    expect(JUR_MAP["uae"]).toBe("AE");
    expect(JUR_MAP["international"]).toBe("INT");
  });

  it("fixtureDocsFor returns UK triple vs single for others", () => {
    const ukMatch: MatchAssignment = {
      match_id: "m1", qualification_id: "q1", jurisdiction: "UK", native_stage_id: "uk:S1",
      canonical_stages: ["PRELIMINARY_DESIGN"], mapping_confidence: "authoritative", odd_status: "in", matched_by: "t",
    };
    const aeMatch: MatchAssignment = {
      match_id: "m2", qualification_id: "q2", jurisdiction: "AE", native_stage_id: "ae-ad:S0",
      canonical_stages: ["FEASIBILITY_CONCEPT"], mapping_confidence: "authoritative", odd_status: "mapped_unproven", matched_by: "t",
    };
    expect(fixtureDocsFor(ukMatch)).toHaveLength(3);
    expect(fixtureDocsFor(aeMatch)).toHaveLength(1);
    expect(fixtureDocsFor(ukMatch)[0].url).toContain("uk-s1");
    expect(fixtureDocsFor(aeMatch)[0].url).toContain("ae-rsa");
  });
});

describe("harvest via MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it("dry-run creates queued job with seed-portals only and gap-aware defaults", async () => {
    const res = await harvest({ live: false, cellKey: null }, {
      store,
      readFileSync: mockRead({}),
      cwd: () => "/tmp",
      nowIso: () => new Date(0).toISOString(),
    });
    expect(res.live).toBe(false);
    expect(res.providers).toEqual(["seed-portals"]);
    expect(res.ranAtIso).toBe(new Date(0).toISOString());
    expect(res.cellKey).toBeNull();
    expect(res.jobId.startsWith("job_")).toBe(true);
    // Verify persisted in injected store, not file fallback
    const job = await getJob(res.jobId, store);
    expect(job).not.toBeNull();
    expect(job!.status).toBe("queued");
    expect(job!.providers).toEqual(["seed-portals"]);
  });

  it("targeted cellKey derives jurisdictional query and theme", async () => {
    const oddJson = makeOddJson();
    const res = await harvest({ live: false, cellKey: "uk:PRELIMINARY_DESIGN" }, {
      store,
      readFileSync: mockRead({ "policies/odd.json": oddJson }),
      cwd: () => "/tmp",
    });
    expect(res.cellKey).toBe("uk:PRELIMINARY_DESIGN");
    expect(res.ctx.query.jurisdictions).toEqual(["UK"]);
    expect(res.ctx.query.themes).toEqual(["preliminary design road safety audit"]);
  });

  it("throws UnknownCellKeyError byte-identical for unknown cellKey", async () => {
    const oddJson = makeOddJson();
    await expect(harvest({ live: false, cellKey: "uk:UNKNOWN_STAGE" }, {
      store,
      readFileSync: mockRead({ "policies/odd.json": oddJson }),
      cwd: () => "/tmp",
    })).rejects.toThrow(UnknownCellKeyError);
    await expect(harvest({ live: false, cellKey: "uk:UNKNOWN_STAGE" }, {
      store,
      readFileSync: mockRead({ "policies/odd.json": oddJson }),
      cwd: () => "/tmp",
    })).rejects.toThrow("unknown cellKey uk:UNKNOWN_STAGE");
  });

  it("gap-aware derives from coverage top 3 when cellKey absent", async () => {
    const coverage = JSON.stringify({ gaps_ranked: ["usa:DETAILED_DESIGN", "uk:PRELIMINARY_DESIGN", "canada:FEASIBILITY_CONCEPT"] });
    const res = await harvest({ live: false, cellKey: null }, {
      store,
      readFileSync: mockRead({ "state/odd-coverage.json": coverage }),
      cwd: () => "/tmp",
    });
    // Should derive jurisdictions from gaps
    expect(res.ctx.query.jurisdictions).toEqual(expect.arrayContaining(["US", "UK", "CA"]));
    expect(res.ctx.query.themes).toHaveLength(3);
    // Themes map via themeFor
    expect(res.ctx.query.themes[0]).toBe("final design road safety audit"); // usa:DETAILED_DESIGN
  });

  it("live resolves extra providers via injection and uses live timestamp", async () => {
    const fixedNow = "2026-08-26T12:00:00.000Z";
    const res = await harvest({ live: true, cellKey: null }, {
      store,
      readFileSync: mockRead({}),
      cwd: () => "/tmp",
      nowIso: () => fixedNow,
      listProviderIds: () => ["seed-portals", "brave-search", "google-cse", "extra"],
      providerEnabled: (id) => id === "brave-search" || id === "extra",
      resolveProvider: (id) => ({ id, source_type: "search-engine", discover: async () => [], fetch: async () => { throw new Error("x"); } } as unknown as ReturnType<typeof import("@/discovery/providers").resolveProvider>),
    });
    // google-cse is deprecated, should be excluded even if enabled
    expect(res.providers).toContain("seed-portals");
    expect(res.providers).toContain("brave-search");
    expect(res.providers).toContain("extra");
    expect(res.providers).not.toContain("google-cse");
    expect(res.ranAtIso).toBe(fixedNow);
    expect(res.ctx.query.jurisdictions.length).toBeGreaterThan(0);
  });

  it("live false always returns seed-portals even if others enabled", async () => {
    const res = await harvest({ live: false, cellKey: null }, {
      store,
      readFileSync: mockRead({}),
      cwd: () => "/tmp",
      listProviderIds: () => ["seed-portals", "brave-search"],
      providerEnabled: () => true,
      resolveProvider: (id) => ({ id } as never),
    });
    expect(res.providers).toEqual(["seed-portals"]);
  });

  it("dedupe index parsed when present, undefined when missing", async () => {
    const dedupe = JSON.stringify({ schema_version: "1.0.0", near_dup_threshold: 0.92, sha256: {}, text_hash: {}, clusters: [] });
    const withDedupe = await harvest({ live: false, cellKey: null }, {
      store,
      readFileSync: mockRead({ "state/dedupe-index.json": dedupe }),
      cwd: () => "/tmp",
    });
    expect(withDedupe.ctx.dedupeIndex).toBeDefined();
    const without = await harvest({ live: false, cellKey: null }, {
      store,
      readFileSync: mockRead({}),
      cwd: () => "/tmp",
    });
    expect(without.ctx.dedupeIndex).toBeUndefined();
  });

  it("best-effort: missing odd.json does not block unknown cellKey check (allows harvest)", async () => {
    // No odd.json file — validation should be best-effort and not throw
    const res = await harvest({ live: false, cellKey: "uk:PRELIMINARY_DESIGN" }, {
      store,
      readFileSync: mockRead({}), // no policies/odd.json
      cwd: () => "/tmp",
    });
    expect(res.cellKey).toBe("uk:PRELIMINARY_DESIGN");
  });

  it("executeJob runs D01..D10 and marks job done with artifacts via MemoryStore", async () => {
    // Use seed-portals provider for deterministic hits
    const { resolveProvider } = await import("@/discovery/providers");
    await import("@/discovery/providers");
    const seed = resolveProvider("seed-portals")!;
    // Harvest with injected providers to control determinism
    const res = await harvest({ live: false, cellKey: null }, {
      store,
      readFileSync: mockRead({}),
      cwd: () => "/tmp",
      // Force providers to just seed-portals deterministically
      listProviderIds: () => ["seed-portals"],
      providerEnabled: () => true,
      resolveProvider: () => seed,
    });
    // Replace ctx providers with seed for execution (harvest already did if mocked as seed)
    // Ensure ctx has seed
    const ctx = { ...res.ctx, providers: [seed] };
    await executeJob(res.jobId, ctx, res.providerIds, res.ranAtIso, { store, nowIso: () => new Date().toISOString() });
    const job = await getJob(res.jobId, store);
    expect(job).not.toBeNull();
    expect(job!.status).toBe("done");
    expect(job!.result).toBeDefined();
    expect(job!.result!.hits.length).toBeGreaterThan(0);
    expect(job!.result!.coverage).not.toBeNull();
    expect(job!.result!.queue.length).toBeGreaterThan(0);
    expect(job!.logs.length).toBeGreaterThan(10);
    expect(job!.logs.some(l => l.node === "D10-QUEUE")).toBe(true);
  });
});
