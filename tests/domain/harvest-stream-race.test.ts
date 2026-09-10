/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "@/lib/persistence/store";
import { createStream, loadStream, saveStream, stopStream, tickStream } from "@/discovery/harvest-stream";

// Isolated interleave tests (H10 stop-race): this file mocks the pipeline with
// a gateableDeferred so a concurrent stop can land mid-tick deterministically.
// Kept separate from harvest-stream.test.ts so the mock cannot leak into the
// real-pipeline suites.
vi.mock("@/discovery/pipeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/discovery/pipeline")>();
  return {
    ...actual,
    runDiscoveryPipeline: (...args: any[]) => {
      const gate = (globalThis as any).__h10_gate;
      return gate
        ? gate(...args)
        : (actual.runDiscoveryPipeline as any)(...args);
    },
  };
});

afterEach(() => {
  (globalThis as any).__h10_gate = null;
  (globalThis as any).__h10_entered = null;
});

describe("harvest-stream stop-race guard (H10)", () => {
  it("concurrent stop during tick wins — no resurrection to RUNNING", async () => {
    const store = new MemoryStore() as any;
    const s = createStream(null, false, true);
    s.status = "RUNNING";
    await saveStream(s, store);

    let release!: () => void;
    const entered = new Promise<void>((res) => {
      (globalThis as any).__h10_entered = res;
    });
    (globalThis as any).__h10_gate = async () => {
      (globalThis as any).__h10_entered?.();
      await new Promise<void>((res) => {
        release = res;
      });
      return { state: { package: [], quality: [], coverage: null } };
    };

    const tickP = tickStream(s.id, store);
    await entered; // tick is now blocked inside the pipeline
    await stopStream(s.id, store); // concurrent stop lands mid-tick
    release();
    const result = await tickP;

    expect(result?.status).toBe("FAILED");
    const final = await loadStream(s.id, store);
    expect(final?.status).toBe("FAILED");
    expect(final?.error).toContain("stopped by operator");
    expect(final?.iteration).toBe(0); // tick's in-memory increment was dropped with its result
  });

  it("undisturbed tick still applies its result", async () => {
    const store = new MemoryStore() as any;
    const s = createStream(null, false, true);
    s.status = "RUNNING";
    await saveStream(s, store);

    (globalThis as any).__h10_gate = async () => ({
      state: { package: [], quality: [], coverage: null },
    });
    const result = await tickStream(s.id, store);
    // 0 packages → verify fails → continuous stays RUNNING with next-tick log
    expect(result?.status).toBe("RUNNING");
    expect(result?.iteration).toBe(1);
  });
});
