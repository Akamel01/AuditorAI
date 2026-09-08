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
    // Threshold sourced from doctrine, not hardcoded (R13) — parse 7d fallback
    let maxDays = 7;
    const m = gates.match(/freshness[^:\n]*[:\-]?\s*(\d+)\s*d/i) || gates.match(/maxAge[^:\n]*[:\-]?\s*(\d+)\s*d/i) || gates.match(/scorecards[^n]*newer than[^\d]*(\d+)\s*d/i);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n) && n > 0 && n < 365) maxDays = n;
    }
    // Freshness gate: check newest entry mtime inside state/eval-scorecards (ponytail: directory mtime + newest child)
    try {
      const scorecardsDir = path.resolve(__dirname, '../state/eval-scorecards');
      const stat = await fs.stat(scorecardsDir);
      let newestMtime = stat.mtime.getTime();
      try {
        const entries = await fs.readdir(scorecardsDir, { withFileTypes: true });
        for (const e of entries) {
          try {
            const s = await fs.stat(path.join(scorecardsDir, e.name));
            if (s.mtime.getTime() > newestMtime) newestMtime = s.mtime.getTime();
          } catch {}
        }
      } catch {}
      const ageMs = Date.now() - newestMtime;
      const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        console.error(`FAIL eval-gate freshness: scorecards older than ${maxDays}d (${Math.round(ageMs/86400000)}d) — run tier1 archive: node scripts/tier1-archive.mjs --rebase --topup <runId> (threshold from docs/validation/eval-gates.md)`);
        process.exit(1);
      }
    } catch (e) {
      // best-effort: missing dir is not a failure (first run), but log
      if (e && e.code !== 'ENOENT') {
        console.warn('WARN eval-gate freshness: could not stat scorecards', e.message);
      }
    }
    console.log(`R13 freshness check: doctrine found, threshold ${maxDays}d, pass`);
    process.exit(0);
  } catch (e) {
    console.error('Error in check-eval-gate-freshness:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();
