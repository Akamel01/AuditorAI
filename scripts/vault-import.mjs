#!/usr/bin/env node
// Vault import (V2): compiles chartered prose zones (journal/, decisions/,
// research-notes/, gotchas/) into a JSON view-of-record at state/vault-notes.json,
// validating front-matter per charter and resolving every evidence_ids entry
// against state/evidence-registry.json. Unknown zones are ignored safely.
// Malformed front-matter or unresolvable evidence ids fail with actionable errors.
// Determinism: output sorted by path; identical inputs => byte-identical outputs.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseFrontMatter, validateNoteFrontMatter, normalizeLinks } from "./lib/frontmatter.mjs";
import { fromRoot } from "./lib/paths.mjs";

const OUT_ROOT = process.cwd();
const CHARTERED_ZONES = [
  ["vault/journal", "journal"],
  ["vault/decisions", "decision"],
  ["vault/research-notes", "research-note"],
  ["vault/gotchas", "gotcha"],
];

function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f))
    .filter((p) => statSync(p).isFile())
    .sort();
}

function loadRegistryIds() {
  const p = fromRoot("state", "evidence-registry.json");
  try {
    const doc = JSON.parse(readFileSync(p, "utf8"));
    return new Set(doc.evidence_records.map((r) => r.evidence_id));
  } catch {
    console.error("[vault-import] FAILED — state/evidence-registry.json is missing or invalid; run scripts/compile-evidence.mjs first");
    process.exit(1);
  }
}

function main() {
  const registryIds = loadRegistryIds();
  const notes = [];
  const errors = [];
  for (const [zone, expectedType] of CHARTERED_ZONES) {
    for (const file of listMarkdown(path.join(OUT_ROOT, zone))) {
      try {
        const text = readFileSync(file, "utf8");
        const { fields, bodyStart } = parseFrontMatter(text, file);
        const { type, status, owner } = validateNoteFrontMatter(file, fields, expectedType);
        const links = normalizeLinks(file, fields);
        const unknown = links.evidence_ids.filter((id) => !registryIds.has(id));
        if (unknown.length > 0) {
          throw new Error(`${file}: evidence_ids do not resolve in state/evidence-registry.json: ${unknown.join(", ")}`);
        }
        notes.push({
          path: path.relative(OUT_ROOT, file).replaceAll("\\", "/"),
          zone,
          title: fields.title,
          type,
          date: fields.date,
          status: status ?? null,
          owner,
          links,
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
  const dest = path.join(OUT_ROOT, "state", "vault-notes.json");
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
  console.log(`[vault-import] ${notes.length} chartered notes -> state/vault-notes.json`);
}

main();
