// D06-PACKAGE — assemble the project-package record from classified docs.
// Completeness mirrors sample-corpus vocabulary; designer_response stays
// explicitly empty-array (scarce class), never omitted.
import type {
  LabelSet,
  ProjectPackageAssembly,
  Qualification,
} from "@/discovery/types";
import { packageId } from "@/discovery/ids";

export function assemblePackage(
  match: MatchAssignmentLike,
  qualification: Qualification,
  labels: LabelSet,
): ProjectPackageAssembly {
  const byRole = (role: LabelSet["labels"][number]["role"]) =>
    labels.labels.filter((l) => l.role === role).map((l) => l.doc_id);

  const rsaReports = byRole("rsa_report");
  const checklists = byRole("checklist");
  const responses = byRole("designer_response");
  const drawings = byRole("drawing_set");
  const supporting = byRole("supporting_document");

  const completeness = deriveCompleteness(rsaReports.length, checklists.length, drawings.length);

  const title =
    qualification.scheme_hint?.split("/").pop()?.replace(/[-_]+/g, " ").trim() ||
    `package ${match.match_id}`;

  return {
    package_id: packageId(match.match_id),
    match_id: match.match_id,
    metadata: {
      title,
      scheme_summary: qualification.scheme_hint,
      authority_hint: null,
      location_hint: null,
      source_urls: [], // filled by D07 from hit URLs
    },
    inputs: { drawing_doc_ids: drawings, other_doc_ids: supporting },
    outputs: {
      rsa_report_doc_ids: rsaReports,
      checklist_doc_ids: checklists,
      designer_response_doc_ids: responses,
    },
    completeness,
  };
}

function deriveCompleteness(
  reports: number,
  checklists: number,
  drawings: number,
): ProjectPackageAssembly["completeness"] {
  if (reports === 0 && drawings > 0) return "inputs-only";
  if (reports === 0) return "excerpt";
  if (drawings > 0 && reports > 0) return "full-package"; // checklist optional (many real RSAs embed it)
  return "outputs-only";
}

interface MatchAssignmentLike {
  match_id: string;
}
