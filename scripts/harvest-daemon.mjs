#!/usr/bin/env node
// R4 live daemon — production harvest proof bundle + productionDeploymentVerified
// Usage: node scripts/harvest-daemon.mjs [--once] [--intervalMs 30000]
// Env: KV_REST_API_URL, KV_REST_API_TOKEN, ADMIN_KEY (for proof route), VERCEL_URL or explicit --vercelUrl
// Ponytail: single file, stdlib only, no new deps, 120s TTL ceiling via harvest-lock

import { setTimeout as sleep } from "node:timers/promises";

async function runOnce() {
  // run discovery harvest live via internal harvest() seam (no HTTP)
  const { harvest } = await import("../src/discovery/harvest.ts");
  const { getDataStore } = await import("../src/lib/persistence/store.ts");
  const store = getDataStore();
  // gap-aware live harvest (uses top gaps from odd-coverage.json)
  const res = await harvest({ live: true, cellKey: null }, { store });
  console.log(`[R4 daemon] harvest queued ${res.jobId} providers ${res.providers.join(",")}`);
  // wait a bit for job to progress (best-effort, no polling loop)
  await sleep(2000);
  // verify production deployment via proof bundle
  try {
    const bundle = await store.get("discovery:proof:bundle");
    if (bundle) {
      console.log(`[R4 daemon] proof bundle ledgerDigest ${bundle.ledgerDigest.slice(0,12)}... dedupeDigest ${bundle.dedupeDigest.slice(0,12)}...`);
    } else {
      console.log("[R4 daemon] proof bundle not yet available (KV truth pending)");
    }
  } catch (e) {
    console.warn("[R4 daemon] proof bundle read failed", e.message);
  }

  // productionDeploymentVerified: check Vercel prod alias reachable
  const vercelUrl = process.env.VERCEL_URL || process.env.VERCEL_PROD_URL || "https://auditorai-gamma.vercel.app";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${vercelUrl.replace(/\/$/, "")}/api/dev/health`, { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) console.log(`[R4 daemon] productionDeploymentVerified ${vercelUrl} OK ${res.status}`);
    else console.warn(`[R4 daemon] productionDeploymentVerified ${vercelUrl} FAIL ${res.status}`);
  } catch (e) {
    console.warn(`[R4 daemon] productionDeploymentVerified failed ${e.message}`);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  const intervalIdx = process.argv.indexOf("--intervalMs");
  const intervalMs = intervalIdx !== -1 ? Number(process.argv[intervalIdx + 1]) : 30000;
  if (once) {
    await runOnce();
    return;
  }
  console.log(`[R4 daemon] starting interval ${intervalMs}ms, press Ctrl+C to stop`);
  // simple interval loop, no external scheduler
  while (true) {
    try {
      await runOnce();
    } catch (e) {
      console.error("[R4 daemon] runOnce error", e);
    }
    await sleep(intervalMs);
  }
}

if (process.argv[1]?.endsWith("harvest-daemon.mjs")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
