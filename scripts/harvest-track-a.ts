#!/usr/bin/env node
// Track A harvester for GitHub issue #40 (Akamel01/AuditorAI).
//
//   npx tsx scripts/harvest-track-a.ts fetch     # public, no-login Canadian RSA documents
//   npx tsx scripts/harvest-track-a.ts intake    # manifests + registers (tracked outputs)
//   npx tsx scripts/harvest-track-a.ts report    # coverage table + unfillable cells
//   npx tsx scripts/harvest-track-a.ts selftest  # offline invariant checks
//
// Rules (ticket #40): public/free/no-login only, robots.txt honoured, at most
// 1 request/second per host, quality over count, licence verdict recorded for
// every document, geography-based train/test split, binaries never enter git.
//
// The parent plan docs/RSA-Documents/HARVESTING_PLAN.md is absent from the repo;
// the source list of record is docs/RSA-Documents/track-a-sources.json.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { withHostBudget } from "../src/discovery/ratelimit.js";
import { crawlDelayMs, isAllowed, robotsFor, HARVEST_USER_AGENT } from "../src/discovery/robots.js";

const REPO = process.cwd();
const MANIFEST_PATH = "docs/RSA-Documents/track-a-sources.json";
/** The round-2 source list of record (ticket #60). */
const MANIFEST_PATH_ROUND2 = "docs/RSA-Documents/track-a-round2-sources.json";
/** The committed round-2 candidate list: one row per candidate URL examined. */
const CANDIDATES_PATH_ROUND2 = "docs/RSA-Documents/track-a-round2-candidates.json";
/** The per-candidate outcome log: one row per candidate URL examined. */
const CANDIDATE_LOG_ROUND2 = "docs/RSA-Documents/track-a-round2-candidate-log.tsv";
/** The byte accounting file: how the 5 GB cap was spent. */
const BYTES_JSON_ROUND2 = "docs/RSA-Documents/track-a-round2-bytes.json";
const CORPUS_ROOT = process.env.TRACK_A_CORPUS_ROOT ?? "docs/RSA-Documents";
const STAGING = path.join(CORPUS_ROOT, ".track-a", "fetched.jsonl");
const STAGING_ROUND2 = path.join(CORPUS_ROOT, ".track-a", "fetched-round2.jsonl");
const LOG_TSV = path.join(CORPUS_ROOT, "canadian-download-log.tsv");
const INTAKE_JSONL = path.join(CORPUS_ROOT, "canada-intake-manifest.jsonl");
const SPLIT_JSON = path.join(CORPUS_ROOT, "track-a-split.json");
const COVERAGE_MD = path.join(CORPUS_ROOT, "track-a-coverage.md");
/** The round-2 fetched-only coverage view (ticket #60). */
const COVERAGE_MD_ROUND2 = path.join(CORPUS_ROOT, "track-a-round2-coverage.md");
const DUPLICATES_JSON = path.join(CORPUS_ROOT, "track-a-duplicates.json");
/** The round-2 duplicates register (ticket #60). */
const DUPLICATES_JSON_ROUND2 = path.join(CORPUS_ROOT, "track-a-round2-duplicates.json");
const DEDUPE_INDEX = path.join(CORPUS_ROOT, "dedupe-index.json");
const LICENSE_REGISTER = path.join(CORPUS_ROOT, "LICENSE-REGISTER.md");
const QUARANTINE_MD = path.join(CORPUS_ROOT, "QUARANTINE.md");
const ODD_COVERAGE = "state/odd-coverage.json";

/** Train/test geography: held-out provinces never train (grilling.md A2/A3). */
export const TEST_PROVINCES: string[] = ["QC", "AB"];

/**
 * The 5 GB corpus cap (ticket #60) and the per-document cap. The cap is
 * cumulative over the corpus on the runner, not per round: a single 400 MiB
 * scan must not eat the budget.
 */
export const BYTE_CAP_BYTES = 5 * 1024 * 1024 * 1024;
export const PER_DOCUMENT_CAP_BYTES = 100 * 1024 * 1024;

/** The candidate-log columns (ticket #60, one row per candidate examined). */
export const CANDIDATE_LOG_COLUMNS = [
  "source_id",
  "source_type",
  "url",
  "http_status",
  "bytes",
  "sha256",
  "decision",
  "reason",
  "dedupe_status",
  "stage_source",
  "tier_source",
] as const;

export const TSV_COLUMNS = [
  "project_id",
  "sha256",
  "tier",
  "stage",
  "cell_key",
  "ca_province",
  "lang",
  "split",
  "doc_type",
  "source_url",
  "licence_verdict",
  "fetched_at",
  "bytes",
  "local_path",
] as const;

interface LicenceDefault {
  verdict: "CLEAR" | "RESTRICTED" | "BLOCKED";
  basis: string;
  licence_ref: string;
}

export interface Source {
  id: string;
  host: string;
  family: string;
  strategy:
    | "known-document-url"
    | "sitemap-keyword"
    | "atom-dataset-listing"
    | "html-listing-pdf"
    | "candidate-list";
  listing_url: string | null;
  alternate_index?: string;
  known_document_urls?: string[];
  url_keywords?: string[];
  feed_keywords?: string[];
  document_url_template?: string | null;
  /** How many listing/detail pages a listing strategy may open. */
  max_listing_pages?: number;
  /** Upper bound on candidate URLs a listing strategy may return. */
  max_candidates?: number;
  robots_hint: string;
  licence_default: LicenceDefault;
  stage_hint: string;
  ca_province_hint: string;
  doc_type_hint: string;
  expected_yield_estimate: number;
  max_downloads?: number;
  /** The closed source-type taxonomy (round 2, ticket #60). */
  source_type?: string;
}

/**
 * One candidate URL examined by a round-2 fetch, with the attributes the
 * discovery pass resolved for it: the licence of the host it lives on, the
 * province hint and the document-type hint. A search returns candidates from
 * many hosts, so these cannot live on the source entry.
 */
export interface CandidateRow {
  url: string;
  source_id: string;
  source_type?: string;
  title_hint?: string;
  query?: string;
  discovery_channel?: string;
  province_hint?: string;
  stage_hint?: string;
  doc_type_hint?: string;
  licence_verdict?: string;
  licence_basis?: string;
  licence_ref?: string;
}

interface CandidatesFile {
  schema_version: string;
  ticket: string;
  candidates: CandidateRow[];
}

let candidateCache: Map<string, CandidateRow> | null = null;

/** Every committed round-2 candidate, keyed by URL. */
export function candidateRows(): Map<string, CandidateRow> {
  if (candidateCache) return candidateCache;
  const map = new Map<string, CandidateRow>();
  const file = path.join(REPO, CANDIDATES_PATH_ROUND2);
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as CandidatesFile;
      for (const row of parsed.candidates ?? []) map.set(row.url, row);
    } catch {
      // an unreadable candidate file must not stop the harvest
    }
  }
  candidateCache = map;
  return map;
}

interface Unfillable {
  family: string;
  host: string | null;
  reason: string;
  track_input: string;
}

interface Manifest {
  schema_version: string;
  user_agent: string;
  sources: Source[];
  unfillable: Unfillable[];
}

export interface IntakeRecord {
  project_id: string;
  sha256: string;
  tier: string;
  stage: string;
  cell_key: string;
  ca_province: string;
  lang: string;
  split: string;
  doc_type: string;
  source_url: string;
  licence_verdict: string;
  licence_basis: string;
  licence_ref: string;
  track: string;
  missing_side_note: string;
  title: string;
  fetched_at: string;
  bytes: number;
  local_path: string;
  source_id: string;
  /** Which harvest round produced the row ("1" for the pre-round-2 rows). */
  round?: string;
  /** Where the stage came from: the document's text or the source's hint. */
  stage_source?: string;
  /** Where the tier came from: the document's text or the source's doc-type hint. */
  tier_source?: string;
}

function loadManifest(round = 1): Manifest {
  const rel = round === 2 ? MANIFEST_PATH_ROUND2 : MANIFEST_PATH;
  return JSON.parse(readFileSync(path.join(REPO, rel), "utf8")) as Manifest;
}

/**
 * Why a manifest source entry is unusable, or null when it is complete.
 * A partial or missing entry is rejected here, so the fetch round skips it
 * with a reason instead of crashing on a missing field.
 */
export function sourceEntryProblem(source: Partial<Source> | null | undefined): string | null {
  if (!source || typeof source !== "object") return "missing entry";
  if (!source.id) return "missing id";
  if (!source.host) return "missing host";
  if (!source.strategy) return "missing strategy";
  if (!source.licence_default?.verdict) return "missing licence_default.verdict";
  if (source.strategy === "known-document-url") {
    if (!source.known_document_urls?.length) return "missing known_document_urls";
  } else if (source.strategy === "candidate-list") {
    // the candidate URLs live in the committed candidate list, not here
  } else if (!source.listing_url) {
    return `missing listing_url for the ${source.strategy} strategy`;
  }
  return null;
}

/**
 * Serialise the corpus dedupe index in the file's existing format (one key per
 * line at column 0, as written by the corpus python scripts). Re-serialising
 * the 333 existing rows must produce the same bytes - only new rows append.
 */
export function serializeDedupeIndex(rows: Array<Record<string, unknown>>): string {
  const body = rows
    .map((row) => `{\n${Object.entries(row)
      .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
      .join(",\n")}\n}`)
    .join(",\n");
  return `[\n${body}\n]`;
}

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(path.join(REPO, rel), "utf8")) as T;
}

/** Why a document that is already on disk is not fetched again. */
export const HASH_SKIP_REASON = "hash-already-present";

let knownHashCache: Set<string> | null = null;

/**
 * Every sha256 the corpus already holds: the on-disk inventory (the operator
 * checkout), the corpus dedupe index and the corpus catalog. A document whose
 * sha256 is in this set is never downloaded again and never enters the intake
 * manifest.
 */
export function knownHashes(): Set<string> {
  if (knownHashCache) return knownHashCache;
  const set = new Set<string>();
  const add = (sha: unknown): void => {
    if (typeof sha === "string" && sha.length > 32) set.add(sha);
  };
  const inventory = path.join(REPO, CORPUS_ROOT, "track-a-ondisk-inventory.jsonl");
  if (existsSync(inventory)) {
    for (const line of readFileSync(inventory, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        add((JSON.parse(line) as { sha256?: string }).sha256);
      } catch {
        // a malformed inventory row must not stop the harvest
      }
    }
  }
  for (const rel of [DEDUPE_INDEX, "docs/RSA-Documents/corpus-catalog.json"]) {
    const file = path.join(REPO, rel);
    if (!existsSync(file)) continue;
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as
        | Array<Record<string, unknown>>
        | { records?: Array<Record<string, unknown>> };
      const rows = Array.isArray(parsed) ? parsed : (parsed.records ?? []);
      for (const row of rows) add(row?.sha256);
    } catch {
      // an unreadable index must not stop the harvest
    }
  }
  knownHashCache = set;
  return set;
}

/** The skip reason for a document the corpus already holds, or null. */
export function hashSkipReason(sha256: string, known: Set<string>): string | null {
  return known.has(sha256) ? HASH_SKIP_REASON : null;
}

function sha256Hex(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** 16 hex chars (64 bits) - the project id format the work order requires. */
function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---- discovery -----------------------------------------------------------------

/**
 * Fetches a listing page. The path is robots-checked first and the host's
 * crawl-delay is honoured before every request, so a CKAN-style host is never
 * hit faster than its robots.txt allows.
 */
async function fetchText(url: string): Promise<string | null> {
  try {
    const robots = await robotsFor(url);
    if (!isAllowed(robots, new URL(url).pathname)) return null;
    const delay = crawlDelayMs(robots) ?? 0;
    if (delay) await sleep(delay);
    const res = await withHostBudget(url, () =>
      fetch(url, { headers: { "user-agent": HARVEST_USER_AGENT } }),
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Absolute URLs of the .pdf links on an HTML page. */
function pdfLinksOn(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)) {
    out.push(new URL(m[1], base).toString());
  }
  return out;
}

/**
 * The candidate URLs a source offers. Exported so the round-2 discovery
 * script can run the same robots-checked listing strategies the fetch round
 * uses - one implementation, one set of rules.
 */
export async function enumerateSource(source: Source): Promise<string[]> {
  return candidatesFor(source);
}

async function candidatesFor(source: Source): Promise<string[]> {
  if (source.strategy === "known-document-url") return source.known_document_urls ?? [];

  // candidate-list: the URLs come from the committed round-2 candidate list,
  // so discovery stays separate from fetching (the candidate list is the
  // auditable record of what was examined).
  if (source.strategy === "candidate-list") {
    const rows = candidateRows();
    return [...rows.values()].filter((r) => r.source_id === source.id).map((r) => r.url);
  }

  if (source.strategy === "sitemap-keyword") {
    const seeds = [source.listing_url, source.alternate_index].filter(
      (u): u is string => typeof u === "string",
    );
    const found: string[] = [];
    const keep = (url: string): void => {
      if (!/\.pdf(\?|$)/i.test(url)) return;
      if (source.url_keywords?.length && !source.url_keywords.some((k) => url.toLowerCase().includes(k))) {
        return;
      }
      if (!found.includes(url)) found.push(url);
    };
    const pageBudget = source.max_listing_pages ?? 12;
    const cap = source.max_candidates ?? 400;
    let opened = 0;
    const queue = [...seeds];
    while (queue.length && opened < pageBudget && found.length < cap) {
      const seed = queue.shift() as string;
      const body = await fetchText(seed);
      opened += 1;
      if (!body) continue;
      const locs = (body.match(/<loc>[^<]+<\/loc>/g) ?? []).map((l) => l.replace(/<\/?loc>/g, ""));
      for (const loc of locs) keep(loc);
      // a sitemap index points at more sitemaps - follow them (bounded).
      if (body.includes("<sitemapindex")) {
        for (const sub of locs.filter((l) => l.endsWith(".xml"))) queue.push(sub);
      }
    }
    return found;
  }

  // html-listing-pdf: a server-rendered index page links to detail pages, and
  // the detail pages carry the document URLs. Faceted (query-string) links are
  // skipped: their crawl space is unbounded (see the robots.txt of the CKAN
  // hosts) and they never carry documents.
  if (source.strategy === "html-listing-pdf") {
    if (!source.listing_url) return [];
    const listing = await fetchText(source.listing_url);
    if (!listing) return [];
    const pageBudget = source.max_listing_pages ?? 8;
    const detail: string[] = [];
    const out: string[] = [];
    for (const m of listing.matchAll(/href="([^"]+)"/gi)) {
      const href = m[1];
      if (href.includes("?")) continue;
      const abs = new URL(href, source.listing_url).toString();
      if (/\.pdf(\?|$)/i.test(abs)) {
        if (!out.includes(abs)) out.push(abs);
        continue;
      }
      if (source.url_keywords?.length && !source.url_keywords.some((k) => abs.toLowerCase().includes(k))) {
        continue;
      }
      if (!detail.includes(abs)) detail.push(abs);
    }
    for (const page of detail.slice(0, pageBudget)) {
      const body = await fetchText(page);
      if (!body) continue;
      for (const pdf of pdfLinksOn(body, page)) if (!out.includes(pdf)) out.push(pdf);
    }
    return out;
  }

  // atom-dataset-listing: the feed is server rendered; dataset pages carry the files.
  const feed = source.listing_url ? await fetchText(source.listing_url) : null;
  if (!feed) return [];
  const slugs: string[] = [];
  for (const entry of feed.split("<entry>")) {
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const href = entry.match(/<link[^>]+href="([^"]*\/dataset\/[^"]+)"/)?.[1];
    if (!href) continue;
    if (source.feed_keywords?.length) {
      const lower = title.toLowerCase();
      if (!source.feed_keywords.some((k) => lower.includes(k.toLowerCase()))) continue;
    }
    slugs.push(new URL(href, "https://donnees.montreal.ca").toString());
  }
  const unique = [...new Set(slugs)];
  const out: string[] = [];
  for (const slug of unique.slice(0, 60)) {
    const page = await fetchText(slug);
    if (!page) continue;
    for (const pdf of pdfLinksOn(page, slug)) out.push(pdf);
  }
  return out;
}

// ---- classification (mechanical; no model needed) --------------------------------

/** Split at intake: geography first, licence gate second. Never train nor test. */
export function splitFor(province: string, licenceVerdict: string): string {
  if (licenceVerdict === "CLEAR") return TEST_PROVINCES.includes(province) ? "test" : "train";
  return licenceVerdict === "BLOCKED" ? "quarantine" : "restricted";
}

/** Splits a document may never be filed under. */
const NON_TRAINABLE_SPLITS = new Set(["restricted", "quarantine"]);

/**
 * Province -> split map for the intake manifest. The split of a province is
 * splitFor(province, licence verdict), so a document whose licence is not CLEAR
 * never lands in train or test.
 */
export function splitByProvince(
  records: Array<Pick<IntakeRecord, "ca_province" | "licence_verdict" | "source_url">>,
): Record<string, { split: string; docs: string[] }> {
  const map: Record<string, { split: string; docs: string[] }> = {};
  for (const r of records) {
    const key = r.ca_province;
    const split = splitFor(key, r.licence_verdict);
    map[key] ??= { split, docs: [] };
    // a province that mixes verdicts keeps the most restrictive label
    if (NON_TRAINABLE_SPLITS.has(split) && !NON_TRAINABLE_SPLITS.has(map[key].split)) {
      map[key].split = split;
    }
    map[key].docs.push(r.source_url);
  }
  return map;
}

const STAGE_RULES: Array<[RegExp, string]> = [
  [/pre-?opening|avant\s+ouverture|en\s+service/i, "PRE_OPENING"],
  [/stage\s*3|detailed design|d[ée]taill[ée]e?\b/i, "DETAILED_DESIGN"],
  [/stage\s*2|preliminary design|pr[ée]liminaire/i, "PRELIMINARY_DESIGN"],
  [/stage\s*1|planning stage|functional plan|planification|[ée]tude de faisabilit[ée]/i, "FEASIBILITY_CONCEPT"],
];

const CANONICAL_STAGE: Record<string, string> = {
  FEASIBILITY_CONCEPT: "canada:FEASIBILITY_CONCEPT",
  PRELIMINARY_DESIGN: "canada:PRELIMINARY_DESIGN",
  DETAILED_DESIGN: "canada:DETAILED_DESIGN",
};

/**
 * The stage and where it came from: `text` when a stage rule matched the
 * document's own words, `hint` when the source's fallback was used. A French
 * RSA must not vanish into UNSTAGED, so the rules carry French vocabulary too.
 */
export function detectStageWithSource(
  text: string,
  hint: string,
): { stage: string; source: "text" | "hint" } {
  const head = text.slice(0, 8000);
  const hits = STAGE_RULES.filter(([re]) => re.test(head)).map(([, stage]) => stage);
  const distinct = [...new Set(hits)];
  // A document naming several stages is not one cell's document.
  if (distinct.length > 1) return { stage: "MULTI_STAGE", source: "text" };
  if (distinct.length === 1) return { stage: distinct[0], source: "text" };
  return { stage: hint, source: "hint" };
}

export function detectStage(text: string, hint: string): string {
  return detectStageWithSource(text, hint).stage;
}

export function detectLang(text: string): string {
  const fr = (text.match(/\b(le|la|les|des|sécurité|routière|audit|rapport)\b/gi) ?? []).length;
  const en = (text.match(/\b(the|and|safety|audit|report|road)\b/gi) ?? []).length;
  return fr > en ? "fr" : "en";
}

export function detectProvince(text: string, hint: string): string {
  const names: Record<string, RegExp> = {
    AB: /\bAlberta\b/i,
    BC: /\bBritish Columbia\b/i,
    QC: /\bQu[ée]bec\b|\bMontr[ée]al\b|\bVille de Montr[ée]al\b/i,
    ON: /\bOntario\b/i,
    NB: /\bNew Brunswick\b/i,
    MB: /\bManitoba\b/i,
    SK: /\bSaskatchewan\b/i,
  };
  let best = { code: hint, at: Number.MAX_SAFE_INTEGER };
  for (const [code, re] of Object.entries(names)) {
    const m = re.exec(text);
    if (m && m.index < best.at) best = { code, at: m.index };
  }
  return best.code;
}

// Tier signals, calibrated against the documents Track A actually fetched
// (see .autoforge/discovery/ for the corpus tiers they must agree with).
const RSA_SUBJECT = /road safety audit|audit de s[ée]curit[ée] routi[èe]re/i;
const REPORT_SIGNAL =
  /\breport on\b|report on (the )?(planning|preliminary|detailed|pre-?opening) stage|audit report|safety audit report|audit of the\b|we are pleased to submit/i;
const POLICY_SIGNAL = /road safety audit (\(rsa\) )?(policy|guidelines)|\bpurpose\b[^.]{0,80}\bpolicy\b/i;
const SUBJECT_LINE = /\b(?:SUBJECT|TITLE|RE)\s*:\s*([^\n]{0,200})/i;
const OUTCOME_SIGNAL = /post-?implementation|follow-?up audit|outcomes? of the (audit|rsa) (programme|program)/i;
const CASE_STUDY = /case stud(y|ies)/i;

/** The document's own subject region: its subject line, else its first 600 characters. */
export function subjectRegion(text: string): string {
  const head = text.slice(0, 600);
  const m = SUBJECT_LINE.exec(head);
  return m ? m[1] : head;
}

const CITATION = /(?:see|refer to|in accordance with|per|under|following|described in)\s+[^.\n]{0,60}$/i;

/**
 * A document is about RSA when its own subject line or title says so - a
 * passing citation of another circular is not a subject.
 */
export function isRsaDocument(text: string): boolean {
  const head = text.slice(0, 2000);
  const subject = /(?:^|\n)\s*(?:SUBJECT|RE|TITLE)\s*:\s*([^\n]{0,150})/i.exec(head);
  if (subject && RSA_SUBJECT.test(subject[1])) return true;
  if (REPORT_SIGNAL.test(head)) return true;
  for (const m of head.matchAll(new RegExp(RSA_SUBJECT.source, "gi"))) {
    const before = head.slice(Math.max(0, m.index - 60), m.index);
    if (!CITATION.test(before)) return true;
  }
  return false;
}

export function detectTier(text: string, docType: string): string {
  return detectTierWithSource(text, docType).tier;
}

/**
 * The tier and where it came from: `text` when the document's own signals
 * decided it, `doc_type_hint` when the source's declared document type forced
 * T3 (the harvester's fallback, not a reading of the document).
 */
export function detectTierWithSource(
  text: string,
  docType: string,
): { tier: string; source: "text" | "doc_type_hint" } {
  const head = text.slice(0, 4000);
  if (!isRsaDocument(text)) return { tier: "T0", source: "text" };
  if (OUTCOME_SIGNAL.test(head)) return { tier: "T4", source: "text" };
  // Guidelines carrying case studies are complete material (corpus anchor T3).
  if (CASE_STUDY.test(text)) return { tier: "T3", source: "text" };
  // A policy or guidelines document states the process; it is not an audit package.
  // Only the subject region counts - a bibliography entry does not.
  if (POLICY_SIGNAL.test(subjectRegion(text))) return { tier: "T1", source: "text" };
  if (REPORT_SIGNAL.test(head)) return { tier: "T3", source: "text" };
  if (docType === "complete-RSA") return { tier: "T3", source: "doc_type_hint" };
  return { tier: "T1", source: "text" };
}


export function missingSideNote(text: string): string {
  if (/designer response|response to (the )?(audit|findings)|owner response/i.test(text)) {
    return "complete: designer/owner response present";
  }
  return "missing: no designer/owner response section detected";
}

export function projectKeyFor(url: string, source: Source): string {
  const u = new URL(url);
  const segs = u.pathname.split("/").filter(Boolean);
  // A project is the deepest directory holding the file, so sibling documents of
  // one multi-document project share the key and therefore the project id.
  const projectDir = segs.slice(0, Math.max(0, segs.length - 1)).join("/");
  if (source.strategy === "known-document-url" && /\/dataset\//.test(u.pathname)) {
    const i = segs.indexOf("dataset");
    if (i >= 0 && segs[i + 1]) return segs[i + 1];
  }
  return (projectDir || u.hostname).toLowerCase();
}

// ---- fetch ---------------------------------------------------------------------

/**
 * The bytes the corpus already holds on this runner: the manifests' byte
 * columns plus whatever is on disk under the corpus shelves. The 5 GB cap is
 * measured against this, so the cap is cumulative over the corpus.
 */
export function corpusBytes(): number {
  let total = 0;
  for (const rel of [INTAKE_JSONL, "docs/RSA-Documents/canadian-download-log.tsv"]) {
    const file = path.join(REPO, rel);
    if (!existsSync(file)) continue;
    if (rel.endsWith(".jsonl")) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          total += Number((JSON.parse(line) as { bytes?: number }).bytes ?? 0);
        } catch {
          // a malformed row must not stop the harvest
        }
      }
    } else {
      const lines = readFileSync(file, "utf8").split("\n").slice(1);
      for (const line of lines) {
        const cells = line.split("\t");
        total += Number(cells[12] ?? 0);
      }
    }
  }
  return total;
}

/** The licence, province, stage and doc-type a candidate carries, if known. */
function attributesFor(url: string, source: Source) {
  const row = candidateRows().get(url);
  return {
    licence: {
      verdict: row?.licence_verdict ?? source.licence_default.verdict,
      basis: row?.licence_basis ?? source.licence_default.basis,
      licence_ref: row?.licence_ref ?? source.licence_default.licence_ref,
    },
    provinceHint: row?.province_hint || source.ca_province_hint,
    stageHint: row?.stage_hint || source.stage_hint,
    docTypeHint: row?.doc_type_hint ?? source.doc_type_hint,
    sourceType: row?.source_type ?? source.source_type ?? "",
  };
}

async function runFetch(argv: string[]): Promise<void> {
  const round = Number(argv.find((a) => a.startsWith("--round="))?.slice("--round=".length) ?? 1);
  const manifest = loadManifest(round);
  const only = argv.find((a) => a.startsWith("--source="))?.slice("--source=".length);
  const limit = Number(argv.find((a) => a.startsWith("--max="))?.slice("--max=".length) ?? 8);
  const staging = round === 2 ? STAGING_ROUND2 : STAGING;
  mkdirSync(path.dirname(path.join(REPO, staging)), { recursive: true });
  const known = knownHashes();

  // The 5 GB cap is enforced before a byte is written (ticket #60).
  const corpusBytesBefore = corpusBytes();
  let remainingBudget = Math.max(0, BYTE_CAP_BYTES - corpusBytesBefore);
  let downloadedThisRound = 0;
  const skippedForCap: string[] = [];
  const logRows: string[] = [];

  for (const source of manifest.sources) {
    const problem = sourceEntryProblem(source);
    if (problem) {
      console.log(`skip (invalid source entry ${source?.id ?? "?"}): ${problem}`);
      continue;
    }
    if (only && source.id !== only) continue;
    const urls = await candidatesFor(source);
    const cap = Math.min(limit, source.max_downloads ?? limit);
    console.log(`[${source.id}] ${urls.length} candidate url(s), cap ${cap}`);

    let downloaded = 0;
    const skipped: Record<string, number> = {};
    const skip = (reason: string): void => {
      skipped[reason] = (skipped[reason] ?? 0) + 1;
    };
    for (const url of urls) {
      if (downloaded >= cap) break;
      const attrs = attributesFor(url, source);
      const logRow = (fields: Record<string, string | number>): void => {
        if (round !== 2) return;
        logRows.push(
          CANDIDATE_LOG_COLUMNS.map((c) => String(fields[c] ?? "")).join("\t"),
        );
      };
      const robots = await robotsFor(url);
      if (!isAllowed(robots, new URL(url).pathname)) {
        const reason = `robots${robots.skipReason ? ` (${robots.skipReason})` : ""}`;
        skip(reason);
        console.log(`  skip (robots): ${url}${robots.skipReason ? ` (${robots.skipReason})` : ""}`);
        logRow({
          source_id: source.id,
          source_type: attrs.sourceType,
          url,
          http_status: 0,
          bytes: 0,
          sha256: "",
          decision: "skipped",
          reason,
          dedupe_status: "not-fetched",
          stage_source: "",
          tier_source: "",
        });
        continue;
      }
      const delay = crawlDelayMs(robots) ?? 0;
      if (delay) await sleep(delay);
      let bytes: Uint8Array;
      let status = 0;
      try {
        const res = await withHostBudget(url, () =>
          fetch(url, { headers: { "user-agent": HARVEST_USER_AGENT } }),
        );
        status = res.status;
        if (!res.ok) {
          skip(`http ${res.status}`);
          console.log(`  skip (http ${res.status}): ${url}`);
          logRow({
            source_id: source.id,
            source_type: attrs.sourceType,
            url,
            http_status: res.status,
            bytes: 0,
            sha256: "",
            decision: "skipped",
            reason: `http ${res.status}`,
            dedupe_status: "not-fetched",
            stage_source: "",
            tier_source: "",
          });
          continue;
        }
        // The byte cap is checked before the body is read, when the server
        // declares a length; otherwise it is checked after the read.
        const declared = Number(res.headers.get("content-length") ?? "0");
        const allowed = Math.min(remainingBudget, PER_DOCUMENT_CAP_BYTES);
        if (declared > 0 && declared > allowed) {
          skip("byte-cap");
          skippedForCap.push(url);
          console.log(`  skip (byte-cap): ${url} (${declared} bytes > ${allowed})`);
          logRow({
            source_id: source.id,
            source_type: attrs.sourceType,
            url,
            http_status: status,
            bytes: 0,
            sha256: "",
            decision: "skipped",
            reason: "byte-cap",
            dedupe_status: "not-fetched",
            stage_source: "",
            tier_source: "",
          });
          continue;
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.length < 5 || new TextDecoder().decode(buf.slice(0, 5)) !== "%PDF-") {
          skip("not a pdf");
          console.log(`  skip (not a pdf): ${url}`);
          logRow({
            source_id: source.id,
            source_type: attrs.sourceType,
            url,
            http_status: status,
            bytes: buf.length,
            sha256: "",
            decision: "skipped",
            reason: "not a pdf",
            dedupe_status: "not-fetched",
            stage_source: "",
            tier_source: "",
          });
          continue;
        }
        bytes = buf;
      } catch (err) {
        skip("fetch error");
        console.log(`  skip (fetch error): ${url} ${err instanceof Error ? err.message : err}`);
        logRow({
          source_id: source.id,
          source_type: attrs.sourceType,
          url,
          http_status: status,
          bytes: 0,
          sha256: "",
          decision: "skipped",
          reason: "fetch error",
          dedupe_status: "not-fetched",
          stage_source: "",
          tier_source: "",
        });
        continue;
      }

      // The corpus already holds this document: never write it, never stage it.
      const sha = sha256Hex(bytes);
      const dup = hashSkipReason(sha, known);
      if (dup) {
        skip(dup);
        console.log(`  skip (${dup}): ${url}`);
        logRow({
          source_id: source.id,
          source_type: attrs.sourceType,
          url,
          http_status: status,
          bytes: bytes.length,
          sha256: sha,
          decision: "skipped",
          reason: dup,
          dedupe_status: dup,
          stage_source: "",
          tier_source: "",
        });
        continue;
      }

      // The cap is re-checked before the write: a document that would take the
      // corpus past 5 GB, or that is over the 100 MiB per-document cap, is
      // discarded, never written and never ingested.
      if (bytes.length > Math.min(remainingBudget, PER_DOCUMENT_CAP_BYTES)) {
        skip("byte-cap");
        skippedForCap.push(url);
        console.log(
          `  skip (byte-cap): ${url} (${bytes.length} bytes > ${Math.min(remainingBudget, PER_DOCUMENT_CAP_BYTES)})`,
        );
        logRow({
          source_id: source.id,
          source_type: attrs.sourceType,
          url,
          http_status: status,
          bytes: bytes.length,
          sha256: sha,
          decision: "skipped",
          reason: "byte-cap",
          dedupe_status: "not-fetched",
          stage_source: "",
          tier_source: "",
        });
        continue;
      }

      let text = "";
      try {
        // getDocumentProxy transfers the buffer, so extract from a copy and keep
        // the original bytes for the file write and the sha256.
        const pdf = await getDocumentProxy(bytes.slice());
        const out = await extractText(pdf, { mergePages: true });
        text = out.text;
      } catch {
        skip("no text layer");
        console.log(`  skip (no text layer): ${url}`);
        logRow({
          source_id: source.id,
          source_type: attrs.sourceType,
          url,
          http_status: status,
          bytes: bytes.length,
          sha256: sha,
          decision: "skipped",
          reason: "no text layer",
          dedupe_status: "new",
          stage_source: "",
          tier_source: "",
        });
        continue;
      }

      if (!isRsaDocument(text)) {
        skip("not RSA");
        console.log(`  skip (not RSA): ${url}`);
        logRow({
          source_id: source.id,
          source_type: attrs.sourceType,
          url,
          http_status: status,
          bytes: bytes.length,
          sha256: sha,
          decision: "skipped",
          reason: "not RSA",
          dedupe_status: "new",
          stage_source: "",
          tier_source: "",
        });
        continue;
      }

      const stage = detectStageWithSource(text, attrs.stageHint);
      const tier = detectTierWithSource(text, attrs.docTypeHint);
      const province = detectProvince(text, attrs.provinceHint);
      const licence = attrs.licence;
      const split = splitFor(province, licence.verdict);
      const projectId = `PRJ-${shortHash(`${source.id}|${projectKeyFor(url, source)}`)}`;
      const fileName = path.basename(new URL(url).pathname) || "document.pdf";
      const shelf =
        licence.verdict === "BLOCKED" ? "quarantine/track-a" : "canada/track-a";
      const localRel = path.posix.join(CORPUS_ROOT, shelf, source.id, fileName);
      const abs = path.join(REPO, localRel);
      mkdirSync(path.dirname(abs), { recursive: true });
      try {
        writeFileSync(abs, bytes);
      } catch (err) {
        // A full disk must not abort the round: the document is skipped.
        skip("write error");
        console.log(`  skip (write error): ${url} ${err instanceof Error ? err.message : err}`);
        logRow({
          source_id: source.id,
          source_type: attrs.sourceType,
          url,
          http_status: status,
          bytes: bytes.length,
          sha256: sha,
          decision: "skipped",
          reason: "write error",
          dedupe_status: "new",
          stage_source: "",
          tier_source: "",
        });
        continue;
      }
      remainingBudget -= bytes.length;
      downloadedThisRound += bytes.length;

      const record: IntakeRecord = {
        project_id: projectId,
        sha256: sha,
        tier: tier.tier,
        stage: stage.stage,
        cell_key: CANONICAL_STAGE[stage.stage] ?? "",
        ca_province: province,
        lang: detectLang(text),
        split,
        doc_type: attrs.docTypeHint,
        source_url: url,
        licence_verdict: licence.verdict,
        licence_basis: licence.basis,
        licence_ref: licence.licence_ref,
        track: "A",
        missing_side_note: missingSideNote(text),
        title: (text.split("\n").find((l) => l.trim().length > 8) ?? fileName).trim().slice(0, 160),
        fetched_at: new Date().toISOString(),
        bytes: bytes.length,
        local_path: localRel,
        source_id: source.id,
        round: String(round),
        stage_source: stage.source,
        tier_source: tier.source,
      };
      appendFileSync(path.join(REPO, staging), `${JSON.stringify(record)}\n`);
      downloaded += 1;
      logRow({
        source_id: source.id,
        source_type: attrs.sourceType,
        url,
        http_status: status,
        bytes: bytes.length,
        sha256: sha,
        decision: "ingested",
        reason: "",
        dedupe_status: "new",
        stage_source: stage.source,
        tier_source: tier.source,
      });
      console.log(
        `  ok: ${fileName} (${bytes.length} bytes, ${record.tier}, ${record.stage}, ${province}, ${split})`,
      );
    }
    const summary = Object.entries(skipped)
      .map(([reason, n]) => `${reason}=${n}`)
      .join(", ");
    console.log(`[${source.id}] fetched ${downloaded}, skipped ${summary || "none"}`);
  }

  if (round === 2) {
    writeFileSync(
      path.join(REPO, CANDIDATE_LOG_ROUND2),
      `${CANDIDATE_LOG_COLUMNS.join("\t")}\n${logRows.join("\n")}\n`,
    );
    writeFileSync(
      path.join(REPO, BYTES_JSON_ROUND2),
      `${JSON.stringify(
        {
          schema_version: "1.0.0",
          ticket: "Akamel01/AuditorAI#60",
          note: "The 5 GB cap is cumulative over the corpus on the runner, not per round; a single document may not exceed 100 MiB. Both limits are enforced before any byte is written to disk.",
          cap_bytes: BYTE_CAP_BYTES,
          per_document_cap_bytes: PER_DOCUMENT_CAP_BYTES,
          corpus_bytes_before: corpusBytesBefore,
          downloaded_this_round: downloadedThisRound,
          corpus_bytes_after: corpusBytesBefore + downloadedThisRound,
          remaining_bytes: remainingBudget,
          skipped_for_cap: skippedForCap,
        },
        null,
        2,
      )}\n`,
    );
  }
}

// ---- intake --------------------------------------------------------------------

function readStaging(file = STAGING): IntakeRecord[] {
  if (!existsSync(path.join(REPO, file))) return [];
  return readFileSync(path.join(REPO, file), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as IntakeRecord);
}

/** The intake manifest rows on disk - the source of truth for the split map. */
function readIntakeManifest(): IntakeRecord[] {
  if (!existsSync(path.join(REPO, INTAKE_JSONL))) return [];
  return readFileSync(path.join(REPO, INTAKE_JSONL), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as IntakeRecord);
}

function runIntake(argv: string[]): void {
  const round = Number(argv.find((a) => a.startsWith("--round="))?.slice("--round=".length) ?? 1);
  const staging = round === 2 ? STAGING_ROUND2 : STAGING;
  const records = readStaging(staging);
  if (!records.length) {
    console.log("no staged records - run `fetch` first");
    return;
  }
  const manifest = loadManifest(round);
  const dedupe = readJson<Array<Record<string, unknown>>>(DEDUPE_INDEX);
  const knownSha = new Set(dedupe.map((r) => String(r.sha256 ?? "")));
  const existingLog = existsSync(path.join(REPO, LOG_TSV))
    ? new Set(readFileSync(path.join(REPO, LOG_TSV), "utf8").split("\n").slice(1).map((l) => l.split("\t")[1]))
    : new Set<string>();

  const knownPath = new Map(dedupe.map((r) => [String(r.sha256 ?? ""), String(r.path ?? "")]));
  // the committed manifest rows, read before the fresh ones are appended
  const existingRecords = readIntakeManifest();
  const fresh: IntakeRecord[] = [];
  const duplicates: Array<{ source_url: string; sha256: string; reason: string; existing_path: string }> = [];
  // Round 2: the duplicates are the fetch-time hash skips. They never reach
  // staging (the gate runs before staging), so they are read from the
  // candidate log. Such a document was downloaded in full and then discarded.
  if (round === 2 && existsSync(path.join(REPO, CANDIDATE_LOG_ROUND2))) {
    const knownPath = new Map(dedupe.map((r) => [String(r.sha256 ?? ""), String(r.path ?? "")]));
    const lines = readFileSync(path.join(REPO, CANDIDATE_LOG_ROUND2), "utf8").split("\n").slice(1);
    for (const line of lines) {
      const cells = line.split("\t");
      const [, , url, , , sha, decision, , dedupeStatus] = cells;
      if (decision !== "skipped" || dedupeStatus !== HASH_SKIP_REASON) continue;
      duplicates.push({
        source_url: url ?? "",
        sha256: sha ?? "",
        reason: "downloaded in full and then discarded: the corpus already holds this sha256",
        existing_path: knownPath.get(sha ?? "") ?? "",
      });
    }
  }
  for (const r of records) {
    if (knownSha.has(r.sha256)) {
      // Round 2 only: a staged row that is already in the dedupe index was
      // ingested by an earlier run of THIS round, not by the corpus, so it is
      // not a corpus duplicate. It is excluded from the fresh set (never
      // ingested twice) and it does not enter the round-2 register.
      if (round === 1) {
        duplicates.push({
          source_url: r.source_url,
          sha256: r.sha256,
          reason: "sha256 already in the corpus dedupe index",
          existing_path: knownPath.get(r.sha256) ?? "",
        });
      }
    } else if (existingLog.has(r.sha256)) {
      if (round === 1) {
        duplicates.push({
          source_url: r.source_url,
          sha256: r.sha256,
          reason: "sha256 already in canadian-download-log.tsv",
          existing_path: "",
        });
      }
    } else {
      fresh.push(r);
    }
  }
  writeFileSync(
    path.join(REPO, round === 2 ? DUPLICATES_JSON_ROUND2 : DUPLICATES_JSON),
    `${JSON.stringify(
      {
        schema_version: "1.0.0",
        ticket: round === 2 ? "Akamel01/AuditorAI#60" : "Akamel01/AuditorAI#40",
        note:
          round === 2
            ? "Round 2 documents that were NOT ingested because their sha256 is already in the corpus. The known-hash gate runs after the bytes arrive, so each of these was downloaded in full and then discarded - never re-ingested, never written to disk."
            : "Documents fetched by Track A that were not ingested because their sha256 is already in the corpus.",
        duplicates,
      },
      null,
      2,
    )}\n`,
  );

  // 1. download log (TSV, one row per document). With no fresh document the
  //    log stays byte-identical.
  if (fresh.length) {
    const logLines = fresh.map((r) => TSV_COLUMNS.map((c) => String(r[c])).join("\t")).join("\n");
    if (existsSync(path.join(REPO, LOG_TSV))) {
      writeFileSync(path.join(REPO, LOG_TSV), `${readFileSync(path.join(REPO, LOG_TSV), "utf8")}${logLines}\n`);
    } else {
      writeFileSync(path.join(REPO, LOG_TSV), `${TSV_COLUMNS.join("\t")}\n${logLines}\n`);
    }
  }

  // 2. intake manifest (JSONL, the source of truth for the coverage table)
  if (fresh.length) {
    const manifestLines = fresh.map((r) => JSON.stringify(r)).join("\n");
    writeFileSync(
      path.join(REPO, INTAKE_JSONL),
      existsSync(path.join(REPO, INTAKE_JSONL))
        ? `${readFileSync(path.join(REPO, INTAKE_JSONL), "utf8")}${manifestLines}\n`
        : `${manifestLines}\n`,
    );
  }

  // 3. split manifest: province -> split, per document. It is derived from the
  //    FULL intake manifest (the committed rows plus the fresh ones), so an
  //    intake run that ingests nothing cannot lose the committed rows.
  const splitMap = splitByProvince([...existingRecords, ...fresh]);
  const splitDoc = {
    schema_version: "1.0.0",
    ticket: "Akamel01/AuditorAI#40",
    note: "the corpus split map; round 2 (ticket Akamel01/AuditorAI#60) appends documents to the same map",
    test_provinces: TEST_PROVINCES,
    rule: "test = QC + held-out prairie province (AB); train = every other province; licence verdict != CLEAR never enters train or test",
    by_province: splitMap,
  };
  writeFileSync(path.join(REPO, SPLIT_JSON), `${JSON.stringify(splitDoc, null, 2)}\n`);

  // 4. corpus dedupe index: keep the existing shape, add project_id + split
  const added: Array<Record<string, unknown>> = [];
  for (const r of fresh) {
    const row: Record<string, unknown> = {
      canonical_id: r.project_id,
      path: r.local_path.replace(`${CORPUS_ROOT}/`, ""),
      sha256: r.sha256,
      bytes: r.bytes,
      source_url: r.source_url,
      project_id: r.project_id,
      split: r.split,
    };
    dedupe.push(row);
    added.push(row);
  }
  writeFileSync(path.join(REPO, DEDUPE_INDEX), serializeDedupeIndex(dedupe));

  // 5. licence register: one row per source directory. A source that was
  //    ATTEMPTED gets a row even when it yielded nothing, so its licence
  //    basis is on record (ticket #60). The verdict is the most restrictive
  //    among the documents the directory actually holds; a directory with
  //    none falls back to the source's declared default.
  let register = readFileSync(path.join(REPO, LICENSE_REGISTER), "utf8");
  const today = new Date().toISOString().slice(0, 10);
  const attempted = new Set<string>();
  if (round === 2 && existsSync(path.join(REPO, CANDIDATE_LOG_ROUND2))) {
    for (const line of readFileSync(path.join(REPO, CANDIDATE_LOG_ROUND2), "utf8").split("\n").slice(1)) {
      const id = line.split("\t")[0];
      if (id) attempted.add(id);
    }
  }
  const contributing = new Set(fresh.map((r) => r.source_id));
  for (const source of manifest.sources) {
    if (!contributing.has(source.id) && !attempted.has(source.id)) continue;
    const dir = `canada/track-a/${source.id}`;
    if (register.includes(`| ${dir} |`)) continue;
    const docs = fresh.filter((r) => r.source_id === source.id);
    const licence = source.licence_default;
    let verdict = licence.verdict;
    let basis = licence.basis;
    let ref = licence.licence_ref;
    if (docs.length) {
      // the most restrictive verdict among the documents the directory holds
      const order: Record<string, number> = { CLEAR: 0, RESTRICTED: 1, BLOCKED: 2 };
      const start = {
        verdict: licence.verdict as "CLEAR" | "RESTRICTED" | "BLOCKED",
        basis: licence.basis,
        ref: licence.licence_ref,
      };
      let worst = start;
      for (const r of docs) {
        if ((order[r.licence_verdict] ?? 0) > (order[worst.verdict] ?? 0)) {
          worst = {
            verdict: r.licence_verdict as "CLEAR" | "RESTRICTED" | "BLOCKED",
            basis: r.licence_basis,
            ref: r.licence_ref,
          };
        }
      }
      verdict = worst.verdict;
      basis = worst.basis;
      ref = worst.ref;
    }
    register = `${register.trimEnd()}\n| ${dir} | ${verdict} | ${basis} (${ref}) | ${today} |\n`;
  }
  writeFileSync(path.join(REPO, LICENSE_REGISTER), register);

  // 6. quarantine register for documents whose terms forbid reuse
  const blocked = fresh.filter((r) => r.licence_verdict === "BLOCKED");
  if (blocked.length) {
    let quarantine = readFileSync(path.join(REPO, QUARANTINE_MD), "utf8");
    for (const r of blocked) {
      const dir = `canada/track-a/${r.source_id}`;
      if (quarantine.includes(`- ${dir}/`)) continue;
      quarantine = `${quarantine.trimEnd()}\n\n- ${dir}/ — status: QUARANTINE; assignee: AutoForge; resolved: —; reason: ${r.licence_basis}; date: ${today}\n  ## Resolution\n  Pending owner sign-off.\n`;
    }
    writeFileSync(path.join(REPO, QUARANTINE_MD), quarantine);
  }

  console.log(`ingested ${fresh.length} new document(s), ${duplicates.length} duplicate(s) skipped`);
  for (const d of duplicates) console.log(`  duplicate: ${d.source_url} (${d.reason})`);
}

// ---- report --------------------------------------------------------------------

/**
 * Hazard H3: binaries fetched by a container run live in that container, not in
 * the operator's checkout. Every regeneration of the coverage report carries it.
 */
export const H3_BINARIES_NOTE =
  "Binaries fetched by this run live in the box-runner container (`docs/RSA-Documents/canada/track-a/**`, gitignored) - they are **not** in the operator's checkout (`/Users/akamel/Documents/AuditorAI`).";

function runReport(argv: string[]): void {
  const round = Number(argv.find((a) => a.startsWith("--round="))?.slice("--round=".length) ?? 1);
  const manifest = loadManifest(round);
  const records = readIntakeManifest().filter((r) => round === 2 || r.round !== "2");
  const coverage = readJson<{ cells: Array<{ cell_key: string; target: number; label: string; priority: number }> }>(
    ODD_COVERAGE,
  );
  const caCells = coverage.cells.filter((c) => c.cell_key.startsWith("canada:"));

  const rows = caCells.map((cell) => {
    const fetched = records.filter((r) => r.cell_key === cell.cell_key).length;
    const complete = records.filter((r) => r.cell_key === cell.cell_key && r.tier === "T3").length;
    return { cell: cell.cell_key, target: cell.target, fetched, complete, priority: cell.priority };
  });
  // Documents that name no single stage belong to no cell; they are reported apart.
  const unstaged = records.filter((r) => r.cell_key === "");

  const bySplit: Record<string, number> = {};
  for (const r of records) bySplit[r.split] = (bySplit[r.split] ?? 0) + 1;

  const duplicates = existsSync(path.join(REPO, DUPLICATES_JSON))
    ? readJson<{ duplicates: Array<{ source_url: string; sha256: string; reason: string; existing_path: string }> }>(
        DUPLICATES_JSON,
      ).duplicates
    : [];

  const unfilled = caCells
    .filter((c) => !records.some((r) => r.cell_key === c.cell_key))
    .map((c) => `- \`${c.cell_key}\` — 0 documents fetched. Sources that cannot fill it: see the unfillable list below.`);

  const md = [
    "# Track A coverage (ticket #40)",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Targets come from `state/odd-coverage.json` (cells[].target).",
    "Fetched = documents in `canada-intake-manifest.jsonl` whose cell_key matches, never the server-side have_total.",
    "",
    H3_BINARIES_NOTE,
    "",
    "| ODD cell | target | fetched | complete (T3) | priority |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.cell} | ${r.target} | ${r.fetched} | ${r.complete} | ${r.priority} |`),
    "",
    "## Priority cells (ticket #40)",
    "",
    "- rural + existing + complete + French",
    "- transit + urban + complete",
    "- pre-opening + complete",
    "- PE, NL and the territories",
    "",
    "The rural/urban, existing/new and language axes do not exist in the corpus taxonomy",
    "(`docs/RSA-Documents/corpus-schema.md`), so these cells are reported as free-text notes",
    "against the ODD cells above; see `track-a-sources.json` -> `unfillable` for the",
    "source families that Track A cannot reach.",
    "",
    "## Cells Track A could not fill",
    "",
    unfilled.length ? unfilled.join("\n") : "- (none)",
    "",
    "## Unfillable source families (input for Track B and Track C)",
    "",
    "| family | host | reason | track input |",
    "| --- | --- | --- | --- |",
    ...manifest.unfillable.map((u) => `| ${u.family} | ${u.host ?? "-"} | ${u.reason} | ${u.track_input} |`),
    "",
    "## Documents not mapped to a single ODD cell",
    "",
    "| stage | tier | documents |",
    "| --- | --- | --- |",
    ...[...new Set(unstaged.map((r) => r.stage))].map(
      (stage) =>
        `| ${stage} | ${unstaged.filter((r) => r.stage === stage).map((r) => r.tier).join(", ")} | ${unstaged.filter((r) => r.stage === stage).length} |`,
    ),
    "",
    "These documents are policy, guideline or multi-stage material: they state the RSA",
    "process rather than report one audit, so they are not counted as cell coverage.",
    "",
    "## Fetched but not ingested (duplicates)",
    "",
    duplicates.length
      ? [
          "| document | sha256 | reason | already in corpus |",
          "| --- | --- | --- | --- |",
          ...duplicates.map(
            (d) =>
              `| ${d.source_url.split("/").pop()} | \`${d.sha256.slice(0, 16)}…\` | ${d.reason} | \`${d.existing_path || "-"}\` |`,
          ),
        ].join("\n")
      : "- (none)",
    "",
    "## Split summary",
    "",
    "| split | documents |",
    "| --- | --- |",
    ...Object.entries(bySplit).map(([k, v]) => `| ${k} | ${v} |`),
    "",
    `Test geography: ${TEST_PROVINCES.join(", ")}. No document appears in both train and test.`,
    "",
  ].join("\n");
  const coveragePath = round === 2 ? COVERAGE_MD_ROUND2 : COVERAGE_MD;
  writeFileSync(path.join(REPO, coveragePath), md);
  console.log(md);
}

// ---- selftest ------------------------------------------------------------------

/**
 * The three documents Track A fetched before the known-hash rule existed. They
 * are in the corpus dedupe index by construction (intake claimed them), so the
 * "no manifest row may carry a hash the corpus already had" check has to
 * exempt exactly these.
 */
export const LEGACY_SHA256 = [
  "0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95",
  "84a70638ba6077885b2c17f94b36554cea4e65f9f001f7d0f8e1c1d0632a245b",
  "555848f63c690810661d7837b766ccb611f97ebe313a942bd413704745e947aa",
];

function selftest(): void {
  const failures: string[] = [];
  const check = (ok: boolean, label: string): void => {
    if (!ok) failures.push(label);
    console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  };

  const manifest = loadManifest();
  check(manifest.sources.length > 0, "manifest lists allowlisted sources");
  check(
    manifest.sources.every((s) => !/\/api\//.test(s.listing_url ?? "") && !s.listing_url?.startsWith("/")),
    "no listing_url points at a robots-disallowed /api/ path or a root-relative path",
  );
  check(
    manifest.sources.every((s) => !(s.listing_url ?? "").includes("/api/")),
    "no source uses a robots-disallowed /api/ listing",
  );
  check(
    new Set(manifest.sources.map((s) => s?.id)).size === manifest.sources.length,
    "every source id is unique",
  );
  const invalid = manifest.sources.filter((s) => sourceEntryProblem(s) !== null);
  check(
    invalid.length === 0,
    `every source entry is complete (${
      invalid.map((s) => `${s?.id ?? "?"}: ${sourceEntryProblem(s)}`).join("; ") || "none invalid"
    })`,
  );
  check(manifest.unfillable.length > 0, "unfillable source families are listed");
  check(
    manifest.unfillable.some((u) => /Quebec provincial/i.test(u.family)),
    "Quebec provincial is listed as unfillable (403)",
  );

  // known-hash rule: nothing already on disk may be fetched again
  const known = knownHashes();
  check(known.size > 0, "the known-hash set is not empty");
  check(
    hashSkipReason("0".repeat(64), known) === null,
    "an unknown sha256 is not skipped",
  );
  const sample = [...known][0];
  check(
    hashSkipReason(sample, known) === HASH_SKIP_REASON,
    "a sha256 already on disk is skipped with hash-already-present",
  );
  const inventory = path.join(REPO, CORPUS_ROOT, "track-a-ondisk-inventory.jsonl");
  const invSha = existsSync(inventory)
    ? (JSON.parse(readFileSync(inventory, "utf8").split("\n")[0]) as { sha256: string }).sha256
    : "";
  check(
    invSha.length === 64 && known.has(invSha),
    "the on-disk inventory sha256 is in the known-hash set",
  );

  // split invariant: no document in both train and test
  if (existsSync(path.join(REPO, SPLIT_JSON))) {
    const split = readJson<{ by_province: Record<string, { split: string; docs: string[] }> }>(SPLIT_JSON);
    const train = new Set<string>();
    const test = new Set<string>();
    for (const [province, entry] of Object.entries(split.by_province)) {
      for (const doc of entry.docs) (entry.split === "train" ? train : test).add(doc);
      if (entry.split === "train" && TEST_PROVINCES.includes(province)) failures.push(`${province} is test geography but in train`);
    }
    const overlap = [...train].filter((d) => test.has(d));
    check(overlap.length === 0, "no document is in both train and test");
  } else {
    console.log("skip split check (no split file yet)");
  }

  // tier ladder: never mint T2
  if (existsSync(path.join(REPO, INTAKE_JSONL))) {
    const records = readIntakeManifest();
    check(records.every((r) => r.tier !== "T2"), "no document is tier T2");
    check(records.every((r) => r.project_id && r.split && r.stage), "every record has project_id, split and stage");
    // no document fetched now may carry a hash the corpus already held
    const stray = records.filter((r) => known.has(r.sha256) && !LEGACY_SHA256.includes(r.sha256));
    check(
      stray.length === 0,
      `no manifest row carries a hash the corpus already held (${stray.length} stray)`,
    );
  } else {
    console.log("skip intake checks (no intake manifest yet)");
  }

  // no corpus binaries tracked by git
  const tracked = execFileSync("git", ["ls-files", "docs/RSA-Documents"], { cwd: REPO, encoding: "utf8" });
  check(
    !tracked.split("\n").some((f) => f.startsWith("docs/RSA-Documents/canada/track-a/")),
    "no Track A corpus binary is tracked by git",
  );

  if (failures.length) {
    console.error(`\nselftest FAILED (${failures.length}): ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log("\nselftest passed");
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "selftest";
  const rest = process.argv.slice(3);
  if (cmd === "fetch") await runFetch(rest);
  else if (cmd === "intake") runIntake(rest);
  else if (cmd === "report") runReport(rest);
  else if (cmd === "selftest") selftest();
  else {
    console.error(`unknown subcommand: ${cmd}`);
    process.exit(2);
  }
}

// Run only when executed directly, so tests can import the pure helpers.
if (process.argv[1] && path.basename(process.argv[1]) === path.basename(__filename)) {
  void main();
}
