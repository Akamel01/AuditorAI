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

// Evidence ids referenced by compiled vault notes must resolve in the registry.
try {
  const reg = new Set(
    JSON.parse(readFileSync(join(STATE_DIR, "evidence-registry.json"), "utf8"))
      .evidence_records.map((r) => r.evidence_id),
  );
  let notes;
  try {
    notes = JSON.parse(readFileSync(join(STATE_DIR, "vault-notes.json"), "utf8")).notes ?? [];
  } catch {
    notes = null;
  }
  if (notes) {
    for (const n of notes) {
      for (const id of n.links?.evidence_ids ?? []) {
        if (!reg.has(id)) failures.push(`vault-notes.json: ${n.path}: evidence_id "${id}" does not resolve in evidence-registry.json`);
      }
    }
  }
} catch (e) {
  failures.push(`evidence cross-check failed: ${e.message}`);
}

// Node contracts must cover exactly the audit_graph node set.
try {
  const { readdirSync } = await import("node:fs");
  const contractsDir = join(ROOT, "contracts", "node-contracts");
  const contractIds = readdirSync(contractsDir)
    .filter((f) => /^AG-.*\.md$/.test(f))
    .map((f) => /^node_id: (\S+)$/m.exec(readFileSync(join(contractsDir, f), "utf8"))?.[1])
    .filter(Boolean);
  const graph = JSON.parse(readFileSync(join(STATE_DIR, "graph-state.json"), "utf8"));
  const graphIds = graph.graphs.audit_graph.nodes.map((n) => n.id);
  for (const id of contractIds) {
    if (!graphIds.includes(id)) failures.push(`node-contracts: ${id} has no audit_graph node in graph-state.json`);
  }
  for (const id of graphIds) {
    if (!contractIds.includes(id)) failures.push(`graph-state.json: audit_graph node ${id} has no node contract`);
  }
} catch (e) {
  failures.push(`contract/graph cross-check failed: ${e.message}`);
}

if (failures.length) {
  console.error("STATE VALIDATION FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("state validation: OK");
