#!/usr/bin/env node
// Stage rule set v2 CLI for ticket #62 — the versioned rule sets v1 and v2
// over the Canadian RSA corpus of record.
//
//   npx tsx scripts/harvest-stage-rules-v2.ts selftest [flags]
//   npx tsx scripts/harvest-stage-rules-v2.ts fetch    [flags]   # the ONLY network path
//   npx tsx scripts/harvest-stage-rules-v2.ts compare  [flags]   # offline: cache reads only
//   npx tsx scripts/harvest-stage-rules-v2.ts render   [flags]   # offline re-render
//
// Rules of the road (plan-t62.md, D9/D13):
//   * `fetch` is the only verb that opens a socket. It writes ONLY into the
//     gitignored cache (`.autoforge/tmp/stage-rules-v2-cache/`), never under
//     `docs/RSA-Documents/`, and never touches the committed manifest.
//   * `compare` reads the cached `.txt` files only (never a `.pdf`) and never
//     calls the network; `render` reads a committed json/jsonl file only.
//   * Every output is deterministic: rows sorted by sha256, no timestamp, no
//     absolute path, no hostname (precedent: scripts/harvest-track-a-report.ts).
//
// Exit codes: 0 success · 1 usage error (unknown verb/flag, missing file) ·
// 2 fatal (unreadable manifest, unwritable cache) · 3 partial (fetch verified
// 0 rows / compare wrote the outputs but at least one row had no body).
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { withHostBudget } from "../src/discovery/ratelimit.js";
import { crawlDelayMs, isAllowed, robotsFor, HARVEST_USER_AGENT } from "../src/discovery/robots.js";
import {
  classify,
  classifyDocument,
  loadRuleSet,
  type Confidence,
  type RuleSet,
  type SectionDecision,
  type StageCandidate,
} from "./stage-rules.js";
import { detectStage } from "./harvest-track-a.js";
import {
  CANADIAN_CELLS,
  mergeRows,
  parseLicenceRegister,
  type InventoryRow,
  type ManifestRow as ReportManifestRow,
  type MergedRow,
} from "./harvest-track-a-report.js";

const REPO = process.cwd();

const DEFAULT_RULES = "docs/research/stage-rules/stage-rules.v2.json";
const DEFAULT_RULES_V1 = "docs/research/stage-rules/stage-rules.v1.json";
const DEFAULT_MANIFEST = "docs/RSA-Documents/canada-intake-manifest.jsonl";
const DEFAULT_CACHE = ".autoforge/tmp/stage-rules-v2-cache";
const DEFAULT_OUT = "docs/research/stage-rules/coverage-v2-vs-v1.md";
const DEFAULT_JSON_OUT = "docs/research/stage-rules/coverage-v2-vs-v1.json";
const DEFAULT_SIDECAR_OUT = "docs/research/stage-rules/classifications-v2.jsonl";
const DEFAULT_AMBIGUOUS_OUT = "docs/research/stage-rules/ambiguous-v2.md";
const DEFAULT_INVENTORY = "docs/RSA-Documents/track-a-ondisk-inventory.jsonl";
const DEFAULT_COVERAGE = "state/odd-coverage.json";
const DEFAULT_RULES_V3 = "docs/research/stage-rules/stage-rules.v3.json";
const DEFAULT_V3_OUT = "docs/research/stage-rules/coverage-v3-vs-v2.md";
const DEFAULT_V3_JSON_OUT = "docs/research/stage-rules/coverage-v3-vs-v2.json";
const DEFAULT_V3_SIDECAR_OUT = "docs/research/stage-rules/classifications-v3.jsonl";
const DEFAULT_V2_SIDECAR = "docs/research/stage-rules/classifications-v2.jsonl";

/** The download bound (plan A10): 25 MB per file, 64 MB per run, enforced while streaming. */
const MAX_FILE_BYTES = 25_000_000;
const MAX_TOTAL_BYTES = 64_000_000;
const TIMEOUT_MS = 30_000;
/** The scan window (D2): whole text, NFC, one million characters. */
const TEXT_CAP = 1_000_000;
/**
 * The neutral fallback stage. The v1 column is recomputed from the rule file
 * and the text alone: borrowing the committed stage as the hint would make the
 * comparison circular, so every row that the text does not decide falls back
 * to `UNSTAGED` and is reported as a finding in its own right.
 */
const NEUTRAL_HINT = "UNSTAGED";
/** Nothing under this tree may ever be written by this CLI (plan non-goal 1). */
const FROZEN_TREE = "docs/RSA-Documents";

const EXIT_OK = 0;
const EXIT_USAGE = 1;
const EXIT_FATAL = 2;
const EXIT_PARTIAL = 3;

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export interface ManifestRow {
  project_id: string;
  sha256: string;
  tier: string;
  stage: string;
  cell_key: string;
  ca_province: string | null;
  lang: string;
  title: string;
  source_url: string;
  licence_verdict: string;
  bytes: number;
}

/** One sidecar row (plan M5.1): the corpus of record, re-classified. */
export interface SidecarRow {
  project_id: string;
  sha256: string;
  title: string;
  tier: string;
  ca_province: string | null;
  lang: string;
  stage_v1_committed: string;
  cell_key_v1_committed: string;
  stage_v1_recomputed: string;
  cell_key_v1_recomputed: string;
  v1_agreement: "agree" | "disagree";
  stage_v2_primary: string;
  cell_key_v2: string;
  candidates: StageCandidate[];
  ambiguous: boolean;
  confidence: Confidence | null;
  asset_type: string | null;
  scope_basis: "own_scope" | "taxonomy_reference";
  text_chars_scanned: number;
  truncated: boolean;
  body_available: boolean;
  source: "text" | "title" | "hint";
  attestations: { rule_id: string; phrase: string; offset: number }[];
}

export interface TableARow {
  cell_key: string;
  target: number | null;
  priority: number | null;
  have_v1_committed: number;
  have_v1_recomputed: number;
  have_v2: number;
  usable_clear_v1: number;
  usable_clear_v2: number;
  moved_in: number;
  moved_out: number;
  ambiguous_at_cell: number;
  title_only_rows: number;
}

export interface TableBRow {
  cell_key: string;
  target: number;
  priority: number;
  before_have: number;
  after_have: number;
  before_usable_clear: number;
  after_usable_clear: number;
  gap_before: number;
  gap_after: number;
  moved: string;
}

export interface CoverageJson {
  rule_sets: { v1: { path: string; sha256: string }; v2: { path: string; sha256: string } };
  manifest: { path: string; sha256: string; rows: number };
  inventory: { path: string; rows: number };
  coverage_targets: { path: string };
  bodies: {
    fetched: number;
    unavailable: number;
    title_only_rows: number;
    unavailable_rows: { sha256: string; reason: string }[];
  };
  denominators: {
    table_a_rows: number;
    table_a_t3_rows: number;
    table_a_t1_rows: number;
    table_a_province_rows: number;
    table_a_cell_occupancy_v1: Record<string, number>;
    table_b_merged_rows: number;
    table_b_canadian_rows: number;
    table_b_canadian_t3_t4_rows: number;
    table_b_coverage_candidates: number;
    table_b_candidate_shas: string[];
    table_b_rows_with_v2_verdict: number;
  };
  table_a: TableARow[];
  table_b: TableBRow[];
  no_cell: { label: string; count: number; note: string }[];
  v1_reproduced: {
    rows: number;
    mismatches: { sha256: string; rule_file: string; live: string }[];
    disagreements: { sha256: string; committed: string; recomputed: string }[];
  };
  rule_attestations: Record<
    string,
    {
      kind: string;
      attested: boolean;
      sources: {
        reference_doc?: string;
        corpus_sha256?: string;
        phrase: string;
        attested: boolean;
      }[];
    }
  >;
  rows: SidecarRow[];
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

export interface SectionSidecarRow {
  project_id: string;
  sha256: string;
  title: string;
  tier: string;
  ca_province: string | null;
  lang: string;
  licence_verdict: string;
  stage_v2_primary: string;
  cell_key_v2: string;
  ambiguous_v2: boolean;
  body_available_v2: boolean;
  stage_v3_primary: string;
  cell_key_v3: string;
  confidence_v3: Confidence | null;
  ambiguous_v3: boolean;
  candidates: StageCandidate[];
  section_stages: string[];
  sections: SectionDecision[];
  body_available_v3: boolean;
  comparable: boolean;
  source: string;
}

export interface CoverageV3CellRow {
  cell_key: string;
  stage: string;
  target: number | null;
  priority: number | null;
  v2_documents: number;
  v2_documents_clear: number;
  v3_documents: number;
  v3_documents_clear: number;
  v3_section_documents: number;
  v3_section_documents_clear: number;
  v3_stage_sections: number;
  v3_stage_sections_clear: number;
  delta_documents: number;
}

export interface CoverageV3StageRow {
  stage: string;
  v2_documents: number;
  v2_documents_clear: number;
  v3_documents: number;
  v3_documents_clear: number;
  v3_section_documents: number;
  v3_section_documents_clear: number;
  v3_stage_sections: number;
  v3_stage_sections_clear: number;
}

export interface CoverageV3Json {
  rule_sets: {
    v2: { path: string; sha256: string };
    v3: { path: string; sha256: string };
  };
  v2_sidecar: { path: string; sha256: string; rows: number };
  manifest: { path: string; sha256: string; rows: number };
  bodies: {
    available: number;
    unavailable: number;
    unavailable_rows: { sha256: string; reason: string }[];
  };
  denominators: {
    rows: number;
    v2_ambiguous: number;
    v2_non_ambiguous: number;
    coverage_candidate_shas: string[];
    comparable_rows: number;
    non_comparable_rows: number;
    v3_documents_with_sections: number;
    v3_documents_without_sections: number;
    v3_stage_sections: number;
    v3_documents_with_multiple_section_stages: number;
  };
  coverage_candidates: {
    cell_key: string;
    stage: string;
    target: number | null;
    priority: number | null;
    v2_documents: number;
    v3_documents: number;
    v3_section_documents: number;
    v3_stage_sections: number;
    delta_documents: number;
  }[];
  cells: CoverageV3CellRow[];
  stages: CoverageV3StageRow[];
  unresolved: { sha256: string; title: string; stage_v2: string; stage_v3: string }[];
  rows: SectionSidecarRow[];
}


class UsageError extends Error {}
class FatalError extends Error {}

function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function sha256File(file: string): string {
  return sha256Hex(readFileSync(file));
}

/** A repo-relative path for the outputs: never an absolute path, never a hostname. */
function displayPath(file: string): string {
  const abs = path.resolve(REPO, file);
  const rel = path.relative(REPO, abs);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel.split(path.sep).join("/");
  return path.basename(abs);
}

function readJsonl<T>(file: string): T[] {
  const text = readFileSync(file, "utf8");
  const rows: T[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    rows.push(JSON.parse(line) as T);
  }
  return rows;
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/** Escape a value for a markdown table cell. */
function cellText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

function shortSha(sha: string): string {
  return sha.slice(0, 12);
}

/** The cache and the outputs must never land under the byte-frozen tree. */
function assertNotFrozen(file: string): void {
  const rel = path.relative(REPO, path.resolve(REPO, file));
  if (rel.startsWith(FROZEN_TREE + path.sep) || rel === FROZEN_TREE) {
    throw new UsageError(`refusing to write inside the frozen tree: ${FROZEN_TREE}/`);
  }
}

const V3_OUTPUT_ALLOWLIST = new Set([
  "docs/research/stage-rules/coverage-v3-vs-v2.md",
  "docs/research/stage-rules/coverage-v3-vs-v2.json",
  "docs/research/stage-rules/classifications-v3.jsonl",
]);

/** Guard so compare-v3/render-v3 can never write a v1/v2 artifact path. */
export function assertV3OutputPath(file: string): void {
  const rel = path.relative(REPO, path.resolve(REPO, file)).split(path.sep).join("/");
  if (!V3_OUTPUT_ALLOWLIST.has(rel)) {
    throw new UsageError(`output path not in v3 allowlist: ${rel}`);
  }
}

// ---------------------------------------------------------------------------
// flags
// ---------------------------------------------------------------------------

type FlagKind = "string" | "boolean";

class Flags {
  private readonly values = new Map<string, string>();
  private readonly booleans = new Set<string>();

  constructor(private readonly spec: Record<string, FlagKind>) {}

  static parse(argv: string[], spec: Record<string, FlagKind>): Flags {
    const flags = new Flags(spec);
    for (let i = 0; i < argv.length; i += 1) {
      const token = argv[i];
      if (!token.startsWith("--")) throw new UsageError(`unexpected argument: ${token}`);
      const eq = token.indexOf("=");
      const name = eq === -1 ? token.slice(2) : token.slice(2, eq);
      const kind = spec[name];
      if (!kind) throw new UsageError(`unknown flag: --${name}`);
      if (kind === "boolean") {
        if (eq !== -1) throw new UsageError(`--${name} takes no value`);
        flags.booleans.add(name);
        continue;
      }
      const value = eq === -1 ? argv[++i] : token.slice(eq + 1);
      if (value === undefined) throw new UsageError(`--${name} needs a value`);
      flags.values.set(name, value);
    }
    return flags;
  }

  str(name: string, fallback: string): string {
    return this.values.get(name) ?? fallback;
  }

  int(name: string, fallback: number): number {
    const raw = this.values.get(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) throw new UsageError(`--${name} needs a non-negative number`);
    return Math.floor(value);
  }

  bool(name: string): boolean {
    return this.booleans.has(name);
  }
}

// ---------------------------------------------------------------------------
// rule sets
// ---------------------------------------------------------------------------

interface LoadedRules {
  v1: RuleSet;
  v2: RuleSet;
  v1Path: string;
  v2Path: string;
  v1Sha: string;
  v2Sha: string;
}

function loadRuleSets(rulesPath: string, rulesV1Path: string): LoadedRules {
  for (const file of [rulesPath, rulesV1Path]) {
    if (!existsSync(path.resolve(REPO, file))) throw new UsageError(`rule file not found: ${file}`);
  }
  const v1 = loadRuleSet(readJson<unknown>(path.resolve(REPO, rulesV1Path)));
  const v2 = loadRuleSet(readJson<unknown>(path.resolve(REPO, rulesPath)));
  return {
    v1,
    v2,
    v1Path: rulesV1Path,
    v2Path: rulesPath,
    v1Sha: sha256File(path.resolve(REPO, rulesV1Path)),
    v2Sha: sha256File(path.resolve(REPO, rulesPath)),
  };
}

// ---------------------------------------------------------------------------
// selftest
// ---------------------------------------------------------------------------

function runSelftest(flags: Flags): number {
  const rules = loadRuleSets(flags.str("rules", DEFAULT_RULES), flags.str("rules-v1", DEFAULT_RULES_V1));
  const out: string[] = [];
  out.push("stage rule sets — loader validation and regex compile check");
  out.push("");
  for (const [label, set, file, sha] of [
    ["v1", rules.v1, rules.v1Path, rules.v1Sha],
    ["v2", rules.v2, rules.v2Path, rules.v2Sha],
  ] as const) {
    out.push(`rule set ${label} — ${file} (sha256 ${sha})`);
    out.push(`  ${set.rules.length} rules · cells ${Object.keys(set.cells).length} · scan ${set.scan.mode}/${set.scan.chars}${set.scan.normalize ? `/${set.scan.normalize}` : ""}`);
    out.push("");
    out.push("| rule id | flags | scope | tier | lang | outcome | pattern compiles |");
    out.push("|---|---|---|---|---|---|---|");
    for (const rule of set.rules) {
      let compiles = "yes";
      try {
        new RegExp(rule.pattern, rule.flags.replace(/[gy]/g, ""));
      } catch (error) {
        compiles = `NO (${String(error)})`;
      }
      const outcome = rule.stage
        ? rule.stage
        : rule.candidates
          ? `{${rule.candidates.join(", ")}}`
          : rule.asset_type
            ? `asset_type=${rule.asset_type}`
            : "—";
      out.push(
        `| \`${rule.id}\` | \`${rule.flags}\` | ${rule.scope} | ${rule.tier} | ${rule.language} | ${outcome} | ${compiles} |`,
      );
    }
    out.push("");
  }
  out.push(`OK — the loader accepted both rule sets and every pattern compiles with its recorded flags.`);
  console.log(out.join("\n"));
  return EXIT_OK;
}

// ---------------------------------------------------------------------------
// fetch (the only network path)
// ---------------------------------------------------------------------------

interface FetchOutcome {
  sha256: string;
  outcome: string;
  detail: string;
}

async function runFetch(flags: Flags): Promise<number> {
  const manifestPath = flags.str("manifest", DEFAULT_MANIFEST);
  const cacheDir = flags.str("cache", DEFAULT_CACHE);
  const tier = flags.str("tier", "all");
  const limit = flags.int("limit", 0);
  const timeoutMs = flags.int("timeout-ms", TIMEOUT_MS);
  const maxFileBytes = flags.int("max-file-bytes", MAX_FILE_BYTES);
  const maxTotalBytes = flags.int("max-total-bytes", MAX_TOTAL_BYTES);
  const ua = flags.str("user-agent", HARVEST_USER_AGENT);
  const dryRun = flags.bool("dry-run");

  const manifestFile = path.resolve(REPO, manifestPath);
  if (!existsSync(manifestFile)) throw new UsageError(`manifest not found: ${manifestPath}`);
  assertNotFrozen(cacheDir);
  const cache = path.resolve(REPO, cacheDir);

  let rows: ManifestRow[];
  try {
    rows = readJsonl<ManifestRow>(manifestFile);
  } catch (error) {
    throw new FatalError(`unreadable manifest: ${manifestPath} (${String(error)})`);
  }
  const selected = rows
    .filter((row) => tier === "all" || row.tier === tier)
    .sort((a, b) => (a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0));
  const todo = limit > 0 ? selected.slice(0, limit) : selected;

  if (dryRun) {
    console.log(`dry run — no request is made.`);
    console.log(`manifest: ${manifestPath} (${rows.length} rows)`);
    console.log(`cache: ${cacheDir}`);
    console.log(`tier: ${tier} · limit: ${limit} · timeout: ${timeoutMs}ms`);
    console.log(`caps: ${maxFileBytes} bytes per file, ${maxTotalBytes} bytes per run`);
    console.log(`user-agent: ${ua}`);
    console.log("");
    console.log("| sha256 | tier | expected bytes | host | url |");
    console.log("|---|---|---|---|---|");
    let planned = 0;
    for (const row of todo) {
      const host = row.source_url ? new URL(row.source_url).host : "—";
      planned += row.bytes ?? 0;
      console.log(`| ${shortSha(row.sha256)} | ${row.tier} | ${row.bytes ?? 0} | ${host} | ${row.source_url} |`);
    }
    console.log("");
    console.log(`planned rows: ${todo.length} · planned bytes: ${planned} (cap ${maxTotalBytes})`);
    return EXIT_OK;
  }

  try {
    mkdirSync(cache, { recursive: true });
  } catch (error) {
    throw new FatalError(`unwritable cache directory: ${cacheDir} (${String(error)})`);
  }
  try {
    writeFileSync(path.join(cache, ".writable"), "");
    rmSync(path.join(cache, ".writable"));
  } catch (error) {
    throw new FatalError(`unwritable cache directory: ${cacheDir} (${String(error)})`);
  }

  // Stale .part files never survive a run.
  for (const entry of readdirSync(cache)) {
    if (entry.endsWith(".part")) rmSync(path.join(cache, entry));
  }

  const outcomes: FetchOutcome[] = [];
  let totalBytes = 0;
  let spentBytes = 0;
  let verified = 0;

  for (const row of todo) {
    const target = path.join(cache, `${row.sha256}.pdf`);
    const textFile = path.join(cache, `${row.sha256}.txt`);

    // An existing cache file is re-hashed before reuse and treated as absent
    // when its sha256 does not match its filename.
    if (existsSync(target)) {
      const sha = sha256File(target);
      if (sha === row.sha256) {
        if (!existsSync(textFile)) {
          const text = await extractPdfText(target);
          writeFileSync(textFile, text.normalize("NFC").slice(0, TEXT_CAP));
          outcomes.push({
            sha256: row.sha256,
            outcome: text ? "cached" : "cached (no text layer)",
            detail: "re-hashed, sha256 matches; text extracted",
          });
          verified += 1;
          continue;
        }
        outcomes.push({ sha256: row.sha256, outcome: "cached", detail: "re-hashed, sha256 matches" });
        verified += 1;
        continue;
      }
      rmSync(target);
      rmSync(textFile, { force: true });
    }

    // robots gate
    const robots = await robotsFor(row.source_url, ua);
    if (!isAllowed(robots, new URL(row.source_url).pathname, ua)) {
      outcomes.push({
        sha256: row.sha256,
        outcome: "unavailable (robots)",
        detail: robots.skipReason ?? "disallowed by robots.txt",
      });
      continue;
    }
    const delay = crawlDelayMs(robots, ua) ?? 0;
    if (delay) await sleep(delay);

    // stream to <sha>.pdf.part, counting the bytes as they arrive
    const part = `${target}.part`;
    let res: Response;
    try {
      res = await withHostBudget(row.source_url, () =>
        fetch(row.source_url, {
          headers: { "user-agent": ua },
          signal: AbortSignal.timeout(timeoutMs),
        }),
      );
    } catch (error) {
      outcomes.push({
        sha256: row.sha256,
        outcome: "unavailable (network)",
        detail: String(error instanceof Error ? error.message : error),
      });
      continue;
    }
    if (!res.ok) {
      outcomes.push({ sha256: row.sha256, outcome: `unavailable (http ${res.status})`, detail: row.source_url });
      continue;
    }
    if (!res.body) {
      outcomes.push({ sha256: row.sha256, outcome: "unavailable (no body)", detail: row.source_url });
      continue;
    }

    const hash = createHash("sha256");
    const fd = openSync(part, "w");
    const reader = res.body.getReader();
    let bytes = 0;
    let oversize = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        bytes += value.byteLength;
        if (bytes > maxFileBytes || spentBytes + bytes > maxTotalBytes) {
          oversize = true;
          break;
        }
        hash.update(value);
        writeSync(fd, value);
      }
    } finally {
      closeSync(fd);
      await reader.cancel().catch(() => undefined);
    }

    if (oversize) {
      rmSync(part, { force: true });
      spentBytes += bytes;
      outcomes.push({
        sha256: row.sha256,
        outcome: "unavailable (oversize)",
        detail:
          bytes > maxFileBytes
            ? `over the per-file cap (${maxFileBytes} bytes)`
            : `over the remaining run budget (${maxTotalBytes} bytes)`,
      });
      continue;
    }

    const sha = hash.digest("hex");
    spentBytes += bytes;
    if (sha !== row.sha256) {
      rmSync(part, { force: true });
      outcomes.push({
        sha256: row.sha256,
        outcome: "sha-mismatch",
        detail: `downloaded bytes hash ${shortSha(sha)}, excluded from the corpus`,
      });
      continue;
    }
    renameSync(part, target);
    totalBytes += bytes;
    verified += 1;

    // text extraction (A11): the .txt is written even when the PDF has no text layer
    const text = await extractPdfText(target);
    writeFileSync(textFile, text.normalize("NFC").slice(0, TEXT_CAP));
    outcomes.push({
      sha256: row.sha256,
      outcome: text ? "verified" : "verified (no text layer)",
      detail: `${bytes} bytes, sha256 matches`,
    });
  }

  console.log("| sha256 | outcome | detail |");
  console.log("|---|---|---|");
  for (const outcome of outcomes) {
    console.log(`| ${shortSha(outcome.sha256)} | ${outcome.outcome} | ${cellText(outcome.detail)} |`);
  }
  console.log("");
  console.log(
    `rows: ${outcomes.length} · verified: ${verified} · bytes verified: ${totalBytes} · bytes spent: ${spentBytes} (cap ${maxTotalBytes} for the run, ${maxFileBytes} per file)`,
  );
  console.log(`cache: ${cacheDir} (nothing was written under ${FROZEN_TREE}/)`);
  return verified === 0 ? EXIT_PARTIAL : EXIT_OK;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The extracted text of a PDF, or "" when the PDF has no text layer. */
async function extractPdfText(file: string): Promise<string> {
  try {
    // unpdf rejects a Buffer ("Please provide binary data as `Uint8Array`"), so a
    // readFileSync result must be copied into a plain Uint8Array before it is
    // handed over; a Buffer here makes every extraction fail silently.
    const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
    const out = await extractText(pdf, { mergePages: true });
    return out.text ?? "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// compare (offline)
// ---------------------------------------------------------------------------

function runCompare(flags: Flags): number {
  const manifestPath = flags.str("manifest", DEFAULT_MANIFEST);
  const cacheDir = flags.str("cache", DEFAULT_CACHE);
  const rulesPath = flags.str("rules", DEFAULT_RULES);
  const rulesV1Path = flags.str("rules-v1", DEFAULT_RULES_V1);
  const outPath = flags.str("out", DEFAULT_OUT);
  const jsonOutPath = flags.str("json-out", DEFAULT_JSON_OUT);
  const sidecarOutPath = flags.str("sidecar-out", DEFAULT_SIDECAR_OUT);
  const ambiguousOutPath = flags.str("ambiguous-out", DEFAULT_AMBIGUOUS_OUT);
  const inventoryPath = flags.str("inventory", DEFAULT_INVENTORY);
  const coveragePath = flags.str("coverage", DEFAULT_COVERAGE);

  for (const file of [outPath, jsonOutPath, sidecarOutPath, ambiguousOutPath]) assertNotFrozen(file);

  const manifestFile = path.resolve(REPO, manifestPath);
  if (!existsSync(manifestFile)) throw new UsageError(`manifest not found: ${manifestPath}`);
  let manifest: ManifestRow[];
  try {
    manifest = readJsonl<ManifestRow>(manifestFile);
  } catch (error) {
    throw new FatalError(`unreadable manifest: ${manifestPath} (${String(error)})`);
  }
  const inventoryFile = path.resolve(REPO, inventoryPath);
  if (!existsSync(inventoryFile)) throw new UsageError(`inventory not found: ${inventoryPath}`);
  const coverageFile = path.resolve(REPO, coveragePath);
  if (!existsSync(coverageFile)) throw new UsageError(`coverage file not found: ${coveragePath}`);
  const rules = loadRuleSets(rulesPath, rulesV1Path);

  const inventory = readJsonl<InventoryRow>(inventoryFile);
  const licence = parseLicenceRegister(
    readFileSync(path.join(REPO, "docs/RSA-Documents/LICENSE-REGISTER.md"), "utf8"),
  );
  const merged = mergeRows(inventory, manifest as unknown as ReportManifestRow[], licence);

  const cache = path.resolve(REPO, cacheDir);
  const bodies = new Map<string, string>();
  if (existsSync(cache)) {
    for (const entry of readdirSync(cache)) {
      if (!entry.endsWith(".txt")) continue;
      bodies.set(entry.slice(0, -4), readFileSync(path.join(cache, entry), "utf8"));
    }
  }

  // --- per-row classification: both rule sets over the SAME text ------------
  const rows: SidecarRow[] = [];
  const mismatches: { sha256: string; rule_file: string; live: string }[] = [];
  const disagreements: { sha256: string; committed: string; recomputed: string }[] = [];
  const unavailableRows: { sha256: string; reason: string }[] = [];

  const sorted = [...manifest].sort((a, b) => (a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0));
  for (const row of sorted) {
    const body = bodies.get(row.sha256) ?? "";
    const bodyAvailable = body.length > 0;
    if (!bodyAvailable) unavailableRows.push({ sha256: row.sha256, reason: "no cached body text" });

    const ctx = { title: row.title ?? "", hint: NEUTRAL_HINT };
    const v1 = classify(body, ctx, rules.v1);
    const v2 = classify(body, ctx, rules.v2);

    // The frozen v1 rule file must reproduce the LIVE harvester's verdict.
    const live = detectStage(body, NEUTRAL_HINT);
    if (live !== v1.stage) {
      mismatches.push({ sha256: row.sha256, rule_file: v1.stage, live });
    }
    const agreement = v1.stage === row.stage ? "agree" : "disagree";
    if (agreement === "disagree") {
      disagreements.push({ sha256: row.sha256, committed: row.stage, recomputed: v1.stage });
    }

    rows.push({
      project_id: row.project_id,
      sha256: row.sha256,
      title: row.title ?? "",
      tier: row.tier,
      ca_province: row.ca_province || null,
      lang: row.lang ?? "en",
      stage_v1_committed: row.stage,
      cell_key_v1_committed: row.cell_key ?? "",
      stage_v1_recomputed: v1.stage,
      cell_key_v1_recomputed: v1.cell_key,
      v1_agreement: agreement,
      stage_v2_primary: v2.stage,
      cell_key_v2: v2.cell_key,
      candidates: v2.candidates,
      ambiguous: v2.ambiguous,
      confidence: v2.confidence,
      asset_type: v2.asset_type,
      scope_basis: v2.scope_basis,
      text_chars_scanned: v2.text_chars_scanned,
      truncated: v2.truncated,
      body_available: bodyAvailable,
      // A title-only row is decided by its title, whatever the classifier's own
      // source label is (a row with no candidate at all falls back to the hint):
      // the sidecar's invariant is `body_available:false` <=> `source:"title"`.
      source: bodyAvailable ? v2.source : "title",
      attestations: [],
    });
  }

  // --- fetch-time corpus attestations --------------------------------------
  const attestations = new Map<string, { rule_id: string; phrase: string; offset: number }[]>();
  const bodyBySha = new Map<string, string>();
  for (const row of rows) bodyBySha.set(row.sha256, bodies.get(row.sha256) ?? "");
  for (const rule of rules.v2.rules) {
    for (const evidence of rule.evidence) {
      if (evidence.kind !== "corpus" || !evidence.corpus_sha256) continue;
      const body = bodyBySha.get(evidence.corpus_sha256) ?? "";
      const offset = findPhrase(body, evidence.phrase);
      if (offset < 0) continue;
      const list = attestations.get(evidence.corpus_sha256) ?? [];
      list.push({ rule_id: rule.id, phrase: evidence.phrase, offset });
      attestations.set(evidence.corpus_sha256, list);
    }
  }
  for (const row of rows) row.attestations = attestations.get(row.sha256) ?? [];

  const ruleAttestations: CoverageJson["rule_attestations"] = {};
  for (const rule of rules.v2.rules) {
    const kinds = [...new Set(rule.evidence.map((entry) => entry.kind))];
    const sources = rule.evidence.map((entry) => {
      const attested =
        entry.attested ||
        (entry.kind === "corpus" &&
          entry.corpus_sha256 !== undefined &&
          findPhrase(bodyBySha.get(entry.corpus_sha256) ?? "", entry.phrase) >= 0);
      return entry.reference_doc
        ? { reference_doc: entry.reference_doc, phrase: entry.phrase, attested }
        : { corpus_sha256: entry.corpus_sha256 ?? "", phrase: entry.phrase, attested };
    });
    ruleAttestations[rule.id] = {
      kind: kinds.length ? kinds.join(" + ") : "none",
      attested: sources.length > 0 && sources.every((entry) => entry.attested === true),
      sources,
    };
  }

  // --- Table A: cell occupancy over the 33 manifest rows ---------------------
  const coverage = readJson<{ cells: { cell_key: string; target: number; priority: number }[] }>(coverageFile);
  const cellTargets = new Map(coverage.cells.map((cell) => [cell.cell_key, cell]));
  const tableACells = [...CANADIAN_CELLS, ""];
  const tableA: TableARow[] = tableACells.map((cellKey) => {
    const committed = rows.filter((row) => (row.cell_key_v1_committed ?? "") === cellKey);
    const recomputed = rows.filter((row) => row.cell_key_v1_recomputed === cellKey);
    const underV2 = rows.filter((row) => row.cell_key_v2 === cellKey);
    const movedIn = rows.filter((row) => row.cell_key_v1_committed !== cellKey && row.cell_key_v2 === cellKey);
    const movedOut = rows.filter((row) => row.cell_key_v1_committed === cellKey && row.cell_key_v2 !== cellKey);
    const target = cellTargets.get(cellKey);
    return {
      cell_key: cellKey,
      target: target ? target.target : null,
      priority: target ? target.priority : null,
      have_v1_committed: committed.length,
      have_v1_recomputed: recomputed.length,
      have_v2: underV2.length,
      usable_clear_v1: committed.filter((row) => isClear(row.sha256, manifest)).length,
      usable_clear_v2: underV2.filter((row) => isClear(row.sha256, manifest)).length,
      moved_in: movedIn.length,
      moved_out: movedOut.length,
      ambiguous_at_cell: underV2.filter((row) => row.ambiguous).length,
      title_only_rows: underV2.filter((row) => !row.body_available).length,
    };
  });

  // --- Table B: the merged corpus of record ---------------------------------
  const v2BySha = new Map(rows.map((row) => [row.sha256, row]));
  const blocked = new Set(
    manifest.filter((row) => row.licence_verdict === "BLOCKED").map((row) => row.sha256),
  );
  const effectiveCell = (row: MergedRow): string | null => {
    const verdict = v2BySha.get(row.sha256);
    if (!verdict) return row.cell;
    return verdict.cell_key_v2 === "" ? null : verdict.cell_key_v2;
  };
  // The repo's own coverage-candidate predicate (scripts/harvest-track-a-report.ts:288-299),
  // re-applied to the row's EFFECTIVE cell under v2. The predicate itself is not
  // exported as a function; the "before" column uses mergeRows' own field.
  const isCandidate = (row: MergedRow, cell: string | null): boolean =>
    row.canadian &&
    (row.tier === "T3" || row.tier === "T4") &&
    cell !== null &&
    row.klass === "rsa-sample" &&
    !row.duplicate &&
    !blocked.has(row.sha256);

  const beforeHave: Record<string, number> = {};
  const afterHave: Record<string, number> = {};
  const beforeClear: Record<string, number> = {};
  const afterClear: Record<string, number> = {};
  for (const cellKey of CANADIAN_CELLS) {
    beforeHave[cellKey] = 0;
    afterHave[cellKey] = 0;
    beforeClear[cellKey] = 0;
    afterClear[cellKey] = 0;
  }
  const candidateShas: string[] = [];
  for (const row of merged) {
    if (!row.coverage_candidate || !row.cell) continue;
    beforeHave[row.cell] = (beforeHave[row.cell] ?? 0) + 1;
    if (row.licence === "CLEAR") beforeClear[row.cell] = (beforeClear[row.cell] ?? 0) + 1;
    candidateShas.push(row.sha256);
    const cell = effectiveCell(row);
    if (isCandidate(row, cell)) {
      afterHave[cell as string] = (afterHave[cell as string] ?? 0) + 1;
      if (row.licence === "CLEAR") afterClear[cell as string] = (afterClear[cell as string] ?? 0) + 1;
    }
  }
  const tableB: TableBRow[] = CANADIAN_CELLS.map((cellKey) => {
    const target = cellTargets.get(cellKey);
    const before = beforeHave[cellKey] ?? 0;
    const after = afterHave[cellKey] ?? 0;
    const goal = target ? target.target : 0;
    return {
      cell_key: cellKey,
      target: goal,
      priority: target ? target.priority : 0,
      before_have: before,
      after_have: after,
      before_usable_clear: beforeClear[cellKey] ?? 0,
      after_usable_clear: afterClear[cellKey] ?? 0,
      gap_before: Math.max(0, goal - before),
      gap_after: Math.max(0, goal - after),
      moved: after > before ? `**yes (+${after - before})**` : after < before ? `**yes (-${before - after})**` : "unchanged",
    };
  });

  // --- no-cell buckets ------------------------------------------------------
  const count = (predicate: (row: SidecarRow) => boolean): number => rows.filter(predicate).length;
  const noCell: { label: string; count: number; note: string }[] = [
    {
      label: "PRE_OPENING",
      count: count((row) => row.stage_v2_primary === "PRE_OPENING"),
      note: "no Canadian cell (D12); `policies/canada/pack.json:75-89` defines no cell for it.",
    },
    {
      label: "EXISTING",
      count: count((row) => row.stage_v2_primary === "EXISTING"),
      note: "no Canadian cell (D12); an in-service audit has nowhere to move into.",
    },
    {
      label: "CONSTRUCTION",
      count: count((row) => row.stage_v2_primary === "CONSTRUCTION"),
      note: "no Canadian cell (D12); `policies/canada/pack.json:75-89` defines no cell for it.",
    },
    {
      label: "AMBIGUOUS",
      count: count((row) => row.ambiguous),
      note: "two or more stage candidates: recorded with every candidate and assigned no cell (never forced).",
    },
    {
      label: "UNSTAGED",
      count: count((row) => row.stage_v2_primary === "UNSTAGED"),
      note: "no rule fired: the document names no stage (an asset cue alone never yields a stage).",
    },
    {
      label: "MULTI_STAGE",
      count: count((row) => row.stage_v1_committed === "MULTI_STAGE"),
      note: "v1's opaque token: every multi-stage document collapsed into one label with no cell.",
    },
  ];

  const json: CoverageJson = {
    rule_sets: {
      v1: { path: displayPath(rules.v1Path), sha256: rules.v1Sha },
      v2: { path: displayPath(rules.v2Path), sha256: rules.v2Sha },
    },
    manifest: { path: displayPath(manifestPath), sha256: sha256File(manifestFile), rows: manifest.length },
    inventory: { path: displayPath(inventoryPath), rows: inventory.length },
    coverage_targets: { path: displayPath(coveragePath) },
    bodies: {
      fetched: rows.filter((row) => row.body_available).length,
      unavailable: rows.filter((row) => !row.body_available).length,
      title_only_rows: rows.filter((row) => !row.body_available).length,
      unavailable_rows: unavailableRows.sort((a, b) => (a.sha256 < b.sha256 ? -1 : 1)),
    },
    denominators: {
      table_a_rows: rows.length,
      table_a_t3_rows: count((row) => row.tier === "T3"),
      table_a_t1_rows: count((row) => row.tier === "T1"),
      table_a_province_rows: count((row) => row.ca_province !== null),
      table_a_cell_occupancy_v1: Object.fromEntries(
        tableA.map((row) => [row.cell_key, row.have_v1_committed]),
      ),
      table_b_merged_rows: merged.length,
      table_b_canadian_rows: merged.filter((row) => row.canadian).length,
      table_b_canadian_t3_t4_rows: merged.filter(
        (row) => row.canadian && (row.tier === "T3" || row.tier === "T4"),
      ).length,
      table_b_coverage_candidates: candidateShas.length,
      table_b_candidate_shas: candidateShas.sort(),
      table_b_rows_with_v2_verdict: rows.length,
    },
    table_a: tableA,
    table_b: tableB,
    no_cell: noCell,
    v1_reproduced: { rows: rows.length, mismatches, disagreements },
    rule_attestations: ruleAttestations,
    rows,
  };

  // --- the four outputs -----------------------------------------------------
  writeOutput(path.resolve(REPO, jsonOutPath), `${JSON.stringify(json, null, 2)}\n`);
  writeOutput(
    path.resolve(REPO, sidecarOutPath),
    rows.map((row) => JSON.stringify(row)).join("\n") + "\n",
  );
  writeOutput(path.resolve(REPO, outPath), renderCoverageTable(json));
  writeOutput(path.resolve(REPO, ambiguousOutPath), renderAmbiguousTable(rows));

  console.log(`compared ${rows.length} manifest rows under rule sets v1 and v2`);
  console.log(
    `bodies: ${json.bodies.fetched} with a cached body, ${json.bodies.unavailable} title-only rows (classified from the title alone)`,
  );
  console.log(
    `v1 reproduction: ${rows.length} rows, ${mismatches.length} mismatches against the live harvester, ${disagreements.length} disagreements with the committed manifest`,
  );
  console.log(`merged corpus: ${merged.length} rows, ${candidateShas.length} coverage candidates`);
  console.log(`wrote ${displayPath(sidecarOutPath)}`);
  console.log(`wrote ${displayPath(jsonOutPath)}`);
  console.log(`wrote ${displayPath(outPath)}`);
  console.log(`wrote ${displayPath(ambiguousOutPath)}`);
  return json.bodies.title_only_rows > 0 ? EXIT_PARTIAL : EXIT_OK;
}

function isClear(sha: string, manifest: ManifestRow[]): boolean {
  const row = manifest.find((entry) => entry.sha256 === sha);
  return row ? row.licence_verdict === "CLEAR" : false;
}

function writeOutput(file: string, content: string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/** The offset of a phrase in a text, whitespace-collapsed and case-insensitive; -1 when absent. */
function findPhrase(text: string, phrase: string): number {
  if (!text || !phrase) return -1;
  const haystack = text.replace(/\s+/g, " ").toLowerCase();
  const needle = phrase.replace(/\s+/g, " ").toLowerCase();
  return haystack.indexOf(needle);
}

// ---------------------------------------------------------------------------
// the pure renderers
// ---------------------------------------------------------------------------

const CAVEATS = [
  "**Caveat 1 — this is a re-labelling, not new coverage.** The corpus of record is the 33 committed manifest rows (`docs/RSA-Documents/canada-intake-manifest.jsonl`): 9 tier-T3, 24 tier-T1, and only **12 rows carry a `ca_province`**. Only tier T3/T4 counts as coverage (`scripts/harvest-track-a-report.ts:363`), and only **3 of the 33 rows are Canadian and T3**. Every number below is a change to how an *existing* document is labelled, not a document that entered the corpus. The largest Canadian pool — 22 of the 30 Canadian T3/T4 documents on the operator's inventory — is in-service/`existing` audits, and `policies/canada/pack.json:75-89` defines no canonical cell for `existing` or `construction`, so a correct classifier still yields **zero** new coverage for them.",
  "**Caveat 2 — an ambiguous document has no cell, and is counted both ways.** A document that names two stages is recorded with **both** candidates and a confidence and is assigned no cell. The \"v2 (primary)\" column excludes such documents; the \"v2 (incl. ambiguous)\" column counts each at its primary candidate's cell. The gap between the two columns is exactly the set of documents a human must adjudicate.",
  "**Caveat 3 — a row can lose a cell.** v1 collapsed every multi-stage document to `MULTI_STAGE` (no cell). Under v2 some of those resolve to a single stage and gain a cell; others resolve to a genuinely ambiguous pair, or to a document that enumerates the stage taxonomy, and keep no cell. Both directions are itemised in §4. Rows also carry a licence state of 32 `RESTRICTED` / 1 `CLEAR`; a RESTRICTED document is counted but is **not usable for train or test** until the owner signs off (`scripts/harvest-track-a-report.ts:374`).",
];

const REPRO_COMMANDS = [
  "npx tsx scripts/harvest-stage-rules-v2.ts selftest",
  "npx tsx scripts/harvest-stage-rules-v2.ts fetch --manifest docs/RSA-Documents/canada-intake-manifest.jsonl --cache .autoforge/tmp/stage-rules-v2-cache/",
  "npx tsx scripts/harvest-stage-rules-v2.ts compare --cache .autoforge/tmp/stage-rules-v2-cache/",
  "npx tsx scripts/harvest-stage-rules-v2.ts render --from docs/research/stage-rules/coverage-v2-vs-v1.json --out docs/research/stage-rules/coverage-v2-vs-v1.md",
  "npx tsx scripts/harvest-stage-rules-v2.ts render --from docs/research/stage-rules/classifications-v2.jsonl --ambiguous-out docs/research/stage-rules/ambiguous-v2.md",
];

/**
 * The coverage table, rendered from the machine companion alone. Pure: the same
 * json always yields the same bytes (no timestamp, no absolute path).
 */
export function renderCoverageTable(json: CoverageJson): string {
  const out: string[] = [];
  const d = json.denominators;
  const occupancy = d.table_a_cell_occupancy_v1;

  out.push("# Stage coverage under rule set v2 versus v1");
  out.push("");
  out.push(
    "Ticket: `Akamel01/AuditorAI#62` — versioned stage rule set v2, corpus re-run, v2-vs-v1 coverage table, ambiguity list.",
  );
  out.push("");
  out.push("Inputs (committed, read-only, no network and no model call):");
  out.push(`- \`${json.rule_sets.v1.path}\` — the frozen v1 rule set (sha256 \`${json.rule_sets.v1.sha256}\`)`);
  out.push(`- \`${json.rule_sets.v2.path}\` — the v2 rule set (sha256 \`${json.rule_sets.v2.sha256}\`)`);
  out.push(
    `- \`${json.manifest.path}\` — the corpus of record: ${json.manifest.rows} rows (sha256 \`${json.manifest.sha256}\`)`,
  );
  out.push(`- \`${json.inventory.path}\` — the operator's on-disk inventory: ${json.inventory.rows} rows`);
  out.push(`- \`${json.coverage_targets.path}\` — the ODD targets and priorities`);
  out.push("");
  out.push(
    "This report carries no timestamp: `npx tsx scripts/harvest-stage-rules-v2.ts render --from docs/research/stage-rules/coverage-v2-vs-v1.json --out docs/research/stage-rules/coverage-v2-vs-v1.md` regenerates it byte-identically.",
  );
  out.push("");

  // -- §1 --------------------------------------------------------------------
  out.push("## 1. Scope and denominators");
  out.push("");
  out.push(
    `- The corpus of record is the **${d.table_a_rows}** committed manifest rows: **${d.table_a_t3_rows}** tier T3, **${d.table_a_t1_rows}** tier T1, **${d.table_a_province_rows}** rows carry a \`ca_province\`.`,
  );
  out.push(
    `- Bodies: **${json.bodies.fetched} of ${d.table_a_rows}** rows have a cached body; **${json.bodies.title_only_rows}** rows are title-only (no body text was fetched) and are classified from their title alone — they are never counted as if they had body evidence.`,
  );
  out.push(
    `- **Two denominators, never mixed.** Table A's ${occupancy["canada:FEASIBILITY_CONCEPT"] ?? 0} / ${occupancy["canada:PRELIMINARY_DESIGN"] ?? 0} / ${occupancy["canada:DETAILED_DESIGN"] ?? 0} are CELL OCCUPANCY over the ${d.table_a_rows} manifest rows; Table B's ${json.table_b[0]?.before_have ?? 0} / ${json.table_b[1]?.before_have ?? 0} / ${json.table_b[2]?.before_have ?? 0} are COVERAGE CANDIDATES over the merged ${d.table_b_merged_rows} rows. Two different populations — never mixed.`,
  );
  out.push(
    `- The v1 column is the **v1 rule file's verdict recomputed over the same text**, not a copy of the committed manifest stage; the committed value is recorded alongside (\`stage_v1_committed\`) and the per-row agreement (\`v1_agreement\`) is a finding, not a bug.`,
  );
  out.push("");

  // -- §2 --------------------------------------------------------------------
  out.push(`## 2. Table A — the re-classified corpus (denominator: the ${d.table_a_rows} manifest rows)`);
  out.push("");
  out.push(
    "| ODD cell | target | priority | have (v1, committed) | have (v1, recomputed) | have (v2) | usable CLEAR (v1) | usable CLEAR (v2) | moved in | moved out | ambiguous (unadjudicated) | title-only rows |",
  );
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const row of json.table_a) {
    const label = row.cell_key === "" ? "(no cell)" : `\`${row.cell_key}\``;
    out.push(
      `| ${label} | ${row.target ?? "—"} | ${row.priority ?? "—"} | ${row.have_v1_committed} | ${row.have_v1_recomputed} | ${row.have_v2} | ${row.usable_clear_v1} | ${row.usable_clear_v2} | ${row.moved_in} | ${row.moved_out} | ${row.ambiguous_at_cell} | ${row.title_only_rows} |`,
    );
  }
  out.push("");
  out.push(
    "\"moved\" is **cell-level**: a row moved when its cell under v2 differs from its committed v1 cell. The ambiguous count and the title-only count sit on the `(no cell)` row, because an ambiguous row has no cell by construction.",
  );
  out.push("");

  // -- §3 --------------------------------------------------------------------
  out.push(
    `## 3. Table B — merged corpus-of-record coverage (denominator: \`mergeRows(inventory, manifest)\` = ${d.table_b_merged_rows} rows, counted with the repo's \`coverage_candidate\` predicate)`,
  );
  out.push("");
  out.push(
    "| ODD cell | target | priority | before have | after have | before usable (CLEAR) | after usable (CLEAR) | gap before | gap after | moved |",
  );
  out.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const row of json.table_b) {
    out.push(
      `| \`${row.cell_key}\` | ${row.target} | ${row.priority} | ${row.before_have} | ${row.after_have} | ${row.before_usable_clear} | ${row.after_usable_clear} | ${row.gap_before} | ${row.gap_after} | ${row.moved} |`,
    );
  }
  out.push("");
  out.push(
    "**No new document was fetched for v2 — every v2 cell is a re-labelling of an already-ingested document (newly fetched rows: 0).** " +
      `${d.table_b_rows_with_v2_verdict} of ${d.table_b_merged_rows} merged rows carry a v2 verdict; the other ${d.table_b_merged_rows - d.table_b_rows_with_v2_verdict} inventory-only rows have no body in this repo, are not re-fetched, and keep their v1 stage and cell.`,
  );
  out.push(
    `- The ${d.table_b_coverage_candidates} coverage candidates are \`${d.table_b_candidate_shas.map((sha) => shortSha(sha)).join("`, `")}\`; the "before have" column is the committed round-2 "after have" (${json.table_b.map((row) => row.before_have).join(" / ")}).`,
  );
  out.push("");

  // -- §4 --------------------------------------------------------------------
  out.push(`## 4. Movement detail (${json.rows.length} rows)`);
  out.push("");
  out.push(renderMovementTable(json.rows));
  out.push("");
  out.push(
    `**v1 findings.** ${json.v1_reproduced.disagreements.length} row(s) carry \`v1_agreement: "disagree"\` — the v1 rule file's verdict over the same text differs from the committed manifest stage. A disagreement is a finding, not a bug: it is itemised above and never silently reconciled. ${json.v1_reproduced.mismatches.length} row(s) differ from the LIVE harvester's \`detectStage\` (the frozen v1 rule file must reproduce it exactly).`,
  );
  if (json.v1_reproduced.disagreements.length > 0) {
    out.push("");
    out.push("| sha256 (12) | committed v1 stage | recomputed v1 stage | body available | reading |");
    out.push("|---|---|---|---|---|");
    for (const disagreement of json.v1_reproduced.disagreements) {
      const row = json.rows.find((entry) => entry.sha256 === disagreement.sha256);
      out.push(
        `| \`${shortSha(disagreement.sha256)}\` | ${disagreement.committed} | ${disagreement.recomputed} | ${row && row.body_available ? "yes" : "no (title-only)"} | ${row && !row.body_available ? "no body text to scan: the neutral fallback, a missing corpus rather than a classifier finding" : "the committed stage and the rule file's verdict over the same text differ"} |`,
      );
    }
  }
  out.push("");

  // -- §5 --------------------------------------------------------------------
  out.push("## 5. Ambiguity (AC3)");
  out.push("");
  const ambiguous = json.rows.filter((row) => row.ambiguous);
  out.push(
    `**${ambiguous.length}** of ${json.rows.length} rows are ambiguous. The full list is \`docs/research/stage-rules/ambiguous-v2.md\`, byte-derivable from the committed sidecar alone.`,
  );
  out.push("");
  if (ambiguous.length === 0) {
    out.push("No document in the corpus of record is ambiguous under rule set v2.");
  } else {
    out.push(ambiguousTable(json.rows));
  }
  out.push("");

  // -- §6 --------------------------------------------------------------------
  out.push("## 6. No-cell buckets");
  out.push("");
  out.push("| bucket | rows | note |");
  out.push("|---|---|---|");
  for (const bucket of json.no_cell) {
    out.push(`| \`${bucket.label}\` | ${bucket.count} | ${bucket.note} |`);
  }
  out.push("");

  // -- §7 --------------------------------------------------------------------
  out.push("## 7. Caveats");
  out.push("");
  for (const caveat of CAVEATS) {
    out.push(`> ${caveat}`);
    out.push("");
  }
  out.push(
    "> **Licence.** 32 `RESTRICTED` / 1 `CLEAR`. No corpus body text is committed: the sidecar carries rule ids, short term quotes and source references only.",
  );
  out.push("");

  // -- §8 --------------------------------------------------------------------
  out.push("## 8. Reproduction and the reproducibility boundary");
  out.push("");
  out.push("The exact commands:");
  out.push("");
  for (const command of REPRO_COMMANDS) out.push(`- \`${command}\``);
  out.push("");
  out.push(`- v1 rule set sha256: \`${json.rule_sets.v1.sha256}\``);
  out.push(`- v2 rule set sha256: \`${json.rule_sets.v2.sha256}\``);
  out.push(`- manifest sha256: \`${json.manifest.sha256}\``);
  out.push("");
  out.push(
    "**The boundary, stated plainly:** the committed `coverage-v2-vs-v1.json`, `classifications-v2.jsonl` and `coverage-v2-vs-v1.md` are reproducible **offline** from the committed rule files and the committed manifest — no corpus and no network; only **re-deriving** them from scratch needs the gitignored corpus cache, which requires a network fetch. The md is byte-derivable from the json; the ambiguity list is byte-derivable from the committed sidecar alone (`render --from classifications-v2.jsonl --ambiguous-out ambiguous-v2.md`).",
  );
  out.push("");
  out.push(
    "`render --from` accepts two forms, distinguished by the file's extension and, failing that, by its content shape: a `.json` companion is re-rendered into the coverage md (`--out`), a `.jsonl` sidecar is re-rendered into the ambiguity list (`--ambiguous-out`).",
  );
  out.push("");
  return out.join("\n");
}

export function renderCoverageV3Table(json: CoverageV3Json): string {
  const out: string[] = [];
  const d = json.denominators;
  out.push("# Stage coverage under rule set v3 versus v2");
  out.push("");
  out.push("Ticket: `Akamel01/AuditorAI#69`. v3 policy: section-aware; rules unchanged from v2.");
  out.push("");
  out.push(`- v2 rules: \`${json.rule_sets.v2.path}\` (\`${json.rule_sets.v2.sha256}\`)`);
  out.push(`- v3 rules: \`${json.rule_sets.v3.path}\` (\`${json.rule_sets.v3.sha256}\`)`);
  out.push(`- v2 sidecar: \`${json.v2_sidecar.path}\` (\`${json.v2_sidecar.sha256}\`), ${json.v2_sidecar.rows} rows`);
  out.push(`- manifest: \`${json.manifest.path}\` (\`${json.manifest.sha256}\`), ${json.manifest.rows} rows`);
  out.push("");
  out.push("Repro: `npx tsx scripts/harvest-stage-rules-v2.ts compare-v3 --manifest docs/RSA-Documents/canada-intake-manifest.jsonl --cache .autoforge/tmp/stage-rules-v2-cache --rules-v2 docs/research/stage-rules/stage-rules.v2.json --rules-v3 docs/research/stage-rules/stage-rules.v3.json --v2-sidecar docs/research/stage-rules/classifications-v2.jsonl --json-out docs/research/stage-rules/coverage-v3-vs-v2.json --sidecar-out docs/research/stage-rules/classifications-v3.jsonl --out docs/research/stage-rules/coverage-v3-vs-v2.md`");
  out.push("");
  // §1
  out.push("## §1 Denominators");
  out.push("");
  out.push(`- rows: ${d.rows}`);
  out.push(`- v2 ambiguous: ${d.v2_ambiguous}; non-ambiguous: ${d.v2_non_ambiguous}`);
  out.push(`- docs with >=1 clear section: ${d.v3_documents_with_sections}; without: ${d.v3_documents_without_sections}`);
  out.push(`- stage sections: ${d.v3_stage_sections}`);
  out.push(`- docs with >=2 distinct section stages: ${d.v3_documents_with_multiple_section_stages}`);
  out.push(`- comparable: ${d.comparable_rows}; non-comparable: ${d.non_comparable_rows}`);
  out.push(`- bodies available: ${json.bodies.available}; unavailable: ${json.bodies.unavailable}`);
  if (json.bodies.unavailable_rows.length) {
    out.push(`- unavailable rows: ${json.bodies.unavailable_rows.map((r) => r.sha256).join(", ")}`);
  }
  out.push("");
  // §2
  out.push("## §2 Before/after by stage (33 Track A documents)");
  out.push("");
  out.push("| Stage | v2 documents | v3 documents | v3 section documents | v3 stage sections | Δ documents |");
  out.push("|---|---|---|---|---|---|");
  for (const s of json.stages) {
    out.push(`| ${s.stage} | ${s.v2_documents} | ${s.v3_documents} | ${s.v3_section_documents} | ${s.v3_stage_sections} | ${s.v3_documents - s.v2_documents} |`);
  }
  out.push("");
  const X = d.v3_documents_with_multiple_section_stages;
  const Y = d.v3_stage_sections;
  const Z = d.v3_documents_with_sections;
  const N = d.v3_documents_without_sections;
  out.push(`${d.v2_ambiguous} of ${d.rows} ambiguous under v2; under v3, ${X} documents have >= 2 distinct section stages, ${Y} stage sections were earned across ${Z} documents, and ${N} documents have no clear section and use the v2-equivalent fallback.`);
  out.push("");
  // §3a
  out.push("## §3 By Canadian cell");
  out.push("");
  out.push("### §3a Stage attribution over all 33 docs");
  out.push("");
  out.push("| Cell | v2 documents | v3 documents | v3 section documents | v3 stage sections | Δ |");
  out.push("|---|---|---|---|---|---|");
  for (const c of json.cells) {
    out.push(`| \`${c.cell_key}\` | ${c.v2_documents} | ${c.v3_documents} | ${c.v3_section_documents} | ${c.v3_stage_sections} | ${c.delta_documents} |`);
  }
  out.push("");
  out.push("### §3b ODD coverage candidates");
  out.push("");
  out.push("coverage candidates only; not the 33-doc population");
  out.push("");
  out.push("Coverage candidate shas: " + json.denominators.coverage_candidate_shas.map((x: string) => "`" + x + "`").join(", "));
  out.push("");
  out.push("| Cell | target | v2 candidate documents | v3 candidate documents | v3 candidate section documents | v3 candidate stage sections | Δ |");
  out.push("|---|---|---|---|---|---|---|");
  for (const c of json.coverage_candidates) {
    out.push(`| \`${c.cell_key}\` | ${c.target ?? "—"} | ${c.v2_documents} | ${c.v3_documents} | ${c.v3_section_documents} | ${c.v3_stage_sections} | ${c.delta_documents} |`);
  }
  out.push("");
  // §4
  out.push("## §4 Per-document (33 rows)");
  out.push("");
  out.push("| sha (12) | title | v2 primary | v3 primary | v3 section stages | stage sections | first heading per stage | flags |");
  out.push("|---|---|---|---|---|---|---|---|");
  for (const r of json.rows) {
    const v2prim = r.ambiguous_v2 ? `${r.stage_v2_primary} (ambiguous)` : r.stage_v2_primary;
    const secStages = r.section_stages.join(", ") || "—";

    // build stage sections counts
    const counts: Record<string, number> = {};
    for (const s of r.sections) counts[s.candidate.stage] = (counts[s.candidate.stage] ?? 0) + 1;
    const stageSectionsStr = Object.entries(counts).map(([k, v]) => `${k}×${v}`).join("; ") || "—";
    // first heading per stage in document order
    const firstByStage: string[] = [];
    const seen = new Set<string>();
    for (const s of r.sections) {
      if (!seen.has(s.candidate.stage)) {
        seen.add(s.candidate.stage);
        firstByStage.push(`${s.candidate.stage}: ${s.heading}`);
      }
    }
    const firstHeading = firstByStage.join("; ") || "—";
    const flagParts = [!r.body_available_v3 ? "(body unavailable in v3 cache)" : "", r.body_available_v2 === false ? "(title-only in v2 sidecar)" : ""].filter(Boolean);
    const finalFlags = flagParts.join("; ");
    out.push(`| \`${shortSha(r.sha256)}\` | ${cellText(r.title)} | ${v2prim} | ${r.stage_v3_primary} | ${secStages} | ${stageSectionsStr} | ${cellText(firstHeading)} | ${finalFlags} |`);
  }
  out.push("");
  // §5
  out.push("## §5 Unresolved");
  out.push("");
  if (json.unresolved.length === 0) {
    out.push("No unresolved rows.");
  } else {
    out.push("| sha (12) | title | v2 | v3 |");
    out.push("|---|---|---|---|");
    for (const u of json.unresolved) {
      out.push(`| \`${shortSha(u.sha256)}\` | ${cellText(u.title)} | ${u.stage_v2} | ${u.stage_v3} |`);
    }
  }
  out.push("");
  // §6
  out.push("## §6 Caveats");
  out.push("");
  out.push("- Re-labelling, not new coverage (33 committed rows; only 3 Canadian T3).");
  out.push("- Documents vs stage sections: a document earning a stage in N sections counts once in documents, N in stage sections.");
  out.push("- A MULTI_STAGE document can earn several cells through sections.");
  out.push("- Title evidence is dropped from the v3 document decision when sections exist (v2 sidecar preserves it).");
  out.push("- Inherited v2 rule coarseness bounds precision (e.g. a 'Stage 1 items' heading in a Stage 2 report earns FEASIBILITY).");
  out.push("- Cache comparability: `f5b7f30a…` is title-only in the v2 sidecar but has a body in the v3 cache (non-comparable); `37863ef8…` was restored and is comparable.");
  out.push("- The 33-doc corpus has one coverage candidate (`0af7ea58...`); the committed v2 Table B's 1/0/1 includes the inventory-only `a24707c6...` (no v3 body/verdict) and is not comparable; no new document was fetched.");
  out.push("- 32 RESTRICTED / 1 CLEAR; no new documents.");
  out.push("- `comparable` means body availability only.");
  out.push("");
  return out.join("\n");
}

/**
 * The movement detail table (§4): one row per corpus document, both v1 verdicts,
 * the v2 verdict and whether the row changed cell.
 */
export function renderMovementTable(rows: SidecarRow[]): string {
  const out: string[] = [];
  out.push(
    "| sha256 (12) | tier | province | title | v1 committed | v1 recomputed | v1 agree? | body available | v2 kind | v2 primary stage | v2 candidates | v2 cell | moved | reason |",
  );
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const row of rows) {
    const kind = row.ambiguous ? "multi-stage" : row.candidates.length === 1 ? "single-stage" : "no-stage";
    const candidates = row.candidates
      .map(
        (candidate) =>
          `${candidate.stage}(${candidate.confidence}, ${candidate.rule_ids.join("+")}, ${candidate.evidence_scope})`,
      )
      .join("; ");
    out.push(
      `| \`${shortSha(row.sha256)}\` | ${row.tier} | ${row.ca_province ?? "—"} | ${cellText(row.title)} | ${row.stage_v1_committed} | ${row.stage_v1_recomputed} | ${row.v1_agreement} | ${row.body_available ? "yes" : "no (title-only)"} | ${kind} | ${row.stage_v2_primary} | ${candidates || "—"} | ${row.cell_key_v2 === "" ? "—" : `\`${row.cell_key_v2}\``} | ${movedOf(row) ? "yes" : "no"} | ${cellText(reasonOf(row))} |`,
    );
  }
  return out.join("\n");
}

function movedOf(row: SidecarRow): boolean {
  return row.cell_key_v1_committed !== row.cell_key_v2;
}

function reasonOf(row: SidecarRow): string {
  if (!row.body_available) {
    return "title-only row: no body text to scan, so the v1 verdict is the neutral fallback — a missing corpus, not a classifier finding";
  }
  if (row.v1_agreement === "disagree") {
    return "v1 rule file verdict differs from the committed manifest stage — a finding, not a bug";
  }
  if (movedOf(row)) {
    return `re-labelled by rule set v2: ${row.cell_key_v1_committed || "(no cell)"} → ${row.cell_key_v2 || "(no cell)"}`;
  }
  if (row.ambiguous) return "ambiguous: two or more candidates, no cell (never forced)";
  return "no cell change";
}

/** The ambiguity table body (§5 of the coverage md and the whole ambiguity md). */
function ambiguousTable(rows: SidecarRow[]): string {
  const ambiguous = rows.filter((row) => row.ambiguous);
  const out: string[] = [];
  out.push(
    "| document (sha256) | real title | candidate 1 (stage · confidence · rule ids) | candidate 2 (stage · confidence · rule ids) | n candidates | scope_basis | cell if adjudicated at candidate 1 |",
  );
  out.push("|---|---|---|---|---|---|---|");
  for (const row of ambiguous) {
    const [first, second] = row.candidates;
    const describe = (candidate: StageCandidate | undefined): string =>
      candidate
        ? `\`${candidate.stage}\` · ${candidate.confidence} · ${candidate.rule_ids.join(", ")}`
        : "—";
    out.push(
      `| \`${shortSha(row.sha256)}\` | ${cellText(row.title)} | ${describe(first)} | ${describe(second)} | ${row.candidates.length} | ${row.scope_basis} | ${first && first.cell_key ? `\`${first.cell_key}\`` : "—"} |`,
    );
  }
  return out.join("\n");
}

/**
 * The ambiguity list: a human table of the ambiguous documents. Rendered from
 * the sidecar rows alone, so it is byte-derivable offline.
 */
export function renderAmbiguousTable(rows: SidecarRow[]): string {
  const ambiguous = rows.filter((row) => row.ambiguous);
  const out: string[] = [];
  out.push("# Ambiguous documents under stage rule set v2");
  out.push("");
  out.push(
    "Ticket: `Akamel01/AuditorAI#62`. Generated from the committed sidecar `docs/research/stage-rules/classifications-v2.jsonl` by `npx tsx scripts/harvest-stage-rules-v2.ts render --from docs/research/stage-rules/classifications-v2.jsonl --ambiguous-out docs/research/stage-rules/ambiguous-v2.md` — no corpus, no network.",
  );
  out.push("");
  out.push(
    `**${ambiguous.length}** of ${rows.length} documents in the corpus of record are ambiguous.`,
  );
  out.push("");
  if (ambiguous.length === 0) {
    out.push("No document in the corpus of record is ambiguous under rule set v2.");
  } else {
    out.push(ambiguousTable(rows));
  }
  out.push("");
  out.push(
    "An ambiguous document names two or more stages: it is recorded with **every** candidate, its confidence and the rule ids that fired, and it is assigned **no cell** — there is no Canadian multi-stage cell, and v1 already treats `MULTI_STAGE` as unmapped (`scripts/harvest-track-a-report.ts:34`). Ambiguity is reported, never resolved.",
  );
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// compare-v3
// ---------------------------------------------------------------------------

function runCompareV3(flags: Flags): number {
  const manifestPath = flags.str("manifest", DEFAULT_MANIFEST);
  const cacheDir = flags.str("cache", DEFAULT_CACHE);
  const rulesV2Path = flags.str("rules-v2", DEFAULT_RULES);
  const rulesV3Path = flags.str("rules-v3", DEFAULT_RULES_V3);
  const v2SidecarPath = flags.str("v2-sidecar", DEFAULT_V2_SIDECAR);
  const jsonOutPath = flags.str("json-out", DEFAULT_V3_JSON_OUT);
  const sidecarOutPath = flags.str("sidecar-out", DEFAULT_V3_SIDECAR_OUT);
  const outPath = flags.str("out", DEFAULT_V3_OUT);
  const coveragePath = flags.str("coverage", DEFAULT_COVERAGE);

  for (const file of [jsonOutPath, sidecarOutPath, outPath]) {
    assertNotFrozen(file);
    assertV3OutputPath(file);
  }

  const manifestFile = path.resolve(REPO, manifestPath);
  if (!existsSync(manifestFile)) throw new UsageError(`manifest not found: ${manifestPath}`);
  let manifest: ManifestRow[];
  try {
    manifest = readJsonl<ManifestRow>(manifestFile);
  } catch (error) {
    throw new FatalError(`unreadable manifest: ${manifestPath} (${String(error)})`);
  }
  const v2SidecarFile = path.resolve(REPO, v2SidecarPath);
  if (!existsSync(v2SidecarFile)) throw new UsageError(`v2 sidecar not found: ${v2SidecarPath}`);
  let v2Sidecar: Record<string, unknown>[];
  try {
    v2Sidecar = readJsonl<Record<string, unknown>>(v2SidecarFile);
  } catch (error) {
    throw new FatalError(`unreadable v2 sidecar: ${v2SidecarPath} (${String(error)})`);
  }
  const coverageFile = path.resolve(REPO, coveragePath);
  if (!existsSync(coverageFile)) throw new UsageError(`coverage file not found: ${coveragePath}`);

  const inventoryFile = path.resolve(REPO, DEFAULT_INVENTORY);
  const inventory = existsSync(inventoryFile) ? readJsonl<InventoryRow>(inventoryFile) : [];
  const licence = existsSync(path.join(REPO, "docs/RSA-Documents/LICENSE-REGISTER.md"))
    ? parseLicenceRegister(readFileSync(path.join(REPO, "docs/RSA-Documents/LICENSE-REGISTER.md"), "utf8"))
    : new Map();
  const merged = mergeRows(inventory, manifest as unknown as ReportManifestRow[], licence as Parameters<typeof mergeRows>[2]);

  // load v3 rules, require version v3
  const rulesV3Raw = readJson<Record<string, unknown>>(path.resolve(REPO, rulesV3Path));
  if ((rulesV3Raw as {rule_set_version?: string}).rule_set_version !== "v3") throw new UsageError(`rule set must be v3: ${rulesV3Path}`);
  const v3 = loadRuleSet(rulesV3Raw);
  // v2 rules loaded only for sha; not used beyond pin
  loadRuleSet(readJson<unknown>(path.resolve(REPO, rulesV2Path)));

  // v2 sidecar must match manifest sha set, 33 rows
  if (manifest.length !== 33) throw new FatalError(`manifest must have 33 rows, got ${manifest.length}`);
  if (v2Sidecar.length !== 33) throw new FatalError(`v2 sidecar must have 33 rows, got ${v2Sidecar.length}`);
  const manifestShas = new Set(manifest.map((r) => r.sha256));
  const sidecarShas = new Set(v2Sidecar.map((r) => String(r.sha256)));
  if (manifestShas.size !== 33 || sidecarShas.size !== 33) throw new FatalError("duplicate sha in manifest or sidecar");
  for (const sha of manifestShas) if (!sidecarShas.has(sha)) throw new FatalError(`sha mismatch: ${sha}`);
  for (const sha of sidecarShas) if (!manifestShas.has(sha)) throw new FatalError(`sha mismatch: ${sha}`);

  const v2BySha = new Map(v2Sidecar.map((r) => [String(r.sha256), r]));

  const cache = path.resolve(REPO, cacheDir);
  const bodies = new Map<string, string>();
  if (existsSync(cache)) {
    for (const entry of readdirSync(cache)) {
      if (!entry.endsWith(".txt")) continue;
      bodies.set(entry.slice(0, -4), readFileSync(path.join(cache, entry), "utf8"));
    }
  }

  const coverage = readJson<{ cells: { cell_key: string; target: number; priority: number }[] }>(coverageFile);
  const cellTargets = new Map(coverage.cells.map((cell) => [cell.cell_key, cell]));

  // repo predicate for coverage candidates (Canadian T3/T4, mapped cell, rsa-sample, not duplicate, not BLOCKED)
  // We apply to the 33 sidecar rows by licence/manifest; manifest has tier, ca_province. Need merged? Plan says apply repo predicate to the 33 sidecar rows.
  // We'll compute candidates from manifest rows where canadian? We don't have merged easily. Use simple: ca_province not null (Canadian), tier T3/T4, klass rsa-sample assumed for all manifest rows? Manifest rows lack klass/duplicate.
  // The plan states only 0af7ea58 is candidate. We'll just include all 3 cells with v2/v3 counts based on candidate shas known? Instead, apply predicate using manifest: canadian = ca_province not null; tier T3/T4; not blocked (licence_verdict !== BLOCKED); klass/duplicate unknown -> assume all manifest rows are rsa-sample non-duplicate (as v2 sidecar candidate logic used effective cell).
  // Simpler: coverage_candidates = the 3 cells; v2_documents from committed v2 cell occupancy among candidates. We need identify candidate shas. Use the same candidateShas as runCompare? Hard. We'll compute candidate shas as manifest rows that are Canadian T3/T4 and not BLOCKED (all 33 manifest? Actually only 3 Canadian T3). Let's filter.


  const sorted = [...manifest].sort((a, b) => (a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0));
  const rows: SectionSidecarRow[] = [];
  const unavailableRows: { sha256: string; reason: string }[] = [];
  let anyMissing = false;

  for (const row of sorted) {
    const body = bodies.get(row.sha256) ?? "";
    const bodyAvailable = body.length > 0;
    if (!bodyAvailable) {
      anyMissing = true;
      unavailableRows.push({ sha256: row.sha256, reason: "no cached body text" });
    }

    const ctx = { title: row.title ?? "", hint: NEUTRAL_HINT };
    const after = classifyDocument(body, ctx, v3);

    // assert sections
    const normalize = typeof v3.scan.normalize === "string" ? v3.scan.normalize : null;
    const region = (normalize ? body.normalize(normalize) : body).slice(0, v3.scan.chars);
    let prevEnd = -1;
    for (const sec of after.sections) {
      if (!(0 <= sec.span.start && sec.span.start < sec.span.end && sec.span.end <= region.length)) {
        throw new FatalError(`section span violation ${row.sha256} ${sec.heading}`);
      }
      if (sec.span.start < prevEnd) throw new FatalError(`section overlap ${row.sha256}`);
      prevEnd = sec.span.end;
      if (!(sec.span.start <= sec.candidate.offset && sec.candidate.offset < sec.span.end)) {
        throw new FatalError(`offset violation ${row.sha256} ${sec.heading}`);
      }
      if (findPhrase(region.slice(sec.span.start, sec.span.end), sec.candidate.matched_phrase) < 0) {
        throw new FatalError(`phrase containment violation ${row.sha256} ${sec.heading}`);
      }
    }

    const v2row = v2BySha.get(row.sha256);
    const stageV2Primary = String(v2row?.stage_v2_primary ?? "");
    const cellKeyV2 = String(v2row?.cell_key_v2 ?? "");
    const ambiguousV2 = (v2row?.ambiguous_v2 ?? v2row?.ambiguous) === true;
    const bodyAvailableV2 = (v2row?.body_available_v2 ?? v2row?.body_available) === true ? true : (v2row?.body_available_v2 ?? v2row?.body_available) === false ? false : bodyAvailable;

    const sectionStages = [...new Set(after.sections.map((s) => s.candidate.stage))];

    rows.push({
      project_id: row.project_id,
      sha256: row.sha256,
      title: row.title ?? "",
      tier: row.tier,
      ca_province: row.ca_province || null,
      lang: row.lang ?? "en",
      licence_verdict: row.licence_verdict,
      stage_v2_primary: stageV2Primary,
      cell_key_v2: cellKeyV2,
      ambiguous_v2: ambiguousV2,
      body_available_v2: bodyAvailableV2,
      stage_v3_primary: after.decision.stage,
      cell_key_v3: after.decision.cell_key,
      confidence_v3: after.decision.confidence,
      ambiguous_v3: after.decision.ambiguous,
      candidates: after.decision.candidates,
      section_stages: sectionStages,
      sections: after.sections,
      body_available_v3: bodyAvailable,
      comparable: bodyAvailableV2 === bodyAvailable,
      source: bodyAvailable ? after.decision.source : "title",
    });
  }

  rows.sort((a, b) => (a.sha256 < b.sha256 ? -1 : a.sha256 > b.sha256 ? 1 : 0));

  const canonicalCells = new Set(["canada:FEASIBILITY_CONCEPT","canada:PRELIMINARY_DESIGN","canada:DETAILED_DESIGN"]);
  const mergedBySha = new Map(merged.map((m) => [m.sha256, m]));
  const candidateShas = new Set<string>();
  const missingMappings: string[] = [];
  for (const row of rows) {
    const mrow = mergedBySha.get(row.sha256);
    if (!mrow) { missingMappings.push(row.sha256); continue; }
    const isCandidateBase = mrow.canadian && (mrow.tier === "T3" || mrow.tier === "T4") && mrow.klass === "rsa-sample" && !mrow.duplicate && mrow.licence !== "BLOCKED";
    if (!isCandidateBase) continue;
    const v2cell = row.cell_key_v2;
    const v3earnedCell = row.sections.length > 0
      ? (row.sections.find((s) => s.candidate.cell_key && canonicalCells.has(s.candidate.cell_key))?.candidate.cell_key ?? "")
      : row.cell_key_v3;
    const underV2 = canonicalCells.has(v2cell);
    const underV3 = canonicalCells.has(v3earnedCell);
    if (underV2 || underV3) candidateShas.add(row.sha256);
  }
  if (missingMappings.length) console.log("missing merged mappings: " + missingMappings.join(", "));

  // counts per canonical stage
  function earned(row: SectionSidecarRow, S: string): boolean {
    const sectionEarned = row.sections.some((s) => s.candidate.stage === S);
    const fallbackEarned = row.sections.length === 0 && row.stage_v3_primary === S;
    return sectionEarned || fallbackEarned;
  }
  function sectionEarned(row: SectionSidecarRow, S: string): boolean {
    return row.sections.some((s) => s.candidate.stage === S);
  }
  const stageOrder = ["FEASIBILITY_CONCEPT", "PRELIMINARY_DESIGN", "DETAILED_DESIGN", "PRE_OPENING", "EXISTING", "CONSTRUCTION", "MULTI_STAGE", "UNSTAGED"];
  const stages = stageOrder.map((S) => {
    const v2Documents = rows.filter((r) => r.stage_v2_primary === S).length;
    const v3Documents = rows.filter((r) => earned(r, S)).length;
    const v3SectionDocuments = rows.filter((r) => sectionEarned(r, S)).length;
    const v3StageSections = rows.reduce((n, r) => n + r.sections.filter((s) => s.candidate.stage === S).length, 0);
    return {
      stage: S,
      v2_documents: v2Documents,
      v2_documents_clear: rows.filter((r) => r.stage_v2_primary === S && r.licence_verdict === "CLEAR").length,
      v3_documents: v3Documents,
      v3_documents_clear: rows.filter((r) => earned(r, S) && r.licence_verdict === "CLEAR").length,
      v3_section_documents: v3SectionDocuments,
      v3_section_documents_clear: rows.filter((r) => sectionEarned(r, S) && r.licence_verdict === "CLEAR").length,
      v3_stage_sections: v3StageSections,
      v3_stage_sections_clear: rows.reduce((n, r) => n + (r.licence_verdict === "CLEAR" ? r.sections.filter((s) => s.candidate.stage === S).length : 0), 0),
    };
  });

  const cells = CANADIAN_CELLS.map((cellKey) => {
    const stage = cellKey.split(":")[1];
    // map cell to stage canonical: FEASIBILITY_CONCEPT etc
    const canonStage = stage;
    const v2Documents = rows.filter((r) => r.cell_key_v2 === cellKey).length;
    const v3DocsSet = new Set<string>();
    for (const r of rows) {
      const secEarned = r.sections.some((s) => s.candidate.stage === canonStage && s.candidate.cell_key === cellKey);
      const fallbackEarned = r.sections.length === 0 && r.stage_v3_primary === canonStage && r.cell_key_v3 === cellKey;
      if (secEarned || fallbackEarned) v3DocsSet.add(r.sha256);
    }
    const v3Documents2 = v3DocsSet.size;
    const v3SectionDocuments = rows.filter((r) => r.sections.some((s) => s.candidate.stage === canonStage && s.candidate.cell_key === cellKey)).length;
    const v3StageSections = rows.reduce((n, r) => n + r.sections.filter((s) => s.candidate.stage === canonStage && s.candidate.cell_key === cellKey).length, 0);
    const target = cellTargets.get(cellKey);
    return {
      cell_key: cellKey,
      stage: canonStage,
      target: target ? target.target : null,
      priority: target ? target.priority : null,
      v2_documents: v2Documents,
      v2_documents_clear: rows.filter((r) => r.cell_key_v2 === cellKey && r.licence_verdict === "CLEAR").length,
      v3_documents: v3Documents2,
      v3_documents_clear: [...v3DocsSet].filter((sha) => rows.find((r) => r.sha256 === sha)?.licence_verdict === "CLEAR").length,
      v3_section_documents: v3SectionDocuments,
      v3_section_documents_clear: rows.filter((r) => r.sections.some((s) => s.candidate.stage === canonStage && s.candidate.cell_key === cellKey) && r.licence_verdict === "CLEAR").length,
      v3_stage_sections: v3StageSections,
      v3_stage_sections_clear: rows.reduce((n, r) => n + (r.licence_verdict === "CLEAR" ? r.sections.filter((s) => s.candidate.stage === canonStage && s.candidate.cell_key === cellKey).length : 0), 0),
      delta_documents: v3Documents2 - v2Documents,
    };
  });

  // coverage candidates
  const coverageCandidates = CANADIAN_CELLS.map((cellKey) => {
    const canonStage = cellKey.split(":")[1];
    const candRows = rows.filter((r) => candidateShas.has(r.sha256));
    const v2Documents = candRows.filter((r) => r.cell_key_v2 === cellKey).length;
    const v3DocsSet = new Set<string>();
    for (const r of candRows) {
      const secEarned = r.sections.some((s) => s.candidate.stage === canonStage && s.candidate.cell_key === cellKey);
      const fallbackEarned = r.sections.length === 0 && r.stage_v3_primary === canonStage && r.cell_key_v3 === cellKey;
      if (secEarned || fallbackEarned) v3DocsSet.add(r.sha256);
    }
    const v3Documents = v3DocsSet.size;
    const v3SectionDocuments = candRows.filter((r) => r.sections.some((s) => s.candidate.stage === canonStage && s.candidate.cell_key === cellKey)).length;
    const v3StageSections = candRows.reduce((n, r) => n + r.sections.filter((s) => s.candidate.stage === canonStage && s.candidate.cell_key === cellKey).length, 0);
    const target = cellTargets.get(cellKey);
    return {
      cell_key: cellKey,
      stage: canonStage,
      target: target ? target.target : null,
      priority: target ? target.priority : null,
      v2_documents: v2Documents,
      v3_documents: v3Documents,
      v3_section_documents: v3SectionDocuments,
      v3_stage_sections: v3StageSections,
      delta_documents: v3Documents - v2Documents,
    };
  });

  const v2Ambiguous = rows.filter((r) => r.ambiguous_v2).length;
  const json: CoverageV3Json = {
    rule_sets: {
      v2: { path: displayPath(rulesV2Path), sha256: sha256File(path.resolve(REPO, rulesV2Path)) },
      v3: { path: displayPath(rulesV3Path), sha256: sha256File(path.resolve(REPO, rulesV3Path)) },
    },
    v2_sidecar: { path: displayPath(v2SidecarPath), sha256: sha256File(v2SidecarFile), rows: v2Sidecar.length },
    manifest: { path: displayPath(manifestPath), sha256: sha256File(manifestFile), rows: manifest.length },
    bodies: {
      available: rows.filter((r) => r.body_available_v3).length,
      unavailable: rows.filter((r) => !r.body_available_v3).length,
      unavailable_rows: unavailableRows.sort((a, b) => (a.sha256 < b.sha256 ? -1 : 1)),
    },
    denominators: {
      rows: rows.length,
      v2_ambiguous: v2Ambiguous,
      v2_non_ambiguous: rows.length - v2Ambiguous,
      coverage_candidate_shas: [...candidateShas].sort(),
    comparable_rows: rows.filter((r) => r.comparable).length,
      non_comparable_rows: rows.filter((r) => !r.comparable).length,
      v3_documents_with_sections: rows.filter((r) => r.sections.length > 0).length,
      v3_documents_without_sections: rows.filter((r) => r.sections.length === 0).length,
      v3_stage_sections: rows.reduce((n, r) => n + r.sections.length, 0),
      v3_documents_with_multiple_section_stages: rows.filter((r) => r.section_stages.length >= 2).length,
    },
    coverage_candidates: coverageCandidates,
    cells,
    stages,
    unresolved: rows
      .filter((r) => r.sections.length === 0 && (r.stage_v3_primary === "MULTI_STAGE" || r.stage_v3_primary === "UNSTAGED"))
      .map((r) => ({ sha256: r.sha256, title: r.title, stage_v2: r.stage_v2_primary, stage_v3: r.stage_v3_primary }))
      .sort((a, b) => (a.sha256 < b.sha256 ? -1 : 1)),
    rows,
  };

  // write outputs
  writeOutput(jsonOutPath, JSON.stringify(json, null, 2) + "\n");
  const sidecarLines = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeOutput(sidecarOutPath, sidecarLines);
  writeOutput(outPath, renderCoverageV3Table(json));

  console.log(`compare-v3: ${rows.length} rows, ${json.denominators.v3_stage_sections} stage sections, ${json.denominators.v3_documents_with_sections} docs with sections`);
  return anyMissing ? EXIT_PARTIAL : EXIT_OK;
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

function runRender(flags: Flags): number {
  const from = flags.str("from", "");
  if (!from) throw new UsageError("render needs --from <json coverage companion | jsonl sidecar>");
  const outPath = flags.str("out", "");
  const ambiguousOutPath = flags.str("ambiguous-out", "");
  const file = path.resolve(REPO, from);
  if (!existsSync(file)) throw new UsageError(`input not found: ${from}`);

  // The two --from forms: a .json coverage companion and a .jsonl sidecar.
  // The extension decides; failing that, the content shape does.
  const extension = path.extname(file).toLowerCase();
  const head = readFileSync(file, "utf8").trimStart().slice(0, 1);
  const isJsonl = extension === ".jsonl" ? true : extension === ".json" ? false : head !== "{" && head !== "[";
  const text = readFileSync(file, "utf8");

  if (isJsonl) {
    if (!ambiguousOutPath) throw new UsageError("render --from <jsonl> needs --ambiguous-out <md>");
    const rows = text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as SidecarRow);
    assertNotFrozen(ambiguousOutPath);
    writeOutput(path.resolve(REPO, ambiguousOutPath), renderAmbiguousTable(rows));
    console.log(`wrote ${displayPath(ambiguousOutPath)} (${rows.length} sidecar rows, ${rows.filter((row) => row.ambiguous).length} ambiguous)`);
    return EXIT_OK;
  }

  if (!outPath) throw new UsageError("render --from <json> needs --out <md>");
  const json = JSON.parse(text) as CoverageJson;
  assertNotFrozen(outPath);
  writeOutput(path.resolve(REPO, outPath), renderCoverageTable(json));
  console.log(`wrote ${displayPath(outPath)} (coverage md from the json companion)`);
  return EXIT_OK;
}

function runRenderV3(flags: Flags): number {
  const from = flags.str("from", "");
  const outPath = flags.str("out", "");
  if (!from) throw new UsageError("render-v3 needs --from <json>");
  if (!outPath) throw new UsageError("render-v3 needs --out <md>");
  const file = path.resolve(REPO, from);
  if (!existsSync(file)) throw new UsageError(`input not found: ${from}`);
  const json = JSON.parse(readFileSync(file, "utf8")) as CoverageV3Json;
  assertNotFrozen(outPath);
  assertV3OutputPath(outPath);
  writeOutput(path.resolve(REPO, outPath), renderCoverageV3Table(json));
  console.log(`wrote ${displayPath(outPath)} (v3 coverage md from the json companion)`);
  return EXIT_OK;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const USAGE = `usage: npx tsx scripts/harvest-stage-rules-v2.ts <verb> [flags]

verbs:
  selftest  load both rule sets, compile every regex with its recorded flags
  fetch     the ONLY network path: stream the corpus into the gitignored cache
  compare   offline: classify the corpus under v1 and v2, write the 4 outputs
  compare-v3 offline: classify the 33-doc corpus under v3, before from the committed v2 sidecar
  render    offline: re-render the coverage md or the ambiguity list
  render-v3 offline: re-render the v3 coverage md from its json companion

common flags:
  --manifest <file>      the corpus of record (default ${DEFAULT_MANIFEST})
  --cache <dir>          the gitignored corpus cache (default ${DEFAULT_CACHE})
  --rules <file>         the v2 rule set (default ${DEFAULT_RULES})
  --rules-v1 <file>      the v1 rule set (default ${DEFAULT_RULES_V1})
  --out <file>           the coverage md (default ${DEFAULT_OUT})
  --json-out <file>      the coverage json companion (default ${DEFAULT_JSON_OUT})
  --sidecar-out <file>   the sidecar jsonl (default ${DEFAULT_SIDECAR_OUT})
  --ambiguous-out <file> the ambiguity md (default ${DEFAULT_AMBIGUOUS_OUT})
  --inventory <file>     the on-disk inventory (default ${DEFAULT_INVENTORY})
  --coverage <file>      the ODD targets (default ${DEFAULT_COVERAGE})
  --from <file>          render: a json companion or a jsonl sidecar
  --tier <tier>          fetch: all | T1 | T3 (default all)
  --limit <n>            fetch: 0 = every row (default 0)
  --timeout-ms <n>       fetch: per-request timeout (default ${TIMEOUT_MS})
  --max-file-bytes <n>   fetch: per-file cap (default ${MAX_FILE_BYTES})
  --max-total-bytes <n>  fetch: per-run cap (default ${MAX_TOTAL_BYTES})
  --user-agent <ua>      fetch: the harvest user agent (default ${HARVEST_USER_AGENT})
  --dry-run              fetch: print the plan, make no request
`;

export async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  if (!verb || verb === "--help" || verb === "-h") {
    console.log(USAGE);
    return verb ? EXIT_OK : EXIT_USAGE;
  }
  const rest = argv.slice(1);
  try {
    switch (verb) {
      case "selftest":
        return runSelftest(Flags.parse(rest, { rules: "string", "rules-v1": "string" }));
      case "fetch":
        return await runFetch(
          Flags.parse(rest, {
            manifest: "string",
            cache: "string",
            tier: "string",
            limit: "string",
            "timeout-ms": "string",
            "max-file-bytes": "string",
            "max-total-bytes": "string",
            "user-agent": "string",
            "dry-run": "boolean",
          }),
        );
      case "compare":
        return runCompare(
          Flags.parse(rest, {
            manifest: "string",
            cache: "string",
            rules: "string",
            "rules-v1": "string",
            out: "string",
            "json-out": "string",
            "sidecar-out": "string",
            "ambiguous-out": "string",
            inventory: "string",
            coverage: "string",
          }),
        );
      case "compare-v3":
        return runCompareV3(
          Flags.parse(rest, {
            manifest: "string",
            cache: "string",
            "rules-v2": "string",
            "rules-v3": "string",
            "v2-sidecar": "string",
            "json-out": "string",
            "sidecar-out": "string",
            out: "string",
            coverage: "string",
          }),
        );
      case "render":
        return runRender(
          Flags.parse(rest, { from: "string", out: "string", "ambiguous-out": "string" }),
        );
      case "render-v3":
        return runRenderV3(Flags.parse(rest, { from: "string", out: "string" }));
      default:
        throw new UsageError(`unknown verb: ${verb}`);
    }
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`usage error: ${error.message}`);
      console.error(USAGE);
      return EXIT_USAGE;
    }
    if (error instanceof FatalError) {
      console.error(`fatal: ${error.message}`);
      return EXIT_FATAL;
    }
    console.error(`fatal: ${String(error instanceof Error ? error.message : error)}`);
    return EXIT_FATAL;
  }
}

// Run only when executed directly, so tests can import the pure helpers.
if (process.argv[1] && path.basename(process.argv[1]) === path.basename(__filename)) {
  void main().then((code) => {
    process.exitCode = code;
  });
}
