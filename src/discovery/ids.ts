// Deterministic id minting for discovery artifacts. Ids encode node + content
// fingerprint so re-runs over identical inputs are byte-stable (same id), and
// different inputs never collide.
import { createHash } from "node:crypto";

export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Normalized-text hash: lowercase, collapse whitespace — near-dup proxy. */
export function normalizedTextHash(text: string): string {
  const norm = text.toLowerCase().replace(/\s+/g, " ").trim();
  return sha256Hex(norm);
}

function shortHash(input: string): string {
  return sha256Hex(input).slice(0, 16);
}

export function hitId(providerId: string, url: string): string {
  return `HIT-${providerId}-${shortHash(url)}`;
}

export function qualificationId(hitIdStr: string): string {
  return `QAL-${shortHash(hitIdStr)}`;
}

export function matchId(qalId: string): string {
  return `MAT-${shortHash(qalId)}`;
}

export function bundleId(matchIdStr: string): string {
  return `ACQ-${shortHash(matchIdStr)}`;
}

export function docId(bundleKey: string, url: string): string {
  return `DOC-${shortHash(`${bundleKey}|${url}`)}`;
}

export function labelsetId(bundleIdStr: string): string {
  return `LAB-${shortHash(bundleIdStr)}`;
}

export function packageId(matchIdStr: string): string {
  return `PKG-${shortHash(`pkg|${matchIdStr}`)}`;
}

export function provenanceId(pkgId: string): string {
  return `PRV-${shortHash(pkgId)}`;
}

export function cellKey(jurisdictionDirId: string, canonicalStages: readonly string[]): string {
  return `${jurisdictionDirId}:${[...canonicalStages].sort().join("+")}`;
}
