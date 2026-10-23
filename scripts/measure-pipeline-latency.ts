import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { DefaultAuditPipeline } from "../src/domain/pipeline/pipeline";
import type { Project } from "../src/domain/types";

const N = 1000;
const FIXTURE = "gf2-usa-rural-highway-prelim.json";
const T0 = "2026-08-22T00:00:00.000Z";

function loadProject(file: string): Project {
  const fx = JSON.parse(readFileSync(path.join(process.cwd(), "tests/fixtures", file), "utf8")) as {
    fixture_id?: string;
    jurisdiction: string;
    native_stage_id: string;
    metadata: Project["metadata"];
    inputs: Project["input_values"];
  };
  return {
    project_id: `P-${fx.fixture_id ?? "X"}`,
    workspace_key_hash: "gf",
    metadata: fx.metadata,
    stage_selection: { jurisdiction: fx.jurisdiction as Project["stage_selection"]["jurisdiction"], native_stage_id: fx.native_stage_id },
    input_values: fx.inputs,
    created_at: T0,
    updated_at: T0,
  };
}

const project = loadProject(FIXTURE);
const pipeline = new DefaultAuditPipeline();

const samples: Record<string, number[]> = {};
for (const _ of Array.from({ length: N })) {
  const run = pipeline.runAllArtifacts(project, T0);
  for (const [k, v] of Object.entries(run.stageDurationsMs)) {
    (samples[k] ??= []).push(v);
  }
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

const runId = `g14-${process.env.GIT_SHA?.slice(0, 7) ?? "local"}-${new Date().toISOString()}`;
const rows = Object.keys(samples).map((id) => {
  const s = [...samples[id]].sort((a, b) => a - b);
  return { id, p50: pct(s, 50), p95: pct(s, 95), n: s.length };
});

const lines: string[] = [];
lines.push("# Per-stage pipeline latency (G-14)");
lines.push("");
lines.push(`- Run id: \`${runId}\``);
lines.push(`- Fixture (named run): \`${FIXTURE}\` (USA rural highway, preliminary design)`);
lines.push(`- Sample size: ${N} synchronous batch runs per stage`);
lines.push(`- Method: each run executes all 13 AG nodes via DefaultAuditPipeline.runAllArtifacts;`);
lines.push("  per-node wall-clock duration captured with performance.now(); p50/p95 computed as");
lines.push("  nearest-rank over the N samples. Deterministic input; no I/O, no AI (adapter off).");
lines.push("- Reproduce: `npx tsx scripts/measure-pipeline-latency.ts`");
lines.push("");
lines.push("| Stage (AG node) | p50 (ms) | p95 (ms) | n |");
lines.push("|---|---:|---:|---:|");
for (const r of rows) lines.push(`| ${r.id} | ${r.p50.toFixed(3)} | ${r.p95.toFixed(3)} | ${r.n} |`);
lines.push("");

mkdirSync(path.join(process.cwd(), "docs", "performance"), { recursive: true });
writeFileSync(path.join(process.cwd(), "docs", "performance", "pipeline-latency.md"), lines.join("\n"));
console.log(`wrote report runId=${runId}`);
console.log(JSON.stringify(rows, null, 2));
