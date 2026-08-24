// ODD declaration gates (ADR-0005 / DEC-0006): policies/odd.json validates
// against its contract schema and upholds the membership invariants — conjunctive
// status rules, floor presence, incident-flag honesty, and cross-checks against
// the corpus fixture set it claims.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import Ajv from "ajv/dist/2020.js";

function loadJson(rel: string): unknown {
  return JSON.parse(readFileSync(path.join(process.cwd(), rel), "utf8"));
}

const declaration = loadJson("policies/odd.json") as Record<string, unknown>;
const schema = loadJson("contracts/schemas/odd-declaration.schema.json") as object;

interface Cell {
  jurisdiction_id: string;
  framework_id: string;
  native_stage_id: string | null;
  canonical_stage: string[];
  mapping_confidence: string | null;
  status: "in" | "mapped_unproven" | "structurally_absent";
  fixture_ids: string[];
  incident_flags: string[];
  input_floor: string[];
  scheme_scope_note: string;
}

const cells = (declaration.cells as Cell[]) ?? [];

describe("ODD declaration", () => {
  it("validates against the contract schema", () => {
    const ajv = new Ajv({ allErrors: true });
    // NodeNext-compatible 2020 meta-schema registration, same as corpus test.
    const validate = ajv.compile(schema);
    const ok = validate(declaration);
    expect(ok, JSON.stringify(validate.errors ?? [], null, 1)).toBe(true);
  });

  it("carries version + ADR provenance", () => {
    expect(declaration.declaration_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(declaration.adr_ref).toContain("0005-operational-design-domain");
  });

  it("'in' cells are conjunctive: accepted-mapping confidence AND >=1 fixture AND >=1 floor class", () => {
    const ins = cells.filter((c) => c.status === "in");
    expect(ins.length).toBeGreaterThanOrEqual(5);
    for (const c of ins) {
      expect(c.fixture_ids.length, `${c.native_stage_id} fixtures`).toBeGreaterThanOrEqual(1);
      expect(c.input_floor.length, `${c.native_stage_id} floor`).toBeGreaterThanOrEqual(1);
      expect(c.mapping_confidence, `${c.native_stage_id} confidence`).not.toBeNull();
    }
  });

  it("'mapped_unproven' cells claim no fixtures", () => {
    for (const c of cells.filter((c) => c.status === "mapped_unproven")) {
      expect(c.fixture_ids, c.native_stage_id ?? "").toEqual([]);
      expect(c.mapping_confidence).not.toBeNull();
    }
  });

  it("'structurally_absent' cells have no native stage, no mapping, no floor", () => {
    for (const c of cells.filter((c) => c.status === "structurally_absent")) {
      expect(c.native_stage_id).toBeNull();
      expect(c.mapping_confidence).toBeNull();
      expect(c.input_floor).toEqual([]);
    }
  });

  it("every claimed fixture id exists in the corpus directory", () => {
    const files = readdirSync(path.join(process.cwd(), "tests/fixtures"));
    for (const c of cells.filter((c) => c.status === "in")) {
      for (const fid of c.fixture_ids) {
      const stem = fid.toLowerCase().replace(/-/g, "");
      expect(
        files.some((f) => f.toLowerCase().startsWith(`${stem}-`)),
        `${fid} fixture file present`,
      ).toBe(true);
      }
    }
  });

  it("CA planning cell is IN with VAL-024 flag cleared after §5 swap+re-test (VAL-2026-08-22-027)", () => {
    const ca = cells.find(
      (c) => c.jurisdiction_id === "canada" && c.canonical_stage.includes("FEASIBILITY_CONCEPT"),
    );
    expect(ca?.status).toBe("in");
    expect(
      ca?.incident_flags.length,
      "no open flags: re-baseline accepted run 2026-08-24T06-11-08-387Z",
    ).toBe(0);
  });

  it("UK x FEASIBILITY_CONCEPT is recorded as structurally absent", () => {
    const uk = cells.find(
      (c) =>
        c.jurisdiction_id === "uk" &&
        c.canonical_stage.includes("FEASIBILITY_CONCEPT"),
    );
    expect(uk?.status).toBe("structurally_absent");
    expect(uk?.native_stage_id).toBeNull();
  });
});
