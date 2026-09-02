#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  try {
    const canonical = path.resolve(__dirname, '../.autoforge/validation/ops-loop-evidence.json');
    const mirror = path.resolve(__dirname, '../stages/07_validate/output/ops-loop-evidence.json');
    const headPath = canonical;
    let dataRaw;
    try {
      dataRaw = await fs.readFile(headPath, 'utf8');
    } catch {
      console.error('.autoforge/validation/ops-loop-evidence.json not found — run: gh workflow run discovery-harvest');
      process.exit(1);
    }

    let data;
    try {
      data = JSON.parse(dataRaw);
    } catch {
      console.error('evidence-head.json invalid JSON');
      process.exit(1);
    }

    const currentHead = execSync('git rev-parse HEAD').toString().trim();
    const commitInHead = data.commit;
    const generatedAtStr = data.generatedAt;
    const freshMs = 24 * 60 * 60 * 1000;

    let fresh = false;
    if (typeof generatedAtStr === 'string') {
      const generatedAt = new Date(generatedAtStr);
      if (!Number.isNaN(generatedAt.valueOf())) {
        fresh = (currentHead === commitInHead) && (Date.now() - generatedAt.getTime() <= freshMs);
      }
    }

    // vault-sync + cmp twin check per plan.md:272
    try {
      execSync(`cmp -s "${canonical}" "${mirror}"`);
    } catch {
      console.error(`evidence stale: twin mismatch — run: node scripts/vault-sync.mjs && cmp -s .autoforge/validation/ops-loop-evidence.json stages/07_validate/output/ops-loop-evidence.json`);
      process.exit(1);
    }
    if (fresh) {
      console.log('Evidence HEAD fresh and anchored to current HEAD.');
      process.exit(0);
    } else {
      const msg = `evidence stale: commit ${currentHead} != HEAD ${commitInHead} or generatedAt stale`;
      console.error(msg + ' — run: gh workflow run discovery-harvest');
      process.exit(1);
    }
  } catch (e) {
    console.error('Error in check-evidence-head:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();
