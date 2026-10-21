import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildReport,
  mergeRows,
  CA_PROVINCES,
  MANIFEST_STAGE_TO_CELL,
  STAGE_TO_CELL,
  type Coverage,
  type InventoryRow,
  type ManifestRow,
  type UnfillableFamily,
} from "../../scripts/harvest-track-a-report";

// Offline: every input is a committed file in this repo. No network, no model call.
const REPO = process.cwd();
const INVENTORY_PATH = path.join(REPO, "docs/RSA-Documents/track-a-ondisk-inventory.jsonl");
const MANIFEST_PATH = path.join(REPO, "docs/RSA-Documents/canada-intake-manifest.jsonl");
const COVERAGE_PATH = path.join(REPO, "state/odd-coverage.json");
const SOURCES_PATH = path.join(REPO, "docs/RSA-Documents/track-a-sources.json");
const SUMMARY_PATH = path.join(REPO, "docs/RSA-Documents/track-a-ondisk-summary.json");
const SCHEMA_PATH = path.join(REPO, "docs/RSA-Documents/corpus-schema.json");
const REPORT_PATH = path.join(REPO, "docs/RSA-Documents/track-a-harvest-report.md");

function readJsonl<T>(file: string): T[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

const inventory = readJsonl<InventoryRow>(INVENTORY_PATH);
const manifest = readJsonl<ManifestRow>(MANIFEST_PATH);
const coverage = readJson<Coverage>(COVERAGE_PATH);
const unfillable = readJson<{ unfillable: UnfillableFamily[] }>(SOURCES_PATH).unfillable;

function invRow(over: Partial<InventoryRow> = {}): InventoryRow {
  return {
    sha256: "a".repeat(64),
    path: "docs/RSA-Documents/canada/canadian/x.pdf",
    title: "x",
    jurisdiction: "AB",
    stage: "planning",
    tier: "T3",
    class: "rsa-sample",
    dup_of: null,
    ...over,
  };
}

function manRow(over: Partial<ManifestRow> = {}): ManifestRow {
  return {
    sha256: "a".repeat(64),
    project_id: "PRJ-test",
    tier: "T3",
    stage: "FEASIBILITY_CONCEPT",
    cell_key: "canada:FEASIBILITY_CONCEPT",
    ca_province: "AB",
    split: "test",
    licence_verdict: "CLEAR",
    title: "x",
    source_url: "https://example.invalid/x.pdf",
    ...over,
  };
}

const syntheticCoverage: Coverage = {
  cells: [
    { cell_key: "canada:FEASIBILITY_CONCEPT", target: 13, priority: 0.9231 },
    { cell_key: "canada:PRELIMINARY_DESIGN", target: 41, priority: 3 },
    { cell_key: "canada:DETAILED_DESIGN", target: 41, priority: 3 },
  ],
};

function coverageRow(markdown: string, cellKey: string): string[] {
  const line = markdown
    .split("\n")
    .find((l) => l.startsWith(`| ${cellKey} |`));
  expect(line, `no coverage row for ${cellKey}`).toBeDefined();
  return (line as string).split("|").map((cell) => cell.trim());
}

describe("stage mapping (plan §3, policies/canada/pack.json)", () => {
  it("maps each inventory stage to its canonical cell", () => {
    expect(STAGE_TO_CELL).toEqual({
      planning: "canada:FEASIBILITY_CONCEPT",
      preliminary: "canada:PRELIMINARY_DESIGN",
      detailed: "canada:DETAILED_DESIGN",
    });
  });

  it("leaves existing / pre-opening / unknown unmapped", () => {
    for (const stage of ["existing", "pre-opening", "unknown"]) {
      expect(STAGE_TO_CELL[stage]).toBeUndefined();
    }
  });

  it("maps the manifest stage vocabulary and leaves the rest unmapped", () => {
    expect(MANIFEST_STAGE_TO_CELL).toEqual({
      FEASIBILITY_CONCEPT: "canada:FEASIBILITY_CONCEPT",
      PRELIMINARY_DESIGN: "canada:PRELIMINARY_DESIGN",
      DETAILED_DESIGN: "canada:DETAILED_DESIGN",
    });
    for (const stage of ["UNSTAGED", "MULTI_STAGE", "PRE_OPENING"]) {
      expect(MANIFEST_STAGE_TO_CELL[stage]).toBeUndefined();
    }
  });

  it("takes the 13 ca_province codes from the committed corpus schema", () => {
    const schema = readJson<{ properties: { ca_province: { enum: string[] } } }>(SCHEMA_PATH);
    expect([...CA_PROVINCES].sort()).toEqual([...schema.properties.ca_province.enum].sort());
  });
});

describe("coverage candidate rule (RC-1)", () => {
  it("never counts a T1 row in a cell", () => {
    const rows = mergeRows(
      [invRow({ tier: "T1", stage: "planning", class: "rsa-sample" })],
      [manRow({ tier: "T1", stage: "UNSTAGED", cell_key: "", ca_province: "BC" })],
    );
    expect(rows.filter((r) => r.coverage_candidate)).toHaveLength(0);
  });

  it("never counts a T0 or a non rsa-sample inventory row", () => {
    const rows = mergeRows(
      [
        invRow({ tier: "T0", sha256: "b".repeat(64) }),
        invRow({ tier: "T3", class: "methodology", sha256: "c".repeat(64) }),
        invRow({ tier: "T3", class: "out-of-scope", sha256: "d".repeat(64) }),
      ],
      [],
    );
    expect(rows.filter((r) => r.coverage_candidate)).toHaveLength(0);
  });

  it("never counts a non-Canadian row", () => {
    const rows = mergeRows([invRow({ tier: "T3", jurisdiction: "USA" })], []);
    expect(rows.filter((r) => r.coverage_candidate)).toHaveLength(0);
  });

  it("counts a sha256 present in both sources once and attributes it to the fetched column", () => {
    const sha = "e".repeat(64);
    const rows = mergeRows(
      [invRow({ sha256: sha, tier: "T0", stage: "planning", class: "rsa-sample" })],
      [manRow({ sha256: sha, tier: "T3", stage: "FEASIBILITY_CONCEPT" })],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("fetched");
    expect(rows[0].tier).toBe("T3");
    expect(rows[0].coverage_candidate).toBe(true);

    const markdown = buildReport(
      [invRow({ sha256: sha, tier: "T0", stage: "planning", class: "rsa-sample" })],
      [manRow({ sha256: sha, tier: "T3", stage: "FEASIBILITY_CONCEPT" })],
      syntheticCoverage,
      [],
    );
    const cells = coverageRow(markdown, "canada:FEASIBILITY_CONCEPT");
    expect(cells[4]).toBe("1"); // have
    expect(cells[5]).toBe("0"); // on disk
    expect(cells[6]).toBe("1"); // fetched
  });

  it("never counts a BLOCKED manifest row as coverage", () => {
    const rows = mergeRows([], [manRow({ licence_verdict: "BLOCKED" })]);
    expect(rows.filter((r) => r.coverage_candidate)).toHaveLength(0);
  });
});

describe("the committed report (M7 acceptance)", () => {
  const fresh = buildReport(inventory, manifest, coverage, unfillable);

  it("equals the freshly computed report, byte for byte", () => {
    expect(readFileSync(REPORT_PATH, "utf8")).toBe(fresh);
  });

  it("carries no timestamp", () => {
    expect(fresh).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it("reads the targets and priorities from state/odd-coverage.json", () => {
    const cells = coverageRow(fresh, "canada:FEASIBILITY_CONCEPT");
    expect(cells[2]).toBe("13");
    expect(cells[3]).toBe("0.9231");
    expect(coverageRow(fresh, "canada:PRELIMINARY_DESIGN")[2]).toBe("41");
    expect(coverageRow(fresh, "canada:DETAILED_DESIGN")[2]).toBe("41");
  });

  it("states both denominators and keeps them apart", () => {
    expect(fresh).toContain("|A| = 305");
    expect(fresh).toContain("|B| = 147");
    expect(fresh).toContain("denominator |A|");
    expect(fresh).toContain("denominator |B|");
  });

  it("shows out-of-scope in the all-rows table and not in the Canadian table", () => {
    const allRows = fresh.slice(fresh.indexOf("### 3a"), fresh.indexOf("### 3b"));
    const canadian = fresh.slice(fresh.indexOf("### 3b"), fresh.indexOf("## 4."));
    const tableRows = (markdown: string) =>
      markdown.split("\n").filter((line) => line.startsWith("|"));
    expect(tableRows(allRows).some((line) => line.startsWith("| out-of-scope |"))).toBe(true);
    expect(tableRows(canadian).some((line) => line.startsWith("| out-of-scope |"))).toBe(false);
    expect(canadian).toContain("out-of-scope"); // the absence is stated explicitly
  });

  it("lists every class value present in the inventory", () => {
    const classes = [...new Set(inventory.map((r) => r.class))].sort();
    const allRows = fresh.slice(fresh.indexOf("### 3a"), fresh.indexOf("### 3b"));
    for (const klass of classes) expect(allRows).toContain(klass);
  });

  it("reports the unmapped stages with their counts", () => {
    for (const stage of ["existing", "pre-opening", "unknown"]) {
      expect(fresh).toContain(`| ${stage} |`);
    }
  });

  it("lists every manifest row with its tier, stage, split and licence verdict", () => {
    for (const row of manifest) {
      expect(fresh).toContain(row.sha256);
      expect(fresh).toContain(row.split);
      expect(fresh).toContain(row.licence_verdict);
    }
  });

  it("passes the per-document split disjointness check", () => {
    expect(fresh).toContain("Split disjointness check");
    expect(fresh).toContain("PASS");
  });

  it("lists all unfillable families", () => {
    expect(unfillable.length).toBe(13);
    for (const family of unfillable) expect(fresh).toContain(family.family);
  });
});

describe("report labelling (M7 notes 1, 2 and 4)", () => {
  const fresh = buildReport(inventory, manifest, coverage, unfillable);

  it("counts rows, not documents, in the all-rows set", () => {
    expect(fresh).toContain("every **row** on record");
    expect(fresh).not.toContain("every document on record");
  });

  it("labels the coverage Have column apart from the server-side have_total", () => {
    expect(fresh).toContain(
      "| ODD cell | Target | Priority | Have (documents) | On disk | Fetched | Gap |",
    );
    expect(fresh).toContain("have_total");
    expect(fresh).toContain("have_full_package");
  });

  it("marks the section-2 stage counts as label-reconciled", () => {
    expect(fresh).toContain("**reconciled** label");
    expect(fresh).toContain("inventory `unknown` → manifest `UNSTAGED`");
    expect(fresh).toContain("inventory `planning` → manifest `FEASIBILITY_CONCEPT`");
  });
});

describe("cross-check against the committed on-disk summary", () => {
  it("reproduces the inventory-only Canadian subset", () => {
    const summary = readJson<{
      deep_subset: {
        canadian_in_scope_documents: number;
        canadian_in_scope_counts: { class: Record<string, number>; stage: Record<string, number>; tier: Record<string, number> };
      };
    }>(SUMMARY_PATH);
    const canadian = inventory.filter(
      (row) => (CA_PROVINCES as readonly string[]).includes(row.jurisdiction) || row.jurisdiction === "CAN-GOV",
    );
    const tally = (rows: InventoryRow[], key: "class" | "stage" | "tier") => {
      const counts: Record<string, number> = {};
      for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
      return counts;
    };
    expect(canadian.length).toBe(summary.deep_subset.canadian_in_scope_documents);
    expect(tally(canadian, "class")).toEqual(summary.deep_subset.canadian_in_scope_counts.class);
    expect(tally(canadian, "stage")).toEqual(summary.deep_subset.canadian_in_scope_counts.stage);
    expect(tally(canadian, "tier")).toEqual(summary.deep_subset.canadian_in_scope_counts.tier);
  });
});
