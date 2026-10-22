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

/** The three Canadian cells that have a canonical cell. */
export const CANADIAN_CELLS = ["canada:FEASIBILITY_CONCEPT", "canada:PRELIMINARY_DESIGN", "canada:DETAILED_DESIGN"];

/** Stages with no canonical cell (policies/canada/pack.json:76-83). */
const UNMAPPED_STAGES = ["existing", "pre-opening", "unknown", "UNSTAGED", "MULTI_STAGE", "PRE_OPENING"];

/** The corpus root: a row whose path starts with it is corpus material. */
export const CORPUS_ROOT = "docs/RSA-Documents/";

export interface InventoryRow {
  sha256: string;
  path: string;
  title: string;
  jurisdiction: string;
  stage: string;
  tier: string;
  class: string;
  dup_of: string | null;
  /** How the label was derived: `anchor`, `rule` or `needs_review` (M4). */
  label_confidence?: string;
  /** The group the row was filed under in the operator's checkout (M2). */
  source_group?: string;
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
  /** The document type the source declared (M3). */
  doc_type?: string;
  /** The source id in track-a-sources.json (M5). */
  source_id?: string;
  /** Where the fetched file was written (M2). */
  local_path?: string;
  /** Which harvest round produced the row; round 2 rows are excluded here. */
  round?: string;
}

export interface SourceEntry {
  id: string;
  /** The source's fallback stage, used when no stage rule matches the text (M5). */
  stage_hint?: string;
  /** The source's declared document type; `complete-RSA` forces tier T3 (M5). */
  doc_type_hint?: string;
  outcome?: { m6_skipped_hash_already_present?: number };
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

/** Directory -> licence verdict, parsed from LICENSE-REGISTER.md (M1). */
export type LicenceRegister = Record<string, string>;

/** The committed files the report reads besides the two row sources. */
export interface ReportContext {
  /** The per-source entries of track-a-sources.json. */
  sources: SourceEntry[];
  /** The unfillable families of track-a-sources.json. */
  unfillable: UnfillableFamily[];
  /** The directory -> verdict map of LICENSE-REGISTER.md. */
  licence: LicenceRegister;
  /** The rows of track-a-duplicates.json (M7). */
  duplicates: { sha256: string }[];
}

/** One document on record: the inventory row and the manifest row merged. */
export interface MergedRow {
  sha256: string;
  /** The inventory class wins for a sha256 in both sources; a manifest-only row is classified from its tier. */
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
  /** The licence verdict: the manifest's for a fetched row, else the register's for its directory. */
  licence: string;
  /** Where the row was seen on disk (the inventory path, else the fetched local path). */
  path: string;
  /** True when `path` is under the corpus root `docs/RSA-Documents/`. */
  corpus_root: boolean;
  /** The inventory label's confidence, or `manifest` for a manifest-only row. */
  label_confidence: string;
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
 * Parse `docs/RSA-Documents/LICENSE-REGISTER.md` into a directory -> verdict map.
 * The register is a markdown table; only the leading CLEAR / RESTRICTED / BLOCKED
 * token of the verdict column is taken (`RESTRICTED - exception-annotation ...`
 * is still RESTRICTED).
 */
export function parseLicenceRegister(markdown: string): LicenceRegister {
  const register: LicenceRegister = {};
  for (const line of markdown.split("\n")) {
    const match = /^\|\s*([^|]+?)\s*\|\s*(CLEAR|RESTRICTED|BLOCKED)\b/.exec(line);
    if (match) register[match[1]] = match[2];
  }
  return register;
}

/**
 * The licence verdict of a file, from the source directory it sits in.
 * A directory that the register does not list is `unknown` - not CLEAR.
 */
export function licenceForPath(filePath: string, register: LicenceRegister): string {
  const dir = filePath.split("/").slice(0, -1).join("/");
  const candidates = [dir];
  if (dir.startsWith(CORPUS_ROOT)) {
    const relative = dir.slice(CORPUS_ROOT.length);
    candidates.push(relative);
    if (relative.startsWith("canada/")) candidates.push(relative.slice("canada/".length));
  }
  candidates.push(dir.split("/").pop() ?? "");
  for (const key of candidates) {
    const verdict = register[key];
    if (verdict) return verdict;
  }
  return "unknown";
}

/**
 * The class of a manifest-only row, from the fields the manifest carries.
 * A manifest row has no `class` field: T3/T4 is a sample of a completed audit,
 * T1 states the process (methodology), T0 is unusable.
 */
export function manifestClass(tier: string): string {
  if (tier === "T3" || tier === "T4") return "rsa-sample";
  if (tier === "T0") return "unusable";
  return "methodology";
}

/** One row per sha256: the same document never carries a count twice. */
function uniqueBySha(rows: MergedRow[]): MergedRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.sha256)) return false;
    seen.add(row.sha256);
    return true;
  });
}

/**
 * Merge the two sources into one row per document, keyed by sha256.
 * A sha256 present in both sources is one document: the manifest wins for
 * tier/stage, the inventory wins for class, and the document is attributed to
 * the fetched column (plan-loop6.md §3 rule 4).
 */
export function mergeRows(
  inventory: InventoryRow[],
  manifest: ManifestRow[],
  licence: LicenceRegister = {},
): MergedRow[] {
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
      licence: fetched ? fetched.licence_verdict : licenceForPath(row.path, licence),
      path: row.path,
      corpus_root: row.path.startsWith(CORPUS_ROOT),
      label_confidence: row.label_confidence ?? "unknown",
    });
  }

  for (const row of manifest) {
    if (inventoried.has(row.sha256)) continue;
    rows.push({
      sha256: row.sha256,
      klass: manifestClass(row.tier),
      tier: row.tier,
      stage: row.stage,
      cell: MANIFEST_STAGE_TO_CELL[row.stage] ?? null,
      jurisdiction: row.ca_province,
      canadian: isCaProvince(row.ca_province),
      source: "fetched",
      duplicate: false,
      coverage_candidate: false,
      licence: row.licence_verdict,
      path: row.local_path ?? "",
      corpus_root: (row.local_path ?? "").startsWith(CORPUS_ROOT),
      label_confidence: "manifest",
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
  manifestAll: ManifestRow[],
  coverage: Coverage,
  context: ReportContext,
): string {
  // This report is the record of round 1 (ticket #40). Round 2 (ticket #60)
  // appends rows to the same manifest and has its own report; filtering here
  // keeps the round-1 report byte-identical without regenerating it.
  const manifest = manifestAll.filter((row) => (row as { round?: string }).round !== "2");
  const { sources, unfillable, licence, duplicates } = context;
  const rows = mergeRows(inventory, manifest, licence);
  const all = rows; // row set A
  const canadian = rows.filter((row) => row.canadian); // row set B
  const duplicatesInA = all.filter((row) => row.duplicate).length;
  const target = (cellKey: string) => coverage.cells.find((c) => c.cell_key === cellKey);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  /** The stage the source would fall back to (M5). */
  const stageFrom = (row: ManifestRow): string => {
    const source = sourceById.get(row.source_id ?? "");
    if (!source?.stage_hint) return "unknown";
    return row.stage === source.stage_hint ? "hint" : "rule";
  };
  /** The tier the source's `doc_type_hint: complete-RSA` would force (M5). */
  const tierFrom = (row: ManifestRow): string => {
    const source = sourceById.get(row.source_id ?? "");
    if (!source) return "unknown";
    return source.doc_type_hint === "complete-RSA" && row.tier === "T3" ? "hint" : "rule";
  };

  const corpusRows = all.filter((row) => row.corpus_root);
  const outsideRows = all.filter((row) => !row.corpus_root);
  const canadianCorpus = canadian.filter((row) => row.corpus_root);
  const canadianOutside = canadian.filter((row) => !row.corpus_root);
  const labelConfidence = tally(inventory, (row) => row.label_confidence ?? "unknown");
  const outsideGroups = sortedCounts(
    tally(
      inventory.filter((row) => !row.path.startsWith(CORPUS_ROOT)),
      (row) => row.source_group ?? "outside the corpus root",
    ),
  ).map(([group, count]) => `${group} (${count})`);
  const manifestBySha = new Map(manifest.map((row) => [row.sha256, row]));

  const out: string[] = [];
  out.push("# Track A harvest report — ODD coverage and harvest precision");
  out.push("");
  out.push("Inputs (committed, read-only, no network and no model call):");
  out.push(
    `- \`docs/RSA-Documents/track-a-ondisk-inventory.jsonl\` — the operator's checkout: ${inventory.length} inventoried rows (${inventory.filter((row) => row.path.startsWith(CORPUS_ROOT)).length} under the corpus root \`${CORPUS_ROOT}\`, ${inventory.filter((row) => !row.path.startsWith(CORPUS_ROOT)).length} elsewhere)`,
  );
  out.push(`- \`docs/RSA-Documents/canada-intake-manifest.jsonl\` — the fetched Track A records: ${manifest.length} rows`);
  out.push("- `state/odd-coverage.json` — the ODD targets and priorities");
  out.push("- `docs/RSA-Documents/track-a-sources.json` — the source outcomes and the unfillable families");
  out.push("- `docs/RSA-Documents/LICENSE-REGISTER.md` — the per-directory licence verdicts");
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
    "- An **inventory** row must additionally be `class == \"rsa-sample\"`. A **manifest-only** row (a sha256 the inventory does not hold) has no `class` field: it is classified from the fields the manifest carries — tier **T3/T4** -> `rsa-sample`, **T1** -> `methodology`, **T0** -> `unusable` — and qualifies on tier + cell_key alone (it already passed the RSA classifier).",
  );
  out.push(
    "- A sha256 present in **both** sources is counted **once** and attributed to the **fetched** column: the manifest wins for tier/stage, the inventory wins for class.",
  );
  out.push("- A duplicate inventory row never carries a count; the primary row does.");
  out.push("- A `BLOCKED` manifest row never counts as coverage.");
  out.push(
    "- **Licence.** A counted candidate carries the licence state of its source: the manifest's `licence_verdict` for a fetched document, else the verdict for its directory in `docs/RSA-Documents/LICENSE-REGISTER.md` (a directory the register does not list is `unknown`). A candidate whose licence is not **CLEAR** is **not usable for train or test until the owner signs off** — it is still counted, because the corpus's `canada/` shelf is RESTRICTED pending owner sign-off and dropping those candidates would zero every cell.",
  );
  out.push(
    `- **Labels.** Every inventory label is machine-derived, not audited: ${formatCounts(labelConfidence)} of ${inventory.length} rows (\`label_confidence\` in the inventory). A \`needs_review\` label has never been checked by a human, and the coverage counts below inherit that.`,
  );
  out.push(
    `- **Population.** A row is any document inventoried anywhere under the operator's checkout, not only the corpus: the rows outside the corpus root \`${CORPUS_ROOT}\` are ${outsideGroups.join(", ")}. The corpus root holds the other ${inventory.length - inventory.filter((row) => !row.path.startsWith(CORPUS_ROOT)).length} inventory rows.`,
  );
  out.push(
    "- **Where a fetched label came from.** The manifest does not record whether a fetched row's tier/stage was read out of the document or taken from the source's fallback (`stage_hint`; `doc_type_hint: complete-RSA` -> T3). Section 4 counts the fetched rows whose value equals the source's fallback.",
  );
  out.push("");
  out.push("Row sets (never mixed):");
  out.push(
    `- **|A| = ${all.length}** — every **row** on record: the ${inventory.length} inventory rows plus the manifest rows whose sha256 is not in the inventory. These are rows, not documents: the inventory holds repeated copies of the same sha256, so ${duplicatesInA} of the rows are duplicate copies of another row. Denominator of the all-rows table (3a). Split by corpus membership: **${corpusRows.length}** under the corpus root \`${CORPUS_ROOT}\`, **${outsideRows.length}** outside it.`,
  );
  out.push(
    `- **|B| = ${canadian.length}** — the Canadian subset of A. Denominator of the Canadian table (3b) and of the in-scope share. Split by corpus membership: **${canadianCorpus.length}** under the corpus root, **${canadianOutside.length}** outside it.`,
  );
  out.push("");

  out.push("## 1. ODD coverage — inventory first, then the fetched documents");
  out.push("");
  out.push(
    "| ODD cell | Target | Priority | Have (documents) | Have (usable, CLEAR only) | On disk | Fetched | Candidate labels | Gap |",
  );
  out.push("|---|---|---|---|---|---|---|---|---|");
  for (const cellKey of CANADIAN_CELLS) {
    const cellState = target(cellKey);
    const candidates = uniqueBySha(all.filter((row) => row.coverage_candidate && row.cell === cellKey));
    const onDisk = candidates.filter((row) => row.source === "on-disk").length;
    const fetched = candidates.filter((row) => row.source === "fetched").length;
    const usable = candidates.filter((row) => row.licence === "CLEAR").length;
    const labels = formatCounts(tally(candidates, (row) => row.label_confidence)) || "none";
    const goal = cellState?.target ?? 0;
    out.push(
      `| ${cellKey} | ${goal} | ${cellState?.priority ?? 0} | ${candidates.length} | ${usable} | ${onDisk} | ${fetched} | ${labels} | ${goal - candidates.length} |`,
    );
  }
  out.push("");
  out.push(
    "Targets and priorities are read from `state/odd-coverage.json`; the counts are distinct coverage-candidate documents, split by the source that supplied the label.",
  );
  out.push("");
  out.push(
    "`Have (documents)` counts the coverage-candidate **documents** of this corpus, under the rules above (a duplicate copy never carries a count). It is **not** the server-side `have_total` of `state/odd-coverage.json`, which counts ODD **packages** (`have_total` / `have_full_package`): the two counters measure different things and can disagree for the same cell.",
  );
  out.push("");
  out.push(
    "`Have (usable, CLEAR only)` counts the candidates whose licence is CLEAR. A candidate whose licence is not CLEAR is **not usable for train or test until the owner signs off** — the register's verdicts gate the C7/C8/C9 inputs, CLEAR only (`docs/RSA-Documents/LICENSE-REGISTER.md`, header). Such candidates are counted rather than dropped: the corpus's `canada/` shelf is RESTRICTED pending owner sign-off, and dropping them would zero every cell.",
  );
  out.push("");
  out.push(
    "`Candidate labels` is the label-confidence breakdown of that cell's candidates (`anchor` / `rule` / `needs_review` in `docs/RSA-Documents/track-a-ondisk-inventory.jsonl`). No inventory label is audited, so the counts above stand on machine-derived labels.",
  );
  out.push("");
  out.push(
    "`docs/RSA-Documents/track-a-coverage.md` is the **fetched-only** view of these cells (it counts the documents in `canada-intake-manifest.jsonl` whose `cell_key` matches — never what is on the operator's disk); this report is the **inventory-first** view (it counts the inventoried corpus as well as the fetched records). For `canada:DETAILED_DESIGN` the fetched-only file reads 0 and this report reads 1, because the one candidate is an on-disk document the fetched-only view cannot see.",
  );
  const candidates = uniqueBySha(all.filter((row) => row.coverage_candidate));
  if (candidates.length > 0) {
    out.push("");
    out.push("Coverage candidates:");
    for (const row of candidates) {
      out.push(
        `- \`${row.sha256}\` — ${row.source} — ${row.tier} — ${row.stage} — ${row.cell} — class \`${row.klass}\` — label confidence \`${row.label_confidence}\` — licence \`${row.licence}\` — corpus root: ${row.corpus_root ? "yes" : "no"} — path \`${row.path}\``,
      );
    }
    for (const row of candidates.filter((candidate) => !candidate.corpus_root)) {
      const fetched = manifestBySha.get(row.sha256);
      out.push(
        `- \`${row.sha256}\` is inventoried **outside** the corpus root, at \`${row.path}\`${row.path.startsWith("tests/fixtures/") ? " — a test fixture" : ""}${fetched?.local_path ? ` — and is byte-identical to the ingested corpus copy \`${fetched.local_path}\`` : ""}. That is why the cell reads \`On disk 0 | Fetched 1\`: the sha256 is in both sources, so it is counted once and attributed to the fetched column.`,
      );
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
  const relabelled = inventory.flatMap((row) => {
    const fetched = manifest.find((m) => m.sha256 === row.sha256);
    if (!fetched || fetched.stage === row.stage) return [];
    return [`\`${row.sha256}\` (inventory \`${row.stage}\` → manifest \`${fetched.stage}\`)`];
  });
  out.push(
    `These counts use the **reconciled** label — the manifest wins for tier and stage, as in the rules above — so a row the manifest re-labels leaves its inventory stage column. Re-labelled here: ${relabelled.length > 0 ? relabelled.join(" and ") : "none"}. Those rows are counted under their reconciled label above, so the inventory's own stage counts (section 7) are higher for the stages they left.`,
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
  const inScope = uniqueBySha(canadian.filter((row) => row.coverage_candidate)).length;
  out.push(
    `In-scope share: ${inScope} of ${canadian.length} Canadian rows are coverage candidates (${share(inScope, canadian.length)} of |B|).`,
  );
  out.push("");
  const corpusCandidates = uniqueBySha(canadianCorpus.filter((row) => row.coverage_candidate)).length;
  const outsideCandidates = uniqueBySha(
    canadian.filter((row) => row.coverage_candidate && !row.corpus_root),
  ).length;
  out.push(
    `Population sensitivity: on the corpus-root cut of |B| (${canadianCorpus.length} rows under \`${CORPUS_ROOT}\`) ${corpusCandidates} ${corpusCandidates === 1 ? "row is a coverage candidate" : "rows are coverage candidates"} (${share(corpusCandidates, canadianCorpus.length)}).${outsideCandidates > 0 ? ` The other counted candidate${outsideCandidates === 1 ? " is" : "s are"} inventoried only outside the corpus root${outsideCandidates === 1 ? " (a test fixture)" : ""}; the corpus copy is the ingested file, which the inventory does not hold.` : ""}`,
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
  out.push("| sha256 | tier | stage | stage from | tier from | cell_key | province | split | licence | title |");
  out.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const row of manifest) {
    out.push(
      `| \`${row.sha256}\` | ${row.tier} | ${row.stage} | ${stageFrom(row)} | ${tierFrom(row)} | ${row.cell_key || "—"} | ${row.ca_province} | ${row.split} | ${row.licence_verdict} | ${cell(row.title)} |`,
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
  out.push(
    `Licence verdict breakdown of the manifest rows: ${formatCounts(tally(manifest, (row) => row.licence_verdict))}.`,
  );
  out.push("");
  const hintStages = manifest.filter((row) => stageFrom(row) === "hint").length;
  const hintTiers = manifest.filter((row) => tierFrom(row) === "hint").length;
  out.push(
    `Stage provenance of the fetched rows: **${hintStages} of ${manifest.length}** carry the source's \`stage_hint\` verbatim and **${hintTiers} of ${manifest.length}** carry tier T3, the value their source's \`doc_type_hint: complete-RSA\` forces. The manifest does not record which path was taken, so \`hint\` marks a possible fallback, not a proven one: \`stage from hint\` = the stage equals the source's \`stage_hint\` (the harvester's fallback when no stage rule matches the text), \`tier from hint\` = tier T3 under a source that declares \`doc_type_hint: complete-RSA\`, which forces T3 (\`scripts/harvest-track-a.ts:478\`).`,
  );
  out.push("");
  const hashSkips = sources.reduce(
    (total, source) => total + (source.outcome?.m6_skipped_hash_already_present ?? 0),
    0,
  );
  out.push(
    `\`docs/RSA-Documents/track-a-duplicates.json\` holds only the **${duplicates.length}** row${duplicates.length === 1 ? "" : "s"} staged before the hash skip moved ahead of staging: the skip happens at fetch time, so a document whose sha256 the corpus already holds never reaches the intake stage and never reaches the register. The register is **partial** — it does not mean "only ${duplicates.length} duplicates ever existed". The committed outcome blocks in \`docs/RSA-Documents/track-a-sources.json\` record **${hashSkips}** fetch-time \`hash-already-present\` skips: those documents were downloaded in full and then discarded (never re-ingested, never written to disk), and none of them is in the register.`,
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
    const have = uniqueBySha(all.filter((row) => row.coverage_candidate && row.cell === cellKey)).length;
    out.push(
      `| ${cellKey} | ${target(cellKey)?.target ?? 0} | ${have} | ${have === 0 ? "yes" : "no"} | Track B (operator) or Track C |`,
    );
  }
  out.push("");
  out.push(
    "`Have (coverage candidates)` is the same count as section 1 (licence state aside): a candidate whose licence is not CLEAR is not usable for train or test until the owner signs off.",
  );
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
  ).filter((row) => (row as { round?: string }).round !== "2");
  const coverage = JSON.parse(readFileSync(path.join(repo, "state/odd-coverage.json"), "utf8")) as Coverage;
  const sources = JSON.parse(
    readFileSync(path.join(repo, "docs/RSA-Documents/track-a-sources.json"), "utf8"),
  ) as { sources: SourceEntry[]; unfillable: UnfillableFamily[] };
  const licence = parseLicenceRegister(
    readFileSync(path.join(repo, "docs/RSA-Documents/LICENSE-REGISTER.md"), "utf8"),
  );
  const duplicates = JSON.parse(
    readFileSync(path.join(repo, "docs/RSA-Documents/track-a-duplicates.json"), "utf8"),
  ) as { duplicates: { sha256: string }[] };
  const report = buildReport(inventory, manifest, coverage, {
    sources: sources.sources,
    unfillable: sources.unfillable,
    licence,
    duplicates: duplicates.duplicates,
  });
  const target = path.join(repo, "docs/RSA-Documents/track-a-harvest-report.md");
  writeFileSync(target, report);
  console.log(`wrote ${path.relative(repo, target)} (${report.length} bytes)`);
}

// Run only when executed directly, so tests can import the pure helpers.
if (process.argv[1] && path.basename(process.argv[1]) === path.basename(__filename)) {
  main();
}
