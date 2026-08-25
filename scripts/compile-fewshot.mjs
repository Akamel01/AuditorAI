#!/usr/bin/env node
// Few-shot store compiler (ADR-0011): deterministically compiles curated
// exemplar records from vault/fewshot/*.md into state/few-shot-store.json.
// - Fails loudly on malformed/incomplete records (never silently drops)
// - Enforces firewall inheritance: an exemplar inherits the strictest role of
//   its source samples; any trace to a release-test-role sample is structurally
//   impossible (compile error), and every source must hold engine-fewshot
//   (ADR-0008 §3).
// - Output is byte-stable for identical inputs (no timestamps) so CI can
//   detect drift via `git diff --exit-code`.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseFrontMatter } from "./lib/frontmatter.mjs";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "vault", "fewshot");
const CORPUS_PATH = path.join(ROOT, "state", "sample-corpus.json");
const OUT_PATH = path.join(ROOT, "state", "few-shot-store.json");

const SCHEMA_VERSION = "1.0.0";
const JURISDICTIONS = new Set(["INT", "UK", "US", "CA", "AE"]);
const CANONICAL_STAGES = new Set(["FEASIBILITY_CONCEPT", "PRELIMINARY_DESIGN", "DETAILED_DESIGN"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Strictest-first precedence for firewall inheritance (ADR-0011 §3).
const ROLE_PRECEDENCE = [
  "release-test",
  "reserve",
  "judge-calibration",
  "engine-fewshot",
  "unassigned",
];

function listMarkdown(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .map((f) => path.join(dir, f))
      .filter((p) => statSync(p).isFile())
      .sort();
  } catch {
    return [];
  }
}

function loadCorpusRoles() {
  let doc;
  try {
    doc = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));
  } catch {
    throw new Error(`state/sample-corpus.json is missing or invalid — cannot resolve exemplar lineage`);
  }
  const byId = new Map();
  for (const s of doc.samples ?? []) byId.set(s.id, s.roles ?? []);
  return byId;
}

function loadStoreVersion() {
  const readme = path.join(SRC_DIR, "README.md");
  const { fields } = parseFrontMatter(readFileSync(readme, "utf8"), "vault/fewshot/README.md");
  const v = Number(fields.store_version);
  if (!Number.isInteger(v) || v < 1) {
    throw new Error("vault/fewshot/README.md: front-matter 'store_version' must be a positive integer (bump on every promotion/removal)");
  }
  return v;
}

function extractSnapshot(text, bodyStart, file) {
  const body = text.slice(bodyStart);
  const m = /```json\r?\n([\s\S]*?)\r?\n```/.exec(body);
  if (!m) throw new Error(`${file}: no \`\`\`json candidate_snapshot fence in note body`);
  let snap;
  try {
    snap = JSON.parse(m[1]);
  } catch (e) {
    throw new Error(`${file}: candidate_snapshot is not valid JSON (${e.message})`);
  }
  const required = ["kind", "category", "statement", "evidence", "assumptions", "rationale", "recommendation", "producer"];
  const missing = required.filter((k) => !(k in snap));
  if (missing.length) throw new Error(`${file}: candidate_snapshot missing field(s): ${missing.join(", ")}`);
  if (typeof snap.statement?.text !== "string") {
    throw new Error(`${file}: candidate_snapshot.statement.text must be a string`);
  }
  if (!Array.isArray(snap.evidence) || snap.evidence.length < 1 ||
      snap.evidence.some((e) => !e || typeof e.evidence_id !== "string")) {
    throw new Error(`${file}: candidate_snapshot.evidence must be a non-empty array of {evidence_id,...}`);
  }
  return snap;
}

function strictestRole(roles) {
  return ROLE_PRECEDENCE.find((r) => roles.includes(r)) ?? "unassigned";
}

const failures = [];
const records = [];

let storeVersion;
try {
  storeVersion = loadStoreVersion();
} catch (e) {
  console.error("FEWSHOT COMPILATION FAILED:");
  console.error(`  - ${e.message}`);
  process.exit(1);
}

const rolesBySampleId = loadCorpusRoles();
const seenIds = new Set();

for (const file of listMarkdown(SRC_DIR)) {
  const rel = path.relative(ROOT, file);
  try {
    const text = readFileSync(file, "utf8");
    const name = path.basename(file);
    const { fields, bodyStart } = parseFrontMatter(text, rel);

    const str = (k) => {
      const v = fields[k];
      if (v === undefined || v === null || v === "") failures.push(`${rel}: missing field '${k}'`);
      return v === undefined || v === null ? null : String(v);
    };
    const exemplarId = str("exemplar_id");
    if (exemplarId && seenIds.has(exemplarId)) failures.push(`${rel}: duplicate exemplar_id '${exemplarId}'`);
    if (exemplarId) seenIds.add(exemplarId);

    const sampleIds = fields.sample_ids;
    if (!Array.isArray(sampleIds) || sampleIds.length === 0 || sampleIds.some((s) => typeof s !== "string" || !s)) {
      failures.push(`${rel}: 'sample_ids' must be a non-empty list of cataloged sample ids`);
    }

    const jurisdiction = str("jurisdiction");
    if (jurisdiction && !JURISDICTIONS.has(jurisdiction)) {
      failures.push(`${rel}: bad jurisdiction '${jurisdiction}' (expected one of ${[...JURISDICTIONS].join("|")})`);
    }
    const nativeStageId = str("native_stage_id");
    const canonicalStage = str("canonical_stage");
    if (canonicalStage && !CANONICAL_STAGES.has(canonicalStage)) {
      failures.push(`${rel}: bad canonical_stage '${canonicalStage}' (expected one of ${[...CANONICAL_STAGES].join("|")})`);
    }

    const programmeRaw = fields.programme;
    const programme = programmeRaw === undefined || programmeRaw === null || programmeRaw === "" ? null : String(programmeRaw);

    // Lineage: literal token 'null-seed' marks owner-seeded exemplars without
    // an outcome row; anything else must be a real CandidateOutcome id.
    const provRaw = fields.provenance_outcome_id === undefined || fields.provenance_outcome_id === null
      ? null
      : String(fields.provenance_outcome_id);
    if (!provRaw) failures.push(`${rel}: missing field 'provenance_outcome_id'`);
    const provenanceOutcomeId = provRaw === "null-seed" ? null : provRaw;

    if (str("approved_by") !== null && String(fields.approved_by) !== "owner") {
      failures.push(`${rel}: 'approved_by' must be 'owner' (promotion gate, ADR-0011 §2)`);
    }
    const approvedAt = str("approved_at");
    if (approvedAt && !DATE_RE.test(approvedAt)) {
      failures.push(`${rel}: 'approved_at' must be YYYY-MM-DD, got '${approvedAt}'`);
    }

    const snapshot = extractSnapshot(text, bodyStart, name);

    // Firewall inheritance: resolve every source sample's consumer roles.
    const sourceIds = Array.isArray(sampleIds) ? sampleIds : [];
    const resolvedRoles = [];
    for (const sid of sourceIds) {
      const roles = rolesBySampleId.get(sid);
      if (!roles) {
        failures.push(`${rel}: source sample '${sid}' not found in state/sample-corpus.json`);
        continue;
      }
      if (roles.includes("release-test")) {
        failures.push(
          `${rel}: FIREWALL — source sample '${sid}' holds the release-test role; an exemplar traceable to a release-test sample is structurally impossible (ADR-0011 §3)`,
        );
      } else if (!roles.includes("engine-fewshot")) {
        failures.push(`${rel}: source sample '${sid}' does not hold the engine-fewshot role (ADR-0008 §3)`);
      }
      resolvedRoles.push(...roles);
    }
    const inheritedRole = strictestRole(resolvedRoles);

    records.push({
      exemplar_id: exemplarId,
      sample_ids: sourceIds,
      jurisdiction,
      native_stage_id: nativeStageId,
      canonical_stage: canonicalStage,
      programme,
      inherited_role: inheritedRole,
      provenance_outcome_id: provenanceOutcomeId,
      approved_by: fields.approved_by === undefined ? null : String(fields.approved_by),
      approved_at: approvedAt,
      candidate_snapshot: snapshot,
    });
  } catch (e) {
    failures.push(e.message);
  }
}

if (failures.length) {
  console.error("FEWSHOT COMPILATION FAILED:");
  for (const f of [...new Set(failures)]) console.error(`  - ${f}`);
  process.exit(1);
}

records.sort((a, b) => a.exemplar_id.localeCompare(b.exemplar_id));

const store = {
  schema_version: SCHEMA_VERSION,
  store_version: storeVersion,
  records,
};

writeFileSync(OUT_PATH, JSON.stringify(store, null, 2) + "\n");
console.log(`few-shot store: ${records.length} record(s), store_version=${storeVersion}`);
