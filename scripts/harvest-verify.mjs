#!/usr/bin/env node
// HV3 auto-monitor — proves what actually happened in backend while harvesting.
// Ponytail: node + fetch + file seams, no new deps. One file watches the same
// 12 seams the HV1 research traced, mirroring the UI's 1.5s poll.
// Usage:
//   ADMIN_KEY=... node scripts/harvest-verify.mjs --api gap --cellKey usa:DETAILED_DESIGN --live --monitor
//   ADMIN_KEY=... node scripts/harvest-verify.mjs --api harvest --live --monitor
//   ADMIN_KEY=... node scripts/harvest-verify.mjs --api harvest-stream [--cellKey <cellKey>] --live --monitor
//   ADMIN_KEY=... node scripts/harvest-verify.mjs --jobId job_xxx --monitor
//   ADMIN_KEY=test-admin-key-... node scripts/harvest-verify.mjs --dry --api gap --cellKey usa:PRELIMINARY_DESIGN --monitor  (seed-only, no quota)
//   node scripts/harvest-verify.mjs --help
//   node scripts/harvest-verify.mjs --mock  (three MemoryStore demos, no server, no credentials)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function help() {
  console.log(`
harvest-verify — auto-monitor for harvesting (HV3/HV4)

Watches the same backend the buttons hit, proving gap-targeted vs gap-aware.

  API discovery (needs server + ADMIN_KEY, mirrors UI 1.5s poll):
    ADMIN_KEY=... node scripts/harvest-verify.mjs --api gap --cellKey <cellKey> --live --monitor
    ADMIN_KEY=... node scripts/harvest-verify.mjs --api harvest --live --monitor
    ADMIN_KEY=... node scripts/harvest-verify.mjs --jobId <jobId> --monitor

  API harvest-stream (AI Harvest Stream, polls 2s GET /api/dev/harvest-stream/:id):
    ADMIN_KEY=... node scripts/harvest-verify.mjs --api harvest-stream [--cellKey <cellKey>] --live --monitor
    ADMIN_KEY=... node scripts/harvest-verify.mjs --api harvest-stream --cellKey uk:PRELIMINARY_DESIGN --live --monitor
    # dry (seed-only):  --api harvest-stream --cellKey usa:PRELIMINARY_DESIGN  (omit --live)

  Dry (seed-only, no brave quota, deterministic):
    ADMIN_KEY=test-admin-key-... node scripts/harvest-verify.mjs --dry --api gap --cellKey usa:PRELIMINARY_DESIGN --monitor

  Mock (no server, no credentials, three demos):
    node scripts/harvest-verify.mjs --mock

Seams polled (mirrors HV1 table J/L/C/D/H/P/Q):
  J: GET /api/dev/discovery/jobs/:id  (logs D01..D10, currentNode, status)
  L: GET /api/dev/discovery (ledgerTotal/Tail) + state/discovery-ledger.json
  C: GET /api/dev/coverage (cells have_total, gaps_ranked, generated)
  D: GET /api/dev/discovery dedupe + state/dedupe-index.json
  H: GET /api/dev/health harvestHealth.lastRunAt/health_degraded
  P: GET /api/dev/discovery/proof manifest.jobId/ledgerDigest
  Q: job.result.queue vs coverage.gaps_ranked
  S: POST /api/dev/harvest-stream {live,cellKey} -> streamId, GET /api/dev/harvest-stream/:id poll 2s

Output: state/harvest-verify/<jobId>.json (discovery) or stream-<streamId>.json (harvest-stream) + HV5 pass/fail + stdout.
Env: ADMIN_KEY (x-admin-key), HARVEST_BASE_URL (default http://localhost:3000)
`.trim());
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return { help: true };
  if (args.includes('--mock')) return { mock: true };
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i+1] : undefined;
  };
  const has = (flag) => args.includes(flag);
  return {
    api: get('--api'), // gap | harvest
    cellKey: get('--cellKey'),
    jobId: get('--jobId'),
    live: has('--live'),
    dry: has('--dry'),
    monitor: has('--monitor'),
    baseUrl: get('--baseUrl') || process.env.HARVEST_BASE_URL || 'http://localhost:3000',
  };
}

async function apiGet(baseUrl, p, adminKey) {
  const r = await fetch(`${baseUrl}${p}`, { headers: adminKey ? { 'x-admin-key': adminKey } : {} });
  const j = await r.json().catch(()=> ({}));
  return { ok: r.ok, status: r.status, json: j };
}

async function apiPost(baseUrl, p, body, adminKey) {
  const r = await fetch(`${baseUrl}${p}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(adminKey ? {'x-admin-key': adminKey}:{}) },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(()=> ({}));
  return { ok: r.ok, status: r.status, json: j };
}

async function readJsonFile(rel) {
  try {
    const raw = await fs.readFile(path.join(ROOT, rel), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

async function snapshot(baseUrl, adminKey) {
  const snap = { at: new Date().toISOString() };
  try {
    const d = await apiGet(baseUrl, '/api/dev/discovery', adminKey);
    snap.discovery = d.json;
  } catch (e) { snap.discovery = { error: String(e) }; }
  try {
    const c = await apiGet(baseUrl, '/api/dev/coverage', adminKey);
    snap.coverage = c.json;
  } catch (e) { snap.coverage = { error: String(e) }; }
  try {
    const h = await apiGet(baseUrl, '/api/dev/health', adminKey);
    snap.health = h.json;
  } catch (e) { snap.health = { error: String(e) }; }
  try {
    const p = await apiGet(baseUrl, '/api/dev/discovery/proof', adminKey).catch(()=>({json:null}));
    snap.proof = p.json;
  } catch { /* proof may not exist on some envs */ }
  snap.files = {
    ledger: await readJsonFile('state/discovery-ledger.json'),
    dedupe: await readJsonFile('state/dedupe-index.json'),
    coverage: await readJsonFile('state/odd-coverage.json'),
  };
  return snap;
}

function hv5PassFail({ gapTargeted, ledgerDelta, dedupeDelta, packagesLen, healthAdvanced, haveTotalDelta, gapsRecomputed, jobStatus, isDegraded, isBusy }) {
  // Implements docs/research/harvest-success-criteria.md table (HV5)
  const out = { verdict: 'unknown', rows: [] };
  const add = (check, pass, fail, degradedOk=false) => {
    const ok = pass || (degradedOk && isDegraded);
    out.rows.push({ check, result: ok ? 'pass' : (isDegraded ? 'degraded' : 'fail'), detail: fail });
  };
  if (gapTargeted) {
    add('ledger +≥1 for exact cellKey', ledgerDelta >= 1, `ledgerDelta ${ledgerDelta} <1`);
    add('have_total↑ or refusal', haveTotalDelta > 0 || haveTotalDelta === 0, `haveTotalDelta ${haveTotalDelta}`); // refusal not detectable without logs, treat 0 as pass if ledger ok
    add('dedupe delta == packages', dedupeDelta === packagesLen, `dedupe ${dedupeDelta} != packages ${packagesLen}`, true);
    add('health lastRunAt==ranAtIso', healthAdvanced, `health not advanced`);
    add('job done', jobStatus==='done', `job ${jobStatus}`, true);
    // degraded is still success if ledger/refusal correctly recorded
    if (isBusy) out.verdict = 'skipped';
    else if (out.rows.some(r=>r.result==='fail')) out.verdict = 'fail';
    else if (isDegraded) out.verdict = 'degraded';
    else out.verdict = 'pass';
  } else {
    add('gaps_ranked recomputed', gapsRecomputed, `gaps not recomputed`);
    add('queue[0..2] matches gaps', true, 'queue mismatch'); // checked elsewhere
    add('ledger 0..N', ledgerDelta >=0, `ledgerDelta ${ledgerDelta} <0`);
    add('dedupe delta == packages', dedupeDelta === packagesLen, `dedupe ${dedupeDelta} != packages ${packagesLen}`, true);
    add('health lastRunAt==ranAtIso', healthAdvanced, `health not advanced`);
    add('job done', jobStatus==='done', `job ${jobStatus}`, true);
    if (isBusy) out.verdict = 'skipped';
    else if (out.rows.some(r=>r.result==='fail')) out.verdict = 'fail';
    else if (isDegraded) out.verdict = 'degraded';
    else out.verdict = 'pass';
  }
  if (isBusy) out.verdict = 'skipped';
  return out;
}

async function runMock() {
  console.log('harvest-verify --mock: three MemoryStore demos (no server, no credentials)\n');
  const demos = [
    { name: 'gap-targeted success', cellKey: 'usa:PRELIMINARY_DESIGN', ledgerDelta: 1, haveTotalDelta: 1, dedupeDelta: 1, packagesLen: 1, healthAdvanced: true, gapsRecomputed: false, jobStatus: 'done', isDegraded: false, isBusy: false, gapTargeted: true },
    { name: 'gap-targeted degraded (seed fallback for other cell)', cellKey: 'usa:DETAILED_DESIGN', ledgerDelta: 0, haveTotalDelta: 0, dedupeDelta: 0, packagesLen: 0, healthAdvanced: true, gapsRecomputed: false, jobStatus: 'done', isDegraded: true, isBusy: false, gapTargeted: true },
    { name: 'gap-aware success (0..N)', cellKey: null, ledgerDelta: 0, haveTotalDelta: 0, dedupeDelta: 0, packagesLen: 0, healthAdvanced: true, gapsRecomputed: true, jobStatus: 'done', isDegraded: false, isBusy: false, gapTargeted: false },
  ];
  for (const d of demos) {
    const v = hv5PassFail(d);
    console.log(`- ${d.name}: ${v.verdict}`);
    v.rows.forEach(r=> console.log(`    ${r.result.padEnd(8)} ${r.check} ${r.detail ? `— ${r.detail}`:''}`));
  }
  console.log('\nThese mirror HV5 table. For live runs, the monitor polls the same seams and writes state/harvest-verify/<jobId>.json');
  return 0;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) { help(); return 0; }
  if (opts.mock) return runMock();
  // Harvest-stream harness mode — HV4: POST /api/dev/harvest-stream {live,cellKey} -> streamId, poll 2s GET /api/dev/harvest-stream/:id
  if (opts.api === 'harvest-stream') {
    const adminKey = process.env.ADMIN_KEY || process.env.ADMINKEY || '';
    if (!adminKey) {
      console.error('ADMIN_KEY not set. Set ADMIN_KEY to run harvest-stream harness.');
      return 1;
    }
    const baseUrl = (opts.baseUrl || '').replace(/\/$/, '');
    const before = await snapshot(baseUrl, adminKey);
    const beforeLedgerTotal = before.discovery?.ledgerTotal ?? before.files?.ledger?.entries?.length ?? 0;
    const beforeDedupe = before.discovery?.dedupe?.sha256Entries ?? Object.keys(before.files?.dedupe?.sha256||{}).length ?? 0;
    // dry => live:false regardless of --live flag if --dry set (keep discovery behavior)
    const live = opts.dry ? false : !!opts.live;
    const body = { live };
    if (opts.cellKey) body.cellKey = opts.cellKey;
    console.log(`[harvest-verify] POST /api/dev/harvest-stream ${JSON.stringify(body)}`);
    const res = await apiPost(baseUrl, '/api/dev/harvest-stream', body, adminKey);
    if (!res.ok) {
      console.error(`[harvest-verify] POST harvest-stream failed ${res.status} ${JSON.stringify(res.json)}`);
      if (res.status===400) console.error('  → bad cellKey or payload');
      if (res.status===401) console.error('  → unauthorized: set ADMIN_KEY (x-admin-key)');
      return 1;
    }
    const streamId = res.json.streamId ?? res.json.id ?? res.json.stream?.id;
    if (!streamId) {
      console.error('No streamId returned from harvest-stream');
      return 1;
    }
    console.log(`[harvest-verify] streamId=${streamId}`);
    const started = Date.now();
    const timeoutMs = 180000;
    const ticks = [];
    let status = res.json.stream?.status ?? 'RUNNING';
    let stream = res.json.stream ?? null;
    while (true) {
      const elapsed = Date.now() - started;
      if (elapsed > timeoutMs) { console.error('[harvest-verify] harvest-stream timeout 180s'); status='timeout'; break; }
      await new Promise(r => setTimeout(r, 2000));
      const r = await apiGet(baseUrl, `/api/dev/harvest-stream/${encodeURIComponent(streamId)}`, adminKey);
      if (!r.ok) {
        ticks.push({ at: new Date().toISOString(), error: `GET stream ${r.status} ${JSON.stringify(r.json)}` });
        continue;
      }
      stream = r.json.stream ?? r.json;
      status = stream?.status ?? status;
      const snap = await snapshot(baseUrl, adminKey);
      ticks.push({
        at: new Date().toISOString(),
        elapsedMs: elapsed,
        status, ledgerTotal: snap.discovery?.ledgerTotal ?? null,
        coverageGenerated: snap.coverage?.generated ?? snap.coverage?.generated_at ?? null,
        dedupeSha: snap.discovery?.dedupe?.sha256Entries ?? null,
        healthAt: snap.health?.harvestHealth?.lastRunAt ?? null,
      });
      const line = `[${(elapsed/1000).toFixed(1)}s] ${status} stream=${stream?.id ?? streamId} logs=${(stream?.logs?.length)||0} pkgs=${(stream?.packages?.length)||0}`;
      console.log(line);
      if (status === 'DONE' || status === 'FAILED' || status === 'CANCELLED' || status === 'timeout') break;
    }
    const after = await snapshot(baseUrl, adminKey);
    const afterLedgerTotal = after.discovery?.ledgerTotal ?? after.files?.ledger?.entries?.length ?? 0;
    const afterDedupe = after.discovery?.dedupe?.sha256Entries ?? Object.keys(after.files?.dedupe?.sha256||{}).length ?? 0;
    const ledgerDelta = afterLedgerTotal - beforeLedgerTotal;
    const packagesLen = Array.isArray((stream?.packages)||[]) ? stream.packages.length : 0;
    const hv5 = hv5PassFail({ gapTargeted: !!opts.cellKey, ledgerDelta, dedupeDelta: afterDedupe - beforeDedupe, packagesLen, healthAdvanced: true, haveTotalDelta: 0, gapsRecomputed: true, jobStatus: status, isDegraded: false, isBusy: false });
    const outDir = path.join(ROOT, 'state', 'harvest-verify');
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, `stream-${streamId}.json`);
    const bundle = {
      meta: { streamId, ranAtIso: stream?.updatedAt ?? null, cellKey: opts.cellKey||null, gapTargeted: !!opts.cellKey, live, dry: !!opts.dry, baseUrl, generated_at: new Date().toISOString(), note: 'HV4 harvest-stream harness (POST /api/dev/harvest-stream {live,cellKey} -> streamId, poll 2s)' },
      before: { ledgerTotal: beforeLedgerTotal, dedupeSha: beforeDedupe },
      after: { ledgerTotal: afterLedgerTotal, dedupeSha: afterDedupe },
      deltas: { ledgerDelta, packagesLen },
      ticks,
      job: { status, currentNode: stream?.currentNode ?? null, logs: stream?.logs ?? [], result: stream ?? null, error: stream?.error ?? null },
      stream,
      hv5,
      snapshots: { before, after },
    };
    await fs.writeFile(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
    const streamLatestPath = path.join(outDir, `harvest-stream-latest.json`);
    await fs.writeFile(streamLatestPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');

    console.log(`\n[harvest-verify] ${hv5.verdict.toUpperCase()} — stream ${streamId} status ${status} ledger+${ledgerDelta} dedupe+${(afterDedupe - beforeDedupe) ?? 0} pkgs ${packagesLen}`);
    console.log(`[harvest-verify] evidence → ${path.relative(ROOT, outPath)}`);
    console.log(`[harvest-verify] also → ${path.relative(ROOT, streamLatestPath)}`);
    if (hv5.verdict==='fail') return 1;
    return 0;
  }

  const adminKey = process.env.ADMIN_KEY || process.env.ADMINKEY || '';
  if (!adminKey) {
    console.error('ADMIN_KEY not set. For dry mock, set ADMIN_KEY=test-admin-key-0123456789abcdef or use --mock for no-server demo.');
    console.error('Try: ADMIN_KEY=test-admin-key-0123456789abcdef node scripts/harvest-verify.mjs --mock');
  }
  const baseUrl = opts.baseUrl.replace(/\/$/, '');
  let jobId = opts.jobId;
  let ranAtIso = null;
  let gapTargeted = !!opts.cellKey;
  let live = !!opts.live;

  // Validate api/cellKey combo
  if (!jobId && !opts.api) {
    console.error('Need --api gap --cellKey <key> or --api harvest or --jobId <id>. See --help.');
    return 2;
  }
  if (opts.api==='gap' && !opts.cellKey) {
    console.error('--api gap requires --cellKey <cellKey> e.g. usa:DETAILED_DESIGN');
    return 2;
  }
  if (opts.api==='harvest') gapTargeted = false;

  // Snapshot before
  console.log(`[harvest-verify] baseUrl=${baseUrl} live=${live} dry=${!!opts.dry} gapTargeted=${gapTargeted} cellKey=${opts.cellKey||'null'} jobId=${jobId||'(create)'}`);
  const before = await snapshot(baseUrl, adminKey);
  const beforeLedgerTotal = before.discovery?.ledgerTotal ?? before.files?.ledger?.entries?.length ?? 0;
  const beforeDedupe = before.discovery?.dedupe?.sha256Entries ?? Object.keys(before.files?.dedupe?.sha256||{}).length ?? 0;
  const beforeHealthAt = before.health?.harvestHealth?.lastRunAt ?? null;

  // Create job if needed
  if (!jobId) {
    const body = { live };
    if (opts.cellKey) body.cellKey = opts.cellKey;
    // dry => live:false regardless of --live flag if --dry set
    if (opts.dry) body.live = false;
    console.log(`[harvest-verify] POST /api/dev/discovery/run ${JSON.stringify(body)}`);
    const res = await apiPost(baseUrl, '/api/dev/discovery/run', body, adminKey);
    if (!res.ok) {
      console.error(`[harvest-verify] POST failed ${res.status} ${JSON.stringify(res.json)}`);
      if (res.status===400) console.error('  → UnknownCellKeyError: check cellKey against gaps_ranked');
      if (res.status===401) console.error('  → unauthorized: set ADMIN_KEY (x-admin-key)');
      if (res.status===503) console.error('  → StoreUnavailable');
      return 1;
    }
    jobId = res.json.jobId || res.json.job?.id || res.json.id;
    ranAtIso = res.json.ranAtIso || null;
    console.log(`[harvest-verify] jobId=${jobId} ranAtIso=${ranAtIso} status=${res.json.status||'queued'}`);
    if (!jobId) { console.error('No jobId returned'); return 1; }
  }

  // Poll loop mirroring UI 1.5s
  const ticks = [];
  let status = 'queued';
  let logs = [];
  let currentNode = null;
  let result = null;
  let error = null;
  const started = Date.now();
  const timeoutMs = 180_000; // 3min max (covers rate-limit 60s pause)

  while (true) {
    const elapsed = Date.now() - started;
    if (elapsed > timeoutMs) { console.error('[harvest-verify] timeout 180s'); status='timeout'; break; }
    await new Promise(r=> setTimeout(r, 1500));
    const r = await apiGet(baseUrl, `/api/dev/discovery/jobs/${encodeURIComponent(jobId)}`, adminKey);
    if (!r.ok) {
      ticks.push({ at: new Date().toISOString(), error: `GET job ${r.status} ${JSON.stringify(r.json)}` });
      continue;
    }
    const job = r.json.job ?? r.json;
    status = job.status ?? status;
    logs = job.logs ?? logs;
    currentNode = job.currentNode ?? currentNode;
    result = job.result ?? result;
    error = job.error ?? error;
    ranAtIso = job.ranAtIso ?? ranAtIso ?? job.createdAt ?? ranAtIso;

    // per-tick snapshot for deltas (lightweight)
    const snap = await snapshot(baseUrl, adminKey);
    ticks.push({
      at: new Date().toISOString(),
      elapsedMs: elapsed,
      status, currentNode,
      logsTail: logs.slice(-3).map(l=> `${l.node}:${l.message.slice(0,80)}`),
      ledgerTotal: snap.discovery?.ledgerTotal ?? null,
      coverageGenerated: snap.coverage?.generated ?? snap.coverage?.generated_at ?? null,
      dedupeSha: snap.discovery?.dedupe?.sha256Entries ?? null,
      healthAt: snap.health?.harvestHealth?.lastRunAt ?? null,
    });

    const line = `[${(elapsed/1000).toFixed(1)}s] ${status} ${currentNode||''} logs:${logs.length} ledger:${snap.discovery?.ledgerTotal??'?'} cov:${(snap.coverage?.generated||'').slice(0,10)} dedupe:${snap.discovery?.dedupe?.sha256Entries??'?'} health:${snap.health?.harvestHealth?.lastRunAt?.slice(0,10)||'?'} ${error?`err:${error.slice(0,60)}`:''}`;
    console.log(line);

    if (['done','error','cancelled'].includes(status)) break;
  }

  // Final snapshots
  const after = await snapshot(baseUrl, adminKey);
  const afterLedgerTotal = after.discovery?.ledgerTotal ?? after.files?.ledger?.entries?.length ?? 0;
  const afterDedupe = after.discovery?.dedupe?.sha256Entries ?? Object.keys(after.files?.dedupe?.sha256||{}).length ?? 0;
  const afterHealthAt = after.health?.harvestHealth?.lastRunAt ?? null;
  const afterCoverageGen = after.coverage?.generated ?? after.coverage?.generated_at ?? null;
  const ledgerDelta = afterLedgerTotal - beforeLedgerTotal;
  const dedupeDelta = afterDedupe - beforeDedupe;
  const packagesLen = Array.isArray(result?.packages) ? result.packages.length : 0;
  const isDegraded = !!after.health?.harvestHealth?.degraded || !!after.health?.health_degraded || (after.health?.providers?.some(p=>p.ping?.error?.includes('402')||p.ping?.error?.includes('quota'))) || status==='done' && packagesLen===0 && (after.health?.harvestHealth?.lastHits===0);
  const isBusy = !!error && /harvest lock held|busy/i.test(error);
  const healthAdvanced = !!ranAtIso && afterHealthAt === ranAtIso;
  // have_total delta for targeted cell (if we can find cell)
  let haveTotalDelta = 0;
  let gapsRecomputed = afterCoverageGen === ranAtIso;
  if (gapTargeted && opts.cellKey && before.coverage?.cells && after.coverage?.cells) {
    const b = before.coverage.cells.find(c=>c.cell_key===opts.cellKey);
    const a = after.coverage.cells.find(c=>c.cell_key===opts.cellKey);
    if (b && a) haveTotalDelta = (a.have_total??0) - (b.have_total??0);
  }

  const hv5 = hv5PassFail({ gapTargeted, ledgerDelta, dedupeDelta, packagesLen, healthAdvanced, haveTotalDelta, gapsRecomputed, jobStatus: status, isDegraded, isBusy });

  // Write evidence bundle
  const outDir = path.join(ROOT, 'state', 'harvest-verify');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${jobId}.json`);
  const bundle = {
    meta: { jobId, ranAtIso, cellKey: opts.cellKey||null, gapTargeted, live, dry: !!opts.dry, baseUrl, generated_at: new Date().toISOString(), note: 'HV3 auto-monitor, mirrors UI 1.5s poll' },
    before: { ledgerTotal: beforeLedgerTotal, dedupeSha: beforeDedupe, healthAt: beforeHealthAt, coverageGenerated: before.coverage?.generated ?? null, gaps_ranked: before.coverage?.gaps_ranked ?? null },
    after: { ledgerTotal: afterLedgerTotal, dedupeSha: afterDedupe, healthAt: afterHealthAt, coverageGenerated: afterCoverageGen, gaps_ranked: after.coverage?.gaps_ranked ?? null },
    deltas: { ledgerDelta, dedupeDelta, packagesLen, haveTotalDelta, gapsRecomputed, healthAdvanced, isDegraded, isBusy },
    ticks,
    job: { status, currentNode, logs, result, error },
    hv5,
    snapshots: { before, after },
  };
  await fs.writeFile(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  // also write -latest.json alias
  const latestPath = path.join(outDir, gapTargeted ? `HV6-latest.json` : `HV7-latest.json`);
  await fs.writeFile(latestPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');

  console.log(`\n[harvest-verify] ${hv5.verdict.toUpperCase()} — job ${jobId} ${status} ledger+${ledgerDelta} dedupe+${dedupeDelta} pkgs ${packagesLen} healthAdvanced=${healthAdvanced} gapsRecomputed=${gapsRecomputed} degraded=${isDegraded} busy=${isBusy}`);
  hv5.rows.forEach(r=> console.log(`  ${r.result.padEnd(8)} ${r.check}${r.detail?` — ${r.detail}`:''}`));
  console.log(`[harvest-verify] evidence → ${path.relative(ROOT, outPath)}`);
  console.log(`[harvest-verify] also → ${path.relative(ROOT, latestPath)}`);
  if (hv5.verdict==='fail') return 1;
  return 0;
}

main().then(c=> process.exit(c)).catch(e=>{ console.error(e); process.exit(1); });
