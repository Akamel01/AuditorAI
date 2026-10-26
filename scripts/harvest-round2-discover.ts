#!/usr/bin/env node
// Round-2 discovery for GitHub issue #60 (Akamel01/AuditorAI).
//
//   npx tsx scripts/harvest-round2-discover.ts            # enumeration channel
//   npx tsx scripts/harvest-round2-discover.ts --dry-run  # list, do not write
//
// Round 2 searches wider than Track A's portal list. Two discovery channels are
// used, and the candidate list records which one found each URL:
//
//   enumeration           the repo's own robots-checked listing strategies
//                         (sitemap-keyword, html-listing-pdf) run against the
//                         round-2 source list. Fully repeatable by this script.
//   operator-discovery-pass
//                         URLs whose location was established in the operator's
//                         discovery pass. NOT reproducible by this script: the
//                         general web-search backends that would find them are
//                         unavailable to a robots-compliant, keyless runner
//                         (see .autoforge/execution/M1.md for the full table).
//                         The documents are still fetched by the harvester from
//                         their origin host under the robots, rate, hash and
//                         licence gates.
//
// The committed candidate list is the auditable record of what was examined
// (ticket #60, "every document gets a licence row, a project ID, a split, a
// dedupe check ..."). The fetch round reads it; it never re-searches.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { enumerateSource, type CandidateRow, type Source } from "./harvest-track-a.js";

const REPO = process.cwd();
const SOURCES_PATH = "docs/RSA-Documents/track-a-round2-sources.json";
const CANDIDATES_PATH = "docs/RSA-Documents/track-a-round2-candidates.json";

interface Round2SourceList {
  sources: Source[];
  host_licences?: Record<string, { verdict: string; basis: string; licence_ref: string }>;
  province_hints?: Record<string, string>;
}

interface CandidatesFile {
  schema_version: string;
  ticket: string;
  generated_by: string;
  discovery_channel: string;
  notes?: string[];
  candidates: CandidateRow[];
}

/** The licence a candidate's host carries, or the source's declared default. */
function licenceFor(url: string, source: Source, list: Round2SourceList) {
  const host = new URL(url).host;
  const map = list.host_licences ?? {};
  for (const [pattern, licence] of Object.entries(map)) {
    if (host === pattern || host.endsWith(`.${pattern}`)) return licence;
  }
  return {
    verdict: source.licence_default.verdict,
    basis: source.licence_default.basis,
    licence_ref: source.licence_default.licence_ref,
  };
}

/** The province hint for a candidate's host, if the source list declares one. */
function provinceFor(url: string, list: Round2SourceList): string {
  const host = new URL(url).host;
  const map = list.province_hints ?? {};
  for (const [pattern, province] of Object.entries(map)) {
    if (host === pattern || host.endsWith(`.${pattern}`)) return province;
  }
  return "";
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const list = JSON.parse(
    readFileSync(path.join(REPO, SOURCES_PATH), "utf8"),
  ) as Round2SourceList;

  const existing: CandidatesFile = existsSync(path.join(REPO, CANDIDATES_PATH))
    ? (JSON.parse(readFileSync(path.join(REPO, CANDIDATES_PATH), "utf8")) as CandidatesFile)
    : { schema_version: "1.0.0", ticket: "Akamel01/AuditorAI#60", generated_by: "", discovery_channel: "", candidates: [] };

  const byUrl = new Map<string, CandidateRow>();
  for (const row of existing.candidates ?? []) byUrl.set(row.url, row);

  let found = 0;
  for (const source of list.sources) {
    // A source with a listing index is enumerable by this script; a source
    // whose candidates come from the operator's discovery pass is not.
    const discovery = (
      source as Source & {
        discovery?: {
          channel: string;
          strategy?: string | null;
          listing_url?: string | null;
          url_keywords?: string[];
          max_listing_pages?: number;
          max_candidates?: number;
        };
      }
    ).discovery;
    if (!discovery?.listing_url) {
      console.log(
        `[${source.id}] ${discovery?.channel ?? "no"} channel - no listing index to enumerate`,
      );
      continue;
    }
    const urls = await enumerateSource({
      ...source,
      strategy: (discovery.strategy ?? "sitemap-keyword") as Source["strategy"],
      listing_url: discovery.listing_url,
      url_keywords: discovery.url_keywords ?? source.url_keywords,
      max_listing_pages: discovery.max_listing_pages ?? source.max_listing_pages,
      max_candidates: discovery.max_candidates ?? source.max_candidates,
    });
    console.log(`[${source.id}] ${urls.length} candidate url(s) from ${discovery.listing_url}`);
    for (const url of urls) {
      if (byUrl.has(url)) continue;
      byUrl.set(url, {
        url,
        source_id: source.id,
        source_type: source.source_type,
        title_hint: "",
        query: "",
        discovery_channel: "enumeration",
        province_hint: provinceFor(url, list),
        stage_hint: source.stage_hint,
        doc_type_hint: source.doc_type_hint,
        ...licenceFor(url, source, list),
      });
      found += 1;
    }
  }

  const candidates = [...byUrl.values()];
  console.log(`\n${candidates.length} candidate(s) in the list (${found} new)`);
  if (dryRun) return;

  const out: CandidatesFile = {
    schema_version: "1.0.0",
    ticket: "Akamel01/AuditorAI#60",
    generated_by: "scripts/harvest-round2-discover.ts",
    discovery_channel: "enumeration + operator-discovery-pass",
    notes: [
      "One row per candidate URL examined. The fetch round reads this file; it never re-searches.",
      "discovery_channel=enumeration: found by this script through the repo's robots-checked listing strategies.",
      "discovery_channel=operator-discovery-pass: the URL's location was established in the operator's discovery pass; the general web-search backends that would find it are unavailable to a robots-compliant, keyless runner (.autoforge/execution/M1.md). The document is fetched by the harvester from its origin host under the robots, rate, hash and licence gates.",
      "The licence and the province hint of a candidate are resolved from its HOST, because one search returns candidates from many hosts.",
    ],
    candidates,
  };
  writeFileSync(path.join(REPO, CANDIDATES_PATH), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`wrote ${CANDIDATES_PATH}`);
}

void main();
