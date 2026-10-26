// G-6: the six DEV-CONSOLE bodies go through the shared schema validator.
// The schema owns type/shape (422), the route keeps its semantics (400), and
// the ADMIN GATE STAYS FIRST: a 401 always precedes a 422, so a schema error
// is never visible to an unauthenticated caller.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MemoryStore, setDataStoreForTests } from "@/lib/persistence/store";
import type { DataStore } from "@/lib/persistence/store";

// `after()` from next/server throws outside a request scope (next 15.5:
// workAsyncStorage.getStore() is null). The discovery route schedules its
// fire-and-forget harvest through it, so it is stubbed out here — the route's
// own contract (202 + jobId) is what is under test.
vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return { ...mod, after: () => undefined };
});

import { POST as createRun } from "@/app/api/dev/runs/route";
import { POST as editRun } from "@/app/api/dev/runs/[runId]/edit/route";
import { POST as stepRun } from "@/app/api/dev/runs/[runId]/step/route";
import { POST as discoveryRun } from "@/app/api/dev/discovery/run/route";
import { POST as startStream } from "@/app/api/dev/harvest-stream/route";
import { POST as setSecrets } from "@/app/api/dev/harvest-stream/secrets/route";

const PREV_ADMIN_KEY = process.env.ADMIN_KEY;
afterEach(() => {
  if (PREV_ADMIN_KEY === undefined) delete process.env.ADMIN_KEY;
  else process.env.ADMIN_KEY = PREV_ADMIN_KEY;
});

// The discovery job store falls back to state/discovery-jobs.json unless the
// ambient DataStore is KV-backed (src/discovery/jobs.ts:109) — install a
// KV-kind in-memory store so this suite writes no shared state file.
beforeAll(() => {
  const mem = new MemoryStore();
  const kv: DataStore = {
    kind: "kv",
    put: (k, v) => mem.put(k, v),
    get: <T,>(k: string) => mem.get<T>(k),
    getMany: <T,>(k: string[]) => mem.getMany<T>(k),
    keys: (p) => mem.keys(p),
    del: (k) => mem.del(k),
    delByPrefix: (p) => mem.delByPrefix(p),
    setIfAbsent: (k, v, t) => mem.setIfAbsent(k, v, t),
    createIfAbsent: (k, v) => mem.createIfAbsent(k, v),
  };
  setDataStoreForTests(kv);
});
afterAll(() => {
  setDataStoreForTests(null);
});

let seq = 0;
/** Arm the admin gate with a key that is unique per test: the admin bucket
 *  allows 30 requests/minute per key digest (src/lib/api.ts:37,54), so a
 *  shared key would make a parallel vitest run flake. */
function adminKey(name: string): string {
  const key = `bv-dev-${name}-${seq++}-0123456789`;
  process.env.ADMIN_KEY = key;
  return key;
}

function req(url: string, body?: string, key?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key !== undefined) headers["x-admin-key"] = key;
  return new Request(`http://local${url}`, { method: "POST", headers, body });
}

function params<T extends object>(p: T): { params: Promise<T> } {
  return { params: Promise.resolve(p) };
}

async function errorOf(res: Response): Promise<string> {
  return ((await res.json()) as { error: string }).error;
}

const PROJECT = {
  project_id: "P-devdemo01",
  workspace_key_hash: "devconsole",
  metadata: { name: "Demo", description: "", scheme_summary: "", authority: "D", location: "" },
  stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S2" },
  input_values: {},
  created_at: "2026-08-22T00:00:00.000Z",
  updated_at: "2026-08-22T00:00:00.000Z",
};

async function newRun(key: string): Promise<string> {
  const res = await createRun(req("/api/dev/runs", JSON.stringify({ project: PROJECT }), key));
  expect(res.status).toBe(200);
  return ((await res.json()) as { runId: string }).runId;
}

describe("POST /api/dev/runs body validation", () => {
  it("answers 422 naming the offending field", async () => {
    const key = adminKey("runs-type");
    const res = await createRun(
      req("/api/dev/runs", JSON.stringify({ project: { project_id: 123 } }), key),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toContain("/project/project_id");
  });

  it("answers 422 for an unknown property", async () => {
    const key = adminKey("runs-unknown");
    const res = await createRun(
      req("/api/dev/runs", JSON.stringify({ project: PROJECT, bogus: 1 }), key),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toMatch(/additional propert/i);
  });

  it("answers 422 for a malformed JSON body, never 500", async () => {
    const key = adminKey("runs-json");
    const res = await createRun(req("/api/dev/runs", "{not json", key));
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toBe("request body is not valid JSON");
  });

  it("answers 401 before the body is read", async () => {
    adminKey("runs-401");
    const res = await createRun(req("/api/dev/runs", JSON.stringify({ project: { project_id: 123 } })));
    expect(res.status).toBe(401);
    expect(await errorOf(res)).not.toMatch(/schema validation/);
  });

  it("keeps the domain 400 for a missing project", async () => {
    const key = adminKey("runs-400");
    const res = await createRun(req("/api/dev/runs", JSON.stringify({}), key));
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toMatch(
      /project with project_id, stage_selection and input_values is required/,
    );
  });

  it("accepts a valid body with 200", async () => {
    const key = adminKey("runs-valid");
    const res = await createRun(req("/api/dev/runs", JSON.stringify({ project: PROJECT }), key));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { runId: string }).runId).toMatch(/^devrun-/);
  });
});

describe("POST /api/dev/runs/[runId]/edit body validation", () => {
  it("answers 422 naming the offending field", async () => {
    const key = adminKey("edit-type");
    const runId = await newRun(key);
    const res = await editRun(
      req(`/api/dev/runs/${runId}/edit`, JSON.stringify({ slice: 42, value: {} }), key),
      params({ runId }),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toContain("/slice");
  });

  it("answers 422 for a malformed JSON body, never 500", async () => {
    const key = adminKey("edit-json");
    const runId = await newRun(key);
    const res = await editRun(
      req(`/api/dev/runs/${runId}/edit`, "{not json", key),
      params({ runId }),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toBe("request body is not valid JSON");
  });

  it("answers 401 before the body is read", async () => {
    adminKey("edit-401");
    const res = await editRun(
      req("/api/dev/runs/devrun-nope/edit", JSON.stringify({ slice: 42 })),
      params({ runId: "devrun-nope" }),
    );
    expect(res.status).toBe(401);
    expect(await errorOf(res)).not.toMatch(/schema validation/);
  });

  it("keeps the domain 400s", async () => {
    const key = adminKey("edit-400");
    const runId = await newRun(key);
    const noSlice = await editRun(
      req(`/api/dev/runs/${runId}/edit`, JSON.stringify({ value: {} }), key),
      params({ runId }),
    );
    expect(noSlice.status).toBe(400);
    expect(await errorOf(noSlice)).toBe("slice is required");

    const noValue = await editRun(
      req(`/api/dev/runs/${runId}/edit`, JSON.stringify({ slice: "input_manifest" }), key),
      params({ runId }),
    );
    expect(noValue.status).toBe(400);
    expect(await errorOf(noValue)).toBe("value is required");

    const unknown = await editRun(
      req(
        `/api/dev/runs/${runId}/edit`,
        JSON.stringify({ slice: "not_a_chartered_slice", value: {} }),
        key,
      ),
      params({ runId }),
    );
    expect(unknown.status).toBe(400);
    expect(await errorOf(unknown)).toMatch(/is not a chartered SharedState slice/);
  });

  it("accepts a valid body with 200", async () => {
    const key = adminKey("edit-valid");
    const runId = await newRun(key);
    const res = await editRun(
      req(
        `/api/dev/runs/${runId}/edit`,
        JSON.stringify({ slice: "input_manifest", value: [{ input_id: "injected" }] }),
        key,
      ),
      params({ runId }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { edited: string }).edited).toBe("input_manifest");
  });
});

describe("POST /api/dev/runs/[runId]/step body validation", () => {
  it("answers 422 naming the offending field", async () => {
    const key = adminKey("step-type");
    const runId = await newRun(key);
    const res = await stepRun(
      req(`/api/dev/runs/${runId}/step`, JSON.stringify({ nodeId: 42 }), key),
      params({ runId }),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toContain("/nodeId");
  });

  it("answers 422 for a decision without finding_id", async () => {
    const key = adminKey("step-decision");
    const runId = await newRun(key);
    const res = await stepRun(
      req(
        `/api/dev/runs/${runId}/step`,
        JSON.stringify({ nodeId: "AG-PROJECT", decisions: [{ action: "accept" }] }),
        key,
      ),
      params({ runId }),
    );
    expect(res.status).toBe(422);
    const message = await errorOf(res);
    expect(message).toContain("/decisions/0");
    expect(message).toContain("finding_id");
  });

  it("answers 422 for a malformed JSON body, never 500", async () => {
    const key = adminKey("step-json");
    const runId = await newRun(key);
    const res = await stepRun(
      req(`/api/dev/runs/${runId}/step`, "{not json", key),
      params({ runId }),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toBe("request body is not valid JSON");
  });

  it("answers 401 before the body is read", async () => {
    adminKey("step-401");
    const res = await stepRun(
      req("/api/dev/runs/devrun-nope/step", JSON.stringify({ nodeId: 42 })),
      params({ runId: "devrun-nope" }),
    );
    expect(res.status).toBe(401);
    expect(await errorOf(res)).not.toMatch(/schema validation/);
  });

  it("keeps the domain 400s", async () => {
    const key = adminKey("step-400");
    const runId = await newRun(key);
    const noNode = await stepRun(
      req(`/api/dev/runs/${runId}/step`, JSON.stringify({}), key),
      params({ runId }),
    );
    expect(noNode.status).toBe(400);
    expect(await errorOf(noNode)).toBe("nodeId is required");

    const unknown = await stepRun(
      req(`/api/dev/runs/${runId}/step`, JSON.stringify({ nodeId: "AG-NOPE" }), key),
      params({ runId }),
    );
    expect(unknown.status).toBe(400);
    expect(await errorOf(unknown)).toMatch(/unknown node AG-NOPE/);
  });

  it("accepts a valid body with 200", async () => {
    const key = adminKey("step-valid");
    const runId = await newRun(key);
    const res = await stepRun(
      req(`/api/dev/runs/${runId}/step`, JSON.stringify({ nodeId: "AG-PROJECT" }), key),
      params({ runId }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { executed: string }).executed).toBe("AG-PROJECT");
  });
});

describe("POST /api/dev/discovery/run body validation", () => {
  it("answers 422 naming the offending field", async () => {
    const key = adminKey("disc-type");
    const res = await discoveryRun(
      req("/api/dev/discovery/run", JSON.stringify({ live: "yes" }), key),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toContain("/live");
  });

  it("answers 422 for a malformed JSON body, never 500", async () => {
    const key = adminKey("disc-json");
    const res = await discoveryRun(req("/api/dev/discovery/run", "{not json", key));
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toBe("request body is not valid JSON");
  });

  it("answers 401 before the body is read", async () => {
    adminKey("disc-401");
    const res = await discoveryRun(req("/api/dev/discovery/run", JSON.stringify({ live: "yes" })));
    expect(res.status).toBe(401);
    expect(await errorOf(res)).not.toMatch(/schema validation/);
  });

  it("keeps the domain 400 for an unknown cellKey", async () => {
    const key = adminKey("disc-400");
    const res = await discoveryRun(
      req("/api/dev/discovery/run", JSON.stringify({ cellKey: "zz:NOT-A-CELL" }), key),
    );
    expect(res.status).toBe(400);
    expect(await errorOf(res)).toMatch(/unknown cellKey/);
  });

  it("keeps an empty body legal (202)", async () => {
    const key = adminKey("disc-empty");
    const res = await discoveryRun(req("/api/dev/discovery/run", undefined, key));
    expect(res.status).toBe(202);
    expect(((await res.json()) as { jobId: string }).jobId).toBeTruthy();
  });

  it("accepts a valid body with 202", async () => {
    const key = adminKey("disc-valid");
    const res = await discoveryRun(
      req("/api/dev/discovery/run", JSON.stringify({ live: false }), key),
    );
    expect(res.status).toBe(202);
    expect(((await res.json()) as { jobId: string }).jobId).toBeTruthy();
  });
});

describe("POST /api/dev/harvest-stream body validation", () => {
  it("answers 422 naming the offending field", async () => {
    const key = adminKey("stream-type");
    const res = await startStream(
      req("/api/dev/harvest-stream", JSON.stringify({ live: "yes" }), key),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toContain("/live");
  });

  it("answers 422 for a malformed JSON body, never 500", async () => {
    const key = adminKey("stream-json");
    const res = await startStream(req("/api/dev/harvest-stream", "{not json", key));
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toBe("request body is not valid JSON");
  });

  it("answers 401 before the body is read", async () => {
    adminKey("stream-401");
    const res = await startStream(req("/api/dev/harvest-stream", JSON.stringify({ live: "yes" })));
    expect(res.status).toBe(401);
    expect(await errorOf(res)).not.toMatch(/schema validation/);
  });

  it("keeps an empty body legal (201)", async () => {
    const key = adminKey("stream-empty");
    const res = await startStream(req("/api/dev/harvest-stream", undefined, key));
    expect(res.status).toBe(201);
    expect(((await res.json()) as { streamId: string }).streamId).toBeTruthy();
  });

  it("accepts a valid body with 201", async () => {
    const key = adminKey("stream-valid");
    const res = await startStream(
      req("/api/dev/harvest-stream", JSON.stringify({ live: false, cellKey: null, continuous: true }), key),
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as { streamId: string }).streamId).toBeTruthy();
  });
});

describe("POST /api/dev/harvest-stream/secrets body validation", () => {
  it("answers 422 naming the offending field", async () => {
    const key = adminKey("secrets-type");
    const res = await setSecrets(
      req("/api/dev/harvest-stream/secrets", JSON.stringify({ enabled: "yes" }), key),
    );
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toContain("/enabled");
  });

  it("answers 422 for a malformed JSON body, never 500", async () => {
    const key = adminKey("secrets-json");
    const res = await setSecrets(req("/api/dev/harvest-stream/secrets", "{not json", key));
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toBe("request body is not valid JSON");
  });

  it("answers 422 for an absent body — the body is required here", async () => {
    const key = adminKey("secrets-absent");
    const res = await setSecrets(req("/api/dev/harvest-stream/secrets", undefined, key));
    expect(res.status).toBe(422);
    expect(await errorOf(res)).toBe("request body is not valid JSON");
  });

  it("answers 401 before the body is read", async () => {
    adminKey("secrets-401");
    const res = await setSecrets(
      req("/api/dev/harvest-stream/secrets", JSON.stringify({ enabled: "yes" })),
    );
    expect(res.status).toBe(401);
    expect(await errorOf(res)).not.toMatch(/schema validation/);
  });

  it("accepts a valid body with 200", async () => {
    const key = adminKey("secrets-valid");
    const res = await setSecrets(
      req("/api/dev/harvest-stream/secrets", JSON.stringify({ enabled: false, exaKey: "k" }), key),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { hasExaKey: boolean }).hasExaKey).toBe(true);
  });
});
