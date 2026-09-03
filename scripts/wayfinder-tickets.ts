#!/usr/bin/env ts-node
// Lightweight CLI to emit Wayfinder ticket index and counts.
// - Reuses indexWayfinderTickets() seam from src/wayfinder/tickets.ts
// - Writes a local markdown canonical file for traceability
// - Supports --json flag to output only counts JSON for automation

import { indexWayfinderTickets } from "../src/wayfinder/tickets";
import * as fs from 'fs';
import * as path from 'path';

function main() {
  const idx = indexWayfinderTickets();
  const out = {
    tickets: idx.tickets,
    counts: idx.counts,
  };

  const jsonOnly = process.argv.includes("--json");
  if (jsonOnly) {
    console.log(JSON.stringify({ counts: idx.counts }, null, 2));
  } else {
    console.log(JSON.stringify(out, null, 2));
  }

  // Write a local-markdown canonical artifact for auditability
  try {
    const mdDir = path.resolve(process.cwd(), '.autoforge', 'explanation');
    if (!fs.existsSync(mdDir)) fs.mkdirSync(mdDir, { recursive: true });
    const mdPath = path.join(mdDir, 'M-R19-ticket-index.md');
    const frontmatter = `---
title: M-R19 Wayfinder tickets index
date: ${new Date().toISOString()}
---
`;
    const body = `Total: ${idx.counts.total}\nFrontier: ${idx.counts.frontier}\nReady: ${idx.counts.ready_without_owner}\nHitL: ${idx.counts.hitl_frontier}\n`;
    fs.writeFileSync(mdPath, frontmatter + "\n" + body, 'utf8');
  } catch (_) {
    // best-effort; do not fail CLI if markdown write fails
  }
}

main();
