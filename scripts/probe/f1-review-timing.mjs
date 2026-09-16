// v3-F1 bottleneck probe — SYNTHETIC ONLY (probe-only, no src edits).
// There are no live adjudication rows, so this measures a synthetic mimic of
// the candidate-review promote path (verbatim copy + F-AI id mint, mirroring
// promoteCandidate semantics) over N=100 generated fixtures and reports
// p50/p95 per-promotion latency. SYNTHETIC ONLY: LIVE bottleneck evidence
// still requires live rows.
//
// Usage: node scripts/probe/f1-review-timing.mjs [--n 100]
const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) => {
    if (!a.startsWith("--")) return [];
    const eq = a.indexOf("=");
    if (eq > 0) return [[a.slice(2, eq), a.slice(eq + 1)]];
    const v = arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "true";
    return [[a.slice(2), v]];
  }),
);

const N = Number(args.n || 100);

function makeFixture(i) {
  return {
    kind: "safety_concern",
    category: `category-${i % 8}`,
    location: "junction",
    road_users: ["cyclists"],
    scenario: `conflicting left turn #${i}`,
    statement: { text: `sight lines restricted at approach ${i}`, normative_basis_note: null },
    evidence: [{ evidence_id: `EV-UK-${String(i).padStart(3, "0")}`, quote: null, use: "supports_concern" }],
    assumptions: [],
    rationale: "derived from drawings",
    recommendation: `Extend the visibility splay at approach ${i} to 2x2x120.`,
    producer: "safety-reasoning-agent",
  };
}

// Synthetic mimic of promoteCandidate: verbatim substance copy + minted
// F-AI id/provenance. Measures the shape of the promote path, not the TS impl.
function syntheticPromote(candidate, seq) {
  return {
    finding_id: `F-AI-${String(seq).padStart(3, "0")}`,
    kind: candidate.kind,
    category: candidate.category,
    location: candidate.location,
    road_users: candidate.road_users,
    scenario: candidate.scenario,
    statement: candidate.statement,
    evidence: candidate.evidence,
    assumptions: candidate.assumptions,
    rationale: candidate.rationale,
    recommendation: candidate.recommendation,
    source_trace: [{ origin: "ai_candidate", producer: candidate.producer }],
    reviewer_status: "accepted",
  };
}

function pct(sorted, q) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

const timings = [];
let minted = 0;
for (let i = 0; i < N; i++) {
  const fixture = makeFixture(i);
  const t0 = performance.now();
  const finding = syntheticPromote(fixture, i + 1);
  timings.push(performance.now() - t0);
  if (finding.finding_id !== `F-AI-${String(i + 1).padStart(3, "0")}`) {
    console.error("FATAL: synthetic promote minted a bad id");
    process.exit(1);
  }
  minted += 1;
}

timings.sort((a, b) => a - b);
const out = {
  meta: {
    synthetic: true,
    n: N,
    path: "synthetic promote mimic (verbatim copy + F-AI id mint)",
    note: "SYNTHETIC ONLY — LIVE bottleneck evidence still requires live rows.",
  },
  minted,
  p50_ms: pct(timings, 50),
  p95_ms: pct(timings, 95),
  min_ms: timings[0] ?? null,
  max_ms: timings[timings.length - 1] ?? null,
};
console.log(JSON.stringify(out, null, 2));
