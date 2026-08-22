import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runAudit } from "@/domain/engine";
import type { Project, InputValueState } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";

function loadFixture(rel: string) {
  return JSON.parse(readFileSync(path.join(process.cwd(), "tests/fixtures", rel), "utf8"));
}

function projectFrom(fx: {
  jurisdiction: string;
  native_stage_id: string;
  metadata: Record<string, string>;
  inputs: Record<string, { state: InputValueState; value?: string }>;
}): Project {
  return {
    project_id: "P-GF1",
    workspace_key_hash: "gf",
    metadata: fx.metadata as unknown as Project["metadata"],
    stage_selection: {
      jurisdiction: fx.jurisdiction as Project["stage_selection"]["jurisdiction"],
      native_stage_id: fx.native_stage_id,
    },
    input_values: fx.inputs,
    created_at: T0,
    updated_at: T0,
  };
}

describe("golden fixture GF-1: UK urban arterial (Stage 2)", () => {
  const fx = loadFixture("gf1-uk-urban-arterial-stage2.json");
  const result = runAudit(projectFrom(fx), T0);

  it("surfaces the intentional process gap (no Stage 1 response reports)", () => {
    const ids = result.findings.map((f) => f.finding_id);
    expect(ids).toContain("F-R-UK-PREVRESP-uk-S2");
  });

  it("does NOT flag missing collision data (it is provided)", () => {
    expect(result.missing_information.map((m) => m.input_id)).not.toContain(
      "collision_data_analysis_36mo",
    );
  });

  it("generates no fabricated safety concerns deterministically", () => {
    expect(result.findings.filter((f) => f.kind === "safety_concern")).toHaveLength(0);
  });

  it("is reproducible byte-for-byte", () => {
    const again = runAudit(projectFrom(fx), T0);
    expect(JSON.stringify(again)).toBe(JSON.stringify(result));
  });

  it("renders a complete report", async () => {
    const { renderReportMarkdown } = await import("@/lib/report");
    const md = renderReportMarkdown(result);
    expect(md).toContain("# Road Safety Audit Report");
    expect(md).toContain("F-R-UK-PREVRESP");
    expect(md).toContain("not scored under this framework");
    expect(md).toContain("Limitations");
  });
});
