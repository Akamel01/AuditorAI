#!/usr/bin/env node
// Vault import (V2): compiles chartered prose zones (decisions/, research-notes/)
// into a JSON view-of-record at state/vault-notes.json. Unknown zones are ignored
// safely. Malformed front-matter fails with an actionable error.
// Determinism: output sorted by path; identical inputs => byte-identical outputs.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHARTERED_ZONES = ["vault/decisions", "vault/research-notes"];
const REQUIRED_FIELDS = ["title", "type", "date", "owner"];
const KNOWN_TYPES = ["decision", "research-note", "journal", "gotcha", "evidence-record", "evidence-index", "graph-overview", "validation-log"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseFrontMatter(text, file) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) throw new Error(`${file}: missing front-matter block (must start with ---)`);
  const fields = {};
  let currentNested = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const nested = line.match(/^ {2}([a-z_]+):\s*(.*)$/);
    if (nested && currentNested) {
      const [, key, raw] = nested;
      currentNested[key] = raw.startsWith("[") ? parseArray(raw, file, key) : raw.trim();
      continue;
    }
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) throw new Error(`${file}: unparseable front-matter line: "${line}" (expected key: value)`);
    const [, key, raw] = kv;
    if (raw === "") {
      // One level of nesting (charter 'links' block); deeper nesting is not chartered.
      fields[key] = {};
      currentNested = fields[key];
      continue;
    }
    currentNested = null;
    fields[key] = raw.startsWith("[") ? parseArray(raw, file, key) : raw.trim();
  }
  return { fields, bodyStart: m[0].length };
}

function parseArray(raw, file, key) {
  if (!raw.endsWith("]")) throw new Error(`${file}: array value for '${key}' must be [a, b] on one line`);
  return raw.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
}

function validate(file, f) {
  for (const req of REQUIRED_FIELDS) {
    if (!(req in f)) throw new Error(`${file}: front-matter missing required field '${req}' (charter §front-matter contract)`);
  }
  if (!KNOWN_TYPES.includes(f.type)) {
    throw new Error(`${file}: unknown type '${f.type}' (chartered types: ${KNOWN_TYPES.join(", ")})`);
  }
  if (!DATE_RE.test(f.date)) throw new Error(`${file}: 'date' must be YYYY-MM-DD, got '${f.date}'`);
  if (!["human", "agent"].includes(f.owner)) {
    throw new Error(`${file}: 'owner' must be human|agent per charter conflict rules, got '${f.owner}'`);
  }
}

function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f))
    .filter((p) => statSync(p).isFile())
    .sort();
}

function main() {
  const notes = [];
  const errors = [];
  for (const zone of CHARTERED_ZONES) {
    for (const file of listMarkdown(path.join(ROOT, zone))) {
      try {
        const text = readFileSync(file, "utf8");
        const { fields, bodyStart } = parseFrontMatter(text, file);
        validate(file, fields);
        notes.push({
          path: path.relative(ROOT, file).replaceAll("\\", "/"),
          zone,
          title: fields.title,
          type: fields.type,
          date: fields.date,
          status: fields.status ?? null,
          owner: fields.owner,
          links: {
            evidence_ids: fields.links?.evidence_ids ?? [],
            issues: fields.links?.issues ?? [],
            adr: fields.links?.adr ?? [],
          },
          body_chars: text.length - bodyStart,
        });
      } catch (e) {
        errors.push(e.message);
      }
    }
  }

  if (errors.length > 0) {
    console.error("[vault-import] FAILED — malformed chartered front-matter:");
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }

  notes.sort((a, b) => a.path.localeCompare(b.path));
  const out = {
    schema_version: "1.0.0",
    compiled_at_commit_only: true,
    note_count: notes.length,
    notes,
  };
  const dest = path.join(ROOT, "state", "vault-notes.json");
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
  console.log(`[vault-import] ${notes.length} chartered notes -> state/vault-notes.json`);
}

main();
