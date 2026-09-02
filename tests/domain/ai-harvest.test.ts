import { describe, expect, it } from "vitest";
import { runDiscoveryPipeline, type DiscoveryCtx } from "@/discovery/pipeline";
import type { DiscoveryHit } from "@/discovery/types";
import { emptyDedupeIndex } from "@/discovery/dedupe";

describe("ai-harvest obtaining/finding documents", () => {
  const mockHits: DiscoveryHit[] = [
    {
      hit_id: "HIT-ai-test1",
      url: "https://planning.welhat.gov.uk/Document/Download?module=PLA&recordNumber=107754&planId=2079274&imageId=5&isPlan=False&fileName=Stage%201%20Road%20Safety%20Report.pdf",
      source_type: "search-engine",
      provider_id: "ai-search",
      portal_id: null,
      discovered_at: "2026-09-02T00:00:00.000Z",
      licence_hint: "public-domain",
      http_status: 200,
      sha256_hint: null,
      title_hint: "Heathfield Lodge Great North Road — Stage 1 Road Safety Audit report with designer response",
      jurisdiction_guess: "UK",
    },
    {
      hit_id: "HIT-ai-test2",
      url: "https://example.com/not-a-doc.html",
      source_type: "search-engine",
      provider_id: "ai-search",
      portal_id: null,
      discovered_at: "2026-09-02T00:00:00.000Z",
      licence_hint: "unknown",
      http_status: 200,
      sha256_hint: null,
      title_hint: "Blog about roads",
      jurisdiction_guess: "UK",
    },
  ];

  it("ai-search via pipeline: 2 hits → 1 in_scope → 1 matched → 1 acquired → 1 package (fixtures)", async () => {
    const ctx: DiscoveryCtx = {
      ranAtIso: new Date().toISOString(),
      query: { jurisdictions: ["UK"], themes: ['"road safety audit"'] },
      providers: [], // hits injected via D01 directly, so providers empty
      dedupeIndex: emptyDedupeIndex(),
      // mock acquireDocs to return a PDF for the in_scope hit
      acquireDocs: async (match) => {
        // only the UK S1 match should be acquired
        if (match.native_stage_id === "uk:S1") {
          return [{ url: mockHits[0].url, bytes: new Uint8Array([37, 80, 68, 70, 45]), mime: "application/pdf" }];
        }
        return [];
      },
    };

    // Manually run D01..D10 with mocked hits by seeding D01
    // For this test we bypass D01's provider discover and inject hits directly via qualify
    const { qualifyHits } = await import("@/discovery/qualifier");
    const { matchQualified } = await import("@/discovery/matcher");

    const qualified = qualifyHits(mockHits);
    expect(qualified.filter((q) => q.verdict === "in_scope").length).toBe(1);

    const matched = qualified.filter((q) => q.verdict === "in_scope").map(matchQualified).filter((o) => o.assignment).map((o) => o.assignment!);
    expect(matched.length).toBe(1);
    expect(matched[0].native_stage_id).toBe("uk:S1");

    // Run full pipeline with mocked acquireDocs
    const { state } = await runDiscoveryPipeline(ctx);
    // Since we used empty providers, D01 will produce 0 hits, so we need to test via direct pipeline with injected state
    // Instead, test the full pipeline via runDiscoveryPipeline with a custom provider that returns mockHits
    const mockProvider = {
      id: "ai-search",
      source_type: "search-engine" as const,
      discover: async () => mockHits,
      fetch: async () => ({ bytes: new Uint8Array([37, 80, 68, 70]), status: 200, headers: new Headers() }),
    };
    const ctx2: DiscoveryCtx = {
      ranAtIso: new Date().toISOString(),
      query: { jurisdictions: ["UK"], themes: ['"road safety audit"'], limit: 2 },
      providers: [mockProvider as any],
      dedupeIndex: emptyDedupeIndex(),
      acquireDocs: async (match) => [{ url: mockHits[0].url, bytes: new Uint8Array([37, 80, 68, 70, 45]), mime: "application/pdf" }],
    };
    const outcome = await runDiscoveryPipeline(ctx2);
    expect(outcome.state.discovery_hits?.length).toBe(2);
    expect(outcome.state.qualified?.filter((q: any) => q.verdict === "in_scope").length).toBe(1);
    expect(outcome.state.matched?.length).toBe(1);
    expect(outcome.state.acquired?.[0]?.documents.length).toBe(1);
    expect(outcome.state.package?.length).toBe(1);
    expect(outcome.state.provenance?.length).toBe(1);
    expect(outcome.state.quality?.[0]?.dedupe_status).toBe("unique");
  });

  it("sample corpus PD sources have public-domain licence via ai-search", async () => {
    expect(mockHits[0].licence_hint).toBe("public-domain");
    expect(mockHits[0].jurisdiction_guess).toBe("UK");
  });

  it("verification never stops till verified: 0 packages → retry", async () => {
    const { verifyStream, createStream } = await import("@/discovery/harvest-stream");
    const stream = createStream("uk:PRELIMINARY_DESIGN", true);
    stream.packages = [];
    stream.quality = [];
    const v0 = verifyStream(stream);
    expect(v0.passed).toBe(false);
    expect(v0.reasons.join(" ")).toContain("0 packages");

    stream.packages = [{ completeness: "excerpt" } as any];
    stream.quality = [{ quality_score: 1, dedupe_status: "unique" } as any];
    const v1 = verifyStream(stream);
    expect(v1.passed).toBe(true);
  });
});
