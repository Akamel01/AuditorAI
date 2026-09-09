/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it } from "vitest";
import { MemoryStore, setDataStoreForTests } from "@/lib/persistence/store";
import {
  clearRuntimeSecrets,
  getRuntimeSecrets,
  runtimeSecretPresence,
  setRuntimeSecrets,
} from "@/discovery/runtime-secrets";

afterEach(() => {
  setDataStoreForTests(null);
});

describe("runtime secrets store (H11)", () => {
  it("empty by default, presence all false", async () => {
    const store = new MemoryStore();
    expect(await getRuntimeSecrets(store as any)).toEqual({ enabled: false, exaKey: null, opencodeKey: null });
    expect(await runtimeSecretPresence(store as any)).toEqual({
      enabled: false,
      hasExaKey: false,
      hasOpencodeKey: false,
      live: false,
    });
  });

  it("set → get roundtrip; empty string clears that key; live when all three", async () => {
    const store = new MemoryStore();
    await setRuntimeSecrets({ enabled: true, exaKey: " exa-123 ", opencodeKey: "op-456" }, store as any);
    expect(await getRuntimeSecrets(store as any)).toEqual({ enabled: true, exaKey: "exa-123", opencodeKey: "op-456" });
    expect((await runtimeSecretPresence(store as any)).live).toBe(true);
    await setRuntimeSecrets({ exaKey: "" }, store as any);
    const after = await getRuntimeSecrets(store as any);
    expect(after.exaKey).toBeNull();
    expect(after.opencodeKey).toBe("op-456");
    expect((await runtimeSecretPresence(store as any)).live).toBe(false);
  });

  it("clear removes all overrides", async () => {
    const store = new MemoryStore();
    await setRuntimeSecrets({ enabled: true, exaKey: "e", opencodeKey: "o" }, store as any);
    await clearRuntimeSecrets(store as any);
    expect(await getRuntimeSecrets(store as any)).toEqual({ enabled: false, exaKey: null, opencodeKey: null });
  });

  it("provider falls back to runtime keys when env is absent", async () => {
    delete process.env.AGENT_REACH_ENABLED;
    delete process.env.EXA_API_KEY;
    delete process.env.OPENCODE_API_KEY;
    const store = new MemoryStore();
    setDataStoreForTests(store as any);
    await setRuntimeSecrets({ enabled: true, exaKey: "rt-exa", opencodeKey: "rt-open" });
    const { AgentReachSearchProvider } = await import("@/discovery/providers/agent-reach-search");
    const seen: string[] = [];
    const fetchImpl = (async (input: any) => {
      const url = String(input);
      seen.push(url);
      if (url === "https://api.exa.ai/search") {
        return new Response(JSON.stringify({ results: [{ url: "https://example.gov.uk/rsa.pdf", title: "RSA" }] }), {
          status: 200,
        });
      }
      if (url.startsWith("https://r.jina.ai/")) return new Response("# doc", { status: 200 });
      if (url.endsWith("/chat/completions")) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify([{ url: "https://example.gov.uk/rsa.pdf", keep: true }]) } }] }),
          { status: 200 },
        );
      }
      return new Response("nf", { status: 404 });
    }) as any;
    const p = new AgentReachSearchProvider();
    const hits = await p.discover({ jurisdictions: ["UK"], themes: ["rsa"], limit: 3 }, fetchImpl);
    expect(hits.length).toBe(1);
    expect(hits[0].provider_id).toBe("agent-reach-search");
    expect(seen).toContain("https://api.exa.ai/search");
  });
});
