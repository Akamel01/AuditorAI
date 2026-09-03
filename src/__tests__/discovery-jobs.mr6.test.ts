import { describe, test, expect } from "vitest";
import { listJobs } from "../discovery/jobs";
import type { DiscoveryJob } from "../discovery/jobs";

// Helper: build a fake job object
function makeJob(i: number): DiscoveryJob {
  return {
    id: `job_${i}`,
    status: "queued",
    live: false,
    cellKey: null,
    providers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logs: [],
    currentNode: null,
  } as unknown as DiscoveryJob;
}

describe("MR6 pagination - listJobs with cursor stability", () => {
  // Build a fake index of 30 jobs
  const fakeIndex = Array.from({ length: 30 }, (_, i) => `job_${i}`);
  // Map of job objects by their storage key: 'discovery:job:job_N'
  const jobsMap: Map<string, DiscoveryJob> = new Map();
  fakeIndex.forEach((id, i) => {
    const key = `discovery:job:${id}`;
    jobsMap.set(key, makeJob(i));
  });

  // Fake DataStore implementation supporting get and getMany
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fakeStore: any = {
    get: async (k: string) => {
      if (k === "discovery:job:index") return fakeIndex;
      // job storage
      return jobsMap.get(k) ?? null;
    },
    getMany: async (keys: string[]) => {
      return keys.map((k) => jobsMap.get(k) ?? null);
    },
  };

  test("first page returns up to cap of 20 with correct nextCursor when no cursor", async () => {
    const res = await listJobs(25, undefined, fakeStore);
    expect(res.jobs.length).toBe(20);
    expect(res.nextCursor).toBe("job_19");
  });

  test("cursor following id returns subsequent page and correct nextCursor", async () => {
    const res = await listJobs(5, "job_15", fakeStore);
    expect(res.jobs.length).toBe(5);
    // expect the nextCursor to be the last id in the returned page
    expect(res.nextCursor).toBe("job_20");
  });

  test("cursor not found (trimmedPast) falls back to latest page", async () => {
    const res = await listJobs(10, "job_9999", fakeStore);
    // falls back to first 10 ids
    expect(res.jobs.length).toBe(10);
    expect(res.nextCursor).toBe("job_9");
  });
});
