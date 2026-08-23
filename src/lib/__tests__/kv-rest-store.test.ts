// KvRestStore over a mocked fetch: command shapes, batching honesty,
// unavailable-vs-absent error posture, and the N3 write cap. Also covers the
// resettable store singleton seam.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ArtifactTooLargeError,
  getDataStore,
  KvRestStore,
  MAX_ARTIFACT_BYTES,
  MemoryStore,
  Repository,
  setDataStoreForTests,
  StoreUnavailableError,
} from "@/lib/persistence";
import type { AuditArtifact } from "@/domain/pipeline/types";

type FetchMock = ReturnType<typeof vi.fn>;

function okResponse(result: unknown) {
  return { ok: true, status: 200, json: async () => ({ result }) };
}

function installFetch(mock: FetchMock) {
  vi.stubGlobal("fetch", mock);
}

const WS = "wshash0009";

function art(node: string, seq: number): AuditArtifact {
  return {
    artifact_id: `ART-${node.replace("AG-", "")}-${seq}`,
    node_id: node as AuditArtifact["node_id"],
    producer: "domain-engine",
    version: seq,
    created_at: "2026-08-22T00:00:00.000Z",
    validation_status: "verified",
    payload_kind: "rules.results",
    payload: { note: "demo" },
  };
}

describe("KvRestStore (fetch-mocked)", () => {
  let mock: FetchMock;

  beforeEach(() => {
    mock = vi.fn();
    installFetch(mock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("put issues one flat SET with the JSON-encoded value", async () => {
    const store = new KvRestStore("http://kv", "tok");
    mock.mockResolvedValue(okResponse("OK"));
    await store.put("k1", { a: 1 });
    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://kv");
    expect(JSON.parse(String(init.body))).toEqual(["SET", "k1", JSON.stringify({ a: 1 })]);
  });

  it("get parses present values and returns null only for genuinely absent keys", async () => {
    const store = new KvRestStore("http://kv", "tok");
    mock.mockResolvedValueOnce(okResponse(JSON.stringify({ a: 1 })));
    mock.mockResolvedValueOnce(okResponse(null));
    expect(await store.get<{ a: number }>("present")).toEqual({ a: 1 });
    expect(await store.get("absent")).toBeNull();
    expect(mock.mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)))).toEqual([
      ["GET", "present"],
      ["GET", "absent"],
    ]);
  });

  it("getMany batches as concurrent individual GETs (no pipelined body)", async () => {
    const store = new KvRestStore("http://kv", "tok");
    mock.mockImplementation(async (_url: string, init: RequestInit) => {
      const cmd = JSON.parse(String(init.body)) as string[];
      if (cmd[0] !== "GET") throw new Error(`unexpected command ${cmd[0]}`);
      // Upstash rejects pipeline-form bodies; every body must be one flat command.
      expect(Array.isArray(cmd[0])).toBe(false);
      return cmd[1] === "k2" ? okResponse(JSON.stringify(2)) : okResponse(null);
    });
    const got = await store.getMany<number>(["k1", "k2", "k3"]);
    expect(got).toEqual([null, 2, null]);
    expect(mock).toHaveBeenCalledTimes(3);
  });

  it("keys sends KEYS prefix* and sorts the result", async () => {
    const store = new KvRestStore("http://kv", "tok");
    mock.mockResolvedValue(okResponse(["ws:a:project:b", "ws:a:project:a"]));
    expect(await store.keys("ws:a:project:")).toEqual(["ws:a:project:a", "ws:a:project:b"]);
    const [, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual(["KEYS", "ws:a:project:*"]);
  });

  it("delByPrefix lists matches then deletes each, reporting the count", async () => {
    const store = new KvRestStore("http://kv", "tok");
    mock.mockImplementation(async (_url: string, init: RequestInit) => {
      const cmd = JSON.parse(String(init.body)) as string[];
      if (cmd[0] === "KEYS") return okResponse(["p:x1", "p:x2", "p:x3"]);
      if (cmd[0] === "DEL") return okResponse(1);
      throw new Error(`unexpected command ${cmd[0]}`);
    });
    expect(await store.delByPrefix("p:")).toBe(3);
    const cmds = mock.mock.calls.map(
      (c) => JSON.parse(String((c[1] as RequestInit).body)) as string[],
    );
    expect(cmds[0][0]).toBe("KEYS");
    expect(cmds.slice(1).map((c) => c[0])).toEqual(["DEL", "DEL", "DEL"]);
  });

  it("transport/5xx/auth failures throw StoreUnavailableError, never null", async () => {
    const store = new KvRestStore("http://kv", "tok");

    mock.mockRejectedValue(new TypeError("network down"));
    await expect(store.get("k")).rejects.toBeInstanceOf(StoreUnavailableError);

    mock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(store.get("k")).rejects.toBeInstanceOf(StoreUnavailableError);
    await expect(store.put("k", 1)).rejects.toBeInstanceOf(StoreUnavailableError);

    mock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(store.keys("p:")).rejects.toBeInstanceOf(StoreUnavailableError);

    mock.mockResolvedValue({ ok: true, json: async () => ({ error: "ERR wrongtype" }) });
    await expect(store.get("k")).rejects.toBeInstanceOf(StoreUnavailableError);
  });

  it("getMany surfaces unavailability instead of masking it as absence", async () => {
    const store = new KvRestStore("http://kv", "tok");
    mock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(store.getMany<number>(["k1", "k2"])).rejects.toBeInstanceOf(
      StoreUnavailableError,
    );
  });

  it("Repository methods propagate unavailability typed instead of returning empty", async () => {
    const repo = new Repository(new KvRestStore("http://kv", "tok"));
    mock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(repo.getProject(WS, "P-x")).rejects.toBeInstanceOf(StoreUnavailableError);
    await expect(repo.listProjects(WS)).rejects.toBeInstanceOf(StoreUnavailableError);
    await expect(repo.listArtifacts(WS, "P-x", "AUD-x")).rejects.toBeInstanceOf(
      StoreUnavailableError,
    );
  });

  it("the artifact byte cap rejects before any PUT reaches the store", async () => {
    const repo = new Repository(new KvRestStore("http://kv", "tok"));
    mock.mockResolvedValue(okResponse([]));
    const big = art("AG-MANIFEST", 1);
    big.payload = { blob: "x".repeat(MAX_ARTIFACT_BYTES + 10) };

    await expect(
      repo.saveArtifactTrailFor(WS, { projectId: "P-cap", auditId: "AUD-cap" }, [big]),
    ).rejects.toBeInstanceOf(ArtifactTooLargeError);
    const cmds = mock.mock.calls.map(
      (c) => JSON.parse(String((c[1] as RequestInit).body)) as string[],
    );
    expect(cmds.every((c) => c[0] !== "SET")).toBe(true);
  });
});

describe("store singleton test seam", () => {
  const savedUrl = process.env.KV_REST_API_URL;
  const savedToken = process.env.KV_REST_API_TOKEN;

  afterEach(() => {
    process.env.KV_REST_API_URL = savedUrl;
    process.env.KV_REST_API_TOKEN = savedToken;
    setDataStoreForTests(null);
  });

  it("setDataStoreForTests forces an instance; null re-derives from env", () => {
    const forced = new MemoryStore();
    setDataStoreForTests(forced);
    expect(getDataStore()).toBe(forced);

    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    setDataStoreForTests(null);
    expect(getDataStore().kind).toBe("memory");
  });
});
