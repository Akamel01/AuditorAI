import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { GET as getReadiness } from "@/app/api/readiness/route";
import { resetDefaultModelReachabilityCache } from "@/lib/model-health";
import { resetHealthState } from "@/discovery/health-state";
import { DEFAULT_BASE_URL, DEFAULT_MODEL } from "@/lib/model-config";

describe("GET /api/readiness", () => {
  const origStore = process.env.TENANT_STORE;
  const origUrl = process.env.TENANT_POSTGRES_URL;
  const origAiEnabled = process.env.AI_ENABLED;
  const origKey = process.env.OPENCODE_API_KEY;
  const origModel = process.env.AI_MODEL;
  const origBase = process.env.AI_BASE_URL;

  beforeEach(() => {
    resetDefaultModelReachabilityCache();
    resetHealthState();
  });

  afterEach(() => {
    if (origStore === undefined) delete process.env.TENANT_STORE;
    else process.env.TENANT_STORE = origStore;
    if (origUrl === undefined) delete process.env.TENANT_POSTGRES_URL;
    else process.env.TENANT_POSTGRES_URL = origUrl;
    if (origAiEnabled === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = origAiEnabled;
    if (origKey === undefined) delete process.env.OPENCODE_API_KEY;
    else process.env.OPENCODE_API_KEY = origKey;
    if (origModel === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = origModel;
    if (origBase === undefined) delete process.env.AI_BASE_URL;
    else process.env.AI_BASE_URL = origBase;
    resetDefaultModelReachabilityCache();
    resetHealthState();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns 200 with booleans only when ready", async () => {
    delete process.env.TENANT_STORE;
    delete process.env.TENANT_POSTGRES_URL;
    delete process.env.AI_ENABLED;
    delete process.env.OPENCODE_API_KEY;
    resetDefaultModelReachabilityCache();
    resetHealthState();
    const res = await getReadiness(new Request("http://local/api/readiness", { headers: { "x-correlation-id": "cid-1" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ready: true, checks: { storage: true, providers: true } });
    expect(res.headers.get("x-correlation-id")).toBe("cid-1");
  });

  it("returns 503 when storage unconfigured", async () => {
    process.env.TENANT_STORE = "postgres";
    delete process.env.TENANT_POSTGRES_URL;
    delete process.env.AI_ENABLED;
    delete process.env.OPENCODE_API_KEY;
    resetDefaultModelReachabilityCache();
    resetHealthState();
    const res = await getReadiness(new Request("http://local/api/readiness"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ready).toBe(false);
    expect(body.checks.storage).toBe(false);
    expect(res.headers.get("x-correlation-id")).toBeTruthy();
  });

  it("returns 503 with providers false on 400 Model is unavailable", async () => {
    delete process.env.TENANT_STORE;
    delete process.env.TENANT_POSTGRES_URL;
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
    resetDefaultModelReachabilityCache();
    resetHealthState();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"error":{"message":"Model is unavailable"}}', { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await getReadiness(new Request("http://local/api/readiness"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ready).toBe(false);
    expect(body.checks.providers).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${DEFAULT_BASE_URL}/chat/completions`);
    expect((init as RequestInit).method).toBe("POST");
    const headers = new Headers((init as RequestInit).headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer sk-test");
    const parsedBody = JSON.parse((init as RequestInit).body as string);
    expect(parsedBody.model).toBe(DEFAULT_MODEL);
  });

  it("returns 200 with providers true on 429", async () => {
    delete process.env.TENANT_STORE;
    delete process.env.TENANT_POSTGRES_URL;
    process.env.AI_ENABLED = "true";
    process.env.OPENCODE_API_KEY = "sk-test";
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
    resetDefaultModelReachabilityCache();
    resetHealthState();
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await getReadiness(new Request("http://local/api/readiness"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.checks.providers).toBe(true);
  });
});
