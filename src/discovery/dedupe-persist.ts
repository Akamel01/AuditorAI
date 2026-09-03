// Dedupe persist — B1 post-run claim-and-merge (file + KV mirror)
// Reads state/dedupe-index.json, merges unique package fingerprints via
// claimFingerprints, writes back file and KV single-doc mirror.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DataStore } from "@/lib/persistence";
import { getDataStore } from "@/lib/persistence/store";
import { DISCOVERY_DEDUPE_INDEX_KEY } from "@/lib/persistence/keys";
import { DEDUPE_INDEX_PATH } from "@/lib/persistence/keys";
import { claimFingerprints, emptyDedupeIndex, type DedupeIndexDoc } from "./dedupe";
import type { AcquisitionBundle, ProjectPackageAssembly, QualityVerdictRecord } from "./types";

function dedupePath(cwd = process.cwd()): string {
  // Use centralized constant to avoid path divergence and enable reuse
  return path.join(cwd, DEDUPE_INDEX_PATH);
}

// ponytail: EROFS ceiling — KV-first with file seed fallback; per-account locks if throughput matters
let writeQueue: Promise<void> = Promise.resolve();

function readFromKVSync(): DedupeIndexDoc | null {
  // ponytail: sync KV read is accepted ceiling (no async in load path); use DataStore seam where available
  try {
    const g = globalThis as unknown as { __KV_DEDUPE_INDEX__?: DedupeIndexDoc };
    if (g?.__KV_DEDUPE_INDEX__) return g.__KV_DEDUPE_INDEX__;
  } catch {}
  return null;
}

export function loadDedupeIndex(cwd?: string): DedupeIndexDoc {
  // Attempt KV-read synchronously first (KV-first). If unavailable, fall back to file seed.
  const kv = readFromKVSync();
  if (kv) return kv;
  try {
    const p = dedupePath(cwd);
    if (!existsSync(p)) return emptyDedupeIndex();
    const raw = readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<DedupeIndexDoc>;
    return {
      schema_version: "1.0.0",
      near_dup_threshold: parsed.near_dup_threshold ?? 0.92,
      sha256: parsed.sha256 ?? {},
      text_hash: parsed.text_hash ?? {},
      clusters: Array.isArray(parsed.clusters) ? parsed.clusters : [],
    };
  } catch {
    return emptyDedupeIndex();
  }
}

// Async KV-first load — true DataStore seam for callers that can await (e.g. future harvest)
// ponytail: keep sync loadDedupeIndex as accepted ceiling; async variant is upgrade path when throughput matters
export async function loadDedupeIndexAsync(store?: DataStore, cwd?: string): Promise<DedupeIndexDoc> {
  const s = store ?? getDataStore();
  try {
    const kv = await s.get(DISCOVERY_DEDUPE_INDEX_KEY);
    if (kv) return kv as DedupeIndexDoc;
  } catch {}
  return loadDedupeIndex(cwd);
}

export function saveDedupeIndex(doc: DedupeIndexDoc, cwd?: string): void {
  // ponytail: serialized queue is single-writer; global lock ceiling
  writeQueue = writeQueue.then(() => {
    try {
      const p = dedupePath(cwd);
      const dir = path.dirname(p);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(p, JSON.stringify(doc, null, 2) + "\n", "utf8");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("EROFS") || msg.includes("ENOENT") || msg.includes("read-only")) {
        console.warn(`WARN dedupe persist EROFS/ENOENT — KV-truth kept, file seed skipped: ${msg.slice(0, 200)}`);
      }
    }
  }).catch(() => {});
}

export async function persistDedupeFromResult(
  packages: ProjectPackageAssembly[],
  bundles: AcquisitionBundle[],
  qualities: QualityVerdictRecord[],
  store?: DataStore,
  cwd?: string,
): Promise<DedupeIndexDoc | null> {
  if (packages.length === 0) return null;
  const index = loadDedupeIndex(cwd);
  const beforeSha = Object.keys(index.sha256).length;
  const bundleByMatch = new Map(bundles.map((b) => [b.match_id, b]));
  const qualityByPkg = new Map(qualities.map((q) => [q.package_id, q]));
  let claimed = 0;
  for (const pkg of packages) {
    const q = qualityByPkg.get(pkg.package_id);
    if (!q || q.dedupe_status !== "unique") continue;
    const bundle = bundleByMatch.get(pkg.match_id);
    if (!bundle) continue;
    claimFingerprints(pkg, bundle, index);
    claimed += 1;
  }
  if (claimed === 0) return null;
  if (Object.keys(index.sha256).length === beforeSha && claimed === 0) return null;
  saveDedupeIndex(index, cwd);
  // KV mirror best-effort
  const s = store ?? getDataStore();
  try {
    await s.put(DISCOVERY_DEDUPE_INDEX_KEY, index);
  } catch {}
  return index;
}
