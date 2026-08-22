// Evidence registry access (deep module over the compiled registry).
import { readFileSync } from "node:fs";
import path from "node:path";

export interface EvidenceRecord {
  evidence_id: string;
  claim: string;
  source_url: string | null;
  source_title: string | null;
  publisher: string | null;
  revision: string | null;
  publication_date: string | null;
  retrieved_date: string | null;
  normative_status: "mandatory" | "recommended" | "informative" | "unknown";
  confidence: "high" | "medium" | "low";
  jurisdiction: string;
}

let records: Map<string, EvidenceRecord> | null = null;

function load(): Map<string, EvidenceRecord> {
  if (records) return records;
  const raw = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "state/evidence-registry.json"),
      "utf8",
    ),
  ) as { evidence_records: EvidenceRecord[] };
  records = new Map(raw.evidence_records.map((r) => [r.evidence_id, r]));
  return records;
}

export function getEvidence(id: string): EvidenceRecord {
  const rec = load().get(id);
  if (!rec) throw new Error(`unknown evidence id: ${id}`);
  return rec;
}

export function tryGetEvidence(id: string): EvidenceRecord | null {
  return load().get(id) ?? null;
}
