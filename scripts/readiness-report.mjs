#!/usr/bin/env node
// T4.x: per-split readiness report (ADR-0007 roles x ODD cells x latest gate archive).
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const odd = read("policies/odd.json");
const corpus = read("state/sample-corpus.json");

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

const fixtureRows = [];
for (const f of fixtures) {
  const fx = read(path.join("tests/fixtures", f));
  const gf = `GF-${f.match(/^gf(\d+)/)[1]}`;
  const cardPath = path.join(scRoot, latest, `${gf}.json`);
  const card = fs.existsSync(cardPath)
    ? JSON.parse(fs.readFileSync(cardPath, "utf8"))
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

const roleCounts = {};
for (const s of corpus.samples) for (const r of s.roles) roleCounts[r] = (roleCounts[r] ?? 0) + 1;

const cellRows = odd.cells.map((c) => ({
  jurisdiction_id: c.jurisdiction_id,
  canonical_stage: c.canonical_stage,
  status: c.status,
  fixtures: c.fixture_ids ?? [],
}));

const report = {
  schema_note:
    "T4.x readiness snapshot: judged fixtures x ODD cells x latest Tier-1 archive, plus ADR-0007 role census. Regenerate with: node scripts/readiness-report.mjs [runId]",
  generated: new Date().toISOString(),
  declaration_version: odd.declaration_version,
  latest_archive: latest,
  release_test_tier: corpus.release_test_policy,
  role_census: { total: corpus.samples.length, ...roleCounts },
  odd_cells: cellRows,
  fixtures: fixtureRows,
};

const outPath = path.join(root, "state", "readiness-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");

console.log(`readiness report -> state/readiness-report.json (declaration ${odd.declaration_version}, archive ${latest})`);
console.log(`corpus: ${corpus.samples.length} cataloged | roles: ${JSON.stringify(roleCounts)}`);
for (const r of fixtureRows) {
    console.log(
      `  ${r.id.padEnd(6)} ${String(r.jurisdiction).padEnd(14)} ${r.real_scheme ? "REAL " : "synth"} ${String(r.gate.mark).padEnd(13)} pass=${String(r.gate.pass_rate ?? "-").padEnd(4)}${r.odd_cell ? " [IN-cell]" : ""}`
    );
}
