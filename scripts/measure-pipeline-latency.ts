import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { execSync } from "node:child_process";
import { DefaultAuditPipeline } from "../src/domain/pipeline/pipeline";
import type { Project } from "../src/domain/types";

const WARM_N = 1000;
const COLD_N = 30;
const FIXTURE = "gf2-usa-rural-highway-prelim.json";
const T0 = "2026-08-22T00:00:00.000Z";

interface SamplesFile {
  runId: string;
  gitSha: string;
  fixture: string;
  nodeVersion: string;
  warmN: number;
  coldN: number;
  warm: Record<string, number[]>;
  cold: number[];
}

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

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function gitSha(): string {
  try { return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch { return "unknown"; }
}

function renderReport(samples: SamplesFile): string {
  const lines: string[] = [];
  lines.push("# Per-stage pipeline latency (G-14)");
  lines.push("");
  lines.push(`- Run id: \`${samples.runId}\``);
  lines.push(`- Git SHA: \`${samples.gitSha}\``);
  lines.push(`- Fixture (named run): \`${samples.fixture}\` (USA rural highway, preliminary design)`);
  lines.push(`- Node version: \`${samples.nodeVersion}\``);
  lines.push(`- Warm sample size: ${samples.warmN} back-to-back in-process runs per stage`);
  lines.push(`- Cold sample size: ${samples.coldN} new Node processes, one audit each`);
  lines.push("- Method: warm runs execute all 13 AG nodes via DefaultAuditPipeline.runAllArtifacts;");
  lines.push("  per-node wall-clock duration captured with performance.now(); p50/p95 computed as");
  lines.push("  nearest-rank over the N samples. Cold runs hit POST /api/projects/[id]/audits with the");
  lines.push("  legacy in-memory store (storage + serialisation included). AI adapter is off by");
  lines.push("  default in production, so no live inference occurs in either measurement.");
  lines.push(`- Raw samples: \`docs/performance/runs/${samples.runId}.json\``);
  lines.push("- Reproduce: `npx tsx scripts/measure-pipeline-latency.ts` (re-render: `--from <file>`)");
  lines.push("");
  lines.push("## Warm in-process");
  lines.push("");
  lines.push("| Stage (AG node) | p50 (ms) | p95 (ms) | n |");
  lines.push("|---|---:|---:|---:|");
  for (const id of Object.keys(samples.warm)) {
    const s = [...samples.warm[id]].sort((a, b) => a - b);
    lines.push(`| ${id} | ${pct(s, 50).toFixed(3)} | ${pct(s, 95).toFixed(3)} | ${s.length} |`);
  }
  lines.push("");
  lines.push("## Cold per-request");
  lines.push("");
  const cold = [...samples.cold].sort((a, b) => a - b);
  lines.push(`- p50: ${pct(cold, 50).toFixed(3)} ms`);
  lines.push(`- p95: ${pct(cold, 95).toFixed(3)} ms`);
  lines.push(`- n: ${cold.length}`);
  lines.push("");
  return lines.join("\n");
}

function main() {
  const fromIdx = process.argv.indexOf("--from");
  if (fromIdx !== -1) {
    const file = process.argv[fromIdx + 1];
    const samples = JSON.parse(readFileSync(file, "utf8")) as SamplesFile;
    const out = path.join(process.cwd(), "docs", "performance", "pipeline-latency.md");
    writeFileSync(out, renderReport(samples));
    console.log("rendered from", file);
    return;
  }

  const project = loadProject(FIXTURE);
  const pipeline = new DefaultAuditPipeline();

  const warm: Record<string, number[]> = {};
  for (let i = 0; i < WARM_N; i++) {
    const run = pipeline.runAllArtifacts(project, T0);
    for (const [k, v] of Object.entries(run.stageDurationsMs)) {
      (warm[k] ??= []).push(v);
    }
  }

  const cold: number[] = [];
  for (let i = 0; i < COLD_N; i++) {
    const r = spawnSync("npx", ["tsx", "scripts/measure-pipeline-cold.ts"], { encoding: "utf8", cwd: process.cwd() });
    const line = r.stdout.trim().split("\n").pop() ?? "{}";
    const parsed = JSON.parse(line) as { durationMs: number };
    cold.push(parsed.durationMs);
  }

  const runId = `g14-${gitSha().slice(0, 7)}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const samples: SamplesFile = {
    runId,
    gitSha: gitSha(),
    fixture: FIXTURE,
    nodeVersion: process.version,
    warmN: WARM_N,
    coldN: COLD_N,
    warm,
    cold,
  };

  mkdirSync(path.join(process.cwd(), "docs", "performance", "runs"), { recursive: true });
  const samplesPath = path.join(process.cwd(), "docs", "performance", "runs", `${runId}.json`);
  writeFileSync(samplesPath, JSON.stringify(samples, null, 2));

  const report = renderReport(samples);
  writeFileSync(path.join(process.cwd(), "docs", "performance", "pipeline-latency.md"), report);
  console.log("runId", runId);
}

main();
