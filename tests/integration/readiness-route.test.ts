import { describe, expect, it, afterEach } from "vitest";
import { GET as getReadiness } from "@/app/api/readiness/route";

describe("GET /api/readiness", () => {
  const origStore = process.env.TENANT_STORE;
  const origUrl = process.env.TENANT_POSTGRES_URL;
  afterEach(() => {
    if (origStore === undefined) delete process.env.TENANT_STORE;
    else process.env.TENANT_STORE = origStore;
    if (origUrl === undefined) delete process.env.TENANT_POSTGRES_URL;
    else process.env.TENANT_POSTGRES_URL = origUrl;
  });

  it("returns 200 with booleans only when ready", async () => {
    delete process.env.TENANT_STORE;
    delete process.env.TENANT_POSTGRES_URL;
    const res = await getReadiness(new Request("http://local/api/readiness", { headers: { "x-correlation-id": "cid-1" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ready: true, checks: { storage: true, providers: true } });
    expect(res.headers.get("x-correlation-id")).toBe("cid-1");
  });

  it("returns 503 when storage unconfigured", async () => {
    process.env.TENANT_STORE = "postgres";
    delete process.env.TENANT_POSTGRES_URL;
    const res = await getReadiness(new Request("http://local/api/readiness"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ready).toBe(false);
    expect(body.checks.storage).toBe(false);
    expect(res.headers.get("x-correlation-id")).toBeTruthy();
  });
});
