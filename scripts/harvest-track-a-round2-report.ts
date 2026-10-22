#!/usr/bin/env node
// Harvest round 2 report for GitHub issue #60 (Akamel01/AuditorAI).
//
//   npx tsx scripts/harvest-track-a-round2-report.ts
//
// Deterministic and offline: every input is a committed file, no network and no
// model call, and the output carries no timestamp, so the committed report is
// byte-reproducible (the round-1 pattern, scripts/harvest-track-a-report.ts).
//
// The report carries the ticket's four acceptance criteria:
//   AC1 the coverage table versus the ODD targets, before and after, with the
//       priority cells called out
//   AC2 harvest precision per class
//   AC3 a source-yield table
//   AC4 the gaps free sources cannot fill, as input for the ATIP fallback
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  CA_PROVINCES,
  CANADIAN_CELLS,
  MANIFEST_STAGE_TO_CELL,
  mergeRows,
  parseLicenceRegister,
  type Coverage,
  type InventoryRow,
  type ManifestRow,
  type MergedRow,
} from "./harvest-track-a-report.js";

const REPO = process.cwd();
const INVENTORY = "docs/RSA-Documents/track-a-ondisk-inventory.jsonl";
const MANIFEST = "docs/RSA-Documents/canada-intake-manifest.jsonl";
const SOURCES = "docs/RSA-Documents/track-a-round2-sources.json";
const CANDIDATES = "docs/RSA-Documents/track-a-round2-candidates.json";
const CANDIDATE_LOG = "docs/RSA-Documents/track-a-round2-candidate-log.tsv";
const BYTES = "docs/RSA-Documents/track-a-round2-bytes.json";
const LICENCE = "docs/RSA-Documents/LICENSE-REGISTER.md";
const ODD = "state/odd-coverage.json";

/** The closed source-type taxonomy of the round-2 source list. */
const SOURCE_TYPES = [
  "municipal-agenda-package",
  "ea-class-ea-study",
  "university-repository",
  "conference-proceedings",
  "provincial-ministry-report",
  "open-data-portal",
  "direct-known-document",
];

interface Round2Source {
  id: string;
  host: string;
  family: string;
  source_type: string;
  strategy: string;
  queries?: string[];
  licence_default: { verdict: string; basis: string; licence_ref: string };
  discovery?: { channel: string; strategy?: string | null; listing_url?: string | null };
}

interface Round2SourceList {
  sources: Round2Source[];
  unfillable: Array<{ family: string; host: string | null; reason: string; track_input: string }>;
  host_licences?: Record<string, { verdict: string; basis: string; licence_ref: string }>;
  province_hints?: Record<string, string>;
  split_rule?: { test_provinces: string[] };
  discovery?: { model_triage?: string };
}

interface CandidateRow {
  url: string;
  source_id: string;
  source_type?: string;
  query?: string;
  discovery_channel?: string;
  province_hint?: string;
  licence_verdict?: string;
}

interface CandidateLogRow {
  source_id: string;
  source_type: string;
  url: string;
  http_status: string;
  bytes: string;
  sha256: string;
  decision: string;
  reason: string;
  dedupe_status: string;
  stage_source: string;
  tier_source: string;
}

function readJsonl<T>(file: string): T[] {
  if (!existsSync(path.join(REPO, file))) return [];
  return readFileSync(path.join(REPO, file), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function readJson<T>(file: string, fallback: T): T {
  const p = path.join(REPO, file);
  if (!existsSync(p)) return fallback;
  return JSON.parse(readFileSync(p, "utf8")) as T;
}

function tally<T>(rows: T[], value: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = value(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function share(count: number, denominator: number): string {
  return denominator === 0 ? "n/a" : `${((count / denominator) * 100).toFixed(1)}%`;
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function isCaProvince(value: string): boolean {
  return (CA_PROVINCES as readonly string[]).includes(value);
}

/** The coverage candidates of a row set, by cell. */
function candidatesByCell(rows: MergedRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cellKey of CANADIAN_CELLS) out[cellKey] = 0;
  for (const row of rows) {
    if (!row.coverage_candidate || !row.cell) continue;
    out[row.cell] = (out[row.cell] ?? 0) + 1;
  }
  return out;
}

/** The coverage candidates of a row set whose licence is CLEAR (usable). */
function usableByCell(rows: MergedRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cellKey of CANADIAN_CELLS) out[cellKey] = 0;
  for (const row of rows) {
    if (!row.coverage_candidate || !row.cell) continue;
    if (row.licence !== "CLEAR") continue;
    out[row.cell] = (out[row.cell] ?? 0) + 1;
  }
  return out;
}

/** The corpus class tables of a row set: the round-1 taxonomy, unchanged. */
function classTables(rows: MergedRow[]): { all: Record<string, number>; canadian: Record<string, number> } {
  const all = tally(rows, (row) => row.klass);
  const canadian = tally(rows.filter((row) => row.canadian), (row) => row.klass);
  return { all, canadian };
}

function classTable(counts: Record<string, number>, denominator: number, classes: string[]): string[] {
  return [
    "| class | count | share |",
    "|---|---|---|",
    ...classes.map((name) => `| ${name} | ${counts[name] ?? 0} | ${share(counts[name] ?? 0, denominator)} |`),
  ];
}

export function buildRound2Report(inputs: {
  inventory: InventoryRow[];
  manifest: ManifestRow[];
  round1Manifest: ManifestRow[];
  coverage: Coverage;
  sources: Round2SourceList;
  candidates: CandidateRow[];
  candidateLog: CandidateLogRow[];
  licence: Record<string, string>;
  bytes: Record<string, unknown> | null;
}): string {
  const { inventory, manifest, round1Manifest, coverage, sources, candidates, candidateLog, licence } = inputs;

  const rowsAll = mergeRows(inventory, manifest, licence);
  const rowsBefore = mergeRows(inventory, round1Manifest, licence);
  const before = candidatesByCell(rowsBefore);
  const beforeUsable = usableByCell(rowsBefore);
  const after = candidatesByCell(rowsAll);
  const afterUsable = usableByCell(rowsAll);

  const manifestBySha = new Map(manifest.map((row) => [row.sha256, row]));
  const sourceById = new Map(sources.sources.map((source) => [source.id, source]));

  const out: string[] = [];
  out.push("# Harvest round 2 report — ODD coverage, harvest precision, source yield and remaining gaps");
  out.push("");
  out.push("Ticket: `Akamel01/AuditorAI#60` — Harvest round 2: free, wide search for public Canadian RSAs.");
  out.push("Parent map: `#41`. Predecessor: `#40` (PR #58, merged) — its report is `docs/RSA-Documents/track-a-harvest-report.md`.");
  out.push("");
  out.push("Inputs (committed, read-only, no network and no model call):");
  out.push(`- \`${INVENTORY}\` — the operator's checkout: ${inventory.length} inventoried rows`);
  out.push(`- \`${MANIFEST}\` — the intake manifest: ${manifest.length} rows (${round1Manifest.length} from round 1, ${manifest.length - round1Manifest.length} from round 2)`);
  out.push(`- \`${CANDIDATES}\` — the committed candidate list: ${candidates.length} candidate URLs`);
  out.push(`- \`${CANDIDATE_LOG}\` — the per-candidate outcome log: ${candidateLog.length} rows`);
  out.push(`- \`${SOURCES}\` — the round-2 source list of record`);
  out.push(`- \`${ODD}\` — the ODD targets and priorities`);
  out.push(`- \`${LICENCE}\` — the per-directory licence verdicts`);
  out.push(`- \`${BYTES}\` — the byte accounting for the 5 GB cap`);
  out.push("");
  out.push("This report carries no timestamp: `npx tsx scripts/harvest-track-a-round2-report.ts` regenerates it byte-identically.");
  out.push("");
  out.push("The counting rules are the round-1 rules, unchanged, so before and after are comparable:");
  out.push("- a document is identified by its **sha256**; a sha256 in both the inventory and the manifest is counted **once** and attributed to the **fetched** column;");
  out.push("- a **coverage candidate** is Canadian (one of the 13 `ca_province` codes, or `CAN-GOV`), tier **T3/T4**, and its stage maps to a canonical cell; **T0 and T1 never count as coverage**;");
  out.push("- a manifest-only row is classified from its tier (T3/T4 -> `rsa-sample`, T1 -> `methodology`, T0 -> `unusable`);");
  out.push("- a candidate whose licence is not **CLEAR** is counted but is **not usable** for train or test until the owner signs off.");
  out.push("");

  // ---- section 0: what round 2 did -------------------------------------------------
  const ingested = candidateLog.filter((row) => row.decision === "ingested");
  const newCoverage = rowsAll.filter(
    (row) => row.coverage_candidate && row.source === "fetched" && !rowsBefore.some((b) => b.sha256 === row.sha256),
  );
  out.push("## 0. What round 2 did");
  out.push("");
  const robotsRefused = candidateLog.filter((r) => r.reason.startsWith("robots")).length;
  const httpRefused = candidateLog.filter((r) => r.reason.startsWith("http ")).length;
  out.push(
    `- **${candidates.length}** candidate URLs were examined; every one was processed by the harvester under the robots, rate, hash and licence gates. **${robotsRefused}** were refused on robots grounds and **${httpRefused}** on an HTTP error before any bytes were fetched.`,
  );
  out.push(`- **${ingested.length}** documents were ingested (bytes written to the gitignored corpus shelf, rows appended to the intake manifest).`);
  out.push(`- **${newCoverage.length}** new coverage candidate(s) were created.`);
  out.push(
    `- The free-model pool was **not** used for triage. ${sources.discovery?.model_triage ?? "No pool was reachable from the runner."} Tier, stage, class and every coverage count are decided by the deterministic rules.`,
  );
  out.push("");

  // ---- section 1: AC1 coverage before and after -----------------------------------
  out.push("## 1. AC1 — ODD coverage versus the targets, before and after");
  out.push("");
  out.push("\"Before\" is the corpus at the round-1 state (the manifest rows without `round: \"2\"`); \"after\" is the same corpus with the round-2 rows added. The rule set is identical, so the two are comparable.");
  out.push("");
  out.push(
    "| ODD cell | target | priority | before have | after have | before usable (CLEAR) | after usable (CLEAR) | gap before | gap after | moved |",
  );
  out.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const cellKey of CANADIAN_CELLS) {
    const cell = coverage.cells.find((c) => c.cell_key === cellKey);
    const target = cell?.target ?? 0;
    const priority = cell?.priority ?? 0;
    const b = before[cellKey] ?? 0;
    const a = after[cellKey] ?? 0;
    out.push(
      `| \`${cellKey}\` | ${target} | ${priority} | ${b} | ${a} | ${beforeUsable[cellKey] ?? 0} | ${afterUsable[cellKey] ?? 0} | ${Math.max(0, target - b)} | ${Math.max(0, target - a)} | ${a > b ? `**yes (+${a - b})**` : "unchanged"} |`,
    );
  }
  out.push("");
  const priorityCells = coverage.cells
    .filter((c) => CANADIAN_CELLS.includes(c.cell_key))
    .sort((x, y) => y.priority - x.priority);
  out.push("**Priority cells** (from `state/odd-coverage.json`):");
  out.push("");
  for (const c of priorityCells) {
    const b = before[c.cell_key] ?? 0;
    const a = after[c.cell_key] ?? 0;
    out.push(
      `- \`${c.cell_key}\` — priority ${c.priority}, target ${c.target}: ${b} before, ${a} after — ${a > b ? `**moved** (+${a - b})` : "**unchanged**"}.`,
    );
  }
  out.push("");
  out.push(
    "`have` counts **documents**; the server-side `have_total` of `state/odd-coverage.json` counts ODD **packages** (`have_total` / `have_full_package`). The two counters measure different things and can disagree for the same cell — the round-1 report carries the same caveat.",
  );
  out.push("");
  if (newCoverage.length === 0) {
    out.push(
      "> **Honest zero.** Round 2 ingested documents but created **0 new coverage candidates**. The coverage table above is **unchanged**: no cell gap closed. The deliverable of this round is the precision, yield and gaps evidence below, not a coverage gain.",
    );
    out.push("");
  }

  // The near misses: Canadian T3/T4 documents that were ingested but did not
  // become coverage candidates. They say where the bottleneck is.
  const round2Shas = new Set(manifest.filter((r) => (r as { round?: string }).round === "2").map((r) => r.sha256));
  const t3Round2 = rowsAll.filter(
    (row) => round2Shas.has(row.sha256) && (row.tier === "T3" || row.tier === "T4") && !row.coverage_candidate,
  );
  const nearMisses = t3Round2.filter((row) => row.canadian);
  const notCanadian = t3Round2.length - nearMisses.length;
  out.push("### Near misses — Canadian T3/T4 documents that did not become coverage");
  out.push("");
  out.push(
    `A Canadian document is fetched and classified T3/T4 but still misses a cell. These are the documents a different stage vocabulary would unlock, so the reason is stated for each: it says where the bottleneck is — the search, the classifier, the stage vocabulary or the licence. (${notCanadian} further T3/T4 document(s) round 2 ingested were **not Canadian** and are counted as out-of-scope in the funnel, not here.)`,
  );
  out.push("");
  if (!nearMisses.length) {
    out.push("None: every Canadian T3/T4 document round 2 ingested is a coverage candidate.");
  } else {
    out.push("| document | tier | stage | province | why it is not coverage |");
    out.push("|---|---|---|---|---|");
    for (const row of nearMisses) {
      const m = manifest.find((r) => r.sha256 === row.sha256);
      const why =
        row.cell === null
          ? `stage \`${row.stage}\` maps to no canonical cell`
          : row.licence !== "CLEAR"
            ? `licence \`${row.licence}\` — counted, not usable`
            : "duplicate or blocked";
      out.push(
        `| ${cell((m?.title ?? row.sha256.slice(0, 16)).slice(0, 60))} | ${row.tier} | \`${row.stage}\` | ${row.jurisdiction || "—"} | ${why} |`,
      );
    }
  }
  out.push("");

  // ---- section 2: AC2 precision ----------------------------------------------------
  out.push("## 2. AC2 — Harvest precision per class");
  out.push("");
  const rowsBeforeA = rowsBefore.length;
  const rowsAfterA = rowsAll.length;
  const beforeCanadian = rowsBefore.filter((row) => row.canadian);
  const afterCanadian = rowsAll.filter((row) => row.canadian);
  out.push(
    `Two denominators, never mixed. **|A|** = every row on record (inventory rows + manifest rows whose sha256 the inventory does not hold): **${rowsBeforeA}** before, **${rowsAfterA}** after (**${rowsAfterA - rowsBeforeA >= 0 ? "+" : ""}${rowsAfterA - rowsBeforeA}**). **|B|** = the Canadian subset: **${beforeCanadian.length}** before, **${afterCanadian.length}** after (**${afterCanadian.length - beforeCanadian.length >= 0 ? "+" : ""}${afterCanadian.length - beforeCanadian.length}**).`,
  );
  out.push("");
  const beforeTables = classTables(rowsBefore);
  const afterTables = classTables(rowsAll);
  const CLASSES = ["rsa-sample", "methodology", "out-of-scope", "duplicate", "unusable"];
  out.push("### 2a — all rows (denominator |A'|)");
  out.push("");
  out.push(...classTable(afterTables.all, rowsAfterA, CLASSES));
  out.push("");
  out.push(
    `Round 1 held ${beforeTables.all["rsa-sample"] ?? 0} \`rsa-sample\` rows of ${rowsBeforeA}; round 2 holds ${afterTables.all["rsa-sample"] ?? 0} of ${rowsAfterA}.`,
  );
  out.push("");
  out.push("### 2b — Canadian in-scope rows (denominator |B'|)");
  out.push("");
  out.push(...classTable(afterTables.canadian, afterCanadian.length, CLASSES.filter((c) => c !== "out-of-scope")));
  out.push("");
  out.push(
    "`out-of-scope` exists only outside the Canadian subset, so it appears in 2a and not in 2b. A T0/T1 row is never a coverage candidate, and a methodology report is never an RSA sample.",
  );
  out.push("");
  out.push("### 2c — the round-2 funnel (denominator: candidate URLs examined)");
  out.push("");
  out.push("Precision for a harvest round is measured over the candidates examined, not over the corpus. The classes below are the funnel classes of this round; they are NOT the corpus class taxonomy of 2a/2b.");
  out.push("");
  const funnel: Record<string, number> = {
    "rsa-sample (ingested, Canadian, T3/T4, stage mapped)": 0,
    "rsa-sample (ingested, T3/T4 — not Canadian, or stage unmapped)": 0,
    methodology: 0,
    "unusable (T0)": 0,
    "out-of-scope": 0,
    "duplicate (fetch-time hash skip)": 0,
    "not-fetched": 0,
  };
  for (const row of candidateLog) {
    if (row.decision === "ingested") {
      const m = manifestBySha.get(row.sha256);
      if (!m) {
        funnel["out-of-scope"] += 1;
        continue;
      }
      const canadian = isCaProvince(m.ca_province);
      const mapped = MANIFEST_STAGE_TO_CELL[m.stage] !== undefined;
      if (m.tier === "T3" || m.tier === "T4") {
        if (canadian && mapped) funnel["rsa-sample (ingested, Canadian, T3/T4, stage mapped)"] += 1;
        else funnel["rsa-sample (ingested, T3/T4 — not Canadian, or stage unmapped)"] += 1;
      } else if (m.tier === "T1") {
        funnel["methodology"] += 1;
      } else {
        funnel["unusable (T0)"] += 1;
      }
      continue;
    }
    if (row.dedupe_status === "hash-already-present") {
      funnel["duplicate (fetch-time hash skip)"] += 1;
      continue;
    }
    if (row.reason === "not RSA") {
      funnel["out-of-scope"] += 1;
      continue;
    }
    funnel["not-fetched"] += 1;
  }
  const examined = candidateLog.length;
  out.push("| funnel class | count | share of candidates examined |");
  out.push("|---|---|---|");
  for (const [name, count] of Object.entries(funnel)) {
    out.push(`| ${name} | ${count} | ${share(count, examined)} |`);
  }
  out.push(`| **total** | **${Object.values(funnel).reduce((a, b) => a + b, 0)}** | ${share(Object.values(funnel).reduce((a, b) => a + b, 0), examined)} |`);
  out.push("");
  out.push(
    "A **fetch-time hash skip** is a document whose bytes were downloaded in full and then discarded: the known-hash gate runs after the response arrives, so the corpus never re-ingests it and never writes it to disk. It is a different mechanism from the round-1 `duplicate` class (an inventory copy) and the two numbers are never summed.",
  );
  out.push("");
  const skips = tally(candidateLog.filter((r) => r.decision !== "ingested"), (r) => r.reason || "none");
  out.push("Every candidate that was not ingested, by reason:");
  out.push("");
  out.push("| reason | candidates |");
  out.push("|---|---|");
  for (const [reason, count] of Object.entries(skips).sort()) out.push(`| ${reason} | ${count} |`);
  out.push("");

  // ---- section 2d: provenance and language ---------------------------------
  const round2Rows = manifest.filter((r) => (r as { round?: string }).round === "2");
  out.push("### 2d — where the tier and the stage came from, and the language split");
  out.push("");
  out.push(
    "A stage or a tier that falls back to a source hint is weaker evidence than one read out of the document, so the two are counted separately (the manifest carries `stage_source` and `tier_source` per row).",
  );
  out.push("");
  out.push("| provenance | stage | tier |");
  out.push("|---|---|---|");
  for (const [stageSource, tierSource] of [
    ["text", "text"],
    ["text", "doc_type_hint"],
    ["hint", "text"],
    ["hint", "doc_type_hint"],
  ]) {
    const n = round2Rows.filter(
      (r) => (r as { stage_source?: string }).stage_source === stageSource && (r as { tier_source?: string }).tier_source === tierSource,
    ).length;
    out.push(`| stage \`${stageSource}\` | tier \`${tierSource}\` | ${n} |`);
  }
  out.push("");
  const languages = tally(round2Rows, (r) => (r as { lang?: string }).lang ?? "unknown");
  out.push("Language of the round-2 documents:");
  out.push("");
  out.push("| language | documents |");
  out.push("|---|---|");
  for (const [lang, count] of Object.entries(languages).sort()) out.push(`| \`${lang}\` | ${count} |`);
  out.push("");
  out.push(
    "The language split is a **heuristic**, not a language model: `detectLang` counts English and French function words in the extracted text, so a short document can be mislabelled and a document with a French title and an English body is counted as English. No claim about French-language coverage rests on this alone.",
  );
  out.push("");

  // ---- section 3: AC3 source yield --------------------------------------------------
  out.push("## 3. AC3 — Source yield");
  out.push("");
  out.push(
    "Source **type** is the closed taxonomy of the round-2 source list. Every ingested document maps to exactly one type; no document is counted under two types and no sha256 is counted under two cells.",
  );
  out.push("");
  const attemptedTypes = new Set(
    candidates.map((c) => c.source_type ?? sourceById.get(c.source_id)?.source_type ?? "unknown"),
  );
  out.push("| source type | hosts tried | candidate URLs seen | candidates rejected | docs ingested | in-scope Canadian RSA T3/T4 | licence state of ingested | yield % |");
  out.push("|---|---|---|---|---|---|---|---|");
  for (const sourceType of SOURCE_TYPES) {
    const typeCandidates = candidates.filter(
      (c) => (c.source_type ?? sourceById.get(c.source_id)?.source_type) === sourceType,
    );
    if (!typeCandidates.length) continue;
    const urls = new Set(typeCandidates.map((c) => c.url));
    const logs = candidateLog.filter((row) => row.source_type === sourceType);
    const ingestedRows = logs.filter((row) => row.decision === "ingested");
    const inScope = ingestedRows.filter((row) => {
      const m = manifestBySha.get(row.sha256);
      if (!m) return false;
      return (
        isCaProvince(m.ca_province) &&
        (m.tier === "T3" || m.tier === "T4") &&
        MANIFEST_STAGE_TO_CELL[m.stage] !== undefined
      );
    });
    const hosts = new Set(typeCandidates.map((c) => new URL(c.url).host));
    const licences = [...new Set(ingestedRows.map((row) => manifestBySha.get(row.sha256)?.licence_verdict ?? "unknown"))];
    const examined = logs.length || typeCandidates.length;
    out.push(
      `| \`${sourceType}\` | ${hosts.size} | ${urls.size} | ${examined - ingestedRows.length} | ${ingestedRows.length} | ${inScope.length} | ${licences.length ? licences.join(", ") : "—"} | ${share(inScope.length, examined)} |`,
    );
  }
  out.push("");
  const unattempted = SOURCE_TYPES.filter((t) => !attemptedTypes.has(t));
  if (unattempted.length) {
    out.push(
      `Source types **not attempted** in round 2 (no candidate of that type was examined, so they are not listed as attempted): ${unattempted.map((t) => `\`${t}\``).join(", ")}.`,
    );
    out.push("");
  }
  out.push(
    "A source type that produced nothing still appears above with explicit zeros; a type that was never reached is named in the list above rather than given a fabricated row.",
  );
  out.push("");

  // ---- section 4: AC4 gaps ------------------------------------------------------------
  out.push("## 4. AC4 — The gaps free sources cannot fill (input for the ATIP fallback)");
  out.push("");
  out.push(
    "Each row names the family, the mechanism that still blocks it, how it was verified this round, the cells it costs, and the Track B (ATIP) ask. The Track B ask names a province, a stage and a document type, because the ODD cells are stage-keyed — an ask without a stage is not actionable.",
  );
  out.push("");
  out.push("| family | host | why still unfillable (mechanism) | how it was verified this round | cells affected | Track B (ATIP) ask: province + stage + document type + issuing body |");
  out.push("|---|---|---|---|---|---|");
  // How each family was verified this round, derived from the candidate log:
  // a claim about what was examined must be backed by a row in the log.
  const seenFor = (pattern: RegExp): number =>
    candidateLog.filter((row) => pattern.test(row.url)).length;
  const ingestedFor = (pattern: RegExp): number =>
    candidateLog.filter((row) => pattern.test(row.url) && row.decision === "ingested").length;
  const familyCheck = (
    pattern: RegExp,
    hosts: string,
    outcome: string,
  ): string => {
    const seen = seenFor(pattern);
    const got = ingestedFor(pattern);
    return `re-attempted: ${seen} candidate(s) on ${hosts} were examined this round and ${got} were ingested — ${outcome}`;
  };
  const verification: Record<string, string> = {
    "Quebec provincial (Ville de Quebec / Quebec government)":
      familyCheck(/transports\.gouv\.qc\.ca/, "the ministry's document library", "the library is reachable and was harvested; `www.quebec.ca` itself still answers 403 to a neutral UA"),
    "Ottawa (open data portal)":
      familyCheck(/documents\.ottawa\.ca/, "the City's document host", "the portal is still a JS-only single page application, but the City's document host served the council documents directly"),
    "Ottawa (eSCRIBE meeting documents)":
      `re-attempted: ${seenFor(/escribemeetings/)} candidate(s) on an eSCRIBE host were examined this round — the meeting list is a JS bundle with no server-rendered index, and the round found no document URL there`,
    "Manitoba open data portal":
      "not re-attempted: `data.gov.mb.ca` is a retired portal (DNS NXDOMAIN) and Manitoba is a candidate held-out geography, so it is left to the split rule",
    "Manitoba government":
      "not re-attempted: Manitoba is a candidate held-out test geography, so it is deliberately left to the split rule rather than harvested into train",
    "Saskatchewan open data":
      "not re-attempted: the portal is retired (DNS NXDOMAIN) and no replacement index is published",
    "Saskatchewan government":
      `re-attempted: ${seenFor(/saskatchewan\.ca/)} candidate(s) on a Saskatchewan host were examined this round — the ministry publishes no document index, and no RSA document was reachable`,
    "MRDC / MUNIAC (University of Manitoba transportation research)":
      "not re-attempted: the host does not resolve (DNS NXDOMAIN) and the entity appears nowhere in the corpus",
    "Prince Edward Island, Newfoundland and Labrador, and the territories":
      `re-attempted: ${seenFor(/\.ca\//)} Canadian candidate(s) were examined this round and none came from a PE, NL, YT, NWT or NU host — no provincial index for those jurisdictions is reachable`,
    "Pre-opening stage audits (all provinces)":
      `re-attempted: ${seenFor(/pre-opening|pre_opening/)} candidate(s) name a pre-opening audit and ${ingestedFor(/pre-opening|pre_opening/)} were ingested, but \`ca-tac:pre-opening\` has no canonical stage, so none can enter a cell. This is a structural gap, not a search failure`,
    "Montreal open data (Ville de Montreal)":
      `re-attempted: ${seenFor(/montreal/)} candidate(s) on a Montreal host were examined this round — the CKAN API is robots-disallowed and the catalogue is client-rendered, so no Montreal document was reachable`,
    "City of Toronto":
      `re-attempted: ${seenFor(/toronto\.ca/)} candidate(s) on a Toronto host were examined this round — the sitemap index covers only the WordPress tree and the agenda service answers 403, so no Toronto document was reachable`,
    "UNB Transportation Group / MRDC":
      familyCheck(/unb\.ca/, "the University's host", "the host answered this round (the earlier \"temporarily unavailable\" page was transient) and two UNB documents were fetched, one of them a hash skip"),
  };
  for (const family of sources.unfillable) {
    const cells = CANADIAN_CELLS.map((key) => {
      const have = after[key] ?? 0;
      return have > 0 ? null : key;
    }).filter((x): x is string => x !== null);
    const ask = ATIP_ASKS[family.family] ?? "Ask the issuing body for the completed RSA report (including the designer/owner response appendix) at each stage: planning, preliminary design, detailed design and pre-opening — for every municipality and highway project in the province, filed under the road safety audit / audit de sécurité routière programme.";
    out.push(
      `| ${cell(family.family)} | ${family.host ?? "—"} | ${cell(family.reason)} | ${verification[family.family] ?? "carried forward from round 1; not re-attempted in round 2"} | ${cells.length ? cells.join(", ") : "—"} | ${cell(ask)} |`,
    );
  }
  out.push("");

  // ---- section 5: provenance and limits ------------------------------------------------
  out.push("## 5. Provenance, limits and what round 2 could not do");
  out.push("");
  out.push("### Discovery channels");
  out.push("");
  const byChannel = tally(candidates, (c) => c.discovery_channel ?? "unknown");
  out.push("| discovery channel | candidates |");
  out.push("|---|---|");
  for (const [channel, count] of Object.entries(byChannel).sort()) out.push(`| ${channel} | ${count} |`);
  out.push("");
  out.push(
    "**A general web search was not available to a robots-compliant, keyless, free runner from this environment.** Every engine either disallows `/search` for generic agents in its robots.txt (`www.bing.com`, `www.ecosia.org`), answers with a CAPTCHA or an anti-bot challenge (`html.duckduckgo.com`, `www.startpage.com`, `www.mojeek.com`, `searx.be`), or needs a paid API key (agent-reach's Exa backend). The full channel table is in `.autoforge/execution/M1.md`. The `operator-discovery-pass` candidates were therefore located during the operator's discovery pass and are **not reproducible by the committed script**; every one of them is fetched by the harvester from its origin host under the robots, rate, hash and licence gates. Closing that gap needs one thing: a free `EXA_API_KEY`, which enables the repo's existing `agent-reach-search` provider with no new code.",
  );
  out.push("");
  out.push("### The 5 GB cap");
  out.push("");
  if (inputs.bytes) {
    const b = inputs.bytes as unknown as {
      cap_bytes: number;
      per_document_cap_bytes: number;
      corpus_bytes_before: number;
      corpus_bytes_after: number;
      downloaded_this_round: number;
      skipped_for_cap: string[];
    };
    out.push(
      `- cap ${b.cap_bytes} bytes (5 GiB) over the whole corpus on the runner, per document at most ${b.per_document_cap_bytes} bytes (100 MiB); the corpus held ${b.corpus_bytes_before} bytes before this round and ${b.corpus_bytes_after} after; ${b.downloaded_this_round} bytes were downloaded; ${b.skipped_for_cap?.length ?? 0} candidate(s) were refused with reason \`byte-cap\`.`,
    );
  } else {
    out.push("- no byte-accounting file was written: the round never ran.");
  }
  out.push("");
  out.push("### What this round could not do");
  out.push("");
  out.push("- It could not run a general web search (see above), so the search space is the two channels, not the whole web.");
  out.push("- It could not filter the MTQ document library by title: `bv.transports.gouv.qc.ca/mono/` publishes 6511 PDFs under opaque numeric names with no index, so a sweep of it is a budget question, not a search question.");
  out.push("- It did not use a model for triage: the free-model pool does not resolve from the runner.");
  out.push("- It did not harvest Manitoba, and it did not change the split rule: the code holds QC + AB as the test geography, and Manitoba is left to the split rule.");
  out.push(
    "- It did not extend the **English** stage vocabulary. Two Canadian T3 documents (the OC Transpo `Transitway Station Design Safety Audit` and the UNB conference paper) name no stage word the classifier recognises, so they land in `UNSTAGED` / `PRE_OPENING` and never reach a cell. The stage vocabulary — not the search — is the bottleneck for those documents. Mapping `Station Design Safety Audit` to a stage is ambiguous between preliminary and detailed design, and changing the rule set would invalidate the before/after comparison of this report, so it belongs in its own ticket.",
  );
  out.push(
    "- It **did** extend the **French** stage vocabulary, and this is disclosed because it is a rule change: `STAGE_RULES` now matches `préliminaire`, `détaillé`, `avant ouverture`, `en service`, `planification` and `étude de faisabilité`. Without it a French RSA falls back to the source hint (`UNSTAGED`) and silently vanishes from the corpus. The change affects only documents whose text is French, and it left the committed round-1 report byte-identical — the round-1 rows are English and their stages are unchanged (verified: `git diff --exit-code -- docs/RSA-Documents/track-a-harvest-report.md`).",
  );
  out.push("");
  out.push(
    "The manifest, the inventory, the licence register and the candidate list are the inputs; nothing in this report is computed from an uncommitted file, and regenerating it leaves the committed file byte-identical.",
  );
  out.push("");
  return out.join("\n");
}

/** The Track B (ATIP) ask per unfillable family. */
const ATIP_ASKS: Record<string, string> = {
  "Quebec provincial (Ville de Quebec / Quebec government)":
    "Quebec — all stages (planning, preliminary design, detailed design, pre-opening) — completed road safety audit reports (audit de sécurité routière) including the designer/owner response appendix, for every project in the MTQ road network: Ministere des Transports et de la Mobilite.",
  "Ottawa (open data portal)":
    "Ontario — all stages — completed road safety audit reports for City of Ottawa road projects, with the designer/owner response appendix: City of Ottawa, Clerk's office.",
  "Ottawa (eSCRIBE meeting documents)":
    "Ontario — all stages — completed road safety audit reports filed as council agenda appendices: City of Ottawa.",
  "Manitoba open data portal":
    "Manitoba — all stages — completed road safety audit reports for provincial highway and municipal road projects, with the designer/owner response appendix: Manitoba Transportation and Infrastructure.",
  "Manitoba government":
    "Manitoba — all stages — completed road safety audit reports for provincial highway and municipal road projects, with the designer/owner response appendix: Manitoba Transportation and Infrastructure.",
  "Saskatchewan open data":
    "Saskatchewan — all stages — completed road safety audit reports for provincial highway and municipal road projects, with the designer/owner response appendix: Saskatchewan Ministry of Government and Public Services / Ministry of Transportation.",
  "Saskatchewan government":
    "Saskatchewan — all stages — completed road safety audit reports for provincial highway and municipal road projects, with the designer/owner response appendix: Saskatchewan Ministry of Transportation.",
  "MRDC / MUNIAC (University of Manitoba transportation research)":
    "Manitoba — all stages — completed road safety audit reports and the studies that carry them: Manitoba Transportation and Infrastructure, and the University of Manitoba transportation research group (MRDC/MUNIAC).",
  "Prince Edward Island, Newfoundland and Labrador, and the territories":
    "PE, NL, YT, NT, NU — all stages — completed road safety audit reports for provincial highway and municipal road projects, with the designer/owner response appendix: the respective provincial Departments of Transportation.",
  "Pre-opening stage audits (all provinces)":
    "All provinces — pre-opening stage — completed pre-opening road safety audit reports (including the designer/owner response appendix) for every project opened to traffic, plus the ODD cell definition for the pre-opening stage, which does not exist yet.",
  "Montreal open data (Ville de Montreal)":
    "Quebec — all stages — completed road safety audit reports for City of Montreal street projects, with the designer/owner response appendix: Ville de Montreal, Service des transports.",
  "City of Toronto":
    "Ontario — all stages — completed road safety audit reports filed as city council agenda appendices (the /legdocs/mmis/ background files), with the designer/owner response appendix: City of Toronto, City Clerk.",
  "UNB Transportation Group / MRDC":
    "New Brunswick — all stages — completed road safety audit reports published by the UNB Transportation Group: University of New Brunswick.",
};

function main(): void {
  const inventory = readJsonl<InventoryRow>(INVENTORY);
  const manifest = readJsonl<ManifestRow>(MANIFEST);
  const round1Manifest = manifest.filter((row) => (row as { round?: string }).round !== "2");
  const coverage = readJson<Coverage>(ODD, { cells: [] });
  const sources = readJson<Round2SourceList>(SOURCES, { sources: [], unfillable: [] });
  const candidateFile = readJson<{ candidates: CandidateRow[] }>(CANDIDATES, { candidates: [] });
  const licence = parseLicenceRegister(readFileSync(path.join(REPO, LICENCE), "utf8"));
  const bytes = readJson<Record<string, unknown> | null>(BYTES, null);

  let candidateLog: CandidateLogRow[] = [];
  const logPath = path.join(REPO, CANDIDATE_LOG);
  if (existsSync(logPath)) {
    const lines = readFileSync(logPath, "utf8").split("\n").slice(1).filter((l) => l.trim());
    candidateLog = lines.map((line) => {
      const cells = line.split("\t");
      return {
        source_id: cells[0] ?? "",
        source_type: cells[1] ?? "",
        url: cells[2] ?? "",
        http_status: cells[3] ?? "",
        bytes: cells[4] ?? "",
        sha256: cells[5] ?? "",
        decision: cells[6] ?? "",
        reason: cells[7] ?? "",
        dedupe_status: cells[8] ?? "",
        stage_source: cells[9] ?? "",
        tier_source: cells[10] ?? "",
      };
    });
  }

  const report = buildRound2Report({
    inventory,
    manifest,
    round1Manifest,
    coverage,
    sources,
    candidates: candidateFile.candidates,
    candidateLog,
    licence,
    bytes,
  });
  const target = path.join(REPO, "docs/RSA-Documents/track-a-round2-harvest-report.md");
  writeFileSync(target, report);
  console.log(`wrote ${path.relative(REPO, target)} (${report.length} bytes)`);
}

// Run only when executed directly, so tests can import the pure helpers.
if (process.argv[1] && path.basename(process.argv[1]) === path.basename(__filename)) {
  main();
}
