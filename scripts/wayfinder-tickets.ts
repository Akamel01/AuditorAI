#!/usr/bin/env ts-node
// Lightweight, strictly-typed wrapper for the Wayfinder ticket index.
// - Restores a static import surface and a main() entry point
// - Supports --lint with optional --root <dir> to validate a tree (uses loadTicketsFromTree)
// - On --lint: prints invalid files to STDERR as: <file>: <reason>, exits 1 if any
// - On non-lint: prints either { counts } or { tickets, counts } depending on --json
// - No artifact writes in lint mode; preserves original JSON shape in non-lint mode
// - Uses the canonical loader surface from src/wayfinder/tickets

import { indexWayfinderTickets, loadTicketsFromTree } from "../src/wayfinder/tickets";

function printCountsOnly(idx: ReturnType<typeof indexWayfinderTickets>) {
  console.log(JSON.stringify({ counts: idx.counts }, null, 2));
}

function printFull(idx: ReturnType<typeof indexWayfinderTickets>) {
  console.log(JSON.stringify({ tickets: idx.tickets, counts: idx.counts }, null, 2));
}

(async function main() {
  try {
    const argv = process.argv.slice(2);
    const lint = argv.includes("--lint");
    const rootIdx = argv.indexOf("--root");
    const root = rootIdx !== -1 ? (argv[rootIdx + 1] ?? process.cwd()) : process.cwd();

    if (lint) {
      try {
        const { skipped } = loadTicketsFromTree(root as string);
        if (Array.isArray(skipped) && skipped.length > 0) {
          for (const s of skipped) {
            console.error(`${s.file ?? "<unknown>"}: ${s.reason ?? "invalid"}`);
          }
          process.exit(1);
        } else {
          process.exit(0);
        }
      } catch {
        process.exit(2);
      }
      return;
    }

    // Non-lint path: produce the canonical shape
    const idx = indexWayfinderTickets(root);
    if (argv.includes("--json")) {
      // Keep the historical shape requested for automation: { counts }
      printCountsOnly(idx);
    } else {
      printFull(idx);
    }
  } catch {
    process.exit(2);
  }
})();
