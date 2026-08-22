#!/usr/bin/env node
// M1 probe (#6): empirical Upstash-REST limits for image-as-data-URL storage.
// Usage: KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/measure-kv-limits.mjs
// Probes a scratch namespace only; deletes every key it creates (verifies cleanup).
import { createHash, randomBytes } from "node:crypto";

const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;
if (!URL_ || !TOKEN) {
  console.error("Set KV_REST_API_URL and KV_REST_API_TOKEN (see docs/deployment.md)");
  process.exit(2);
}

const NS = `probe:kvlimits:${randomBytes(4).toString("hex")}`;
const created = [];

// NOTE: Upstash REST accepts ONE flat command per request (["SET",k,v]).
// Pipeline form ([[..],[..]]) parses as a malformed single command (ERR
// unsupported arg type) — see side-finding on ratelimit.ts.
async function call(commands) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, ok: res.ok, body };
}

async function setGetDel(sizeBytes) {
  const payload = randomBytes(sizeBytes).toString("base64");
  const key = `${NS}:${sizeBytes}`;
  created.push(key);
  const t0 = performance.now();
  const set = await call(["SET", key, payload]);
  const setMs = Math.round(performance.now() - t0);
  if (!set.ok) return { sizeBytes, wireBytes: Buffer.byteLength(payload), ok: false, status: set.status, err: JSON.stringify(set.body).slice(0, 120), setMs };
  const t1 = performance.now();
  const get = await call(["GET", key]);
  const getMs = Math.round(performance.now() - t1);
  const back = typeof get.body?.result === "string" ? get.body.result : null;
  const intact = back !== null && createHash("sha256").update(back).digest("hex") === createHash("sha256").update(payload).digest("hex");
  return { sizeBytes, wireBytes: Buffer.byteLength(payload), ok: true, intact, setMs, getMs, status: set.status };
}

const SIZES = [100 * 1024, 500 * 1024, 1024 * 1024, 2 * 1024 * 1024, 4 * 1024 * 1024, 6 * 1024 * 1024, 8 * 1024 * 1024, 16 * 1024 * 1024, 32 * 1024 * 1024];
const rows = [];
let firstFailure = null;
for (const s of SIZES) {
  process.stdout.write(`probing ${Math.round(s / 1024)}KB ... `);
  try {
    const r = await setGetDel(s);
    rows.push(r);
    console.log(r.ok ? `OK ${r.setMs}ms/${r.getMs}ms intact=${r.intact}` : `FAIL ${r.status} ${r.err ?? ""}`);
    if (!r.ok) { firstFailure = r; break; }
  } catch (e) {
    rows.push({ sizeBytes: s, ok: false, err: String(e).slice(0, 160) });
    console.log(`THREW ${String(e).slice(0, 80)}`);
    firstFailure = { sizeBytes: s, err: String(e) };
    break;
  }
}

// median-of-3 latency at 500KB
const med = [];
for (let i = 0; i < 3; i++) med.push(await setGetDel(500 * 1024));
const lat = med.map((m) => m.setMs).sort((a, b) => a - b)[1];

console.log("\n=== RESULTS ===");
console.log("sizeKB | wireKB | SET ms | GET ms | intact");
for (const r of rows.filter((x) => x.ok)) console.log(`${Math.round(r.sizeBytes / 1024)} | ${Math.round(r.wireBytes / 1024)} | ${r.setMs} | ${r.getMs} | ${r.intact}`);
if (firstFailure) console.log(`FIRST FAILURE at ${Math.round((firstFailure.sizeBytes ?? 0) / 1024)}KB: ${firstFailure.err ?? firstFailure.status}`);
console.log(`median SET@500KB: ${lat}ms`);

// cleanup + verify
let clean = true;
for (const k of created) {
  const del = await call(["DEL", k]);
  const ex = await call(["EXISTS", k]);
  // DEL=0 is fine for keys that failed before SET (never existed); EXISTS must be 0.
  if (ex.body?.result !== 0) clean = false;
  if (del.status >= 400) clean = false;
}
console.log(clean ? "cleanup verified: all probe keys deleted" : "CLEANUP INCOMPLETE");
process.exit(clean ? 0 : 1);
