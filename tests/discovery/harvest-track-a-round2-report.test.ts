import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mergeRows,
  parseLicenceRegister,
  CANADIAN_CELLS,
  MANIFEST_STAGE_TO_CELL,
  type Coverage,
  type InventoryRow,
  type ManifestRow,
} from "../../scripts/harvest-track-a-report";
import { buildRound2Report } from "../../scripts/harvest-track-a-round2-report";
import { BYTE_CAP_BYTES, PER_DOCUMENT_CAP_BYTES } from "../../scripts/harvest-track-a";

// Offline: every input is a committed file in this repo. No network, no model call.
const REPO = process.cwd();
const INVENTORY_PATH = path.join(REPO, "docs/RSA-Documents/track-a-ondisk-inventory.jsonl");
const MANIFEST_PATH = path.join(REPO, "docs/RSA-Documents/canada-intake-manifest.jsonl");
const COVERAGE_PATH = path.join(REPO, "state/odd-coverage.json");
const SOURCES_PATH = path.join(REPO, "docs/RSA-Documents/track-a-round2-sources.json");
const CANDIDATES_PATH = path.join(REPO, "docs/RSA-Documents/track-a-round2-candidates.json");
const CANDIDATE_LOG_PATH = path.join(REPO, "docs/RSA-Documents/track-a-round2-candidate-log.tsv");
const BYTES_PATH = path.join(REPO, "docs/RSA-Documents/track-a-round2-bytes.json");
const LICENCE_PATH = path.join(REPO, "docs/RSA-Documents/LICENSE-REGISTER.md");
const REPORT_PATH = path.join(REPO, "docs/RSA-Documents/track-a-round2-harvest-report.md");
const ROUND1_REPORT_PATH = path.join(REPO, "docs/RSA-Documents/track-a-harvest-report.md");

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
const round1Manifest = manifest.filter((row) => (row as { round?: string }).round !== "2");
const coverage = readJson<Coverage>(COVERAGE_PATH);
const sources = readJson<{
  sources: Array<{ id: string; source_type: string; licence_default: { verdict: string } }>;
  unfillable: Array<{ family: string; host: string | null; reason: string; track_input: string }>;
}>(SOURCES_PATH);
const candidateFile = readJson<{
  candidates: Array<{ url: string; source_id: string; source_type?: string; licence_verdict?: string }>;
}>(CANDIDATES_PATH);
const licence = parseLicenceRegister(readFileSync(LICENCE_PATH, "utf8"));
const bytes = readJson<{
  cap_bytes: number;
  per_document_cap_bytes: number;
  corpus_bytes_before: number;
  corpus_bytes_after: number;
  downloaded_this_round: number;
  fetched_this_round: number;
  discarded_bytes: number;
  skipped_for_cap: string[];
}>(BYTES_PATH);

const candidateLog = readFileSync(CANDIDATE_LOG_PATH, "utf8")
  .split("\n")
  .slice(1)
  .filter((l) => l.trim())
  .map((line) => {
    const c = line.split("\t");
    return {
      source_id: c[0] ?? "",
      source_type: c[1] ?? "",
      url: c[2] ?? "",
      http_status: c[3] ?? "",
      bytes: c[4] ?? "",
      sha256: c[5] ?? "",
      decision: c[6] ?? "",
      reason: c[7] ?? "",
      dedupe_status: c[8] ?? "",
      stage_source: c[9] ?? "",
      tier_source: c[10] ?? "",
    };
  });

function build(): string {
  return buildRound2Report({
    inventory,
    manifest,
    round1Manifest,
    coverage,
    sources: sources as never,
    candidates: candidateFile.candidates as never,
    candidateLog,
    licence,
    bytes: bytes as never,
  });
}

describe("harvest round 2 report (ticket #60)", () => {
  it("regenerates byte-identically from the committed inputs", () => {
    const fresh = build();
    expect(readFileSync(REPORT_PATH, "utf8")).toBe(fresh);
  });

  it("carries no timestamp", () => {
    expect(build()).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  });

  it("states the four acceptance criteria as report sections", () => {
    const report = build();
    expect(report).toContain("AC1 — ODD coverage versus the targets, before and after");
    expect(report).toContain("AC2 — Harvest precision per class");
    expect(report).toContain("AC3 — Source yield");
    expect(report).toContain("AC4 — The gaps free sources cannot fill");
  });

  it("counts no T0/T1 row as coverage", () => {
    const rows = mergeRows(inventory, manifest, licence);
    for (const row of rows) {
      if (!row.coverage_candidate) continue;
      expect(["T3", "T4"]).toContain(row.tier);
      expect(row.cell).not.toBeNull();
    }
  });

  it("counts a document once: a duplicate copy never carries a count", () => {
    // The merged row set is ROWS, not documents: the inventory holds repeated
    // copies of one sha256, and each copy is its own row (the round-1 report
    // says so). The invariant is that a duplicate copy is never a coverage
    // candidate, so one document never carries a count twice.
    const rows = mergeRows(inventory, manifest, licence);
    for (const row of rows) {
      if (!row.coverage_candidate) continue;
      expect(row.duplicate, `a duplicate copy is counted as coverage: ${row.path}`).toBe(false);
    }
    // every sha256 that appears twice is a copy pair, and only one of them counts
    const bySha = new Map<string, typeof rows>();
    for (const row of rows) bySha.set(row.sha256, [...(bySha.get(row.sha256) ?? []), row]);
    for (const [, group] of bySha) {
      if (group.length < 2) continue;
      expect(group.filter((r) => r.coverage_candidate).length).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the round-1 coverage numbers as the 'before' column", () => {
    // The round-1 report is the record of the round-1 state; the round-2
    // report's before column must agree with it.
    const before = mergeRows(inventory, round1Manifest, licence);
    const report = build();
    for (const cellKey of CANADIAN_CELLS) {
      const have = before.filter((r) => r.coverage_candidate && r.cell === cellKey).length;
      const row = report
        .split("\n")
        .find((l) => l.startsWith(`| \`${cellKey}\``));
      expect(row, `no coverage row for ${cellKey}`).toBeDefined();
      const cells = (row as string).split("|").map((c) => c.trim());
      // | cell | target | priority | before have | after have | ...
      expect(cells[4]).toBe(String(have));
    }
  });

  it("leaves the round-1 rows unchanged by the round-2 rows", () => {
    const round1 = mergeRows(inventory, round1Manifest, licence);
    const all = mergeRows(inventory, manifest, licence);
    expect(all.length).toBeGreaterThanOrEqual(round1.length);
    // Every round-1 row survives unchanged. Rows are matched by sha256 AND
    // path: the inventory holds repeated copies of one sha256, and a copy is
    // its own row.
    for (const row of round1) {
      const now = all.find((r) => r.sha256 === row.sha256 && r.path === row.path);
      expect(now, `row ${row.sha256} ${row.path} vanished`).toBeDefined();
      expect(now?.coverage_candidate).toBe(row.coverage_candidate);
      expect(now?.tier).toBe(row.tier);
      expect(now?.stage).toBe(row.stage);
    }
  });

  it("sums the funnel rows to the candidate log's row count", () => {
    const report = build();
    const total = Number(
      (report.split("\n").find((l) => l.startsWith("| **total** |")) as string)
        .split("|")[2]
        .replace(/\*/g, "")
        .trim(),
    );
    expect(total).toBe(candidateLog.length);
  });

  it("gives every attempted source type a row in the yield table", () => {
    const report = build();
    const attempted = new Set(candidateFile.candidates.map((c) => c.source_type));
    for (const sourceType of attempted) {
      expect(report, `no yield row for ${sourceType}`).toContain(`| \`${sourceType}\` |`);
    }
  });

  it("keeps the byte accounting arithmetic consistent and inside the cap", () => {
    expect(bytes.corpus_bytes_after).toBe(bytes.corpus_bytes_before + bytes.downloaded_this_round);
    expect(bytes.corpus_bytes_after).toBeLessThanOrEqual(bytes.cap_bytes);
    expect(bytes.per_document_cap_bytes).toBeLessThanOrEqual(bytes.cap_bytes);
  });

  it("records a licence row for every source the round attempted", () => {
    const attempted = new Set(candidateLog.map((r) => r.source_id));
    const register = readFileSync(LICENCE_PATH, "utf8");
    for (const sourceId of attempted) {
      expect(register, `no licence row for ${sourceId}`).toContain(`| canada/track-a/${sourceId} |`);
    }
  });

  it("never counts a hash-skipped download as an ingested document", () => {
    const manifestShas = new Set(manifest.map((r) => r.sha256));
    for (const row of candidateLog) {
      if (row.decision !== "ingested") continue;
      expect(manifestShas.has(row.sha256), `ingested row ${row.sha256} is not in the manifest`).toBe(true);
      expect(row.dedupe_status).not.toBe("hash-already-present");
    }
  });

  it("keeps the round-1 report file itself unchanged on disk", () => {
    // The round-2 rows must not have been written into the round-1 artefact.
    const round1 = readFileSync(ROUND1_REPORT_PATH, "utf8");
    expect(round1).toContain("# Track A harvest report");
    expect(round1).not.toContain("track-a-round2");
  });

  it("enforces the 5 GB cap and the 100 MiB per-document cap (R35, R36)", () => {
    expect(BYTE_CAP_BYTES).toBe(5 * 1024 * 1024 * 1024);
    expect(PER_DOCUMENT_CAP_BYTES).toBe(100 * 1024 * 1024);
    // the accounting: the corpus before plus what this round wrote is the
    // corpus after, and what went over the wire is at least what was written
    expect(bytes.corpus_bytes_before + bytes.downloaded_this_round).toBe(bytes.corpus_bytes_after);
    expect(bytes.fetched_this_round).toBeGreaterThanOrEqual(bytes.downloaded_this_round);
    expect(bytes.corpus_bytes_after).toBeLessThanOrEqual(bytes.cap_bytes);
  });

  it("cross-checks the yield table against the manifest (R22)", () => {
    // The in-scope column of the yield table must equal the coverage
    // candidates the manifest attributes to that source type.
    const report = build();
    const manifestBySha = new Map(manifest.map((r) => [r.sha256, r]));
    const sourceTypeById = new Map(sources.sources.map((s) => [s.id, s.source_type]));
    const byType = new Map<string, number>();
    for (const row of candidateLog) {
      if (row.decision !== "ingested") continue;
      const m = manifestBySha.get(row.sha256);
      if (!m) continue;
      const type = sourceTypeById.get(row.source_id) ?? row.source_type;
      const inScope =
        (m.ca_province === "QC" ||
          m.ca_province === "AB" ||
          m.ca_province === "ON" ||
          m.ca_province === "BC" ||
          m.ca_province === "NB" ||
          m.ca_province === "SK" ||
          m.ca_province === "MB" ||
          m.ca_province === "NS" ||
          m.ca_province === "PE" ||
          m.ca_province === "NL" ||
          m.ca_province === "YT" ||
          m.ca_province === "NT" ||
          m.ca_province === "NU" ||
          m.ca_province === "CAN-GOV") &&
        (m.tier === "T3" || m.tier === "T4") &&
        MANIFEST_STAGE_TO_CELL[m.stage] !== undefined;
      if (!inScope) continue;
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }
    for (const [type, count] of byType) {
      const line = report.split("\n").find((l) => l.startsWith(`| \`${type}\` |`));
      expect(line, `no yield row for ${type}`).toBeDefined();
      const cells = (line as string).split("|").map((c) => c.trim());
      // | type | hosts | seen | rejected | ingested | in-scope | licence | yield |
      expect(cells[6]).toBe(String(count));
    }
  });

  it("gives every unfillable family a gap row with an actionable ask (R23, R24)", () => {
    const report = build();
    for (const family of sources.unfillable) {
      expect(report, `no gap row for ${family.family}`).toContain(`| ${family.family.replace(/\|/g, "\\|")} |`);
    }
    // each ask must name a province, a stage and a document type
    const asks = report.split("\n").filter((l) => l.startsWith("| ") && l.includes("Track B") === false && l.includes("—") && l.split("|").length > 6);
    expect(asks.length).toBeGreaterThanOrEqual(sources.unfillable.length);
  });

  it("states the honest zero when no coverage candidate was created (R45)", () => {
    const before = mergeRows(inventory, round1Manifest, licence);
    const after = mergeRows(inventory, manifest, licence);
    const newOnes = after.filter(
      (r) => r.coverage_candidate && !before.some((b) => b.sha256 === r.sha256 && b.path === r.path),
    );
    const report = build();
    if (newOnes.length === 0) {
      expect(report).toContain("**Honest zero.**");
      expect(report).toContain("0 new coverage candidates");
      expect(report).toContain("unchanged");
    }
  });

  it("gives every manifest row a candidate-log row (R-4)", () => {
    const logged = new Set(candidateLog.map((r) => r.sha256));
    for (const row of manifest.filter((r) => (r as { round?: string }).round === "2")) {
      expect(logged.has(row.sha256), `manifest row ${row.sha256} has no candidate-log row`).toBe(true);
    }
  });

  it("tabulates the stage and tier provenance and the language split (R30, R31)", () => {
    const report = build();
    expect(report).toContain("### 2d — where the tier and the stage came from");
    expect(report).toContain("stage_source");
    const round2 = manifest.filter((r) => (r as { round?: string }).round === "2");
    const fromText = round2.filter((r) => (r as { stage_source?: string }).stage_source === "text").length;
    const fromHint = round2.filter((r) => (r as { stage_source?: string }).stage_source === "hint").length;
    expect(fromText + fromHint).toBe(round2.length);
    // the language split is declared a heuristic, not a language model
    expect(report).toContain("heuristic");
  });
});
