// D07-PROVENANCE — byte-stable provenance record minting (fixed key order).
// Every normative-adjacent field carries its chain: URL -> sha256 -> extraction
// engine -> classifier version. firewall_tainted starts false and is only set
// by explicit owner action (never inferred silently).
import { provenanceId } from "@/discovery/ids";
import type {
  LabelSet,
  MatchAssignment,
  ProvenanceRecord,
  ProjectPackageAssembly,
} from "@/discovery/types";

export function writeProvenance(input: {
  pkg: ProjectPackageAssembly;
  match: MatchAssignment;
  labels: LabelSet;
  sha256Chain: { doc_id: string; sha256: string }[];
  retrievedAtIso: string;
}): ProvenanceRecord {
  return {
    provenance_id: provenanceId(input.pkg.package_id),
    package_id: input.pkg.package_id,
    source_urls: [...input.pkg.metadata.source_urls],
    retrieved_at: input.retrievedAtIso,
    sha256_chain: input.sha256Chain.map((c) => ({ doc_id: c.doc_id, sha256: c.sha256 })),
    extraction: { pdf_engine: "unpdf", ocr_engine: null },
    classification: {
      classifier_id: input.labels.classifier_trace.classifier_id,
      ruleset_version: input.labels.classifier_trace.ruleset_version,
    },
    licence: "unknown",
    odd_cell: {
      jurisdiction_id: input.match.jurisdiction,
      canonical_stage: [...input.match.canonical_stages],
      status: input.match.odd_status,
    },
    firewall_tainted: false,
  };
}
