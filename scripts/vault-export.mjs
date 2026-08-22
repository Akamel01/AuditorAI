#!/usr/bin/env node
// Vault export (V2): renders JSON-canonical registries into vault/views/ notes.
// Machine-owned zone: regenerated wholesale; hand edits are discarded by design.
// Determinism: stable ordering + sorted keys; identical inputs => byte-identical outputs.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = process.cwd();
const VIEWS = path.join(ROOT, "vault", "views");

function sha(json) {
  return createHash("sha256").update(JSON.stringify(json)).digest("hex").slice(0, 12);
}

function fm(fields) {
  const lines = ["---"];
  for (const [k, v] of fields) lines.push(`${k}: ${v}`);
  lines.push("---", "");
  return lines.join("\n");
}

function writeView(name, content) {
  writeFileSync(path.join(VIEWS, name), content);
}

function evidenceRecordNote(rec) {
  return fm([
    ["generated", "true"],
    ["type", "evidence-record"],
    ["source", "state/evidence-registry.json"],
    ["source_hash", rec._hash],
    ["normative_status", rec.normative_status],
    ["confidence", rec.confidence],
    ["jurisdiction", rec.jurisdiction],
  ]) +
`# ${rec.evidence_id}

${rec.claim}

- Publisher: ${rec.publisher ?? "—"}
- Source: ${rec.source_url ?? "—"}
- Retrieved: ${rec.retrieved_date ?? "—"}
- Normative status: **${rec.normative_status}** (confidence: ${rec.confidence})

Part of [[evidence-index]] · registry: \`state/evidence-registry.json\`
`;
}

function main() {
  rmSync(VIEWS, { recursive: true, force: true });
  mkdirSync(VIEWS, { recursive: true });

  // ---- Evidence registry: index + one note per record ------------------------
  const ev = JSON.parse(readFileSync(path.join(ROOT, "state/evidence-registry.json"), "utf8"));
  const records = [...ev.evidence_records].sort((a, b) =>
    a.evidence_id.localeCompare(b.evidence_id),
  );
  for (const rec of records) rec._hash = sha(rec);

  const byJurisdiction = {};
  for (const r of records) (byJurisdiction[r.jurisdiction] ||= []).push(r.evidence_id);

  let idx = fm([
    ["generated", "true"],
    ["type", "evidence-index"],
    ["source", "state/evidence-registry.json"],
    ["source_hash", sha(ev)],
    ["record_count", String(records.length)],
  ]);
  idx += `# Evidence index\n\nCompiled from \`state/evidence-registry.json\` — do not edit by hand.\n\n`;
  for (const j of Object.keys(byJurisdiction).sort()) {
    idx += `\n## ${j} (${byJurisdiction[j].length})\n\n`;
    for (const id of byJurisdiction[j]) idx += `- [[EV-${j}-${id.split("-").slice(2).join("-")}]]\n`;
  }
  writeView("evidence-index.md", idx);
  const notesDir = path.join(VIEWS, "evidence");
  mkdirSync(notesDir, { recursive: true });
  for (const rec of records) {
    writeFileSync(path.join(notesDir, `${rec.evidence_id}.md`), evidenceRecordNote(rec));
  }

  // ---- Audit graph overview ---------------------------------------------------
  const gs = JSON.parse(readFileSync(path.join(ROOT, "state/graph-state.json"), "utf8"));
  const ag = gs.graphs.audit_graph;
  let graph = fm([
    ["generated", "true"],
    ["type", "graph-overview"],
    ["source", "state/graph-state.json"],
    ["source_hash", sha(gs)],
  ]);
  graph += `# Audit graph (§19)\n\nBounded-context pipeline the product executes.\n\n## Nodes\n\n`;
  for (const n of ag.nodes) {
    graph += `- **${n.id}** — ${n.role}\n  - impl: \`${n.impl}\`\n`;
  }
  graph += `\n## Edges\n\n`;
  for (const e of ag.edges) {
    graph += `- ${e.from} → ${e.to} (${e.type}): ${e.payload}\n`;
  }
  writeView("graph-overview.md", graph);

  // ---- Validation log ----------------------------------------------------------
  const vs = JSON.parse(readFileSync(path.join(ROOT, "state/validation-state.json"), "utf8"));
  let val = fm([
    ["generated", "true"],
    ["type", "validation-log"],
    ["source", "state/validation-state.json"],
    ["source_hash", sha(vs)],
    ["record_count", String(vs.validations.length)],
  ]);
  val += `# Validation log\n\n`;
  for (const v of vs.validations) {
    val += `\n## ${v.validation_id}\n\n- Date: ${v.date}\n- Scope: ${v.scope}\n- Result: **${v.result}**\n`;
    if (v.follow_ups?.length) {
      val += `- Follow-ups:\n${v.follow_ups.map((f) => `  - ${f}`).join("\n")}\n`;
    }
  }
  writeView("validation-log.md", val);

  console.log(`[vault-export] views regenerated in vault/views/ (${records.length} evidence notes)`);
}

main();
