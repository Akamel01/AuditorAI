import { runPrototype, classifyExit, type RunOptions } from "./pipeline";
import { parseArgs } from "node:util";

function help() {
  console.log(`Usage: npx tsx scripts/calibration/prototype/run.ts [options]
--doc <id|all> (repeatable) default all
--extractor <model-id> default nvidia/nemotron-3.5-super-vl:free
--verifier <model-id> default opencode-go/beam-free
--out <dir> default state/calibration
--date <YYYY-MM-DD>
--dry-run
--help`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { help(); process.exit(0); }
  const parsed = parseArgs({
    args,
    options: {
      doc: { type: "string", multiple: true },
      extractor: { type: "string" },
      verifier: { type: "string" },
      out: { type: "string" },
      date: { type: "string" },
      "dry-run": { type: "boolean" },
    },
    allowPositionals: false,
  });
  const docIds = (parsed.values.doc as string[] | undefined) ?? ["all"];
  const opts: RunOptions = {
    docIds,
    extractor: (parsed.values.extractor as string) ?? "nvidia/nemotron-3.5-super-vl:free",
    verifier: (parsed.values.verifier as string) ?? "opencode-go/beam-free",
    out: (parsed.values.out as string) ?? "state/calibration",
    date: parsed.values.date as string | undefined,
    dryRun: !!parsed.values["dry-run"],
    keys: {
      openrouter: process.env.OPENROUTER_API_KEY,
      go: process.env.OPENCODE_GO_API_KEY,
    },
    baseUrls: {
      openrouter: process.env.OPENROUTER_BASE_URL,
      go: process.env.OPENCODE_GO_BASE_URL,
    },
  };
  // required keys check (non dry-run)
  if (!opts.dryRun) {
    const { MODEL_TABLE } = await import("./model");
    const e = MODEL_TABLE[opts.extractor];
    const v = MODEL_TABLE[opts.verifier];
    if (e?.provider === "openrouter" && !opts.keys.openrouter) { console.error("missing OPENROUTER_API_KEY"); process.exit(1); }
    if (v?.provider === "openrouter" && !opts.keys.openrouter) { console.error("missing OPENROUTER_API_KEY"); process.exit(1); }
    if (e?.provider === "opencode-go" && !opts.keys.go) { console.error("missing OPENCODE_GO_API_KEY"); process.exit(1); }
    if (v?.provider === "opencode-go" && !opts.keys.go) { console.error("missing OPENCODE_GO_API_KEY"); process.exit(1); }
  }
  try {
    const res = await runPrototype(opts);
    for (const d of res.summary.docs) {
      const c = d.counts;
      const r = d.rates;
      console.log(`${d.doc_id} ${d.cell_key} ${d.status} ${c?.raw ?? 0} ${c?.deterministic_passed ?? 0} ${c?.verified ?? 0} ${c?.established ?? 0} ${c?.discarded ?? 0} ${r ? JSON.stringify(r) : "null"} ${d.record_path ?? ""}`);
    }
    console.log(`run ${res.runId} ${res.summaryPath}`);
    process.exit(res.exitCode);
  } catch (e) {
    console.error(String(e));
    process.exit(classifyExit(e));
  }
}

main();
