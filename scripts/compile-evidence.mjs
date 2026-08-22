#!/usr/bin/env node
// Evidence Manager node: deterministically compiles researcher front-matter
// evidence records into state/evidence-registry.json.
// - Fails loudly on malformed/missing/incomplete records (never silently drops)
// - Output is byte-stable for identical inputs (no timestamps) so CI can
//   detect drift via `git diff --exit-code`.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

const SOURCES = [
  { file: "international-rsa-research.md", jurisdiction: "INT" },
  { file: "uk-rsa-research.md", jurisdiction: "UK" },
  { file: "usa-rsa-research.md", jurisdiction: "US" },
  { file: "canada-rsa-research.md", jurisdiction: "CA" },
  { file: "uae-rsa-research.md", jurisdiction: "AE" },
];

const NORMATIVE = new Set(["mandatory", "recommended", "informative", "unknown"]);
const CONFIDENCE = new Set(["high", "medium", "low"]);
const REQUIRED_FIELDS = ["evidence_id", "claim", "source_url", "source_title", "retrieved_date", "normative_status", "confidence"];

function cleanValue(raw) {
  let v = raw.trim();
  if (v === "" || v === "null") return null;
  if (v.startsWith('"') && v.endsWith('"')) {
    v = v.slice(1, -1).replace(/\\"/g, '"');
  }
  return v;
}

function parseFrontMatter(text, file) {
  const lines = text.split("\n");
  if (lines[0].trim() !== "---") throw new Error(`${file}: no front matter`);
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") { end = i; break; }
  }
  if (end === -1) throw new Error(`${file}: unterminated front matter`);
  return lines.slice(1, end);
}

function parseRecords(fmLines, file) {
  const start = fmLines.findIndex((l) => /^evidence_records:\s*$/.test(l));
  if (start === -1) throw new Error(`${file}: no evidence_records key in front matter`);
  const records = [];
  let current = null;
  for (let i = start + 1; i < fmLines.length; i++) {
    const line = fmLines[i];
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) break; // next top-level key: end of block
    const item = line.match(/^ {2}- ([a-z_]+):\s?(.*)$/);
    if (item) {
      if (current) records.push(current);
      current = { [item[1]]: cleanValue(item[2]) };
      continue;
    }
    const field = line.match(/^ {4}([a-z_]+):\s?(.*)$/);
    if (field && current) {
      current[field[1]] = cleanValue(field[2]);
      continue;
    }
    // continuation line: append to previous value
    if (current) {
      const keys = Object.keys(current);
      const lastKey = keys[keys.length - 1];
      current[lastKey] = `${current[lastKey]} ${line.trim()}`;
      continue;
    }
    throw new Error(`${file}: unexpected front-matter line ${i + 1}: ${line}`);
  }
  if (current) records.push(current);
  return records;
}

const failures = [];
const all = [];

for (const src of SOURCES) {
  const path = join(ROOT, "docs/research", src.file);
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    failures.push(`${src.file}: missing`);
    continue;
  }
  const hash = createHash("sha256").update(text).digest("hex");
  let recs;
  try {
    recs = parseRecords(parseFrontMatter(text, src.file), src.file);
  } catch (e) {
    failures.push(e.message);
    continue;
  }
  if (recs.length === 0) failures.push(`${src.file}: zero evidence records`);

  for (const r of recs) {
    for (const f of REQUIRED_FIELDS) {
      if (r[f] == null || r[f] === "") failures.push(`${src.file}:${r.evidence_id ?? "?"}: missing field "${f}"`);
    }
    if (r.normative_status && !NORMATIVE.has(r.normative_status)) {
      failures.push(`${src.file}:${r.evidence_id}: bad normative_status "${r.normative_status}"`);
    }
    if (r.confidence && !CONFIDENCE.has(r.confidence)) {
      failures.push(`${src.file}:${r.evidence_id}: bad confidence "${r.confidence}"`);
    }
    all.push({ ...r, jurisdiction: src.jurisdiction });
  }
  src.count = recs.length;
  src.sha256 = hash;
}

const ids = all.map((r) => r.evidence_id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) failures.push(`duplicate evidence_ids: ${[...new Set(dupes)].join(", ")}`);

if (failures.length) {
  console.error("EVIDENCE COMPILATION FAILED:");
  for (const f of [...new Set(failures)]) console.error(`  - ${f}`);
  process.exit(1);
}

const ORDER = { INT: 0, UK: 1, US: 2, CA: 3, AE: 4 };
all.sort((a, b) => ORDER[a.jurisdiction] - ORDER[b.jurisdiction] || a.evidence_id.localeCompare(b.evidence_id));

const registry = {
  schema_version: "1.0.0",
  compilation: {
    sources: SOURCES.map(({ file, jurisdiction, count, sha256 }) => ({ file, jurisdiction, record_count: count, sha256 })),
    total_records: all.length,
    rule: "regenerated deterministically by scripts/compile-evidence.mjs; edit sources, not this file",
  },
  evidence_records: all,
};

writeFileSync(join(ROOT, "state/evidence-registry.json"), JSON.stringify(registry, null, 2) + "\n");
const byJur = {};
for (const r of all) byJur[r.jurisdiction] = (byJur[r.jurisdiction] ?? 0) + 1;
console.log(`evidence registry: ${all.length} records`, JSON.stringify(byJur));
