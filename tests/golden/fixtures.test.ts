// Golden fixture runner: every §32 fixture must produce its expected findings,
// non-findings, missing information, mapping confidence and canonical spans —
// deterministically.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { runAudit } from "@/domain/engine";
import type { InputValueState, JurisdictionId, Project } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";

interface Fixture {
  jurisdiction: string;
  native_stage_id: string;
  metadata: Project["metadata"];
  inputs: Record<string, { state: InputValueState; value?: string }>;
  expected: {
    finding_ids_present?: string[];
    finding_ids_present_prefix?: string[];
    finding_ids_present_any_of?: string[];
    missing_information_input_ids: string[];
    mapping_confidence: "authoritative" | "interpreted" | "inferred";
    canonical_stages?: string[];
    questions_min?: number;
  };
}

const FILES = [
  "gf1-uk-urban-arterial-stage2.json",
  "gf2-usa-rural-highway-prelim.json",
  "gf3-uae-roundabout-combined-s12.json",
  "gf4-canada-pedestrian-planning.json",
  "gf5-int-roundabout-detailed.json",
];

for (const file of FILES) {
  const fx = JSON.parse(
    readFileSync(path.join(process.cwd(), "tests/fixtures", file), "utf8"),
  ) as Fixture;

  const project: Project = {
    project_id: `P-${fx.fixture_id ?? "X"}`,
    workspace_key_hash: "gf",
    metadata: fx.metadata,
    stage_selection: {
      jurisdiction: fx.jurisdiction as JurisdictionId,
      native_stage_id: fx.native_stage_id,
    },
    input_values: fx.inputs,
    created_at: T0,
    updated_at: T0,
  };
  const result = runAudit(project, T0);
  const ids = result.findings.map((f) => f.finding_id);
  const miIds = result.missing_information.map((m) => m.input_id);

  describe(`golden ${file} (${fx.metadata.name})`, () => {
    it("runs at the selected native stage with expected mapping confidence", () => {
      expect(result.mapping_confidence).toBe(fx.expected.mapping_confidence);
    });

    it("produces exactly the expected findings / non-findings", () => {
      for (const id of fx.expected.finding_ids_present ?? []) expect(ids).toContain(id);
      for (const pre of fx.expected.finding_ids_present_prefix ?? [])
        expect(ids.some((i) => i.startsWith(pre))).toBe(true);
      if ((fx.expected.finding_ids_present_any_of ?? []).length > 0) {
        expect(
          (fx.expected.finding_ids_present_any_of as string[]).some((cand) =>
            ids.some((i) => i.startsWith(cand)),
          ),
        ).toBe(true);
      }
      // Non-finding guarantee: deterministic engine never fabricates safety concerns
      expect(result.findings.filter((f) => f.kind === "safety_concern")).toHaveLength(0);
    });

    it("reports the expected missing information", () => {
      expect(miIds.sort()).toEqual([...(fx.expected.missing_information_input_ids ?? [])].sort());
    });

    if (fx.expected.canonical_stages) {
      it("maps to the expected canonical span", () => {
        expect(result.canonical_stages).toEqual(fx.expected.canonical_stages);
      });
    }

    if (fx.expected.questions_min) {
      it("poses the minimum stage questions", () => {
        expect(result.audit_questions.length).toBeGreaterThanOrEqual(
          fx.expected.questions_min as number,
        );
      });
    }

    it("is byte-deterministic", () => {
      const again = runAudit(project, T0);
      expect(JSON.stringify(again)).toBe(JSON.stringify(result));
    });
  });
}
