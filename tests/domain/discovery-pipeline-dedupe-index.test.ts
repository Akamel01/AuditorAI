/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { runDiscoveryPipeline } from "@/discovery/pipeline";
import type { DiscoveryCtx } from "@/discovery/pipeline";
import type { MatchAssignment } from "@/discovery/types";

// Lightweight fixture similar to existing tests
function fixtureCtx(overrides: Partial<DiscoveryCtx> = {}): DiscoveryCtx {
  // Seed a minimal environment; providers are wired in the test via overrides
  return {
    ranAtIso: new Date(0).toISOString(),
    query: { jurisdictions: ["UK", "US", "CA", "AE", "INT"], themes: ['"road safety audit"'] },
    providers: [],
    acquireDocs: async (match: MatchAssignment) => {
      // Return a trivial single PDF-like doc that downstream tests mock
      return [
        {
          url: `https://fixtures.invalid/${match.jurisdiction.toLowerCase()}-road-safety-audit-report.pdf`,
          bytes: new Uint8Array([37, 80, 68, 70]),
          mime: "application/pdf",
        } as any,
      ];
    },
    ...overrides,
  } as DiscoveryCtx;
}

describe("discovery pipeline dedupe-index threading (M-A3)", () => {
  it("pipeline twice threads dedupeIndex across runs when provided by caller", async () => {
    await import("@/discovery/providers");
    const { resolveProvider } = await import("@/discovery/providers");
    const seed = resolveProvider("seed-portals");
    // First run with empty (or seed-provided) context
    const ctx1 = fixtureCtx({ providers: [seed as any] as any[] });
    const out1 = await runDiscoveryPipeline(ctx1);
    expect(out1.dedupeIndex).toBeDefined();

    // Second run uses the first run's dedupeIndex to thread state
    const ctx2 = fixtureCtx({ providers: [seed as any] as any[], dedupeIndex: out1.dedupeIndex } as any);
    const out2 = await runDiscoveryPipeline(ctx2);
    // The second run should expose a non-unique dedupe status for at least one package
    const hasNonUnique = (out2.state.quality ?? []).some((q: any) => q.dedupe_status !== "unique");
    expect(hasNonUnique).toBe(true);
  });
});
