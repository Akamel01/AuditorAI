import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runDiscoveryPipeline, type DiscoveryCtx } from "@/discovery/pipeline";
import { setProviderDegraded, isProviderDegraded, recordZeroHitOutcome, resetHealthState } from "@/discovery/health-state";
import { resetHostBudgets } from "@/discovery/ratelimit";
import { resetSecretCache } from "@/discovery/keychain";
import { MemoryStore } from "@/lib/persistence";
import { harvest } from "@/discovery/harvest";
import type {
  DiscoverQuery,
  DiscoveryProvider,
  FetchResult,
} from "@/discovery/providers/provider-types";
import type { DiscoveryHit } from "@/discovery/types";

// Lightweight fake provider implementing the DiscoveryProvider interface
class FakeBraveProvider implements DiscoveryProvider {
  readonly id = "brave-search";
  readonly source_type = "search-engine" as const;
  async discover(_query: DiscoverQuery): Promise<DiscoveryHit[]> {
    // No hits
    return [];
  }
  async fetch(_url: string): Promise<FetchResult> {
    return { bytes: new Uint8Array(), status: 200, headers: new Headers() } as unknown as FetchResult;
  }
}

// Fake provider with one reserve-verdict hit (no .pdf URL, so D03 stays empty
// and D04 never reaches the network; acquireDocs is still stubbed explicitly).
class FakeBraveProviderWithHit extends FakeBraveProvider {
  override async discover(_query: DiscoverQuery): Promise<DiscoveryHit[]> {
    return [
      {
        hit_id: "brave-hit-1",
        url: "https://dot.gov/safety/rsa-overview",
        source_type: "search-engine",
        provider_id: "brave-search",
        portal_id: null,
        discovered_at: new Date(0).toISOString(),
        licence_hint: "unknown",
        http_status: 200,
        sha256_hint: null,
        title_hint: "Road Safety Audit overview",
        jurisdiction_guess: "US",
      },
    ];
  }
}

// SAFETY: this suite must NEVER touch the real state/discovery-ledger.json
// (live harvester state). The FS mirror is confined to an absolute mkdtemp
// path via AUDITORAI_LEDGER_MIRROR, and the live mtime is asserted unchanged.
const LIVE_LEDGER = path.join(process.cwd(), "state", "discovery-ledger.json");
const TEST_BRAVE_KEY = "test-brave-key";
let liveMtimeMs = 0;
let tmpRoot = "";
let prevMirror: string | undefined;
let prevBraveKey: string | undefined;

const SINGLE_QUERY: DiscoverQuery = {
  jurisdictions: ["US"],
  themes: ['"road safety audit"'],
  limit: 1,
};

// Minimal fetch stub in repo style (cf. kv-rest-store.test.ts okResponse):
// only the members the brave 402/429/error paths touch.
function stubBraveFetch(status: number, body: string) {
  const mock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

// The real BraveSearchProvider registers only when its secret resolves at
// import time, so each real-provider test gets a fresh module graph (after
// vi.resetModules) with the test key set — no fixture, no network, one fetch.
async function loadRealBraveProvider() {
  vi.resetModules();
  process.env.DISCOVERY_BRAVE_API_KEY = TEST_BRAVE_KEY;
  const { resetSecretCache: resetSecrets } = await import("@/discovery/keychain");
  resetSecrets();
  await import("@/discovery/providers/brave-search");
  const { resolveProvider } = await import("@/discovery/providers/provider-types");
  const { isProviderDegraded: isDegradedFresh } = await import("@/discovery/health-state");
  const provider = resolveProvider("brave-search");
  if (!provider) throw new Error("brave-search did not register (test key missing)");
  return { provider, isDegradedFresh };
}

describe("M-R16 brave quota degradation", () => {
  beforeAll(async () => {
    liveMtimeMs = (await fs.stat(LIVE_LEDGER)).mtimeMs;
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), "auditorai-ledger-"));
    const mirror = path.join(tmpRoot, "discovery-ledger.json");
    if (!path.isAbsolute(mirror)) throw new Error("ledger mirror must be absolute");
    prevMirror = process.env.AUDITORAI_LEDGER_MIRROR;
    process.env.AUDITORAI_LEDGER_MIRROR = mirror;
    prevBraveKey = process.env.DISCOVERY_BRAVE_API_KEY;
    process.env.DISCOVERY_BRAVE_API_KEY = TEST_BRAVE_KEY;
  });

  afterAll(async () => {
    if (prevMirror === undefined) delete process.env.AUDITORAI_LEDGER_MIRROR;
    else process.env.AUDITORAI_LEDGER_MIRROR = prevMirror;
    if (prevBraveKey === undefined) delete process.env.DISCOVERY_BRAVE_API_KEY;
    else process.env.DISCOVERY_BRAVE_API_KEY = prevBraveKey;
    await fs.rm(tmpRoot, { recursive: true, force: true });
    expect((await fs.stat(LIVE_LEDGER)).mtimeMs).toBe(liveMtimeMs);
  });

  beforeEach(() => {
    // reset global health state for Brave before each test (BOTH degraded
    // flags AND zero-hit counters), plus host budgets / secret cache / fetch.
    resetHealthState();
    resetHostBudgets();
    resetSecretCache();
    process.env.DISCOVERY_BRAVE_API_KEY = TEST_BRAVE_KEY;
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("injects brave-search quota refusal into pipeline refusals when degraded and no hits", async () => {
    // Mark Brave as degraded to trigger the refusal path
    setProviderDegraded("brave-search", true);

    const fake: DiscoveryProvider = new FakeBraveProvider();
    // Build a minimal context with the fake provider participating
    const ctx: DiscoveryCtx = {
      ranAtIso: new Date().toISOString(),
      query: { jurisdictions: ["US"], themes: ['"road safety audit"'], limit: 1 },
      providers: [fake],
      acquireDocs: undefined,
      dedupeIndex: undefined,
    };

    const out = await runDiscoveryPipeline(ctx);
    expect(out.refusals).toContain("brave-search:USAGE_LIMIT_EXCEEDED");
  });

  it("degrades brave-search after two consecutive zero-hits", () => {
    setProviderDegraded("brave-search", false);
    recordZeroHitOutcome("brave-search", true);
    recordZeroHitOutcome("brave-search", true);
    expect(isProviderDegraded("brave-search")).toBe(true);
  });

  it("pins live provider order: seeds lead, deprecated excluded (no reorder)", async () => {
    const store = new MemoryStore();
    const res = await harvest(
      { live: true, cellKey: null },
      {
        store,
        readFileSync: () => JSON.stringify({ cells: [] }),
        cwd: () => "/tmp",
        listProviderIds: () => ["google-cse", "brave-search", "seed-portals"],
        providerEnabled: () => true,
        resolveProvider: (id) => ({ id }) as never,
        nowIso: () => new Date(0).toISOString(),
      },
    );
    // harvest.ts order line: seeds first, deprecated google-cse excluded.
    expect(res.providerIds[0]).toBe("seed-portals");
    expect(res.providerIds).not.toContain("google-cse");
  });

  it("real provider 402 returns [] and marks degraded without throwing", async () => {
    stubBraveFetch(402, JSON.stringify({ error: { code: "USAGE_LIMIT_EXCEEDED" } }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { provider, isDegradedFresh } = await loadRealBraveProvider();
    await expect(provider.discover(SINGLE_QUERY)).resolves.toEqual([]);
    expect(isDegradedFresh("brave-search")).toBe(true);
  });

  it("real provider 429 skips without throwing", async () => {
    const fetchMock = stubBraveFetch(429, "rate limited");
    const { provider, isDegradedFresh } = await loadRealBraveProvider();
    await expect(provider.discover(SINGLE_QUERY)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isDegradedFresh("brave-search")).toBe(false);
  });

  it("real provider USAGE_LIMIT_EXCEEDED body without 402 returns [] degraded", async () => {
    stubBraveFetch(400, JSON.stringify({ message: "USAGE_LIMIT_EXCEEDED" }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { provider, isDegradedFresh } = await loadRealBraveProvider();
    await expect(provider.discover(SINGLE_QUERY)).resolves.toEqual([]);
    expect(isDegradedFresh("brave-search")).toBe(true);
  });

  it("real provider non-402 error with zero hits throws", async () => {
    stubBraveFetch(500, "boom");
    const { provider } = await loadRealBraveProvider();
    await expect(provider.discover(SINGLE_QUERY)).rejects.toThrow("brave-search discovered nothing");
  });

  it("pipeline emits no refusal when degraded but hits exist", async () => {
    setProviderDegraded("brave-search", true);
    const out = await runDiscoveryPipeline({
      ranAtIso: new Date(0).toISOString(),
      query: { jurisdictions: ["US"], themes: ['"road safety audit"'], limit: 1 },
      providers: [new FakeBraveProviderWithHit()],
      acquireDocs: async () => [],
      dedupeIndex: undefined,
    });
    expect(out.refusals).not.toContain("brave-search:USAGE_LIMIT_EXCEEDED");
  });

  it("pipeline emits no refusal when not degraded and zero hits", async () => {
    const out = await runDiscoveryPipeline({
      ranAtIso: new Date(0).toISOString(),
      query: { jurisdictions: ["US"], themes: ['"road safety audit"'], limit: 1 },
      providers: [new FakeBraveProvider()],
      acquireDocs: async () => [],
      dedupeIndex: undefined,
    });
    expect(out.refusals).toEqual([]);
  });
});
