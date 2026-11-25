import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkDefaultModelHealth, resetDefaultModelReachabilityCache } from "@/lib/model-health";
import {
  setProviderDegraded,
  isProviderDegraded,
  resetHealthState,
} from "@/discovery/health-state";

const ORIG = {
  AI_ENABLED: process.env.AI_ENABLED,
  OPENCODE_API_KEY: process.env.OPENCODE_API_KEY,
  AI_MODEL: process.env.AI_MODEL,
  AI_BASE_URL: process.env.AI_BASE_URL,
};

beforeEach(() => {
  delete process.env.AI_ENABLED;
  delete process.env.OPENCODE_API_KEY;
  delete process.env.AI_MODEL;
  delete process.env.AI_BASE_URL;
  resetDefaultModelReachabilityCache();
  resetHealthState();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterEach(() => {
  if (ORIG.AI_ENABLED === undefined) delete process.env.AI_ENABLED;
  else process.env.AI_ENABLED = ORIG.AI_ENABLED;
  if (ORIG.OPENCODE_API_KEY === undefined) delete process.env.OPENCODE_API_KEY;
  else process.env.OPENCODE_API_KEY = ORIG.OPENCODE_API_KEY;
  if (ORIG.AI_MODEL === undefined) delete process.env.AI_MODEL;
  else process.env.AI_MODEL = ORIG.AI_MODEL;
  if (ORIG.AI_BASE_URL === undefined) delete process.env.AI_BASE_URL;
  else process.env.AI_BASE_URL = ORIG.AI_BASE_URL;
  resetDefaultModelReachabilityCache();
  resetHealthState();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("checkDefaultModelHealth", () => {
  it("AI_ENABLED=true + no key -> unknown, no fetch, flag false", async () => {
    process.env.AI_ENABLED = "true";
    delete process.env.OPENCODE_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkDefaultModelHealth()).toBe("unknown");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isProviderDegraded("ai-default")).toBe(false);
  });

  it("AI_ENABLED unset + key present -> unknown, no fetch, flag false", async () => {
    delete process.env.AI_ENABLED;
    process.env.OPENCODE_API_KEY = "sk-test";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkDefaultModelHealth()).toBe("unknown");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isProviderDegraded("ai-default")).toBe(false);
  });

  it("disabled/no-key clears only ai-default (other provider preserved)", async () => {
    process.env.AI_ENABLED = "true";
    delete process.env.OPENCODE_API_KEY;
    setProviderDegraded("brave-search", true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkDefaultModelHealth()).toBe("unknown");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isProviderDegraded("ai-default")).toBe(false);
    expect(isProviderDegraded("brave-search")).toBe(true);
  });

  it("200 -> reachable, flag false, 1 fetch", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkDefaultModelHealth()).toBe("reachable");
    expect(isProviderDegraded("ai-default")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("400 body 'Model is unavailable' -> unavailable, flag true, 1 fetch", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"error":{"message":"Model is unavailable"}}', { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkDefaultModelHealth()).toBe("unavailable");
    expect(isProviderDegraded("ai-default")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("429 -> unknown, no flag change, 1 fetch", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkDefaultModelHealth()).toBe("unknown");
    expect(isProviderDegraded("ai-default")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("500 -> unknown, flag false, 1 fetch", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkDefaultModelHealth()).toBe("unknown");
    expect(isProviderDegraded("ai-default")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("400 other body -> unknown, flag false, 1 fetch", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":{"message":"bad request"}}', { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkDefaultModelHealth()).toBe("unknown");
    expect(isProviderDegraded("ai-default")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetch rejects AbortError -> unknown, no flag change", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    const err = new Error("aborted");
    err.name = "AbortError";
    const fetchMock = vi.fn().mockRejectedValue(err);
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkDefaultModelHealth()).toBe("unknown");
    expect(isProviderDegraded("ai-default")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("body-read throw -> unknown, no flag change", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    const res = { ok: false, status: 400, text: vi.fn().mockRejectedValue(new Error("boom")) };
    const fetchMock = vi.fn().mockResolvedValue(res);
    vi.stubGlobal("fetch", fetchMock);
    expect(await checkDefaultModelHealth()).toBe("unknown");
    expect(isProviderDegraded("ai-default")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("abort via timeoutMs -> unknown", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    const fetchMock = vi.fn().mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      });
    });
    const r = await checkDefaultModelHealth({ fetchImpl: fetchMock, timeoutMs: 10 });
    expect(r).toBe("unknown");
    expect(isProviderDegraded("ai-default")).toBe(false);
  });

  it("cache TTL: two calls -> 1 fetch; after expiry -> 2 fetches", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    let now = 1000;
    const nowFn = () => now;
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    expect(await checkDefaultModelHealth({ fetchImpl: fetchMock, now: nowFn })).toBe("reachable");
    expect(await checkDefaultModelHealth({ fetchImpl: fetchMock, now: nowFn })).toBe("reachable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now += 300_000 + 1;
    expect(await checkDefaultModelHealth({ fetchImpl: fetchMock, now: nowFn })).toBe("reachable");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cache hit re-applies the flag", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    const now = 1000;
    const nowFn = () => now;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"error":{"message":"Model is unavailable"}}', { status: 400 }));
    await checkDefaultModelHealth({ fetchImpl: fetchMock, now: nowFn });
    expect(isProviderDegraded("ai-default")).toBe(true);
    // simulate drift
    setProviderDegraded("ai-default", false);
    expect(isProviderDegraded("ai-default")).toBe(false);
    // cache hit should re-apply
    await checkDefaultModelHealth({ fetchImpl: fetchMock, now: nowFn });
    expect(isProviderDegraded("ai-default")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("disable/re-enable within TTL re-probes and flips again", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"error":{"message":"Model is unavailable"}}', { status: 400 }));
    await checkDefaultModelHealth({ fetchImpl: fetchMock });
    expect(isProviderDegraded("ai-default")).toBe(true);

    delete process.env.AI_ENABLED;
    const r2 = await checkDefaultModelHealth();
    expect(r2).toBe("unknown");
    expect(isProviderDegraded("ai-default")).toBe(false);

    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    const fetchMock2 = vi
      .fn()
      .mockResolvedValue(new Response('{"error":{"message":"Model is unavailable"}}', { status: 400 }));
    const r3 = await checkDefaultModelHealth({ fetchImpl: fetchMock2 });
    expect(r3).toBe("unavailable");
    expect(isProviderDegraded("ai-default")).toBe(true);
    expect(fetchMock2).toHaveBeenCalledTimes(1);
  });

  it("log hygiene: no sk-test, https://, body text, or Authorization", async () => {
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    process.env.AI_BASE_URL = "https://secret.example";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{"error":{"message":"Model is unavailable"}}', { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const logs: string[] = [];
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    spies.forEach((s) => s.mockImplementation((...args: unknown[]) => {
      logs.push(args.map((a) => String(a)).join(" "));
    }));
    await checkDefaultModelHealth();
    const all = logs.join("\n");
    expect(all).not.toContain("sk-test");
    expect(all).not.toContain("https://");
    expect(all).not.toContain("Model is unavailable");
    expect(all).not.toContain("Authorization");
    spies.forEach((s) => s.mockRestore());
  });
});
