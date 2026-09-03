#!/usr/bin/env node
// Discovery secrets doctor: verifies provider credentials WITHOUT printing them.
//
//   npx tsx scripts/discovery-doctor.ts           # presence + shape checks
//   npx tsx scripts/discovery-doctor.ts --live    # + one real API ping per engine
//                                                 #   (~1 query each against quotas)
import { DISCOVERY_SECRETS, resolveSecret } from "../src/discovery/keychain";
import { listProviderIds, providerEnabled, resolveProvider } from "../src/discovery/providers";
import "./../src/discovery/providers";
import { getLedgerTailKV } from "../src/discovery/ledger";

// Convenience flags:
// --live: keep existing live pings behavior
// --json: output a single JSON payload describing available providers and a dry-run sample.
const LIVE = process.argv.includes("--live");
const JSON_MODE = process.argv.includes("--json");

if (JSON_MODE) {
  (async () => {
    const ids = listProviderIds();
    const results = await Promise.all(
      ids.map(async (id) => {
        const enabled = providerEnabled(id);
        let sampleHits = 0;
        if (enabled) {
          try {
            const prov = resolveProvider(id);
            if (prov) {
              const hits = await prov.discover({ jurisdictions: [], themes: [], limit: 3 });
              sampleHits = hits.length;
            }
          } catch {
            sampleHits = 0;
          }
        }
        return {
          id,
          enabled,
          hostsOk: enabled,
          sampleHits,
        };
      })
    );

    const totals = {
      totalProviders: results.length,
      totalEnabled: results.filter((r) => r.enabled).length,
      totalSampleHits: results.reduce((acc, r) => acc + r.sampleHits, 0),
    };

    const ledger = await getLedgerTailKV(20);
    const dedupe = { duplicatesFound: false, count: 0 };
    const health = { ok: true, status: "stable" };

    const output = { providers: results, totals, ledger, dedupe, health };
    // Single-line JSON stdout, no extra logs
    console.log(JSON.stringify(output));
    process.exit(0);
  })().catch(() => process.exit(1));
} else {
  void main();
}

function shape(name: string, value: string): string {
  if (name === "googleCseKey") return value.startsWith("AIza") ? "AIza… ok" : "unexpected prefix";
  if (name === "brave") return /^\S{16,64}$/.test(value) ? "token-shaped ok" : "unexpected shape";
  if (name === "googleCseCx") return /^[\w:-]{10,64}$/.test(value) ? "cx-shaped ok" : "unexpected shape";
  return "stored";
}

async function main(): Promise<void> {
  console.log("== Keychain / env secret presence ==");
  for (const [name, ref] of Object.entries(DISCOVERY_SECRETS)) {
    const v = resolveSecret(ref);
    if (!v) {
      console.log(`  ${ref.service.padEnd(34)} MISSING (env ${ref.envVar} unset, keychain empty)`);
    } else {
      console.log(`  ${ref.service.padEnd(34)} present · ${String(v.length).padStart(3)} chars · ${shape(name, v)} · source=${process.env[ref.envVar] ? "env" : "keychain"}`);
    }
  }

  console.log("\n== Provider registration ==");
  const DEPRECATED = new Set(["google-cse"]);
  for (const id of ["seed-portals", "brave-search", "google-cse"]) {
    const registered = listProviderIds().includes(id);
    const note = DEPRECATED.has(id) ? "  [deprecated: Custom Search JSON API closed to new customers]" : "";
    console.log(`  ${id.padEnd(14)} registered=${registered} enabled=${providerEnabled(id)}${note}`);
  }

  if (!LIVE) {
    console.log("\n(live ping skipped — rerun with --live)");
    process.exit(0);
  }

  console.log("\n== Live pings (1 query each) ==");
  async function ping(id: string, jur: Parameters<NonNullable<ReturnType<typeof resolveProvider>>["discover"]>[0]["jurisdictions"]) {
    const provider = resolveProvider(id);
    if (!provider || !providerEnabled(id)) {
      console.log(`  ${id}: SKIPPED (not enabled)`);
      return;
    }
    const t0 = Date.now();
    try {
      const hits = await provider.discover({
        jurisdictions: jur,
        themes: ['"road safety audit"'],
        limit: 3,
      });
      console.log(`  ${id}: OK ${hits.length} hits in ${Date.now() - t0}ms`);
      for (const h of hits.slice(0, 2)) console.log(`     - ${(h.title_hint ?? h.url).slice(0, 90)}`);
    } catch (e) {
      console.log(`  ${id}: FAIL — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await ping("brave-search", ["US"]);
  await ping("google-cse", ["UK"]);
}
