#!/usr/bin/env node
// T4.x: per-split readiness report (ADR-0007 roles x ODD cells x latest gate archive).
// Executed via tsx (repo pattern: scripts/run-eval.ts); imports the pure
// metrics module the tests exercise — one implementation, no duplicated math.
import fs from "node:fs";
import path from "node:path";
import { computeMetrics, parseOutcomeLog } from "../src/lib/learning-metrics";

const root = process.cwd();
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(root, p), "utf8")) as T;

interface OddDoc {
  declaration_version: string;
  cells: {
    jurisdiction_id: string;
    canonical_stage: string | null;
    status: string;
    fixture_ids?: string[];
  }[];
}
interface CorpusDoc {
  samples: {
    roles: string[];
    jurisdiction: string;
    native_stage_id?: string;
    odd_cell_status?: string;
  }[];
  release_test_policy: unknown;
}
interface FixtureDoc {
  jurisdiction: string;
  native_stage_id: string;
  canonical_stage?: string;
  provenance?: {
    source_sample?: string;
    sample_id?: string;
    source_url?: string;
    extractor?: string;
    license?: string;
  };
}
interface ScorecardDoc {
  pass_rate: number;
  passes_corpus_mark: boolean;
  findings_scored: number | unknown[];
  findings_unscored: number | unknown[];
}

const odd = read<OddDoc>("policies/odd.json");
const corpus = read<CorpusDoc>("state/sample-corpus.json");

const scRoot = path.join(root, "state", "eval-scorecards");
const runs = fs
  .readdirSync(scRoot)
  .filter((d) => /^2026-/.test(d))
  .sort();
if (!runs.length) throw new Error("no eval-scorecards archives");
const latest = process.argv[2] ?? runs[runs.length - 1];

const fixtures = fs
  .readdirSync(path.join(root, "tests/fixtures"))
  .filter((f) => /^gf\d+-.*\.json$/.test(f));

interface FixtureGateRow {
  id: string;
  file: string;
  jurisdiction: string;
  native_stage: string;
  canonical_stage: string | null;
  source_sample: string | null;
  real_scheme: boolean;
  odd_cell: { jurisdictions: string; stage: string | null } | null;
  gate: {
    run: string;
    mark: string;
    pass_rate?: number;
    scored?: number;
    unscored?: number;
  };
}

const fixtureRows: FixtureGateRow[] = [];
for (const f of fixtures) {
  const fx = read<FixtureDoc>(path.join("tests/fixtures", f));
  const gf = `GF-${f.match(/^gf(\d+)/)![1]}`;
  const cardPath = path.join(scRoot, latest, `${gf}.json`);
  const card = fs.existsSync(cardPath)
    ? (JSON.parse(fs.readFileSync(cardPath, "utf8")) as ScorecardDoc)
    : null;
  const cell = odd.cells.find(
    (c) => c.status === "in" && (c.fixture_ids ?? []).includes(gf)
  );
  fixtureRows.push({
    id: gf,
    file: `tests/fixtures/${f}`,
    jurisdiction: fx.jurisdiction,
    native_stage: fx.native_stage_id,
    canonical_stage: fx.canonical_stage ?? null,
    source_sample:
      fx.provenance?.source_sample ??
      fx.provenance?.sample_id ??
      (fx.provenance?.source_url ? fx.provenance.source_url : null),
    real_scheme: Boolean(fx.provenance?.extractor ?? fx.provenance?.license),
    odd_cell: cell ? { jurisdictions: cell.jurisdiction_id, stage: cell.canonical_stage } : null,
    gate: card
      ? {
          run: latest,
          mark: card.passes_corpus_mark ? "PASS" : "FAIL",
          pass_rate: card.pass_rate,
          scored: Array.isArray(card.findings_scored) ? card.findings_scored.length : card.findings_scored,
          unscored: Array.isArray(card.findings_unscored) ? card.findings_unscored.length : card.findings_unscored,
        }
      : { run: latest, mark: "no-scorecard" },
  });
}

const roleCounts: Record<string, number> = {};
for (const s of corpus.samples) for (const r of s.roles) roleCounts[r] = (roleCounts[r] ?? 0) + 1;

const cellRows = odd.cells.map((c) => ({
  jurisdiction_id: c.jurisdiction_id,
  canonical_stage: c.canonical_stage,
  status: c.status,
  fixtures: c.fixture_ids ?? [],
}));

const report: {
  schema_note: string;
  generated: string;
  declaration_version: string;
  latest_archive: string;
  release_test_tier: unknown;
  role_census: Record<string, number>;
  odd_cells: typeof cellRows;
  fixtures: FixtureGateRow[];
  learning_layer: Record<string, unknown>;
} = {
  schema_note:
    "T4.x readiness snapshot: judged fixtures x ODD cells x latest Tier-1 archive, plus ADR-0007 role census. Regenerate with: npx tsx scripts/readiness-report.ts [runId]",
  generated: new Date().toISOString(),
  declaration_version: odd.declaration_version,
  latest_archive: latest,
  release_test_tier: corpus.release_test_policy,
  role_census: { total: corpus.samples.length, ...roleCounts },
  odd_cells: cellRows,
  fixtures: fixtureRows,
  learning_layer: {},
};

// Learning layer census (ADR-0008..0013): generated numbers for the
// learning-architecture diagram — never hand-maintained.
const registry = read<Record<string, unknown>>("state/evidence-registry.json");
const regRecords = Object.values(registry).flatMap((v) =>
  Array.isArray(v) ? v : [],
);
report.learning_layer = {
  evidence_records: regRecords.length,
  corpus_cataloged: corpus.samples.length,
  fewshot_total: roleCounts["engine-fewshot"] ?? 0,
  judge_calibration_total: roleCounts["judge-calibration"] ?? 0,
  fewshot_by_jurisdiction: corpus.samples.reduce<Record<string, number>>((acc, s) => {
    if (s.roles.includes("engine-fewshot"))
      acc[s.jurisdiction] = (acc[s.jurisdiction] ?? 0) + 1;
    return acc;
  }, {}),
  rubric_dimensions: "5-dim per src/lib/eval-gates.ts DIMENSIONS",
};

// ADR-0013 §2 mechanism-first metrics: PromotionRate / HallucinationRate are
// computed and published from day one, straight off the append-only
// CandidateOutcome log; numeric investigation thresholds stay unset until
// ~30 days of real data exists. Empty log is reported honestly — no zeros
// pretending to be measured rates.
const coDir = path.join(root, "state", "candidate-outcomes");
const coFiles = fs.existsSync(coDir)
  ? fs
      .readdirSync(coDir)
      .filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f))
      .sort()
  : [];
if (coFiles.length) {
  let rows: ReturnType<typeof parseOutcomeLog>["rows"] = [];
  let malformed = 0;
  for (const f of coFiles) {
    const { rows: parsed, malformed_lines } = parseOutcomeLog(
      fs.readFileSync(path.join(coDir, f), "utf8"),
    );
    if (malformed_lines)
      console.warn(`[readiness] ${f}: skipped ${malformed_lines} malformed line(s)`);
    rows = rows.concat(parsed);
    malformed += malformed_lines;
  }
  report.learning_layer.metrics = {
    source: "state/candidate-outcomes/*.jsonl",
    files_parsed: coFiles.length,
    malformed_lines_skipped: malformed,
    thresholds_note:
      "numeric investigation thresholds unset per ADR-0013 §2 — set by owner amendment after ~30 days of data",
    ...computeMetrics({ outcomes: rows }),
  };
} else {
  report.learning_layer.metrics = {
    outcomes_present: false,
    note: "no outcomes logged yet",
  };
}

// Per-cell few-shot/calib coverage counts from ticket 06's machine-readable
// mirror. Counts only — ids stay in the source doc.
const perCellPath = path.join(root, "docs", "architecture", "per-cell-data-table.md");
try {
  const mirror = JSON.parse(
    /```json\n([\s\S]*?)```/.exec(fs.readFileSync(perCellPath, "utf8"))?.[1] ??
      (() => {
        throw new Error("json fence not found");
      })(),
  ) as { meta: { cell_total: number; status_counts: Record<string, number> } };
  report.learning_layer.per_cell_coverage = {
    source: "docs/architecture/per-cell-data-table.md machine-readable mirror",
    cell_total: mirror.meta.cell_total,
    status_counts: mirror.meta.status_counts,
  };
} catch (e) {
  console.warn(
    `[readiness] per-cell coverage unavailable (${e instanceof Error ? e.message : String(e)})`,
  );
}

const outPath = path.join(root, "state", "readiness-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");

console.log(`readiness report -> state/readiness-report.json (declaration ${odd.declaration_version}, archive ${latest})`);
console.log(`corpus: ${corpus.samples.length} cataloged | roles: ${JSON.stringify(roleCounts)}`);
for (const r of fixtureRows) {
    console.log(
      `  ${r.id.padEnd(6)} ${String(r.jurisdiction).padEnd(14)} ${r.real_scheme ? "REAL " : "synth"} ${String(r.gate.mark).padEnd(13)} pass=${String(r.gate.pass_rate ?? "-").padEnd(4)}${r.odd_cell ? " [IN-cell]" : ""}`
    );
}
