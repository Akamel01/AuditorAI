// H5 loading-UX probe — READ-ONLY collector (no mutations, no src edits).
// Measures against a running build (default http://localhost:3000):
//   M1 time-to-first-skeleton (audit page + mission-control)
//   M3 time-to-complete (skeleton/loading gone, content or error settled)
//   M4 TTFB + LCP guardrail
//   M5 CLS window (cumulative layout shift during load)
//   M6 view-source bytes (raw document GET bytes)
//   M7 GET-payload SHA-256 hashes (document + sub-resource GETs during load)
//
// Design: N=20 per route, alternating cold (fresh context) / warm (same-context
// reload) => 10 cold + 10 warm. Fast-3G + 4x CPU via CDP on every page.
// Audit route uses sentinel IDs (probe-nonexistent) so the probe is strictly
// read-only: the page renders Skeleton, GETs 404, shows the error notice. No
// POST/PUT/PATCH/DELETE is ever issued (asserted at the end).
//
// Usage:
//   node scripts/probe/h5-measure.mjs [--base-url URL] [--n 20] [--out path]
// Output: JSON artifact consumed by scripts/probe/h5-compare.mjs.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a, i, arr) => {
    if (!a.startsWith("--")) return [];
    const eq = a.indexOf("=");
    if (eq > 0) return [[a.slice(2, eq), a.slice(eq + 1)]];
    const v = arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "true";
    return [[a.slice(2), v]];
  }),
);

const BASE_URL = args["base-url"] || process.env.PROBE_BASE_URL || "http://localhost:3000";
const N = Number(args.n || 20);
const OUT = resolve(args.out || "docs/probe/h5-baseline.json");

// Read-only routes. Audit uses sentinel IDs: renders Skeleton, GETs 404, no writes.
const ROUTES = [
  { name: "audit", path: "/projects/probe-nonexistent/audits/probe-nonexistent" },
  { name: "mission-control", path: "/dev/mission-control" },
];

const SKELETON_SEL = ".skeleton, [role='status'], .animate-pulse";
const SETTLE_TIMEOUT_MS = 20_000;

const pct = (sorted, q) => {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
};
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function emulate(ctx, page) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: ((1.6 * 1024 * 1024) / 8) | 0, // Fast 3G
    uploadThroughput: ((768 * 1024) / 8) | 0,
    latency: 150,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

const CLS_INIT = () => {
  window.__cls = 0;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
};

async function measureOnce(browser, request, route, i, warmCtx) {
  const cold = i % 2 === 0 || !warmCtx;
  const ctx = cold ? await browser.newContext() : warmCtx;
  const owned = cold;
  const page = await ctx.newPage();
  await page.addInitScript(CLS_INIT);
  await emulate(ctx, page);

  let mutation = null;
  page.on("request", (r) => {
    if (!["GET", "HEAD"].includes(r.method())) mutation = `${r.method()} ${r.url()}`;
  });

  const url = BASE_URL + route.path;
  const seen = new Map(); // url -> {status, bytes, hash}
  page.on("response", async (res) => {
    try {
      const req = res.request();
      if (req.method() !== "GET" || seen.has(res.url())) return;
      const buf = await res.body().catch(() => null);
      if (!buf) return;
      seen.set(res.url(), { status: res.status(), bytes: buf.length, hash: sha256(buf) });
    } catch {}
  });

  const t0 = Date.now();
  const docRespP = page.waitForResponse((r) => r.url() === url && r.request().method() === "GET");
  await page.goto(url, { waitUntil: "commit" });
  await docRespP.catch(() => null); // document response observed via response listener + nav timing

  // M1: first skeleton/loading paint.
  let m1 = null;
  try {
    await page.waitForSelector(SKELETON_SEL, { timeout: SETTLE_TIMEOUT_MS });
    m1 = Date.now() - t0;
  } catch {}

  // M3: settle — skeleton/loading gone (content or read-only error notice).
  let m3 = null;
  try {
    await page.waitForFunction(
      (sel) => document.querySelectorAll(sel).length === 0,
      SKELETON_SEL,
      { timeout: SETTLE_TIMEOUT_MS, polling: 100 },
    );
    m3 = Date.now() - t0;
  } catch {
    m3 = Date.now() - t0; // timeout value still recorded; flagged via settled:false
  }
  const settled = await page.evaluate((sel) => document.querySelectorAll(sel).length === 0, SKELETON_SEL);

  // M4: TTFB (playwright resource timing, fallback navigation timing) + LCP.
  let ttfb = null;
  try {
    ttfb = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return nav ? Math.round(nav.responseStart) : null;
    });
  } catch {}
  let lcp = null;
  try {
    lcp = await page.evaluate(async () => {
      const entries = performance.getEntriesByType("largest-contentful-paint");
      if (entries.length) return Math.round(entries[entries.length - 1].startTime);
      return await new Promise((res) => {
        const to = setTimeout(() => res(null), 1500);
        try {
          new PerformanceObserver((list, obs) => {
            const es = list.getEntries();
            clearTimeout(to);
            obs.disconnect();
            res(Math.round(es[es.length - 1].startTime));
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          clearTimeout(to);
          res(null);
        }
      });
    });
  } catch {}

  // M5: CLS accumulated during load window.
  const cls = await page.evaluate(() => window.__cls ?? null).catch(() => null);

  // M6/M7: raw document bytes via fresh GET (read-only) + hash.
  let docBytes = null;
  let docHash = null;
  try {
    const r = await request.get(url, { timeout: 15_000 });
    const buf = Buffer.from(await r.body());
    docBytes = buf.length;
    docHash = sha256(buf);
    if (!seen.has(url)) seen.set(url, { status: r.status(), bytes: docBytes, hash: docHash });
  } catch {}

  await page.close().catch(() => {});
  if (owned) await ctx.close().catch(() => {});
  return {
    iter: i,
    mode: owned ? "cold" : "warm",
    ctxReused: !owned,
    m1_ms: m1,
    m3_ms: m3,
    settled,
    ttfb_ms: ttfb,
    lcp_ms: lcp,
    cls,
    doc_bytes: docBytes,
    doc_hash: docHash,
    resources: [...seen.entries()].map(([u, v]) => ({ url: u.replace(BASE_URL, ""), ...v })),
    mutation,
    nextWarmCtx: owned ? null : ctx,
  };
}

const browser = await chromium.launch();
const request = await (await import("@playwright/test")).request.newContext({ baseURL: BASE_URL });
let mutations = [];
const out = {
  meta: { baseURL: BASE_URL, n: N, network: "Fast-3G", cpuThrottle: "4x", at: new Date().toISOString(), readOnly: true },
  routes: {},
};

for (const route of ROUTES) {
  const samples = [];
  let warmCtx = null;
  for (let i = 0; i < N; i++) {
    const s = await measureOnce(browser, request, route, i, warmCtx);
    if (s.mode === "cold") {
      warmCtx?.close?.().catch(() => {});
      warmCtx = await browser.newContext(); // becomes warm ctx for next iter
      s.nextWarmCtx = undefined;
    }
    if (s.mutation) mutations.push(s.mutation);
    const { nextWarmCtx: _drop, ...rest } = s;
    void _drop;
    samples.push(rest);
    process.stdout.write(`  ${route.name} #${i + 1}/${N} ${s.mode} m1=${s.m1_ms} m3=${s.m3_ms} ttfb=${s.ttfb_ms} lcp=${s.lcp_ms}\n`);
  }
  await warmCtx?.close?.().catch(() => {});
  const num = (k) => samples.map((s) => s[k]).filter((v) => typeof v === "number").sort((a, b) => a - b);
  const sum = (k) => {
    const vals = samples.map((s) => s[k]).filter((v) => typeof v === "number");
    const srt = [...vals].sort((a, b) => a - b);
    return { n: vals.length, p50: pct(srt, 50), p95: pct(srt, 95) };
  };
  out.routes[route.name] = {
    path: route.path,
    m1: sum("m1_ms"),
    m3: sum("m3_ms"),
    ttfb: sum("ttfb_ms"),
    lcp: sum("lcp_ms"),
    cls: sum("cls"),
    docBytes: sum("doc_bytes"),
    settledCount: samples.filter((s) => s.settled).length,
    // M7 determinism: distinct doc hashes across iters (0 divergence = 1 distinct).
    docHashes: [...new Set(samples.map((s) => s.doc_hash).filter(Boolean))],
    samples,
  };
  void num;
}

await request.dispose();
await browser.close();

out.mutations = mutations;
if (mutations.length) {
  console.error(`FATAL: probe issued non-GET requests: ${JSON.stringify(mutations)}`);
  process.exit(2);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`wrote ${OUT}`);
