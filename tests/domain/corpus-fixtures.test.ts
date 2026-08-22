// E3 gates: corpus fixtures GF-6..GF-10 validate against the project and
// finding schemas, carry license provenance, reproduce their recorded Tier-0
// deterministic snapshots byte-stably, and keep judge baselines distinct.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";
import { runAudit } from "@/domain/engine";
import type { InputValueState, JurisdictionId, Project } from "@/domain/types";

function loadJson(rel: string): unknown {
  return JSON.parse(readFileSync(path.join(process.cwd(), rel), "utf8"));
}

const projectSchema = loadJson("contracts/schemas/project.schema.json") as object;
const findingSchema = loadJson("contracts/schemas/finding.schema.json") as object;

const T0 = "2026-08-22T00:00:00.000Z";

interface CorpusFixture {
  fixture_id: string;
  jurisdiction: string;
  native_stage_id: string;
  metadata: Project["metadata"];
  inputs: Record<string, { state: InputValueState; value?: string }>;
  provenance: {
    source_url: string;
    license: string;
    retrieved: string;
    extractor: string;
  };
  expected_findings_baseline: unknown[];
  expected: {
    finding_ids_present: string[];
    missing_information_input_ids: string[];
    questions_min_count: number;
    mapping_confidence: string;
    snapshot_recorded?: string;
  };
}

const FILES = [
  "gf6-uk-m5j10-stage1.json",
  "gf7-usa-arterial-prelim.json",
  "gf8-usa-hawk-final.json",
  "gf9-int-interchange-prelim.json",
  "gf10-canada-corridor-planning.json",
];

function load(file: string): CorpusFixture {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "tests/fixtures", file), "utf8"),
  ) as CorpusFixture;
}

function toProject(fx: CorpusFixture): Project {
  return {
    project_id: `P-${fx.fixture_id.toLowerCase().replace(/-/g, "")}`,
    workspace_key_hash: "gfworkspace",
    metadata: fx.metadata,
    stage_selection: {
      jurisdiction: fx.jurisdiction as JurisdictionId,
      native_stage_id: fx.native_stage_id,
    },
    input_values: fx.inputs,
    created_at: T0,
    updated_at: T0,
  };
}

const ajv = new Ajv({ strict: false, allErrors: true });
const validateProject = ajv.compile(projectSchema);
const validateFinding = ajv.compile(findingSchema);

describe.each(FILES)("corpus fixture %s", (file) => {
  const fx = load(file);

  it("derives a Project that validates against project.schema.json", () => {
    expect(validateProject(toProject(fx))).toBe(true);
  });

  it("carries complete license provenance with a reachable-looking source", () => {
    expect(fx.provenance.source_url).toMatch(/^https?:\/\//);
    expect(fx.provenance.license).toMatch(/public domain|open government licence|OGL/i);
    expect(fx.provenance.retrieved).toBe("2026-08-22");
    expect(fx.provenance.extractor.length).toBeGreaterThan(40);
  });

  it("reproduces its recorded Tier-0 deterministic snapshot", () => {
    const result = runAudit(toProject(fx), T0);
    expect(result.findings.map((f) => f.finding_id)).toEqual(fx.expected.finding_ids_present);
    expect(result.missing_information.map((m) => m.input_id)).toEqual(
      fx.expected.missing_information_input_ids,
    );
    expect(result.audit_questions.length).toBeGreaterThanOrEqual(
      fx.expected.questions_min_count,
    );
    expect(result.mapping_confidence).toBe(fx.expected.mapping_confidence);
  });

  it("is byte-deterministic across runs", () => {
    const project = toProject(fx);
    expect(JSON.stringify(runAudit(project, T0))).toBe(JSON.stringify(runAudit(project, T0)));
  });

  it("has judge baselines that validate against finding.schema.json", () => {
    expect(fx.expected_findings_baseline.length).toBeGreaterThan(0);
    for (const f of fx.expected_findings_baseline) {
      expect(validateFinding(f), JSON.stringify(validateFinding.errors)).toBe(true);
    }
  });

  it("keeps judge baselines separate from deterministic output", () => {
    const result = runAudit(toProject(fx), T0);
    const engineIds = new Set(result.findings.map((f) => f.finding_id));
    for (const b of fx.expected_findings_baseline as { finding_id: string }[]) {
      expect(engineIds.has(b.finding_id)).toBe(false);
    }
  });
});

describe("corpus coverage", () => {
  it("spans at least four jurisdictions including UK Stage 1 and US final design", () => {
    const fixtures = FILES.map(load);
    const juris = new Set(fixtures.map((f) => f.jurisdiction));
    expect(juris.size).toBeGreaterThanOrEqual(4);
    expect(fixtures.some((f) => f.native_stage_id === "uk:S1")).toBe(true);
    expect(fixtures.some((f) => f.native_stage_id === "us-fhwa:final-design")).toBe(true);
  });

  it("contains no UAE fixture while corpus licensing remains unconfirmed", () => {
    const juris = new Set(FILES.map((f) => load(f).jurisdiction));
    expect(juris.has("AE")).toBe(false); // E2 coverage check: UAE ❌ licensing unconfirmed
  });
});
