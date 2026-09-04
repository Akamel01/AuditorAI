#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  try {
    const gatesPath = path.resolve(__dirname, '../docs/validation/eval-gates.md');
    const gates = await fs.readFile(gatesPath, 'utf8');
    // Verify doctrine is present: check §3 thresholds and §2 trigger paths per plan.md:216-223
    const hasDoctrine = gates.includes('## 2. Tier-1 trigger paths') && gates.includes('## 3. Threshold table');
    if (!hasDoctrine) {
      console.error('WARN eval-gate freshness: doctrine frozen thresholds not found — check docs/validation/eval-gates.md §2/§3');
      process.exit(1);
    }
    // Freshness gate: check state/eval-scorecards mtime if present — exit 1 if stale (>7d)
    try {
      const scorecardsDir = path.resolve(__dirname, '../state/eval-scorecards');
      const stat = await fs.stat(scorecardsDir);
      const ageMs = Date.now() - stat.mtime.getTime();
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        console.error(`FAIL eval-gate freshness: scorecards older than 7d (${Math.round(ageMs/86400000)}d) — run tier1 archive: gh workflow run tier1 --topup <runId>`);
        process.exit(1);
      }
    } catch (e) {
      // best-effort: missing dir is not a failure (first run), but log
      if (e && e.code !== 'ENOENT') {
        console.warn('WARN eval-gate freshness: could not stat scorecards', e.message);
      }
    }
    console.log('R13 freshness check: doctrine found, pass');
    process.exit(0);
  } catch (e) {
    console.error('Error in check-eval-gate-freshness:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();
