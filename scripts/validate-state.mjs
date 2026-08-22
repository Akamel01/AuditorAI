#!/usr/bin/env node
// Deterministic validation of shared-state registries.
// Exit 0 = all registries well-formed; nonzero = CI failure.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const STATE_DIR = join(ROOT, "state");

const REQUIRED_KEYS = {
  "project-state.json": ["schema_version", "desired_state", "current_state", "updated_at", "updated_by"],
  "decision-registry.json": ["schema_version", "decisions"],
  "artifact-registry.json": ["schema_version", "artifacts"],
  "evidence-registry.json": ["schema_version", "evidence_records"],
  "agent-registry.json": ["schema_version", "agents"],
  "graph-state.json": ["schema_version", "graphs"],
  "validation-state.json": ["schema_version", "validations"],
};

const SEMVER = /^\d+\.\d+\.\d+$/;
const failures = [];

for (const [file, keys] of Object.entries(REQUIRED_KEYS)) {
  const path = join(STATE_DIR, file);
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    failures.push(`${file}: missing`);
    continue;
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    failures.push(`${file}: invalid JSON (${e.message})`);
    continue;
  }
  if (!SEMVER.test(doc.schema_version ?? "")) {
    failures.push(`${file}: schema_version missing or not semver`);
  }
  for (const key of keys) {
    if (!(key in doc)) failures.push(`${file}: missing key "${key}"`);
  }
}

// Every registry array must be an array.
for (const [file, key] of [
  ["decision-registry.json", "decisions"],
  ["artifact-registry.json", "artifacts"],
  ["evidence-registry.json", "evidence_records"],
  ["agent-registry.json", "agents"],
  ["validation-state.json", "validations"],
]) {
  try {
    const doc = JSON.parse(readFileSync(join(STATE_DIR, file), "utf8"));
    if (!Array.isArray(doc[key])) failures.push(`${file}: "${key}" must be an array`);
  } catch {
    /* already reported above */
  }
}

// Graphs must declare both development and audit graphs with typed edges.
try {
  const g = JSON.parse(readFileSync(join(STATE_DIR, "graph-state.json"), "utf8"));
  for (const name of ["development_graph", "audit_graph"]) {
    if (!g.graphs?.[name]) failures.push(`graph-state.json: missing graphs.${name}`);
  }
} catch {
  /* already reported above */
}

if (failures.length) {
  console.error("STATE VALIDATION FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("state validation: OK");
