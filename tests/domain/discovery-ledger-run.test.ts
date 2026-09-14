import { describe, it, expect } from "vitest";
import { MemoryStore } from "@/lib/persistence";
import { appendLedgerRun } from "@/discovery/ledger";
import { getLedgerTailKV } from "@/discovery/ledger";
import { promises as fs } from "node:fs";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import os from "node:os";

// SAFETY: this test must NEVER touch the real state/discovery-ledger.json
// (live harvester state). Mirror is confined to a tmp dir via env override.
//
// SCOPE NOTE: true-simultaneous disjointness is NOT asserted here. Seq allocation
// is read-tail-then-assign (inherited from persistDiscoveryState); the shared
// single-writer primitive throws on contention rather than queuing, so simultaneity
// semantics belong to the persistence lane, not this seam move. This test proves
// deterministic adjunct continuation on a shared store.

describe("discovery ledger run seam: appendLedgerRun", () => {
  it("adjunct runs on a shared store continue disjoint sequences; mirror confined to tmp", async () => {
    const stRealBefore = await fs.stat(path.join(process.cwd(), "state", "discovery-ledger.json"));
    const tmpRoot = mkdtempSync(path.join(os.tmpdir(), "auditorai-ledger-"));
    const tmpFile = path.join(tmpRoot, "discovery-ledger.json");
    const prevMirror = process.env.AUDITORAI_LEDGER_MIRROR;
    process.env.AUDITORAI_LEDGER_MIRROR = tmpFile;
    try {
      const store = new MemoryStore();
      const r1 = await appendLedgerRun(
        [["a.hits", "discovery.hitset", [{ a: 1 }]], ["a.pkg", "package.assemblies", [{ b: 1 }]]],
        new Date(0).toISOString(),
        store,
      );
      const r2 = await appendLedgerRun(
        [["b.hits", "discovery.hitset", [{ a: 2 }]], ["b.pkg", "package.assemblies", [{ b: 2 }]]],
        new Date(0).toISOString(),
        store,
      );
      expect(r1.length).toBe(2);
      expect(r2.length).toBe(2);
      const seqs = [...r1, ...r2].map((e) => e.seq);
      expect(new Set(seqs).size).toBe(4);
      expect(Math.max(...r1.map((e) => e.seq))).toBeLessThan(Math.min(...r2.map((e) => e.seq)));
      const tail = await getLedgerTailKV(50, store);
      expect(tail.total).toBe(4);
      const raw = await fs.readFile(tmpFile, "utf8");
      expect(Array.isArray((JSON.parse(raw) as { entries: unknown[] }).entries)).toBe(true);
    } finally {
      if (prevMirror === undefined) delete process.env.AUDITORAI_LEDGER_MIRROR;
      else process.env.AUDITORAI_LEDGER_MIRROR = prevMirror;
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
    const stRealAfter = await fs.stat(path.join(process.cwd(), "state", "discovery-ledger.json"));
    expect(stRealAfter.mtimeMs).toBe(stRealBefore.mtimeMs);
  });
});
