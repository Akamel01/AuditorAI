import { describe, test, expect } from "vitest";
import { MemoryStore, setDataStoreForTests } from "@/lib/persistence/store";
import { acquireHarvestLock, HARVEST_LOCK_KEY } from "@/discovery/harvest-lock";
import { emptyDedupeIndex, claimFingerprints, checkDuplicate } from "@/discovery/dedupe";

describe("R3 regression: lock + dedup", () => {
  test("busy: second acquire while held returns not acquired", async () => {
    const store = new MemoryStore();
    setDataStoreForTests(store);
    const first = await acquireHarvestLock(store, 120, "holder-1");
    expect(first.acquired).toBe(true);
    const second = await acquireHarvestLock(store, 120, "holder-2");
    expect(second.acquired).toBe(false);
    await first.release();
    const third = await acquireHarvestLock(store, 120, "holder-3");
    expect(third.acquired).toBe(true);
    await third.release();
    setDataStoreForTests(null);
  });

  test("ordering: dedupe clusters in insertion order", async () => {
    const idx = emptyDedupeIndex();
    const pkgA = { package_id: "pkgA" } as unknown as import("@/discovery/types").ProjectPackageAssembly;
    const bundleA = {
      documents: [{ doc_id: "d1", sha256: "shaA", extraction: { text_sha256: "textA" } }],
    } as unknown as import("@/discovery/types").AcquisitionBundle;
    const pkgB = { package_id: "pkgB" } as unknown as import("@/discovery/types").ProjectPackageAssembly;
    const bundleB = {
      documents: [{ doc_id: "d2", sha256: "shaB", extraction: { text_sha256: "textB" } }],
    } as unknown as import("@/discovery/types").AcquisitionBundle;
    await claimFingerprints(pkgA, bundleA, idx);
    await claimFingerprints(pkgB, bundleB, idx);
    expect(idx.clusters.length).toBe(2);
    expect(idx.clusters[0].canonical_id).toBe("pkgA");
    expect(idx.clusters[1].canonical_id).toBe("pkgB");
  });

  test("dedup: duplicate via same sha", async () => {
    const idx = emptyDedupeIndex();
    const pkg1 = { package_id: "p1" } as unknown as import("@/discovery/types").ProjectPackageAssembly;
    const bundle1 = {
      documents: [{ doc_id: "d1", sha256: "abc", extraction: { text_sha256: "t1" } }],
    } as unknown as import("@/discovery/types").AcquisitionBundle;
    await claimFingerprints(pkg1, bundle1, idx);
    const pkg2 = { package_id: "p2" } as unknown as import("@/discovery/types").ProjectPackageAssembly;
    const bundle2 = {
      documents: [{ doc_id: "d1", sha256: "abc", extraction: { text_sha256: "t1" } }],
    } as unknown as import("@/discovery/types").AcquisitionBundle;
    const dup = checkDuplicate(pkg2, bundle2, idx);
    expect(dup.status).toBe("duplicate");
    expect(dup.canonical_package_id).toBe("p1");
  });
});
