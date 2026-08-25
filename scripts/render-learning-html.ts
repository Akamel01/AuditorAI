#!/usr/bin/env node
// Ticket 04 / ADR-0013: regenerate the hand-edited KPI numbers in
// docs/architecture/learning-architecture.html from generated truth in
// state/readiness-report.json. Patches ONLY the KPI <span>/<b>/<small>
// numeric slots + footer line via src/lib/learning-metrics.ts
// (patchLearningHtml) — any missing slot fails loudly. Never hand-edit
// those numbers again. Executed via tsx (repo pattern: scripts/run-eval.ts).
import fs from "node:fs";
import path from "node:path";
import { patchLearningHtml, type DiagramValues } from "../src/lib/learning-metrics";

interface ReportDoc {
  declaration_version: string;
  latest_archive: string;
  odd_cells: { status: string }[];
  role_census: Record<string, number>;
  learning_layer: {
    rubric_dimensions?: string;
    evidence_records: number;
    corpus_cataloged: number;
  };
  fixtures: { odd_cell: unknown; gate: { mark: string } }[];
}

const root = process.cwd();
const htmlPath = path.join(root, "docs", "architecture", "learning-architecture.html");
const reportPath = path.join(root, "state", "readiness-report.json");

const report = JSON.parse(fs.readFileSync(reportPath, "utf8")) as ReportDoc;
const html = fs.readFileSync(htmlPath, "utf8");

const statusCounts: Record<string, number> = {};
for (const c of report.odd_cells) statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
const rubricRaw = report.learning_layer.rubric_dimensions ?? "";
const rubricLabel = /^\d+-dim/.exec(rubricRaw)?.[0] ?? rubricRaw;

const values: DiagramValues = {
  declaration_version: report.declaration_version,
  archive_id: report.latest_archive,
  odd_cells: {
    total: report.odd_cells.length,
    in: statusCounts.in ?? 0,
    mapped_unproven: statusCounts.mapped_unproven ?? 0,
    structurally_absent: statusCounts.structurally_absent ?? 0,
  },
  evidence_records: report.learning_layer.evidence_records,
  corpus: {
    total: report.learning_layer.corpus_cataloged,
    fewshot: report.role_census["engine-fewshot"] ?? 0,
    calib: report.role_census["judge-calibration"] ?? 0,
    reserve: report.role_census.reserve ?? 0,
  },
  fixtures_in_passing: report.fixtures.filter(
    (f) => f.odd_cell && f.gate.mark === "PASS",
  ).length,
  rubric_dimensions_label: rubricLabel,
};

const patched = patchLearningHtml(html, values);
// Byte-stability guard: a second pass over already-generated output must be
// a no-op, otherwise the committed artifact would drift per invocation.
const repatched = patchLearningHtml(patched, values);
if (repatched !== patched) {
  throw new Error("render-learning-html: not idempotent — second pass changed output");
}

fs.writeFileSync(htmlPath, patched);

console.log(`learning-architecture.html <- readiness-report.json`);
console.log(
  `  ODD v${values.declaration_version} · cells ${values.odd_cells.total} (${values.odd_cells.in} IN / ${values.odd_cells.mapped_unproven} mapped / ${values.odd_cells.structurally_absent} absent)`,
);
console.log(
  `  evidence ${values.evidence_records} · corpus ${values.corpus.total} (${values.corpus.fewshot} few-shot / ${values.corpus.calib} calib / ${values.corpus.reserve} reserve) · fixtures-IN-passing ${values.fixtures_in_passing}`,
);
console.log(`  rubric ${values.rubric_dimensions_label} · archive ${values.archive_id}`);
