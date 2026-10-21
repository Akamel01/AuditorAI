#!/usr/bin/env node
// Track A harvest report for ticket #40: the inventory-first ODD coverage table
// and the harvest precision per class.
//
//   npx tsx scripts/harvest-track-a-report.ts
//
// Deterministic and offline: every input is a committed file, no network and no
// model call, and the output carries no timestamp, so the committed report is
// byte-reproducible (plan-loop6.md §5, work-order-loop6.json M7).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** The 13 ca_province codes (docs/RSA-Documents/corpus-schema.json:10-12). */
export const CA_PROVINCES = ["BC", "AB", "ON", "QC", "MB", "NB", "NL", "NS", "PE", "SK", "YT", "NT", "NU"] as const;

/** Inventory stage -> canonical cell (policies/canada/pack.json:22-67). */
export const STAGE_TO_CELL: Record<string, string> = {
  planning: "canada:FEASIBILITY_CONCEPT",
  preliminary: "canada:PRELIMINARY_DESIGN",
  detailed: "canada:DETAILED_DESIGN",
};

/** Manifest stage -> canonical cell (scripts/harvest-track-a.ts:350-354). */
export const MANIFEST_STAGE_TO_CELL: Record<string, string> = {
  FEASIBILITY_CONCEPT: "canada:FEASIBILITY_CONCEPT",
  PRELIMINARY_DESIGN: "canada:PRELIMINARY_DESIGN",
  DETAILED_DESIGN: "canada:DETAILED_DESIGN",
};

/** The three Canadian cells that have a canonical stage. */
export const CANADIAN_CELLS = ["canada:FEASIBILITY_CONCEPT", "canada:PRELIMINARY_DESIGN", "canada:DETAILED_DESIGN"];

/** Stages with no canonical cell (policies/canada/pack.json:76-83). */
const UNMAPPED_STAGES = ["existing", "pre-opening", "unknown", "UNSTAGED", "MULTI_STAGE", "PRE_OPENING"];

export interface InventoryRow {
  sha256: string;
  path: string;
  title: string;
  jurisdiction: string;
  stage: string;
  tier: string;
  class: string;
  dup_of: string | null;
}

export interface ManifestRow {
  sha256: string;
  project_id: string;
  tier: string;
  stage: string;
  cell_key: string;
  ca_province: string;
  split: string;
  licence_verdict: string;
  title: string;
  source_url: string;
}

export interface CoverageCell {
  cell_key: string;
  target: number;
  priority: number;
}

export interface Coverage {
  cells: CoverageCell[];
}

export interface UnfillableFamily {
  family: string;
  host: string | null;
  reason: string;
  track_input: string;
}

/** One document on record: the inventory row and the manifest row merged. */
export interface MergedRow {
  sha256: string;
  /** The inventory class wins for a sha256 in both sources; a manifest-only row is class-equivalent to rsa-sample. */
  klass: string;
  /** The manifest wins for tier and stage; the inventory wins for the class. */
  tier: string;
  stage: string;
  cell: string | null;
  jurisdiction: string;
  canadian: boolean;
  source: "on-disk" | "fetched";
  duplicate: boolean;
  coverage_candidate: boolean;
}

function isCaProvince(value: string): boolean {
  return (CA_PROVINCES as readonly string[]).includes(value);
}

function tally<T>(rows: T[], value: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = value(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function sortedCounts(counts: Record<string, number>): [string, number][] {
  return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
}

function share(count: number, denominator: number): string {
  return denominator === 0 ? "n/a" : `${((count / denominator) * 100).toFixed(1)}%`;
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

/**
 * Merge the two sources into one row per document, keyed by sha256.
 * A sha256 present in both sources is one document: the manifest wins for
 * tier/stage, the inventory wins for class, and the document is attributed to
 * the fetched column (plan-loop6.md §3 rule 4).
 */
export function mergeRows(inventory: InventoryRow[], manifest: ManifestRow[]): MergedRow[] {
  const manifestBySha = new Map(manifest.map((row) => [row.sha256, row]));
  const blockedShas = new Set(
    manifest.filter((row) => row.licence_verdict === "BLOCKED").map((row) => row.sha256),
  );
  const rows: MergedRow[] = [];
  const inventoried = new Set<string>();

  for (const row of inventory) {
    inventoried.add(row.sha256);
    const fetched = manifestBySha.get(row.sha256);
    rows.push({
      sha256: row.sha256,
      klass: row.class,
      tier: fetched ? fetched.tier : row.tier,
      stage: fetched ? fetched.stage : row.stage,
      cell: fetched
        ? MANIFEST_STAGE_TO_CELL[fetched.stage] ?? null
        : STAGE_TO_CELL[row.stage] ?? null,
      jurisdiction: row.jurisdiction,
      canadian: isCaProvince(row.jurisdiction) || row.jurisdiction === "CAN-GOV",
      source: fetched ? "fetched" : "on-disk",
      duplicate: row.dup_of !== null,
      coverage_candidate: false,
    });
  }

  for (const row of manifest) {
    if (inventoried.has(row.sha256)) continue;
    rows.push({
      sha256: row.sha256,
      klass: "rsa-sample",
      tier: row.tier,
      stage: row.stage,
      cell: MANIFEST_STAGE_TO_CELL[row.stage] ?? null,
      jurisdiction: row.ca_province,
      canadian: isCaProvince(row.ca_province),
      source: "fetched",
      duplicate: false,
      coverage_candidate: false,
    });
  }

  for (const row of rows) {
    row.coverage_candidate =
      row.canadian &&
      (row.tier === "T3" || row.tier === "T4") &&
      row.cell !== null &&
      row.klass === "rsa-sample" &&
      !row.duplicate &&
      !blockedShas.has(row.sha256);
  }

  return rows;
}

/** Build the whole report. Pure: same inputs, same bytes. */
export function buildReport(
  inventory: InventoryRow[],
  manifest: ManifestRow[],
  coverage: Coverage,
  unfillable: UnfillableFamily[],
): string {
  const rows = mergeRows(inventory, manifest);
  const all = rows; // row set A
  const canadian = rows.filter((row) => row.canadian); // row set B
  const target = (cellKey: string) => coverage.cells.find((c) => c.cell_key === cellKey);

  const out: string[] = [];
  out.push("# Track A harvest report — ODD coverage and harvest precision");
  out.push("");
  out.push("Inputs (committed, read-only, no network and no model call):");
  out.push(`- \`docs/RSA-Documents/track-a-ondisk-inventory.jsonl\` — the operator's on-disk corpus: ${inventory.length} rows`);
  out.push(`- \`docs/RSA-Documents/canada-intake-manifest.jsonl\` — the fetched Track A records: ${manifest.length} rows`);
  out.push("- `state/odd-coverage.json` — the ODD targets and priorities");
  out.push("- `docs/RSA-Documents/track-a-sources.json` — the unfillable families");
  out.push("");
  out.push("This report carries no timestamp: `npx tsx scripts/harvest-track-a-report.ts` regenerates it byte-identically.");
  out.push("");
  out.push("## Rules applied");
  out.push("");
  out.push("- A document is identified by its **sha256**.");
  out.push(
    "- A **coverage candidate** is Canadian (one of the 13 `ca_province` codes, or `CAN-GOV`), tier **T3/T4**, and its stage maps to a canonical cell. **T0 and T1 never count as coverage.**",
  );
  out.push(
    "- An **inventory** row must additionally be `class == \"rsa-sample\"`; a **manifest** row qualifies on tier + cell_key alone (it has no `class` field — it already passed the RSA classifier).",
  );
  out.push(
    "- A sha256 present in **both** sources is counted **once** and attributed to the **fetched** column: the manifest wins for tier/stage, the inventory wins for class.",
  );
  out.push("- A duplicate inventory row never carries a count; the primary row does.");
  out.push("- A `BLOCKED` manifest row never counts as coverage; `RESTRICTED` rows stay in the corpus.");
  out.push("");
  out.push("Row sets (never mixed):");
  out.push(
    `- **|A| = ${all.length}** — every document on record: the ${inventory.length} inventory rows plus the manifest rows whose sha256 is not in the inventory. Denominator of the all-rows table (3a).`,
  );
  out.push(
    `- **|B| = ${canadian.length}** — the Canadian subset of A. Denominator of the Canadian table (3b) and of the in-scope share.`,
  );
  out.push("");

  out.push("## 1. ODD coverage — inventory first, then the fetched documents");
  out.push("");
  out.push("| ODD cell | Target | Priority | Have | On disk | Fetched | Gap |");
  out.push("|---|---|---|---|---|---|---|");
  for (const cellKey of CANADIAN_CELLS) {
    const cellState = target(cellKey);
    const candidates = all.filter((row) => row.coverage_candidate && row.cell === cellKey);
    const onDisk = candidates.filter((row) => row.source === "on-disk").length;
    const fetched = candidates.filter((row) => row.source === "fetched").length;
    const goal = cellState?.target ?? 0;
    out.push(
      `| ${cellKey} | ${goal} | ${cellState?.priority ?? 0} | ${candidates.length} | ${onDisk} | ${fetched} | ${goal - candidates.length} |`,
    );
  }
  out.push("");
  out.push(
    "Targets and priorities are read from `state/odd-coverage.json`; the counts are distinct coverage-candidate documents, split by the source that supplied the label.",
  );
  const candidates = all.filter((row) => row.coverage_candidate);
  if (candidates.length > 0) {
    out.push("");
    out.push("Coverage candidates:");
    for (const row of candidates) {
      out.push(`- \`${row.sha256}\` — ${row.source} — ${row.tier} — ${row.stage} — ${row.cell}`);
    }
  }
  const both = inventory.filter((row) => manifest.some((m) => m.sha256 === row.sha256));
  if (both.length > 0) {
    out.push("");
    out.push("Reconciliation — shas present in both sources (counted once, attributed to the fetched column):");
    for (const row of both) {
      const fetched = manifest.find((m) => m.sha256 === row.sha256) as ManifestRow;
      const merged = rows.find((r) => r.sha256 === row.sha256) as MergedRow;
      out.push(
        `- \`${row.sha256}\` — inventory: ${row.jurisdiction} ${row.stage}/${row.tier}/${row.class}; manifest: ${fetched.ca_province} ${fetched.stage}/${fetched.tier} — counted once in ${merged.cell ?? "no cell"}, ${merged.source} column.`,
      );
    }
  }
  out.push("");

  out.push("## 2. Unmapped stages");
  out.push("");
  out.push("| Stage | Canonical cell | Rows in A | Rows in B |");
  out.push("|---|---|---|---|");
  for (const stage of UNMAPPED_STAGES) {
    const inAll = all.filter((row) => row.stage === stage).length;
    const inCanadian = canadian.filter((row) => row.stage === stage).length;
    out.push(`| ${stage} | none (unmapped) | ${inAll} | ${inCanadian} |`);
  }
  out.push("");
  out.push(
    "`existing`, `pre-opening` and `unknown` (and the manifest's `UNSTAGED` / `MULTI_STAGE` / `PRE_OPENING`) have no canonical cell (`policies/canada/pack.json:76-83`), so they are reported here and are never coverage.",
  );
  out.push("");

  out.push("## 3. Harvest precision");
  out.push("");
  out.push(
    "Two denominators, never mixed: the all-rows table uses **|A|**, the Canadian table uses **|B|**. `out-of-scope` exists only outside the Canadian subset, so it appears in 3a and not in 3b.",
  );
  out.push("");
  out.push(`### 3a — all rows (denominator |A| = ${all.length})`);
  out.push("");
  out.push("| class | count | share of A |");
  out.push("|---|---|---|");
  for (const [klass, count] of sortedCounts(tally(all, (row) => row.klass))) {
    out.push(`| ${klass} | ${count} | ${share(count, all.length)} |`);
  }
  out.push("");
  out.push(`### 3b — Canadian in-scope rows (denominator |B| = ${canadian.length})`);
  out.push("");
  out.push("| class | count | share of B |");
  out.push("|---|---|---|");
  for (const [klass, count] of sortedCounts(tally(canadian, (row) => row.klass))) {
    out.push(`| ${klass} | ${count} | ${share(count, canadian.length)} |`);
  }
  out.push("");
  out.push(
    "`out-of-scope` is explicitly absent from this table — every `out-of-scope` row sits outside the Canadian subset and is counted in 3a only.",
  );
  out.push("");
  out.push(
    `In-scope share: ${canadian.filter((row) => row.coverage_candidate).length} of ${canadian.length} Canadian rows are coverage candidates (${share(canadian.filter((row) => row.coverage_candidate).length, canadian.length)} of |B|).`,
  );
  out.push("");
  out.push("Tier cross-tab of the Canadian subset (a tier cut of row set B, not a class):");
  out.push("");
  out.push("| tier | count | share of B |");
  out.push("|---|---|---|");
  for (const [tier, count] of sortedCounts(tally(canadian, (row) => row.tier))) {
    out.push(`| ${tier} | ${count} | ${share(count, canadian.length)} |`);
  }
  out.push("");
  out.push(
    "T0 and T1 rows are reported here and count as coverage nowhere; only T3/T4 rows with a mapped stage and a qualifying class enter section 1.",
  );
  out.push("");

  out.push("## 4. Fetched-only precision — every row of the intake manifest");
  out.push("");
  out.push("| sha256 | tier | stage | cell_key | province | split | licence | title |");
  out.push("|---|---|---|---|---|---|---|---|");
  for (const row of manifest) {
    out.push(
      `| \`${row.sha256}\` | ${row.tier} | ${row.stage} | ${row.cell_key || "—"} | ${row.ca_province} | ${row.split} | ${row.licence_verdict} | ${cell(row.title)} |`,
    );
  }
  const splits = new Map<string, Set<string>>();
  for (const row of manifest) {
    const known = splits.get(row.sha256) ?? new Set<string>();
    known.add(row.split);
    splits.set(row.sha256, known);
  }
  const overlapping = [...splits.entries()].filter(([, values]) => values.size > 1);
  out.push("");
  out.push(
    `Split disjointness check (per document: sha256 -> split): ${overlapping.length === 0 ? "PASS" : "FAIL"} — ${splits.size} document(s) checked, ${overlapping.length} with two splits.`,
  );
  out.push("");

  out.push("## 5. Cells Track A cannot fill");
  out.push("");
  out.push(`### Unfillable families (${unfillable.length})`);
  out.push("");
  out.push("| Family | Host | Reason | Track input |");
  out.push("|---|---|---|---|");
  for (const family of unfillable) {
    out.push(`| ${cell(family.family)} | ${family.host ?? "—"} | ${cell(family.reason)} | ${family.track_input} |`);
  }
  out.push("");
  out.push("### Canadian cells");
  out.push("");
  out.push("| ODD cell | Target | Have (coverage candidates) | Zero count | Track input |");
  out.push("|---|---|---|---|---|");
  for (const cellKey of CANADIAN_CELLS) {
    const have = all.filter((row) => row.coverage_candidate && row.cell === cellKey).length;
    out.push(
      `| ${cellKey} | ${target(cellKey)?.target ?? 0} | ${have} | ${have === 0 ? "yes" : "no"} | Track B (operator) or Track C |`,
    );
  }
  out.push("");

  out.push("## 6. Provenance");
  out.push("");
  out.push(
    "The inventoried documents live in the operator's checkout, not in this container; `docs/RSA-Documents/track-a-ondisk-inventory.jsonl` is the committed stand-in for them. Binaries fetched by Track A live in the box-runner container under `docs/RSA-Documents/canada/track-a/**`, not in the operator's checkout, and no binary entered git.",
  );
  out.push("");

  out.push("## 7. Cross-check — inventory-only Canadian subset");
  out.push("");
  const inventoryOnlyCanadian = inventory.filter(
    (row) => isCaProvince(row.jurisdiction) || row.jurisdiction === "CAN-GOV",
  );
  out.push("| dimension | counts |");
  out.push("|---|---|");
  out.push(`| rows | ${inventoryOnlyCanadian.length} |`);
  out.push(`| class | ${formatCounts(tally(inventoryOnlyCanadian, (row) => row.class))} |`);
  out.push(`| stage | ${formatCounts(tally(inventoryOnlyCanadian, (row) => row.stage))} |`);
  out.push(`| tier | ${formatCounts(tally(inventoryOnlyCanadian, (row) => row.tier))} |`);
  out.push("");
  out.push(
    "These must reproduce `docs/RSA-Documents/track-a-ondisk-summary.json` (`deep_subset.canadian_in_scope_documents` and `deep_subset.canadian_in_scope_counts`).",
  );

  return `${out.join("\n")}\n`;
}

function formatCounts(counts: Record<string, number>): string {
  return sortedCounts(counts)
    .map(([key, count]) => `${key} ${count}`)
    .join(", ");
}

function readJsonl<T>(file: string): T[] {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function main(): void {
  const repo = process.cwd();
  const inventory = readJsonl<InventoryRow>(
    path.join(repo, "docs/RSA-Documents/track-a-ondisk-inventory.jsonl"),
  );
  const manifest = readJsonl<ManifestRow>(
    path.join(repo, "docs/RSA-Documents/canada-intake-manifest.jsonl"),
  );
  const coverage = JSON.parse(readFileSync(path.join(repo, "state/odd-coverage.json"), "utf8")) as Coverage;
  const sources = JSON.parse(
    readFileSync(path.join(repo, "docs/RSA-Documents/track-a-sources.json"), "utf8"),
  ) as { unfillable: UnfillableFamily[] };
  const report = buildReport(inventory, manifest, coverage, sources.unfillable);
  const target = path.join(repo, "docs/RSA-Documents/track-a-harvest-report.md");
  writeFileSync(target, report);
  console.log(`wrote ${path.relative(repo, target)} (${report.length} bytes)`);
}

// Run only when executed directly, so tests can import the pure helpers.
if (process.argv[1] && path.basename(process.argv[1]) === path.basename(__filename)) {
  main();
}
