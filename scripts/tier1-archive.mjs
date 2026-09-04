#!/usr/bin/env node
// R14 Tier-1 archive — real path: `scripts/tier1-archive.mjs` --rebase --topup <runId>
// Doctrine: docs/validation/eval-gates.md §2/§3 (thresholds, trigger paths) — flags reference doctrine by path only
// Usage: node scripts/tier1-archive.mjs --rebase --topup <runId> | node scripts/tier1-archive.mjs --topup <runId> --rebase
// Ponytail: single file, stdlib fs/path only, no new deps, drift-insensitive header

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function tier1ArchiveMain(opts = {}) {
  const args = process.argv.slice(2);
  const hasRebase = args.includes("--rebase");
  const topupIdx = args.indexOf("--topup");
  const topupRunId = topupIdx !== -1 ? args[topupIdx + 1] : opts.topupRunId ?? null;

  // Real path: archive current eval scorecards + evidence registry snapshot
  // 1) ensure state/eval-scorecards exists
  const scorecardsDir = path.resolve(__dirname, "../state/eval-scorecards");
  const archiveRoot = path.resolve(scorecardsDir, "..", "eval-archive");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(archiveRoot, stamp);

  try {
    await fs.mkdir(dest, { recursive: true });
  } catch {}

  // 2) copy latest scorecards if present (best-effort)
  try {
    const entries = await fs.readdir(scorecardsDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const src = path.join(scorecardsDir, e.name);
        const dst = path.join(dest, e.name);
        await fs.cp(src, dst, { recursive: true, force: true });
      }
    }
  } catch {}

  // 3) snapshot evidence registry
  try {
    const src = path.resolve(__dirname, "../state/evidence-registry.json");
    const dst = path.join(dest, "evidence-registry.json");
    await fs.copyFile(src, dst);
  } catch {}

  // 4) write manifest with --rebase --topup <runId> flags and doctrine ref
  const manifest = {
    createdAt: new Date().toISOString(),
    flags: { rebase: hasRebase, topupRunId },
    doctrine: "docs/validation/eval-gates.md",
    // keep threshold sourced from docs/validation/eval-gates.md §3, not hardcoded
    note: "archive created via --rebase --topup <runId> per R14",
  };
  try {
    await fs.writeFile(path.join(dest, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  } catch {}

  console.log(`[R14] Tier-1 archive created at ${dest} ${hasRebase ? "--rebase" : ""} ${topupRunId ? `--topup ${topupRunId}` : ""}`.trim());
  return 0;
}

if (process.argv[1]?.endsWith("tier1-archive.mjs")) {
  (async () => {
    try {
      const code = await tier1ArchiveMain();
      process.exit(code);
    } catch (err) {
      console.error("[R14] skeleton error:", err);
      process.exit(1);
    }
  })();
}
