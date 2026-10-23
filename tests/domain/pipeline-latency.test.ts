import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DefaultAuditPipeline } from "@/domain/pipeline/pipeline";
import type { Project } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";

function loadProject(file: string) {
  const fx = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/fixtures", file), "utf8")) as {
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

describe("G-14 per-stage latency", () => {
  it("records a non-negative duration for all 13 stages", () => {
    const project = loadProject("gf2-usa-rural-highway-prelim.json");
    const pipeline = new DefaultAuditPipeline();
    const run = pipeline.runAllArtifacts(project, T0);
    const entries = Object.entries(run.stageDurationsMs);
    expect(entries).toHaveLength(13);
    for (const [, v] of entries) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("renders the report deterministically from a samples file", () => {
    const runsDir = path.join(process.cwd(), "docs", "performance", "runs");
    const files = fs.readdirSync(runsDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    const sampleFile = path.join(runsDir, files[0]);
    const reportPath = path.join(process.cwd(), "docs", "performance", "pipeline-latency.md");
    const before = fs.readFileSync(reportPath, "utf8");
    execFileSync("npx", ["tsx", "scripts/measure-pipeline-latency.ts", "--from", sampleFile], { cwd: process.cwd(), stdio: "pipe" });
    const after = fs.readFileSync(reportPath, "utf8");
    // deterministic: same input file -> same report bytes
    execFileSync("npx", ["tsx", "scripts/measure-pipeline-latency.ts", "--from", sampleFile], { cwd: process.cwd(), stdio: "pipe" });
    const after2 = fs.readFileSync(reportPath, "utf8");
    expect(after).toBe(after2);
    // restore original report
    fs.writeFileSync(reportPath, before);
  });
});
