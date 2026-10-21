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
const CORPUS_ROOT = process.env.TRACK_A_CORPUS_ROOT ?? "docs/RSA-Documents";
const STAGING = path.join(CORPUS_ROOT, ".track-a", "fetched.jsonl");
const LOG_TSV = path.join(CORPUS_ROOT, "canadian-download-log.tsv");
const INTAKE_JSONL = path.join(CORPUS_ROOT, "canada-intake-manifest.jsonl");
const SPLIT_JSON = path.join(CORPUS_ROOT, "track-a-split.json");
const COVERAGE_MD = path.join(CORPUS_ROOT, "track-a-coverage.md");
const DUPLICATES_JSON = path.join(CORPUS_ROOT, "track-a-duplicates.json");
const DEDUPE_INDEX = path.join(CORPUS_ROOT, "dedupe-index.json");
const LICENSE_REGISTER = path.join(CORPUS_ROOT, "LICENSE-REGISTER.md");
const QUARANTINE_MD = path.join(CORPUS_ROOT, "QUARANTINE.md");
const ODD_COVERAGE = "state/odd-coverage.json";

/** Train/test geography: held-out provinces never train (grilling.md A2/A3). */
export const TEST_PROVINCES: string[] = ["QC", "AB"];

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
    | "html-listing-pdf";
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
}

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(path.join(REPO, MANIFEST_PATH), "utf8")) as Manifest;
}

/**
 * Why a manifest source entry is unusable, or null when it is complete.
 * A partial entry is rejected here, so the fetch round skips it with a reason
 * instead of crashing on a missing field.
 */
export function sourceEntryProblem(source: Partial<Source>): string | null {
  if (!source.id) return "missing id";
  if (!source.host) return "missing host";
  if (!source.strategy) return "missing strategy";
  if (!source.licence_default?.verdict) return "missing licence_default.verdict";
  if (source.strategy === "known-document-url") {
    if (!source.known_document_urls?.length) return "missing known_document_urls";
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

async function candidatesFor(source: Source): Promise<string[]> {
  if (source.strategy === "known-document-url") return source.known_document_urls ?? [];

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
  [/pre-?opening/i, "PRE_OPENING"],
  [/stage\s*3|detailed design/i, "DETAILED_DESIGN"],
  [/stage\s*2|preliminary design/i, "PRELIMINARY_DESIGN"],
  [/stage\s*1|planning stage|functional plan/i, "FEASIBILITY_CONCEPT"],
];

const CANONICAL_STAGE: Record<string, string> = {
  FEASIBILITY_CONCEPT: "canada:FEASIBILITY_CONCEPT",
  PRELIMINARY_DESIGN: "canada:PRELIMINARY_DESIGN",
  DETAILED_DESIGN: "canada:DETAILED_DESIGN",
};

export function detectStage(text: string, hint: string): string {
  const head = text.slice(0, 8000);
  const hits = STAGE_RULES.filter(([re]) => re.test(head)).map(([, stage]) => stage);
  const distinct = [...new Set(hits)];
  // A document naming several stages is not one cell's document.
  if (distinct.length > 1) return "MULTI_STAGE";
  if (distinct.length === 1) return distinct[0];
  return hint;
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
  const head = text.slice(0, 4000);
  if (!isRsaDocument(text)) return "T0";
  if (OUTCOME_SIGNAL.test(head)) return "T4";
  // Guidelines carrying case studies are complete material (corpus anchor T3).
  if (CASE_STUDY.test(text)) return "T3";
  // A policy or guidelines document states the process; it is not an audit package.
  // Only the subject region counts - a bibliography entry does not.
  if (POLICY_SIGNAL.test(subjectRegion(text))) return "T1";
  if (REPORT_SIGNAL.test(head) || docType === "complete-RSA") return "T3";
  return "T1";
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

async function runFetch(argv: string[]): Promise<void> {
  const manifest = loadManifest();
  const only = argv.find((a) => a.startsWith("--source="))?.slice("--source=".length);
  const limit = Number(argv.find((a) => a.startsWith("--max="))?.slice("--max=".length) ?? 8);
  mkdirSync(path.dirname(STAGING), { recursive: true });
  const known = knownHashes();

  for (const source of manifest.sources) {
    const problem = sourceEntryProblem(source);
    if (problem) {
      console.log(`skip (invalid source entry ${source.id ?? "?"}): ${problem}`);
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
      const robots = await robotsFor(url);
      if (!isAllowed(robots, new URL(url).pathname)) {
        skip(`robots${robots.skipReason ? ` (${robots.skipReason})` : ""}`);
        console.log(`  skip (robots): ${url}${robots.skipReason ? ` (${robots.skipReason})` : ""}`);
        continue;
      }
      const delay = crawlDelayMs(robots) ?? 0;
      if (delay) await sleep(delay);
      let bytes: Uint8Array;
      try {
        const res = await withHostBudget(url, () =>
          fetch(url, { headers: { "user-agent": HARVEST_USER_AGENT } }),
        );
        if (!res.ok) {
          skip(`http ${res.status}`);
          console.log(`  skip (http ${res.status}): ${url}`);
          continue;
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.length < 5 || new TextDecoder().decode(buf.slice(0, 5)) !== "%PDF-") {
          skip("not a pdf");
          console.log(`  skip (not a pdf): ${url}`);
          continue;
        }
        bytes = buf;
      } catch (err) {
        skip("fetch error");
        console.log(`  skip (fetch error): ${url} ${err instanceof Error ? err.message : err}`);
        continue;
      }

      // The corpus already holds this document: never write it, never stage it.
      const sha = sha256Hex(bytes);
      const dup = hashSkipReason(sha, known);
      if (dup) {
        skip(dup);
        console.log(`  skip (${dup}): ${url}`);
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
        continue;
      }

      if (!isRsaDocument(text)) {
        skip("not RSA");
        console.log(`  skip (not RSA): ${url}`);
        continue;
      }

      const stage = detectStage(text, source.stage_hint);
      const province = detectProvince(text, source.ca_province_hint);
      const licence = source.licence_default;
      const split = splitFor(province, licence.verdict);
      const projectId = `PRJ-${shortHash(`${source.id}|${projectKeyFor(url, source)}`)}`;
      const fileName = path.basename(new URL(url).pathname) || "document.pdf";
      const shelf =
        licence.verdict === "BLOCKED" ? "quarantine/track-a" : "canada/track-a";
      const localRel = path.posix.join(CORPUS_ROOT, shelf, source.id, fileName);
      const abs = path.join(REPO, localRel);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, bytes);

      const record: IntakeRecord = {
        project_id: projectId,
        sha256: sha,
        tier: detectTier(text, source.doc_type_hint),
        stage,
        cell_key: CANONICAL_STAGE[stage] ?? "",
        ca_province: province,
        lang: detectLang(text),
        split,
        doc_type: source.doc_type_hint,
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
      };
      appendFileSync(STAGING, `${JSON.stringify(record)}\n`);
      downloaded += 1;
      console.log(`  ok: ${fileName} (${bytes.length} bytes, ${record.tier}, ${stage}, ${province}, ${split})`);
    }
    const summary = Object.entries(skipped)
      .map(([reason, n]) => `${reason}=${n}`)
      .join(", ");
    console.log(`[${source.id}] fetched ${downloaded}, skipped ${summary || "none"}`);
  }
}

// ---- intake --------------------------------------------------------------------

function readStaging(): IntakeRecord[] {
  if (!existsSync(path.join(REPO, STAGING))) return [];
  return readFileSync(path.join(REPO, STAGING), "utf8")
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

function runIntake(): void {
  const records = readStaging();
  if (!records.length) {
    console.log("no staged records - run `fetch` first");
    return;
  }
  const manifest = loadManifest();
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
  for (const r of records) {
    if (knownSha.has(r.sha256)) {
      duplicates.push({
        source_url: r.source_url,
        sha256: r.sha256,
        reason: "sha256 already in the corpus dedupe index",
        existing_path: knownPath.get(r.sha256) ?? "",
      });
    } else if (existingLog.has(r.sha256)) {
      duplicates.push({
        source_url: r.source_url,
        sha256: r.sha256,
        reason: "sha256 already in canadian-download-log.tsv",
        existing_path: "",
      });
    } else {
      fresh.push(r);
    }
  }
  writeFileSync(
    path.join(REPO, DUPLICATES_JSON),
    `${JSON.stringify(
      {
        schema_version: "1.0.0",
        ticket: "Akamel01/AuditorAI#40",
        note: "Documents fetched by Track A that were not ingested because their sha256 is already in the corpus.",
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

  // 5. licence register: one row per source directory
  let register = readFileSync(path.join(REPO, LICENSE_REGISTER), "utf8");
  const today = new Date().toISOString().slice(0, 10);
  const contributing = new Set(fresh.map((r) => r.source_id));
  for (const source of manifest.sources) {
    if (!contributing.has(source.id)) continue;
    const dir = `canada/track-a/${source.id}`;
    if (register.includes(`| ${dir} |`)) continue;
    const licence = source.licence_default;
    register = `${register.trimEnd()}\n| ${dir} | ${licence.verdict} | ${licence.basis} (${licence.licence_ref}) | ${today} |\n`;
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

function runReport(): void {
  const manifest = loadManifest();
  const records = readIntakeManifest();
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
  writeFileSync(path.join(REPO, COVERAGE_MD), md);
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
    new Set(manifest.sources.map((s) => s.id)).size === manifest.sources.length,
    "every source id is unique",
  );
  const invalid = manifest.sources.filter((s) => sourceEntryProblem(s) !== null);
  check(
    invalid.length === 0,
    `every source entry is complete (${
      invalid.map((s) => `${s.id}: ${sourceEntryProblem(s)}`).join("; ") || "none invalid"
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
  else if (cmd === "intake") runIntake();
  else if (cmd === "report") runReport();
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
