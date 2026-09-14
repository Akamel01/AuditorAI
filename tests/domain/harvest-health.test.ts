// Harvest health bridge tests — verify 8-field bridge shape on MemoryStore and KV-down fallback
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStore, type DataStore } from "@/lib/persistence";
import { createJob, setJobDone } from "@/discovery/jobs";
import { appendLedgerKV } from "@/discovery/ledger";
import { bridgeHarvestHealth } from "@/discovery/health-aggregate";

describe("harvest-health bridge (M-R8)", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  it("bridges KV tail + latest job into 8-field HarvestHealth (1 done job)", async () => {
    // create a done job
    const job = await createJob({ live: false, cellKey: null, providers: [] }, store);
    await setJobDone(job.id, {
      ranAtIso: new Date(0).toISOString(),
      coverage: null,
      queue: [],
      packages: [],
      hits: [],
      matched: [],
      refusals: [],
      quality: [],
    }, store);

    // push a tiny ledger tail entry
    await appendLedgerKV([
      { seq: 1, at: new Date(0).toISOString(), payload_kind: "discovery_hits", data: {} },
    ], store);

    const health = await bridgeHarvestHealth(store, 50);
    // 8-field shape pinned: 4 base + 4 bridge
    expect(Object.keys(health).sort()).toEqual(
      ["degraded", "indexedEntriesCount", "lastHits", "lastRunAt", "lastRunStatus", "lastSuccessAt", "lockAcquiredAt", "lockHolder"].sort(),
    );
    // lastRunStatus should reflect the latest job's status
    expect(health.lastRunStatus).toBe("done");
    // there is 1 entry in the index
    expect(health.indexedEntriesCount).toBe(1);
  });

  it("KV-down path yields nullish bridge fields while keeping shape intact", async () => {    // A store that always fails on get reads simulates KV outage
    class FailStore implements DataStore {
      kind = "kv" as const;
      async put(_k: string, _v: unknown): Promise<void> { throw new Error("down"); }
      async get<T>(_k: string): Promise<T | null> {
        throw new Error("down");
      }
      async getMany<T>(_k: string[]): Promise<(T | null)[]> { throw new Error("down"); }
      async keys(_p: string): Promise<string[]> { throw new Error("down"); }
      async del(_k: string): Promise<void> { throw new Error("down"); }
      async delByPrefix(_p: string): Promise<number> { throw new Error("down"); }
      async setIfAbsent(_k: string, _v: string, _ttl: number): Promise<boolean> {
        throw new Error("down");
      }
    }

    const health = await bridgeHarvestHealth(new FailStore(), 50);
    // On KV-down, bridge fields should be null/0 as per fallback behavior
    expect(Object.keys(health).sort()).toEqual(
      ["degraded", "indexedEntriesCount", "lastHits", "lastRunAt", "lastRunStatus", "lastSuccessAt", "lockAcquiredAt", "lockHolder"].sort(),
    );
    expect(health.lastRunAt).toBe(null);
    expect(health.lastRunStatus).toBeNull();
    expect(health.indexedEntriesCount).toBe(0);
    expect(health.lockHolder).toBeNull();
    expect(health.lockAcquiredAt).toBeNull();
  });

  it("fallback entries backfill base fields when KV tail is empty", async () => {
    class FailStore implements DataStore {
      kind = "kv" as const;
      async put(_k: string, _v: unknown): Promise<void> { throw new Error("down"); }
      async get<T>(_k: string): Promise<T | null> {
        throw new Error("down");
      }
      async getMany<T>(_k: string[]): Promise<(T | null)[]> { throw new Error("down"); }
      async keys(_p: string): Promise<string[]> { throw new Error("down"); }
      async del(_k: string): Promise<void> { throw new Error("down"); }
      async delByPrefix(_p: string): Promise<number> { throw new Error("down"); }
      async setIfAbsent(_k: string, _v: string, _ttl: number): Promise<boolean> {
        throw new Error("down");
      }
    }
    const at = new Date(0).toISOString();
    const health = await bridgeHarvestHealth(new FailStore(), 50, [
      { seq: 1, at, payload_kind: "discovery.hitset", data: [{}, {}] },
    ]);
    expect(health.lastRunAt).toBe(at);
    expect(health.indexedEntriesCount).toBe(1);
    expect(Object.keys(health).sort()).toEqual(
      ["degraded", "indexedEntriesCount", "lastHits", "lastRunAt", "lastRunStatus", "lastSuccessAt", "lockAcquiredAt", "lockHolder"].sort(),
    );
  });
});
