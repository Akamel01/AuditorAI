import { describe, it, expect } from "vitest";
import { MemoryStore } from "@/lib/persistence/store";
import { createJob, getJob, updateJob } from "@/discovery/jobs";

describe("MemoryStore cancellation flow (M-R5 knockout test)", () => {
  it("should flip job status to cancelled when updated with MemoryStore", async () => {
    const store = new MemoryStore();
    // create a new job
    const j = await createJob({ live: true, cellKey: null, providers: [] }, store);
    expect(j.status).toBe("queued");

    // cancel the job via updateJob in store
    await updateJob(j.id, { status: "cancelled", updatedAt: new Date().toISOString(), currentNode: null }, store);

    const loaded = await getJob(j.id, store);
    expect(loaded).not.toBeNull();
    expect(loaded?.status).toBe("cancelled");
  });
});
