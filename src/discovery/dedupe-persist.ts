// Dedupe persist — B1 post-run claim-and-merge (file + KV mirror)
// Reads state/dedupe-index.json, merges unique package fingerprints via
// claimFingerprints, writes back file and KV single-doc mirror.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DataStore } from "@/lib/persistence";
import { getDataStore } from "@/lib/persistence/store";
import { DISCOVERY_DEDUPE_INDEX_KEY } from "@/lib/persistence/keys";
import { claimFingerprints, emptyDedupeIndex, type DedupeIndexDoc } from "./dedupe";
import type { AcquisitionBundle, ProjectPackageAssembly, QualityVerdictRecord } from "./types";

function dedupePath(cwd = process.cwd()): string {
  return path.join(cwd, "state", "dedupe-index.json");
}

export function loadDedupeIndex(cwd?: string): DedupeIndexDoc {
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

export function saveDedupeIndex(doc: DedupeIndexDoc, cwd?: string): void {
  try {
    const p = dedupePath(cwd);
    const dir = path.dirname(p);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(p, JSON.stringify(doc, null, 2) + "\n", "utf8");
  } catch {}
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
