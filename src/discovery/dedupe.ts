// Deduplicator — exact sha256 + normalized-text near-dup clustering.
// Canonical = first package observed (lowest package_id lexicographically for
// determinism). Index is a plain JSON map persisted at state/dedupe-index.json.
import type {
  AcquisitionBundle,
  DedupeStatus,
  ProjectPackageAssembly,
} from "@/discovery/types";

export interface DedupeIndexDoc {
  schema_version: "1.0.0";
  near_dup_threshold: number;
  sha256: Record<string, string>;
  text_hash: Record<string, string>;
  clusters: { canonical_id: string; members: string[]; kind: "exact" | "near_dup" }[];
}

export function emptyDedupeIndex(): DedupeIndexDoc {
  return {
    schema_version: "1.0.0",
    near_dup_threshold: 0.92,
    sha256: {},
    text_hash: {},
    clusters: [],
  };
}

export interface DedupeVerdict {
  status: DedupeStatus;
  canonical_package_id: string | null;
}

/**
 * Pure check against the current index (no mutation): returns duplicate when
 * any doc sha256 or any doc text-hash key was already claimed by another
 * package; near_dup when the same text hash appears within the same cluster
 * family but bytes differ.
 */
export function checkDuplicate(
  pkg: ProjectPackageAssembly,
  bundle: AcquisitionBundle,
  index: DedupeIndexDoc,
): DedupeVerdict {
  const canonicalBySha = new Map(Object.entries(index.sha256));
  const canonicalByText = new Map(Object.entries(index.text_hash));

  let shaHit: string | null = null;
  let textHit: string | null = null;
  for (const doc of bundle.documents) {
    const viaSha = canonicalBySha.get(doc.sha256);
    if (viaSha && viaSha !== pkg.package_id) shaHit ??= viaSha;
    const textKey = bundleTextKey(bundle, doc.doc_id);
    if (textKey) {
      const viaText = canonicalByText.get(textKey);
      if (viaText && viaText !== pkg.package_id) textHit ??= viaText;
    }
  }

  if (shaHit) return { status: "duplicate", canonical_package_id: shaHit };
  if (textHit) return { status: "near_dup", canonical_package_id: textHit };
  return { status: "unique", canonical_package_id: null };
}

/** Mutates the index to claim pkg's fingerprints (call only for unique pkgs). */
export function claimFingerprints(
  pkg: ProjectPackageAssembly,
  bundle: AcquisitionBundle,
  index: DedupeIndexDoc,
): void {
  for (const doc of bundle.documents) {
    if (!index.sha256[doc.sha256]) index.sha256[doc.sha256] = pkg.package_id;
    const textKey = bundleTextKey(bundle, doc.doc_id);
    if (textKey && !index.text_hash[textKey]) index.text_hash[textKey] = pkg.package_id;
  }
  // One cluster per canonical id keeps the file simple; membership grows on dupes.
  if (!index.clusters.some((c) => c.canonical_id === pkg.package_id)) {
    index.clusters.push({ canonical_id: pkg.package_id, members: [pkg.package_id], kind: "exact" });
  }
}

function bundleTextKey(bundle: AcquisitionBundle, docId: string): string | null {
  const doc = bundle.documents.find((d) => d.doc_id === docId);
  return doc?.extraction.text_sha256 ?? null;
}
