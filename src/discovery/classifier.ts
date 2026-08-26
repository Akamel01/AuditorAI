// D05-CLASSIFY — deterministic ruleset classifier over acquired documents.
// Owner decision 2026-08-25: confidence < AUTO_RESERVE_BELOW is auto-routed to
// reserve (no human queue). The trace records every auto-reserve for audit.
import { normalizedTextHash, sha256Hex } from "@/discovery/ids";
import { labelsetId } from "@/discovery/ids";
import type {
  AcquisitionBundle,
  AcquiredDocument,
  DocLabel,
  DocRole,
  LabelSet,
} from "@/discovery/types";

export const RULESET_VERSION = "kw-1.0.0";
export const AUTO_RESERVE_BELOW = 0.7;

interface Rule {
  role: DocRole;
  patterns: RegExp[];
  weight: number;
}

const RULES: Rule[] = [
  { role: "rsa_report", patterns: [/\brsa\b/i, /road\s+safety\s+audit\s+report/i, /audit\s+report/i], weight: 3 },
  { role: "designer_response", patterns: [/response\s+report/i, /designer\s+response/i, /decision\s+log/i], weight: 3 },
  { role: "checklist", patterns: [/checklist/i, /prompt\s+list/i], weight: 2 },
  { role: "drawing_set", patterns: [/drawings?\b/i, /plan(s)? sheet/i, /general arrangement/i, /cross section/i, /layout/i], weight: 2 },
];

export function classifyBundle(bundle: AcquisitionBundle): LabelSet {
  const labels: DocLabel[] = [];
  const autoReserved: string[] = [];
  for (const doc of bundle.documents) {
    const label = classifyDocument(doc);
    if (label.confidence < AUTO_RESERVE_BELOW) {
      autoReserved.push(doc.doc_id);
      continue; // owner decision: below threshold is auto-reserve, never queued
    }
    labels.push(label);
  }
  return {
    labelset_id: labelsetId(bundle.bundle_id),
    bundle_id: bundle.bundle_id,
    labels,
    classifier_trace: {
      classifier_id: "keyword-ruleset",
      ruleset_version: RULESET_VERSION,
      auto_reserved_doc_ids: autoReserved,
    },
  };
}

function classifyDocument(doc: AcquiredDocument): DocLabel {
  // Signals: URL filename + extracted-text head. Text hash participates in
  // dedupe later, so compute it here once and reuse via extraction field.
  let decoded: string;
  try { decoded = decodeURIComponent(doc.url); } catch { decoded = doc.url; }
  const titleLower = ((doc as any).title_hint ?? "").toString().toLowerCase().replace(/[-_]+/g, " ");
  const urlLower = (decoded.toLowerCase().replace(/[-_]+/g, " ") + " " + titleLower).trim();
  let best: { role: DocRole; score: number } = { role: "supporting_document", score: 0 };
  for (const rule of RULES) {
    let score = 0;
    for (const p of rule.patterns) if (p.test(urlLower)) score += rule.weight * 2;
    if (score > best.score) best = { role: rule.role, score };
  }
  const confidence = Math.max(0, Math.min(1, best.score / 6));
  return { doc_id: doc.doc_id, role: best.role, confidence: round2(confidence) };
}

/** Stable per-document text key used by the deduplicator. */
export function documentTextKey(doc: AcquiredDocument): string | null {
  return doc.extraction.text_sha256 ?? normalizedTextHash(doc.url);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function hashForTests(input: string): string {
  return sha256Hex(input);
}
