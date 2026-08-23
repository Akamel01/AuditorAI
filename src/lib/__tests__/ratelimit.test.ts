// Ratelimit matrix: memory branch, KV success, KV exception fail-open,
// non-number INCR results, and the INCR→EXPIRE follow-up (one flat command
// per REST request; pipelined bodies are rejected by Upstash — issue #6).
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "@/lib/ratelimit";

const savedUrl = process.env.KV_REST_API_URL;
const savedToken = process.env.KV_REST_API_TOKEN;

function kvResult(n: unknown) {
  return { ok: true, json: async () => ({ result: n }) };
}

afterEach(() => {
  process.env.KV_REST_API_URL = savedUrl;
  process.env.KV_REST_API_TOKEN = savedToken;
  vi.unstubAllGlobals();
});

describe("checkRateLimit", () => {
  it("memory branch allows under max and blocks over max with retry-after", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;

    expect(await checkRateLimit("mem-a", 2)).toEqual({ allowed: true });
    expect(await checkRateLimit("mem-a", 2)).toEqual({ allowed: true });
    expect(await checkRateLimit("mem-a", 2)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  it("KV branch: INCR result within max allows and fires EXPIRE on first hit", async () => {
    process.env.KV_REST_API_URL = "http://kv";
    process.env.KV_REST_API_TOKEN = "tok";
    const mock = vi.fn().mockResolvedValue(kvResult(1));
    vi.stubGlobal("fetch", mock);

    expect(await checkRateLimit("kv-first", 120)).toEqual({ allowed: true });

    const cmds = mock.mock.calls.map(
      (c) => JSON.parse(String((c[1] as RequestInit).body)) as string[],
    );
    expect(cmds).toHaveLength(2);
    expect(cmds[0][0]).toBe("INCR");
    expect(cmds[1][0]).toBe("EXPIRE");
  });

  it("KV branch: count over max blocks", async () => {
    process.env.KV_REST_API_URL = "http://kv";
    process.env.KV_REST_API_TOKEN = "tok";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(kvResult(121)));

    expect(await checkRateLimit("kv-over", 120)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
  });

  it("KV exception fails open rather than blocking auditors on infra hiccups", async () => {
    process.env.KV_REST_API_URL = "http://kv";
    process.env.KV_REST_API_TOKEN = "tok";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

    expect(await checkRateLimit("kv-down", 1)).toEqual({ allowed: true });
  });

  it("non-number INCR result fails open (treated as unavailable)", async () => {
    process.env.KV_REST_API_URL = "http://kv";
    process.env.KV_REST_API_TOKEN = "tok";

    for (const bogus of [null, "7", { n: 1 }, undefined]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(kvResult(bogus)));
      expect(await checkRateLimit(`kv-bogus-${String(bogus)}`, 1)).toEqual({ allowed: true });
    }
  });

  it("non-2xx KV responses fail open", async () => {
    process.env.KV_REST_API_URL = "http://kv";
    process.env.KV_REST_API_TOKEN = "tok";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    expect(await checkRateLimit("kv-500", 1)).toEqual({ allowed: true });
  });
});
