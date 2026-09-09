/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it } from "vitest";
import { resetSecretCache } from "@/discovery/keychain";

const SAVED = { ...process.env };

afterEach(() => {
  process.env = { ...SAVED };
  resetSecretCache();
});

function mockFetch(exaResults: Array<{ url: string; title: string }>, qualifyKeep: boolean[]) {
  return (async (input: any, init?: any) => {
    const url = String(input);
    if (url === "https://api.exa.ai/search") {
      return new Response(JSON.stringify({ results: exaResults }), { status: 200 });
    }
    if (url.startsWith("https://r.jina.ai/")) {
      return new Response("# doc", { status: 200 });
    }
    if (url.endsWith("/chat/completions")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      void body;
      const arr = exaResults.map((r, i) => ({
        url: r.url,
        keep: qualifyKeep[i] ?? true,
        title_hint: r.title,
      }));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(arr) } }] }), {
        status: 200,
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

describe("agent-reach-search provider (H7)", () => {
  it("Exa → Jina → gpt-5-nano qualify returns shaped hits", async () => {
    process.env.AGENT_REACH_ENABLED = "true";
    process.env.EXA_API_KEY = "test-exa";
    process.env.OPENCODE_API_KEY = "test-opencode";
    const { AgentReachSearchProvider } = await import("@/discovery/providers/agent-reach-search");
    const p = new AgentReachSearchProvider();
    const hits = await p.discover(
      { jurisdictions: ["UK"], themes: ['"road safety audit"'], limit: 5 },
      mockFetch(
        [
          { url: "https://example.gov.uk/rsa-stage1.pdf", title: "Stage 1 RSA report" },
          { url: "https://example.com/blog-about-roads", title: "Blog about roads" },
        ],
        [true, false],
      ),
    );
    expect(hits.length).toBe(1);
    expect(hits[0].url).toBe("https://example.gov.uk/rsa-stage1.pdf");
    expect(hits[0].provider_id).toBe("agent-reach-search");
    expect(hits[0].source_type).toBe("search-engine");
    expect(hits[0].jurisdiction_guess).toBe("UK");
    expect(hits[0].hit_id.startsWith("HIT-agent-reach-search-")).toBe(true);
  });

  it("missing keys → [] with no throw (graceful off)", async () => {
    delete process.env.AGENT_REACH_ENABLED;
    delete process.env.EXA_API_KEY;
    const { AgentReachSearchProvider } = await import("@/discovery/providers/agent-reach-search");
    const p = new AgentReachSearchProvider();
    const hits = await p.discover({ jurisdictions: ["UK"], themes: ["rsa"] }, (async () => {
      throw new Error("must not fetch when disabled");
    }) as any);
    expect(hits).toEqual([]);
  });

  it("providerEnabled gates on flag + keys", async () => {
    const { providerEnabled } = await import("@/discovery/providers/provider-types");
    delete process.env.AGENT_REACH_ENABLED;
    expect(providerEnabled("agent-reach-search")).toBe(false);
    process.env.AGENT_REACH_ENABLED = "true";
    process.env.EXA_API_KEY = "test-exa";
    process.env.OPENCODE_API_KEY = "test-opencode";
    expect(providerEnabled("agent-reach-search")).toBe(true);
  });

  it("registered in listProviderIds", async () => {
    await import("@/discovery/providers/index");
    const { listProviderIds } = await import("@/discovery/providers/provider-types");
    expect(listProviderIds()).toContain("agent-reach-search");
  });
});
