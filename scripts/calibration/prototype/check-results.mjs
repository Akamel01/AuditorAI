// Verify the committed extraction run against its records and the design doc.
// Usage: node scripts/calibration/prototype/check-results.mjs
import { readFileSync } from "node:fs";

const ROOT = process.cwd();
const DOC = "docs/research/calibration/extraction-design.md";
const SUMMARY = "state/calibration/extraction-summary-2026-11-02.json";
const RECORDS = [
  "state/calibration/extractions/canada/FEASIBILITY_CONCEPT/CA-001.json",
  "state/calibration/extractions/canada/PRELIMINARY_DESIGN/CA-002.json",
  "state/calibration/extractions/canada/DETAILED_DESIGN/CA-007.json",
];

const read = (p) => JSON.parse(readFileSync(`${ROOT}/${p}`, "utf8"));
const errors = [];
const check = (ok, msg) => { if (!ok) errors.push(msg); };
const words = (q) => q.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const summary = read(SUMMARY);
const records = RECORDS.map(read);
check(summary.docs.length === 3, "summary must list three documents");
check(summary.totals.docs_complete === 3, "all three documents must be complete");
check(summary.excluded_docs.includes("CA-010"), "CA-010 must be excluded");
check(!JSON.stringify(summary).includes("CA-010\":") || summary.docs.every((d) => d.doc_id !== "CA-010"), "CA-010 must not be a result doc");
check(summary.models.family_disjoint === true, "model families must be disjoint");
check(summary.models.extractor.family !== summary.models.verifier.family, "extractor and verifier must differ");

let raw = 0, det = 0, ver = 0, est = 0, disc = 0;
for (const r of records) {
  check(r.status === "complete", `${r.doc_id} must be complete`);
  check(r.models.family_disjoint === true, `${r.doc_id} family_disjoint must be true`);
  check(r.models.extractor.family !== r.models.verifier.family, `${r.doc_id} model families must differ`);
  check(typeof r.source_url === "string" && r.source_url.startsWith("http"), `${r.doc_id} source_url missing`);
  check(typeof r.sha256 === "string" && r.sha256.length === 64, `${r.doc_id} sha256 missing`);
  check(r.calls.length >= 3, `${r.doc_id} calls[] missing preflight/extraction/verifier`);
  check(typeof r.prompt_hash === "string" && r.prompt_hash.length === 64, `${r.doc_id} prompt_hash missing`);
  check(typeof r.verifier_prompt_hash === "string" && r.verifier_prompt_hash.length === 64, `${r.doc_id} verifier_prompt_hash missing`);
  check(r.preflight.length === 2, `${r.doc_id} preflight[] must have two entries`);
  check(!JSON.stringify(r.findings).includes("[[PAGE"), `${r.doc_id} must not store page text`);
  check(!r.failures.some((f) => (f.raw_item_excerpt ?? "").length > 500), `${r.doc_id} failure excerpt over 500 chars`);
  for (const f of r.findings) {
    check(f.verification?.verified === true, `${f.item_id} must be verified`);
    check(f.span.word_count >= 3 && f.span.word_count <= 14, `${f.item_id} word count out of range`);
    check(!f.span.quote.includes("...") && !f.span.quote.includes("…"), `${f.item_id} has ellipsis`);
    check(f.span.page >= 1 && f.span.page <= r.page_count, `${f.item_id} page out of range`);
    check(r.source_url.startsWith("http"), `${f.item_id} source URL missing`);
  }
  const c = r.counts;
  const rr = r.rates;
  const rate = (n, d) => (d === 0 ? null : Number((n / d).toFixed(6)));
  check(rr.pass === rate(c.verified, c.raw), `${r.doc_id} pass rate mismatch`);
  check(rr.discard === rate(c.discarded, c.raw), `${r.doc_id} discard rate mismatch`);
  check(rr.verify === rate(c.verified, c.deterministic_passed), `${r.doc_id} verify rate mismatch`);
  check(rr.established === rate(c.established, c.raw), `${r.doc_id} established rate mismatch`);
  check(c.discarded === c.raw - c.established, `${r.doc_id} discarded count mismatch`);
  check(c.deterministic_passed >= c.verified, `${r.doc_id} verified exceeds deterministic pass`);
  check(c.scheme.raw === (r.scheme_description ? 1 : 0) || c.scheme.discarded >= 0, `${r.doc_id} scheme counts inconsistent`);
  raw += c.raw;
  det += c.deterministic_passed;
  ver += c.verified;
  est += c.established;
  disc += c.discarded;
}
check(raw === summary.totals.raw, `summary raw ${summary.totals.raw} != records ${raw}`);
check(det === summary.totals.deterministic_passed, `summary deterministic ${summary.totals.deterministic_passed} != ${det}`);
check(ver === summary.totals.verified, `summary verified ${summary.totals.verified} != ${ver}`);
check(est === summary.totals.established, `summary established ${summary.totals.established} != ${est}`);
check(disc === summary.totals.discarded, `summary discarded ${summary.totals.discarded} != ${disc}`);
check(summary.totals.rates.pass === Number((ver / raw).toFixed(6)), "pooled pass rate mismatch");
check(summary.totals.rates.verify === Number((ver / det).toFixed(6)), "pooled verify rate mismatch");
check(summary.totals.rates.established === Number((est / raw).toFixed(6)), "pooled established rate mismatch");
check(summary.totals.gate.met === false, "the gate must not be claimed met");
check(typeof summary.run.started_at === "string" && !Number.isNaN(Date.parse(summary.run.started_at)), "summary started_at missing");
check(typeof summary.run.finished_at === "string" && Date.parse(summary.run.finished_at) >= Date.parse(summary.run.started_at), "summary finished_at invalid");
check(typeof summary.run.duration_ms === "number" && summary.run.duration_ms > 0, "summary duration_ms invalid");

const doc = readFileSync(`${ROOT}/${DOC}`, "utf8");
const summaryBlock = doc.split("**Five-line summary**")[1]?.split("## 0.")[0] ?? "";
const lines = summaryBlock.split("\n").map((l) => l.trim()).filter(Boolean);
check(lines.length === 5, `design doc summary block must have exactly 5 non-empty lines, got ${lines.length}`);
for (const line of lines) check(/^\d\./.test(line), "summary line must start with a number");
const exampleRows = [...doc.matchAll(/^\|\s*(CA-\d{3})\s*\|\s*(\d+)(?:\s*\([^)]*\))?\s*\|\s*“([^”]+)”\s*\|\s*<https?:\/\/[^>]+>\s*\|/gm)];
check(exampleRows.length >= 3, "design doc must show at least three sourced quoted examples");
for (const [, , , quote] of exampleRows) {
  check(words(quote) < 15, `example quote over 14 words: ${quote}`);
}

if (errors.length) {
  console.error("FAIL");
  for (const e of errors) console.error("- " + e);
  process.exit(1);
}
console.log(`PASS: ${records.length} records, ${raw} raw, ${det} deterministic, ${ver} verified, ${est} established, ${disc} discarded, ${exampleRows.length} sourced examples`);
