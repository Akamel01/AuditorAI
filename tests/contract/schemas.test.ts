// Contract tests: committed JSON Schemas must accept real artifacts produced by
// the engine and API. This closes the loop between TypeScript types and the
// versioned schema files (drift in either direction fails here).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import { runAudit } from "@/domain/engine";
import type { AuditResult, JurisdictionId, Project } from "@/domain/types";

function loadJson(rel: string): unknown {
  return JSON.parse(readFileSync(path.join(process.cwd(), rel), "utf8"));
}

const findingSchema = loadJson("contracts/schemas/finding.schema.json") as object;
const auditResultSchema = loadJson(
  "contracts/schemas/audit-result.schema.json",
) as object;
const projectSchema = loadJson("contracts/schemas/project.schema.json") as object;

const ajv = new Ajv({ strict: false, allErrors: true });
ajv.addSchema(findingSchema);
const validateAuditResult = ajv.compile<AuditResult>(auditResultSchema);
const validateProject = ajv.compile<Project>(projectSchema);

const T0 = "2026-08-22T00:00:00.000Z";

const FIXTURES = [
  "gf1-uk-urban-arterial-stage2.json",
  "gf2-usa-rural-highway-prelim.json",
  "gf3-uae-roundabout-combined-s12.json",
  "gf4-canada-pedestrian-planning.json",
  "gf5-int-roundabout-detailed.json",
] as const;

describe("audit results conform to audit-result.schema.json", () => {
  for (const file of FIXTURES) {
    it(`${file} output validates`, () => {
      const fx = loadJson(path.join("tests/fixtures", file)) as {
        jurisdiction: JurisdictionId;
        native_stage_id: string;
        metadata: Project["metadata"];
        inputs: Project["input_values"];
      };
      const result = runAudit(
        {
          project_id: `P-${file.slice(0, 4).toUpperCase()}`,
          workspace_key_hash: "schema-test-hash",
          metadata: fx.metadata,
          stage_selection: {
            jurisdiction: fx.jurisdiction,
            native_stage_id: fx.native_stage_id,
          },
          input_values: fx.inputs,
          created_at: T0,
          updated_at: T0,
        },
        T0,
      );
      const ok = validateAuditResult(result);
      if (!ok) {
        throw new Error(
          `${file}: ${(validateAuditResult.errors ?? [])
            .map((e) => `${e.instancePath} ${e.message}`)
            .join("; ")}`,
        );
      }
      expect(ok).toBe(true);
    });
  }

  it("GF-1 process-gap finding conforms to finding.schema.json", () => {
    const gf = loadJson(path.join("tests/fixtures", FIXTURES[0])) as {
      jurisdiction: JurisdictionId;
      native_stage_id: string;
      metadata: Project["metadata"];
      inputs: Project["input_values"];
    };
    const result = runAudit(
      {
        project_id: "P-GF1C",
        workspace_key_hash: "h",
        metadata: gf.metadata,
        stage_selection: {
          jurisdiction: gf.jurisdiction,
          native_stage_id: gf.native_stage_id,
        },
        input_values: gf.inputs,
        created_at: T0,
        updated_at: T0,
      },
      T0,
    );
    const finding = result.findings.find((f) =>
      f.finding_id.startsWith("F-R-UK-PREVRESP"),
    );
    expect(finding).toBeDefined();
    const validateFinding = ajv.compile(findingSchema);
    expect(validateFinding(finding)).toBe(true);
  });
});

describe("projects conform to project.schema.json", () => {
  it("a realistic UK S2 project validates", () => {
    const project: Project = {
      project_id: "P-schema01",
      workspace_key_hash: "abcdef1234567890",
      metadata: {
        name: "Schema Contract Project",
        description: "",
        scheme_summary: "",
        authority: "Council",
        location: "UK",
      },
      stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S2" },
      input_values: {
        scheme_description_objectives: { state: "provided", value: "x" },
        previous_rsa_reports_and_responses: { state: "required_missing" },
      },
      created_at: T0,
      updated_at: T0,
    };
    const ok = validateProject(project);
    if (!ok) {
      throw new Error(
        (validateProject.errors ?? [])
          .map((e) => `${e.instancePath} ${e.message}`)
          .join("; "),
      );
    }
    expect(ok).toBe(true);
  });

  it("rejects bare-integer native stage ids (ADR-0002 namespace rule)", () => {
    expect(
      validateProject({
        project_id: "P-badstage1",
        workspace_key_hash: "abcdef1234567890",
        metadata: { name: "Bad" },
        stage_selection: { jurisdiction: "UK", native_stage_id: "2" },
        input_values: {},
        created_at: T0,
        updated_at: T0,
      }),
    ).toBe(false);
  });

  it("rejects invalid input states", () => {
    expect(
      validateProject({
        project_id: "P-badstate1",
        workspace_key_hash: "abcdef1234567890",
        metadata: { name: "Bad" },
        stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S1" },
        input_values: { collision_data_analysis_36mo: { state: "nope" } },
        created_at: T0,
        updated_at: T0,
      }),
    ).toBe(false);
  });
});
