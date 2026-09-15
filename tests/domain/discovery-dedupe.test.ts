import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MemoryStore } from "@/lib/persistence";
import { DISCOVERY_DEDUPE_INDEX_KEY } from "@/lib/persistence/keys";
import { persistDedupeFromResult } from "@/discovery/dedupe-persist";
import type {
  AcquisitionBundle,
  ProjectPackageAssembly,
  QualityVerdictRecord,
} from "@/discovery/types";

function fixtures() {
  const pkg = {
    package_id: "p1",
    match_id: "m1",
    metadata: { title: "t", scheme_summary: null, authority_hint: null, location_hint: null, source_urls: [] },
    inputs: { drawing_doc_ids: [], other_doc_ids: [] },
    outputs: { rsa_report_doc_ids: [], checklist_doc_ids: [], designer_response_doc_ids: [] },
    completeness: "outputs-only",
  } as unknown as ProjectPackageAssembly;
  const bundle = {
    match_id: "m1",
    documents: [{ doc_id: "d1", sha256: "abc123", extraction: { engine: "t", text_sha256: "t1" } }],
  } as unknown as AcquisitionBundle;
  const quality = { package_id: "p1", match_id: "m1", dedupe_status: "unique" } as unknown as QualityVerdictRecord;
  return { pkg, bundle, quality };
}

const MIRROR_TIMEOUT_MS = 2000;

async function pollMirror(cwd: string, sha: string, want: string): Promise<{ sha256: Record<string, string> }> {
  const p = path.join(cwd, "state/dedupe-index.json");
  const deadline = Date.now() + MIRROR_TIMEOUT_MS;
  for (;;) {
    try {
      const doc = JSON.parse(fs.readFileSync(p, "utf8")) as { sha256: Record<string, string> };
      if (doc?.sha256?.[sha] === want) return doc;
    } catch {}
    if (Date.now() > deadline) throw new Error(`mirror timeout: ${sha} never mirrored in ${p}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dedupe KV-first persist (M-R10)", () => {
  it("writes KV first, then file mirror (local dev writes both)", async () => {
    const store = new MemoryStore();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "aud-dd-"));
    const order: string[] = [];
    const origPut = store.put.bind(store);
    store.put = async (k: string, v: unknown) => {
      order.push(`kv:${k}`);
      return origPut(k, v);
    };
    const { pkg, bundle, quality } = fixtures();
    const out = await persistDedupeFromResult([pkg], [bundle], [quality], store, cwd);
    expect(out).not.toBeNull();
    // KV-first: index key written before the file mirror lands
    expect(order).toContain(`kv:${DISCOVERY_DEDUPE_INDEX_KEY}`);
    const kv = await store.get<{ sha256: Record<string, string> }>(DISCOVERY_DEDUPE_INDEX_KEY);
    expect(kv?.sha256["abc123"]).toBe("p1");
    const file = await pollMirror(cwd, "abc123", "p1");
    expect(file.sha256["abc123"]).toBe("p1");
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  // chmod-based ROFS is a no-op for root (CI runs as root) — skip there.
  const itNonRoot = typeof process.getuid === "function" && process.getuid() === 0 ? it.skip : it;
  itNonRoot("ROFS cwd → KV ok + single mirror-skipped warn", async () => {
    const store = new MemoryStore();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "aud-dd-ro-"));
    fs.mkdirSync(path.join(cwd, "state"), { recursive: true });
    fs.chmodSync(path.join(cwd, "state"), 0o555);
    fs.chmodSync(cwd, 0o555);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { pkg, bundle, quality } = fixtures();
      const out = await persistDedupeFromResult([pkg], [bundle], [quality], store, cwd);
      expect(out).not.toBeNull();
      const kv = await store.get<{ sha256: Record<string, string> }>(DISCOVERY_DEDUPE_INDEX_KEY);
      expect(kv?.sha256["abc123"]).toBe("p1");
      const wdeadline = Date.now() + MIRROR_TIMEOUT_MS;
      let rofsWarns: unknown[][] = [];
      for (;;) {
        rofsWarns = warn.mock.calls.filter((c) => String(c[0]).includes("dedupe: FS mirror skipped (ROFS)"));
        if (rofsWarns.length === 1) break;
        if (Date.now() > wdeadline) break;
        await new Promise((r) => setTimeout(r, 10));
      }
      expect(rofsWarns).toHaveLength(1);
    } finally {
      fs.chmodSync(cwd, 0o755);
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("KV put throws → still file-mirrors + returns non-null index", async () => {
    const store = new MemoryStore();
    store.put = async () => {
      throw new Error("KV down (falsification)");
    };
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "aud-dd-putfail-"));
    try {
      const { pkg, bundle, quality } = fixtures();
      const out = await persistDedupeFromResult([pkg], [bundle], [quality], store, cwd);
      expect(out).not.toBeNull();
      expect(out?.sha256["abc123"]).toBe("p1");
      const file = await pollMirror(cwd, "abc123", "p1");
      expect(file.sha256["abc123"]).toBe("p1");
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("KV load failure → file seed fallback", async () => {
    const store = new MemoryStore();
    store.get = async <T>(): Promise<T | null> => {
      throw new Error("KV load down (falsification)");
    };
    let putDoc: { sha256: Record<string, string> } | undefined;
    const origPut = MemoryStore.prototype.put.bind(store);
    store.put = async (k: string, v: unknown) => {
      putDoc = v as { sha256: Record<string, string> };
      return origPut(k, v);
    };
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "aud-dd-seed-"));
    try {
      fs.mkdirSync(path.join(cwd, "state"), { recursive: true });
      fs.writeFileSync(
        path.join(cwd, "state/dedupe-index.json"),
        JSON.stringify({ schema_version: "1.0.0", near_dup_threshold: 0.92, sha256: { deadbeef: "p0" }, text_hash: {}, clusters: [] }, null, 2),
        "utf8",
      );
      const { pkg, bundle, quality } = fixtures();
      const out = await persistDedupeFromResult([pkg], [bundle], [quality], store, cwd);
      expect(out).not.toBeNull();
      expect(out?.sha256["deadbeef"]).toBe("p0");
      expect(out?.sha256["abc123"]).toBe("p1");
      expect(putDoc?.sha256["deadbeef"]).toBe("p0");
      expect(putDoc?.sha256["abc123"]).toBe("p1");
      const file = await pollMirror(cwd, "abc123", "p1");
      expect(file.sha256["deadbeef"]).toBe("p0");
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
