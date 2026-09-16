// H5 probe comparator — before/after + hash diff.
// Awaits a future RSC spike: run against baseline-vs-baseline now as
// self-consistency proof (exit 0, zero hash divergence).
// Usage:
//   node scripts/probe/h5-compare.mjs --before a.json --after b.json [--ttfb-guard 10] [--lcp-guard 10]
// Exit: 0 clean (hashes identical, guardrails hold), 1 on hash divergence or
// guardrail breach. Same-file comparison always exits 0.
import { readFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) => {
    if (!a.startsWith("--")) return [];
    const eq = a.indexOf("=");
    if (eq > 0) return [[a.slice(2, eq), a.slice(eq + 1)]];
    const v = arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "true";
    return [[a.slice(2), v]];
  }),
);
if (!args.before || !args.after) {
  console.error("usage: h5-compare.mjs --before a.json --after b.json");
  process.exit(2);
}
const TTFB_GUARD = Number(args["ttfb-guard"] || 10); // % regression allowed
const LCP_GUARD = Number(args["lcp-guard"] || 10);

const before = JSON.parse(readFileSync(args.before, "utf8"));
const after = JSON.parse(readFileSync(args.after, "utf8"));
const deltaPct = (b, a) => (b == null || a == null || b === 0 ? null : +(((a - b) / b) * 100).toFixed(1));

let fail = 0;
const line = (s) => process.stdout.write(s + "\n");
line(`compare: ${args.before} vs ${args.after}`);

for (const name of Object.keys(before.routes || {})) {
  const b = before.routes[name];
  const a = after.routes?.[name];
  if (!a) {
    line(`  ${name}: MISSING in after — FAIL`);
    fail = 1;
    continue;
  }
  line(`  [${name}] ${b.path}`);
  for (const m of ["m1", "m3", "ttfb", "lcp", "cls", "docBytes"]) {
    const dp50 = deltaPct(b[m]?.p50, a[m]?.p50);
    const dp95 = deltaPct(b[m]?.p95, a[m]?.p95);
    line(`    ${m}: p50 ${b[m]?.p50} -> ${a[m]?.p50} (${dp50 ?? "?"}%) | p95 ${b[m]?.p95} -> ${a[m]?.p95} (${dp95 ?? "?"}%)`);
  }
  // Guardrails: TTFB/LCP must stay within +guard%.
  for (const [m, g] of [["ttfb", TTFB_GUARD], ["lcp", LCP_GUARD]]) {
    const d = deltaPct(before.routes[name][m]?.p50, a[m]?.p50);
    if (d != null && d > g) {
      line(`    GUARDRAIL BREACH: ${m} +${d}% > +${g}% — FAIL`);
      fail = 1;
    }
  }
  // Hash diff: deterministic GET payloads must be identical.
  const bh = new Map((b.samples.at(-1)?.resources || []).map((r) => [r.url, r.hash]));
  const ah = new Map((a.samples.at(-1)?.resources || []).map((r) => [r.url, r.hash]));
  const urls = new Set([...bh.keys(), ...ah.keys()]);
  let div = 0;
  for (const u of urls) {
    if (bh.get(u) !== ah.get(u)) {
      div++;
      line(`    hash DIVERGE: ${u} ${bh.get(u)?.slice(0, 12) ?? "∅"} -> ${ah.get(u)?.slice(0, 12) ?? "∅"}`);
    }
  }
  const bDoc = JSON.stringify(b.docHashes), aDoc = JSON.stringify(a.docHashes);
  if (bDoc !== aDoc) {
    div++;
    line(`    doc-hash set DIVERGE: ${bDoc} -> ${aDoc}`);
  }
  line(`    hash divergence: ${div} url(s)`);
  if (div) fail = 1;
}

line(fail ? "RESULT: FAIL" : "RESULT: SELF-CONSISTENT (clean)");
process.exit(fail);
