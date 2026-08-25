#!/usr/bin/env node
// Regenerate state/odd-coverage.json from the discovery ledger + policies/odd.json.
// Derived view — deterministic given ledger bytes; never hand-edit.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resetOddDeclarationCache, computeCoverage } from "../src/discovery/coverage.js";
import type { MatchAssignment, ProjectPackageAssembly } from "../src/discovery/types.js";

async function main(): Promise<void> {

  const ROOT = process.cwd();
  resetOddDeclarationCache();

  interface LedgerEntry {
    seq: number;
    at: string;
    payload_kind: string;
    data: unknown;
  }

  const ledgerPath = join(ROOT, "state", "discovery-ledger.json");
  let entries: LedgerEntry[] = [];
  try {
    entries = (JSON.parse(readFileSync(ledgerPath, "utf8")) as { entries: LedgerEntry[] }).entries ?? [];
  } catch {
    console.error(`ledger unreadable at ${ledgerPath}; nothing to score`);
    process.exit(1);
  }

  // Latest-wins fold over package + match emissions.
  const pkgById = new Map<string, ProjectPackageAssembly>();
  const matchById = new Map<string, MatchAssignment>();
  for (const e of entries) {
    if (e.payload_kind === "package.assemblies") {
      for (const p of e.data as ProjectPackageAssembly[]) pkgById.set(p.package_id, p);
    } else if (e.payload_kind === "match.assignments") {
      for (const m of e.data as MatchAssignment[]) matchById.set(m.match_id, m);
    }
  }
  const packaged = [...pkgById.values()]
    .map((pkg) => {
      const match = matchById.get(pkg.match_id);
      return match ? { pkg, match } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const lastAt = entries.length ? entries[entries.length - 1].at : new Date(0).toISOString();
  const view = computeCoverage(packaged, lastAt);

  const outPath = join(ROOT, "state", "odd-coverage.json");
  writeFileSync(outPath, JSON.stringify(view, null, 2) + "\n");
  console.log(
    `odd-coverage v${view.declaration_version}: ${view.cells.filter((c) => c.label !== "EXCLUDED").length} active cells · ` +
      `${packaged.length} packages tallied · top gap: ${view.gaps_ranked[0] ?? "(none)"}`,
  );
  console.log("wrote", outPath.replace(ROOT + "/", ""));

}

void main();
