#!/usr/bin/env node
// Discovery pipeline CLI.
//
//   tsx scripts/discovery-run.ts            # DRY-RUN (default): offline seed
//                                           # provider + deterministic fixture
//                                           # documents; exercises D01..D10 with
//                                           # zero network.
//   tsx scripts/discovery-run.ts --live     # real provider calls (requires
//                                           # DISCOVERY_BING_API_KEY and/or
//                                           # DISCOVERY_GOOGLE_CSE_*); polite
//                                           # 1 rps / 2-concurrent per host.
//   tsx scripts/discovery-run.ts --write    # persist ledger append + coverage
//
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listProviderIds, providerEnabled, resolveProvider } from "../src/discovery/providers/index.js";
import "./../src/discovery/providers/index.js"; // bootstrap built-ins
import { runDiscoveryPipeline, type DiscoveryCtx, type RawDocument } from "../src/discovery/pipeline";
import type { MatchAssignment } from "../src/discovery/types";
import type { JurisdictionId } from "../src/domain/types";

async function main(): Promise<void> {

  const args = new Set(process.argv.slice(2));
  const LIVE = args.has("--live");
  const WRITE = args.has("--write");
  // Guard: the machine ledger records REAL acquisitions. Fixture dry-runs may
  // only persist when explicitly acknowledged.
  if (WRITE && !LIVE && !args.has("--allow-fixture")) {
    console.error("refusing to --write dry-run fixtures into the ledger without --allow-fixture");
    process.exit(2);
  }
  const ROOT = process.cwd();

  if (!LIVE && args.has("--providers")) {
    // explicit provider selection still allowed in dry-run for seed-only extras
  }
  const requestedProviders = (() => {
    const flagIdx = process.argv.indexOf("--providers");
    if (flagIdx === -1) return null;
    return (process.argv[flagIdx + 1] ?? "").split(",").filter(Boolean);
  })();

  // google-cse is deprecated for us: Custom Search JSON API is closed to new
// customers (developers.google.com/custom-search/v1/overview, 2026-02) and
// live calls flap 200/403 across frontends. Explicit --providers still allows it.
const DEPRECATED_PROVIDERS = new Set(["google-cse"]);
const providerIds =
  requestedProviders ??
  (["seed-portals", ...(LIVE ? listProviderIds().filter((p) => p !== "seed-portals" && providerEnabled(p) && !DEPRECATED_PROVIDERS.has(p)) : [])] as string[]);
  const providers = providerIds
    .map((id) => resolveProvider(id))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const ranAtIso = LIVE ? new Date().toISOString() : new Date(0).toISOString();

  // Gap-aware live themes: read the last coverage view and target its top gaps.
  // Keeps harvest representative instead of re-harvesting easy cells.
  let gapThemes: string[] | null = null;
  let gapJurs: ("UK" | "US" | "CA" | "AE" | "INT")[] | null = null;
  if (LIVE) {
    try {
      const cov = JSON.parse(readFileSync(join(ROOT, "state", "odd-coverage.json"), "utf8")) as {
        gaps_ranked: string[];
      };
      const top = (cov.gaps_ranked as string[]).slice(0, 3);
      if (top.length) {
        const jurMap: Record<string, "UK" | "US" | "CA" | "AE" | "INT"> = {
          uk: "UK",
          usa: "US",
          canada: "CA",
          international: "INT",
          ae: "AE",
          uae: "AE",
        };
        gapJurs = [...new Set(top.map((k) => jurMap[k.split(":")[0].toLowerCase()] ?? "INT"))] as ("UK" | "US" | "CA" | "AE" | "INT")[];
        const themeFor = (key: string): string => {
          if (key.includes("DETAILED_DESIGN")) return "final design road safety audit";
          if (key.includes("FEASIBILITY_CONCEPT")) return "feasibility concept road safety audit";
          return "preliminary design road safety audit";
        };
        gapThemes = top.map(themeFor);
      }
    } catch {}
  }

  // Deterministic fixture documents so the offline run is fully deterministic
  // and byte-stable (no network). Live runs fetch the originating hit URL.
  function fixtureDocsFor(match: MatchAssignment): RawDocument[] {
    const mk = (name: string, text: string): Uint8Array =>
      new TextEncoder().encode(`%PDF-1.4 fixture ${match.jurisdiction} ${match.native_stage_id} ${name}\n${text}`);
    if (match.jurisdiction === "UK") {
      return [
        { url: `https://fixtures.invalid/uk-s1-rsa-report.pdf`, bytes: mk("report", "Road Safety Audit Report Stage 1 preliminary design"), mime: "application/pdf" },
        { url: `https://fixtures.invalid/uk-s1-general-arrangement-drawings.pdf`, bytes: mk("drawings", "General arrangement drawings cross-section layout sheets"), mime: "application/pdf" },
        { url: `https://fixtures.invalid/uk-s1-designer-response-report.pdf`, bytes: mk("response", "Designer response report decision log"), mime: "application/pdf" },
      ];
    }
    return [
      { url: `https://fixtures.invalid/${match.jurisdiction.toLowerCase()}-rsa-report.pdf`, bytes: mk("report", "Road Safety Audit Report"), mime: "application/pdf" },
    ];
  }

  const ctx: DiscoveryCtx = {
    ranAtIso,
    query: {
      jurisdictions: (gapJurs ?? (["UK", "US", "CA", "AE", "INT"] as JurisdictionId[])),
      themes: gapThemes ?? ['"road safety audit"', "preliminary design RSA", "stage 1 road safety audit"],
    },
    providers,
    // Live: pipeline fetches the originating hit URL directly (polite per-host).
    // Dry-run: deterministic fixtures so the run is offline and reproducible.
    ...(LIVE ? {} : { acquireDocs: (match: MatchAssignment) => Promise.resolve(fixtureDocsFor(match)) }),
  };

  const outcome = await runDiscoveryPipeline(ctx);

  console.log("hits:", outcome.state.discovery_hits?.length ?? 0);
  console.log("qualified:", JSON.stringify(countBy((outcome.state.qualified ?? []).map((q) => q.verdict))));
  console.log("matched:", outcome.state.matched?.length ?? 0);
  if (outcome.refusals.length) console.log("refusals:", outcome.refusals.length);
  for (const r of outcome.refusals) console.log("  -", r);
  console.log("packages:", (outcome.state.package ?? []).map((p) => `${p.package_id}:${p.completeness}`).join(", ") || "(none)");

  for (const q of outcome.state.quality ?? []) {
    console.log("quality:", q.package_id, q.dedupe_status, q.completeness, q.human_required ? "[owner-review]" : "");
  }
  const cov = outcome.state.coverage;
  if (cov) {
    console.log("\nODD coverage v" + cov.declaration_version + " target=" + cov.target_total);
    for (const c of cov.cells) {
      console.log(
        `  ${c.label.padEnd(16)} ${c.cell_key.padEnd(34)} have=${String(c.have_total).padStart(3)} full=${String(c.have_full_package).padStart(3)}/${String(c.target).padStart(3)} prio=${c.priority}`,
      );
    }
    console.log("queue:");
    for (const item of outcome.state.queue ?? []) {
      console.log(`  #${item.rank} ${item.cell_key} :: ${item.query_theme}`);
    }
  }

  if (WRITE) {
    const ledgerPath = join(ROOT, "state", "discovery-ledger.json");
    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as { entries: unknown[] };
    let seq = ledger.entries.length;
    const kinds: [keyof typeof outcome.state, string][] = [
      ["discovery_hits", "discovery.hitset"],
      ["qualified", "qualification.verdicts"],
      ["matched", "match.assignments"],
      ["acquired", "acquisition.bundles"],
      ["classified", "classification.labelsets"],
      ["package", "package.assemblies"],
      ["provenance", "provenance.records"],
      ["quality", "quality.verdicts"],
      ["coverage", "coverage.view"],
      ["queue", "queue.items"],
    ];
    for (const [slice, kind] of kinds) {
      const value = outcome.state[slice];
      if (!value || (Array.isArray(value) && value.length === 0)) continue;
      seq += 1;
      ledger.entries.push({ seq, at: ranAtIso, payload_kind: kind, data: value });
    }
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n");

    const covPath = join(ROOT, "state", "odd-coverage.json");
    writeFileSync(covPath, JSON.stringify(outcome.state.coverage, null, 2) + "\n");
    console.log("\nwrote:", ledgerPath.replace(ROOT + "/", ""), "+ state/odd-coverage.json");
  }

  function countBy(values: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const v of values) out[v] = (out[v] ?? 0) + 1;
    return out;
  }

}

void main();
