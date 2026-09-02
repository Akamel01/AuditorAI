/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, beforeEach } from "vitest";
import { createStream, saveStream, tickStream, verifyStream } from "@/discovery/harvest-stream";
import { MemoryStore } from "@/lib/persistence/store";

describe("harvest-stream continuous AI harvest", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it("obtains documents via pipeline: uk:PRELIMINARY_DESIGN → 1 package", async () => {
    const stream = createStream("uk:PRELIMINARY_DESIGN", false);
    stream.status = "RUNNING";
    await saveStream(stream, store as any);

    const ticked = await tickStream(stream.id, store as any);
    expect(ticked).not.toBeNull();
    expect(ticked!.iteration).toBe(1);
    // With seed + fixtures, UK S1 should produce at least 1 package (Heathfield Lodge)
    expect(ticked!.packages.length).toBeGreaterThanOrEqual(1);
    expect(ticked!.coverage).not.toBeNull();
  }, 10000);

  it("verification never stops till verified: 0→retry, 1→done", async () => {
    const s0 = createStream("uk:PRELIMINARY_DESIGN", false);
    s0.packages = [];
    s0.quality = [];
    const v0 = verifyStream(s0);
    expect(v0.passed).toBe(false);
    expect(v0.reasons.join(" ")).toContain("0 packages");

    const s1 = createStream("uk:PRELIMINARY_DESIGN", false);
    s1.packages = [{ completeness: "excerpt" } as any];
    s1.quality = [{ quality_score: 1, dedupe_status: "unique" } as any];
    const v1 = verifyStream(s1);
    expect(v1.passed).toBe(true);
  });

  it("control: pause holds, resume continues, stop fails", async () => {
    const stream = createStream("uk:PRELIMINARY_DESIGN", true);
    stream.status = "RUNNING";
    await saveStream(stream, store as any);

    const { pauseStream, resumeStream, stopStream } = await import("@/discovery/harvest-stream");
    const paused = await pauseStream(stream.id, store as any);
    expect(paused!.status).toBe("PAUSED");

    const resumed = await resumeStream(stream.id, store as any);
    expect(resumed!.status).toBe("RUNNING");

    const stopped = await stopStream(stream.id, store as any);
    expect(stopped!.status).toBe("FAILED");
    expect(stopped!.error).toContain("stopped");
  });

  it("fixtures and samples: ai-search hits via mock provider produce package", async () => {
    const mockHits = [
      {
        hit_id: "HIT-fixture-1",
        url: "https://planning.welhat.gov.uk/Document/Download?module=PLA&recordNumber=107754&planId=2079274&imageId=5&isPlan=False&fileName=Stage%201%20Road%20Safety%20Report.pdf",
        source_type: "search-engine" as const,
        provider_id: "ai-search",
        portal_id: null,
        discovered_at: new Date().toISOString(),
        licence_hint: "public-domain" as const,
        http_status: 200,
        sha256_hint: null,
        title_hint: "Heathfield Lodge — Stage 1 RSA",
        jurisdiction_guess: "UK" as const,
      },
    ];
    const { runDiscoveryPipeline } = await import("@/discovery/pipeline");
    const { emptyDedupeIndex } = await import("@/discovery/dedupe");
    const mockProvider = {
      id: "ai-search",
      source_type: "search-engine" as const,
      discover: async () => mockHits,
      fetch: async () => ({ bytes: new Uint8Array([37, 80, 68, 70]), status: 200, headers: new Headers() }),
    };
    const outcome = await runDiscoveryPipeline({
      ranAtIso: new Date().toISOString(),
      query: { jurisdictions: ["UK"], themes: ['"road safety audit"'], limit: 2 },
      providers: [mockProvider as any],
      dedupeIndex: emptyDedupeIndex(),
      acquireDocs: async () => [{ url: mockHits[0].url, bytes: new Uint8Array([37, 80, 68, 70, 45]), mime: "application/pdf" }],
    });
    expect(outcome.state.package?.length).toBe(1);
    expect(outcome.state.provenance?.length).toBe(1);
  });
});
