// AG-REPORT — Report Assembly (deterministic). Builds the schema-valid
// AuditResult literal and its Markdown rendering. Byte-identical output apart
// from the caller-injected ran_at.
import { renderReportMarkdown } from "@/lib/report";
import { DISCLAIMER } from "@/domain/pipeline/constants";
import {
  assembleAuditResult,
  makeArtifact,
  requireSlice,
} from "@/domain/pipeline/nodes/shared";
import type { NodeFn, ReportBundleSlice } from "@/domain/pipeline/types";

export const runReport: NodeFn = (state, ctx) => {
  requireSlice("AG-REPORT", state, "adjudication");
  const json = assembleAuditResult(state, ctx.ranAtIso);
  const slice: ReportBundleSlice = {
    json,
    markdown: renderReportMarkdown(json),
    disclaimer: DISCLAIMER,
  };
  return {
    artifacts: [
      makeArtifact("AG-REPORT", "report-builder", "report.bundle", 1, ctx, "verified", slice),
    ],
    patch: { report_bundle: slice },
  };
};
