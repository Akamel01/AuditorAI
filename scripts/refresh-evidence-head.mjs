#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';

try {
  const canonical = path.resolve('.autoforge/validation/ops-loop-evidence.json');
  const twin = path.resolve('stages/07_validate/output/ops-loop-evidence.json');

  const dataRaw = fs.readFileSync(canonical, 'utf8');
  const data = JSON.parse(dataRaw);
  // fetch current HEAD commit
  const commit = execSync('git rev-parse HEAD').toString().trim();
  const updated = Object.assign({}, data, {
    commit: commit,
    generatedAt: new Date().toISOString(),
  });

  // Write back to canonical as the source of truth, and also write to twin
  fs.writeFileSync(canonical, JSON.stringify(updated, null, 2) + '\n');
  // Write to the twin location preserving the rest of the structure
  fs.writeFileSync(twin, JSON.stringify(updated, null, 2) + '\n');
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
