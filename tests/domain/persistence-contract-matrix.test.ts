// v3-F4 contract matrix prep (probe-only, no src edits, no new dependencies):
// the SAME read/write/overwrite/missing-key assertions run against MemoryStore
// and a minimal in-test KV-conforming fake implementing the DataStore seam.
import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/persistence/store";
import type { DataStore } from "@/lib/persistence/store";

/** Minimal in-test KV-conforming fake: DataStore seam only, Map-backed. */
class FakeKvStore implements DataStore {
  readonly kind = "kv" as const;
  private m = new Map<string, string>();
  async put(key: string, value: unknown): Promise<void> {
    this.m.set(key, JSON.stringify(value));
  }
  async get<T>(key: string): Promise<T | null> {
    const raw = this.m.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map((k) => this.get<T>(k)));
  }
  async keys(prefix: string): Promise<string[]> {
    return [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
  async del(key: string): Promise<void> {
    this.m.delete(key);
  }
  async delByPrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const k of [...this.m.keys()]) {
      if (k.startsWith(prefix)) {
        this.m.delete(k);
        n += 1;
      }
    }
    return n;
  }
}

const stores: Array<[string, () => DataStore]> = [
  ["MemoryStore", () => new MemoryStore()],
  ["FakeKvStore", () => new FakeKvStore()],
];

describe.each(stores)("persistence contract: %s", (_name, make) => {
  it("write then read returns the stored value", async () => {
    const store = make();
    await store.put("ws:test:k1", { note: "hello" });
    await expect(store.get<{ note: string }>("ws:test:k1")).resolves.toEqual({ note: "hello" });
  });

  it("overwrite replaces the stored value", async () => {
    const store = make();
    await store.put("ws:test:k1", { v: 1 });
    await store.put("ws:test:k1", { v: 2 });
    await expect(store.get<{ v: number }>("ws:test:k1")).resolves.toEqual({ v: 2 });
  });

  it("missing key resolves to null (not an error)", async () => {
    const store = make();
    await expect(store.get("ws:test:nope")).resolves.toBeNull();
  });

  it("getMany is positional with nulls for absent keys", async () => {
    const store = make();
    await store.put("ws:test:present", { v: 1 });
    await expect(store.getMany(["ws:test:present", "ws:test:absent"])).resolves.toEqual([
      { v: 1 },
      null,
    ]);
  });
});
