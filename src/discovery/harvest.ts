// Harvest orchestration — extracted from POST /api/dev/discovery/run for C6.
// Route keeps only requireAdmin, body parse, harvest() delegate, 202 {jobId}
// and after() fire-and-forget. This module owns query derivation, provider
// resolution, coverage/dedupe reads, fixtureDocsFor, and the executeJob loop.
// DataStore seam injection via optional store param (MemoryStore for tests).
import { readFileSync } from "node:fs";
import path from "node:path";
import { listProviderIds as defaultListProviderIds, providerEnabled as defaultProviderEnabled, resolveProvider as defaultResolveProvider } from "@/discovery/providers";
import "@/discovery/providers";
import { DISCOVERY_NODE_IDS } from "@/discovery/types";
import { runDiscoveryNode, type DiscoveryCtx, type RawDocument } from "@/discovery/pipeline";
import type { MatchAssignment } from "@/discovery/types";
import { appendLog, createJob, setJobDone, setJobError, setJobRunning, updateJob, getJob } from "@/discovery/jobs";
import { getLedgerTailKV } from "./ledger";
import type { LedgerEntry } from "./ledger";
import type { DataStore } from "@/lib/persistence";

export const DEPRECATED_PROVIDERS = new Set(["google-cse"]);

export const JUR_MAP: Record<string, "UK" | "US" | "CA" | "AE" | "INT"> = {
  uk: "UK",
  usa: "US",
  canada: "CA",
  international: "INT",
  ae: "AE",
  uae: "AE",
};

export function themeFor(cellKey: string): string {
  if (cellKey.includes("DETAILED_DESIGN")) return "final design road safety audit";
  if (cellKey.includes("FEASIBILITY_CONCEPT")) return "feasibility concept road safety audit";
  return "preliminary design road safety audit";
}

export function fixtureDocsFor(match: MatchAssignment): RawDocument[] {
  const mk = (name: string, text: string): Uint8Array =>
    new TextEncoder().encode(`%PDF-1.4 fixture ${match.jurisdiction} ${match.native_stage_id} ${name}\n${text}`);
  if (match.jurisdiction === "UK") {
    return [
      { url: `https://fixtures.invalid/uk-s1-rsa-report.pdf`, bytes: mk("report", "Road Safety Audit Report Stage 1 preliminary design"), mime: "application/pdf" as const },
      { url: `https://fixtures.invalid/uk-s1-general-arrangement-drawings.pdf`, bytes: mk("drawings", "General arrangement drawings cross-section layout sheets"), mime: "application/pdf" as const },
      { url: `https://fixtures.invalid/uk-s1-designer-response-report.pdf`, bytes: mk("response", "Designer response report decision log"), mime: "application/pdf" as const },
    ];
  }
  return [
    {
      url: `https://fixtures.invalid/${match.jurisdiction.toLowerCase()}-rsa-report.pdf`,
      bytes: mk("report", "Road Safety Audit Report"),
      mime: "application/pdf" as const,
    },
  ];
}

export class UnknownCellKeyError extends Error {
  constructor(cellKey: string) {
    super(`unknown cellKey ${cellKey}`);
    this.name = "UnknownCellKeyError";
  }
}

export interface HarvestDeps {
  store?: DataStore;
  /** Override file reader for tests; default readFileSync */
  readFileSync?: (p: string, encoding: string) => string;
  cwd?: () => string;
  listProviderIds?: () => string[];
  providerEnabled?: (id: string) => boolean;
  resolveProvider?: (id: string) => ReturnType<typeof defaultResolveProvider>;
  nowIso?: () => string;
}

export interface HarvestInput {
  live?: boolean;
  cellKey?: string | null;
}

export interface HarvestResult {
  jobId: string;
  status: "queued";
  ranAtIso: string;
  live: boolean;
  cellKey: string | null;
  providers: string[];
  // Exposed for after() scheduling without re-deriving
  ctx: DiscoveryCtx;
  providerIds: string[];
}

function resolveCwd(deps?: HarvestDeps): string {
  return deps?.cwd ? deps.cwd() : process.cwd();
}

function resolveRead(deps?: HarvestDeps): (p: string, enc: string) => string {
  return deps?.readFileSync ?? ((p: string, enc: string) => readFileSync(p, enc as BufferEncoding) as unknown as string);
}


// Simple, process-wide harvest lock to avoid concurrent writes/ledger races.
// Note: This lock is intentionally process-local only. It cannot prevent
// cross-instance (e.g., multi-process or serverless) races. The documentation
// and upgrade path live in source comments and artifacts below the hatrack.
// See also the notes in MAPs/evidence for KV/CAS upgrade guidance.
let HARVEST_LOCK = false;

export async function executeJob(
  jobId: string,
  ctx: DiscoveryCtx,
  providerIds: string[],
  ranAtIso: string,
  deps?: HarvestDeps,
): Promise<void> {
  // Early cancellation check: if the job has already been cancelled server-side,
  // bail out before acquiring the process-wide lock. This ensures idempotent
  // cancellation semantics and prevents wasted work.
  const storeForCheck = deps?.store;
  try {
    const cur = await getJob(jobId, storeForCheck);
    if (cur && cur.status === "cancelled") {
      // Best-effort log, but do not proceed with harvesting.
      try {
        await appendLog(jobId, { at: new Date().toISOString(), node: "D00-CANCELLED", message: "harvest cancelled (server)" }, storeForCheck);
      } catch {
        // ignore log failure
      }
      return;
    }
  } catch {
    // ignore cancellation check failures; proceed defensively
  }
  // Guard against concurrent harvest invocations within the same process.
  // If the lock is already held, we currently throw to surface a clear
  // busy-state. Callers may catch this on fire-and-forget paths and surface
  // a best-effort notification. Note: this does not protect across multiple
  // processes or serverless instances.
  // If a harvest is already in progress, mark the queued job as a terminal error
  // and return early to avoid unhandled rejections downstream. This is a best-effort
  // path and does not attempt to release locks (there is no acquired lock in this
  // branch).
  if (HARVEST_LOCK) {
    try {
      // best-effort: record the failure without relying on a global hook
      await setJobError(jobId, "harvest is already running", deps?.store);
    } catch {
      // swallow any errors from the best-effort path to avoid masking the original state
    }
    return;
  }
  HARVEST_LOCK = true;
  // Capture common dependencies in outer scope so both the main path and
  // error-handling catch blocks can reference them.
  const store = deps?.store;
  // nowIso is a function returning ISO string; default to Date.now() string if not provided
  const nowIso = (deps?.nowIso ?? (() => new Date().toISOString())) as () => string;
  try {
    // Remove the unnecessary inner try. Do the work directly and rely on the
    // outer catch/finally to handle errors and release the lock.
    await setJobRunning(jobId, "D01-DISCOVER", store);
    await appendLog(jobId, { at: nowIso(), node: "D00-QUEUED", message: `providers ${providerIds.join(",")} query jurs=${ctx.query.jurisdictions.join(",")} themes=${ctx.query.themes.slice(0, 2).join(" | ")}` }, store);

    let state: Record<string, unknown> = {};
    const artifacts: unknown[] = [];
    let refusals: string[] = [];

    for (const nodeId of DISCOVERY_NODE_IDS) {
      // per-node cancellation poll — ponytail: one guard in shared function, smallest diff
      try {
        const cur2 = await getJob(jobId, store);
        if (cur2 && cur2.status === "cancelled") {
          await appendLog(jobId, { at: nowIso(), node: "D00-CANCELLED", message: `harvest cancelled before ${nodeId}` }, store);
          return;
        }
      } catch {}
      await updateJob(jobId, { currentNode: nodeId }, store);
      await appendLog(jobId, { at: nowIso(), node: nodeId, message: `start ${nodeId}` }, store);
      const t0 = Date.now();
      const res = await runDiscoveryNode(nodeId as never, state as never, ctx);
      state = { ...state, ...res.patch };
      if (res.artifacts?.length) artifacts.push(...res.artifacts);
      if (res.refusals?.length) refusals = [...refusals, ...res.refusals];
      const patchKeys = Object.keys(res.patch).join(",");
      const elapsed = Date.now() - t0;
      await appendLog(jobId, {
        at: nowIso(),
        node: nodeId,
        message: `done ${nodeId} — patch ${patchKeys || "none"} artifacts ${res.artifacts.length} refusals ${res.refusals?.length ?? 0} ${elapsed}ms`,
      }, store);
    }

    const s = state as {
      coverage?: unknown;
      queue?: unknown[];
      package?: unknown[];
      discovery_hits?: unknown[];
      matched?: unknown[];
      quality?: unknown[];
      qualified?: unknown[];
      acquired?: unknown[];
      classified?: unknown[];
      provenance?: unknown[];
    };

    // Persist ledger and dedupe before marking the job done to avoid
    // race conditions with visibility-triggered reloads.
  let persistedEntries: import("./ledger").LedgerEntry[] = [];
  if (process.env.VITEST !== "true" && process.env.NODE_ENV !== "test") {
    try {
      persistedEntries = await persistDiscoveryState(s, ranAtIso, store);
    } catch (e) {
      await appendLog(jobId, { at: nowIso(), node: "PERSIST-WARN", message: `persist skipped: ${e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)}` }, store);
    }
  }
  // KV mirror best-effort (survives Vercel lambda) – always attempt with
  // whatever entries we derived, even if FS writes failed
  try {
    const { appendLedgerKV } = await import("./ledger");
    await appendLedgerKV(persistedEntries, store);
  } catch {}
    // Dedupe claim-and-merge (B1)
    try {
      const { persistDedupeFromResult } = await import("./dedupe-persist");
      const pkgs = (s.package as unknown as import("./types").ProjectPackageAssembly[]) ?? [];
      const bundles = (s.acquired as unknown as import("./types").AcquisitionBundle[]) ?? [];
      const quals = (s.quality as unknown as import("./types").QualityVerdictRecord[]) ?? [];
      await persistDedupeFromResult(pkgs, bundles, quals, store);
    } catch {}

  await setJobDone(jobId, {
       ranAtIso,
       coverage: (s.coverage as unknown) ?? null,
       queue: (s.queue as unknown[]) ?? [],
       packages: (s.package as unknown[]) ?? [],
       hits: (s.discovery_hits as unknown[]) ?? [],
       matched: (s.matched as unknown[]) ?? [],
       refusals,
       quality: (s.quality as unknown[]) ?? [],
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     } as any, store);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await appendLog(jobId, { at: nowIso(), node: "ERROR", message: msg.slice(0, 500) }, store);
    await setJobError(jobId, msg.slice(0, 2000), store);
  } finally {
    // Release the in-progress lock regardless of success or failure
    HARVEST_LOCK = false;
  }
}

async function persistDiscoveryState(
  state: Record<string, unknown>,
  ranAtIso: string,
  store?: DataStore,
): Promise<import("./ledger").LedgerEntry[]> {
  // Derive new ledger entries from in-memory state and persist in a
  // best-effort way. If the filesystem is read-only, swallow write errors
  // and still return the derived entries so downstream KV path can proceed.
  const { readFileSync, writeFileSync, existsSync, mkdirSync } = await import("node:fs");
  const cwd = process.cwd();
  const ledgerPath = path.join(cwd, "state", "discovery-ledger.json");
  const covPath = path.join(cwd, "state", "odd-coverage.json");
  // Load existing ledger if possible; otherwise start fresh.
  let ledgerEntries: LedgerEntry[] = [];
  try {
    const raw = readFileSync(ledgerPath, "utf8");
    const parsed = JSON.parse(raw) as { entries: LedgerEntry[] };
    ledgerEntries = parsed.entries ?? [];
  } catch {
    ledgerEntries = [];
  }

  // Determine a safe starting sequence using the existing ledger tail via KV.
  let lastSeq = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].seq : 0;
  try {
    const tail = await getLedgerTailKV(50, store);
    if (tail.total > 0 && tail.entries.length > 0) {
      const tailLast = tail.entries[tail.entries.length - 1].seq;
      if (typeof tailLast === "number" && tailLast > lastSeq) lastSeq = tailLast;
    }
  } catch {
    // ignore tail lookup failures
  }
  let nextSeq = lastSeq;
  const kinds: [string, string][] = [
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
  const appended: LedgerEntry[] = [];
  for (const [slice, kind] of kinds) {
    const value = state[slice];
    if (value == null || (Array.isArray(value) && value.length === 0)) continue;
    if (kind === "coverage.view" && typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) continue;
    nextSeq += 1;
    const entry: LedgerEntry = { seq: nextSeq, at: ranAtIso, payload_kind: kind, data: value as unknown };
    ledgerEntries.push(entry);
    appended.push(entry);
  }
  // Best-effort writes
  try {
    const dir = path.dirname(ledgerPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // Keep the file mirror in sync when possible
    const ledgerObj = { entries: ledgerEntries };
    writeFileSync(ledgerPath, JSON.stringify(ledgerObj, null, 2) + "\n", "utf8");
  } catch {
    // swallow FS errors to preserve operation in read-only environments
  }
  try {
    if (state.coverage && typeof state.coverage === "object") {
      const covDir = path.dirname(covPath);
      if (!existsSync(covDir)) mkdirSync(covDir, { recursive: true });
      writeFileSync(covPath, JSON.stringify(state.coverage, null, 2) + "\n", "utf8");
    }
  } catch {
    // swallow
  }
  return appended;
}

export async function harvest(input: HarvestInput, deps?: HarvestDeps): Promise<HarvestResult> {
  const LIVE = input.live === true;
  const cellKey = typeof input.cellKey === "string" && input.cellKey.length > 0 ? input.cellKey : null;

  const cwd = resolveCwd(deps);
  const read = resolveRead(deps);
  const listIds = deps?.listProviderIds ?? defaultListProviderIds;
  const isEnabled = deps?.providerEnabled ?? defaultProviderEnabled;
  const resolve = deps?.resolveProvider ?? defaultResolveProvider;
  const nowIso = deps?.nowIso ?? (() => new Date().toISOString());

  if (cellKey) {
    try {
      const oddRaw = read(path.join(cwd, "policies", "odd.json"), "utf8");
      const odd = JSON.parse(oddRaw) as { cells: { jurisdiction_id: string; canonical_stage: string[] }[] };
      const normalizedCellKeys = new Set(
        odd.cells.map((c) => `${c.jurisdiction_id}:${[...c.canonical_stage].sort().join("+")}`),
      );
      if (!normalizedCellKeys.has(cellKey)) {
        throw new UnknownCellKeyError(cellKey);
      }
    } catch (e) {
      if (e instanceof UnknownCellKeyError) throw e;
      // best-effort — ignore read/parse failures
    }
  }

  const providerIds = LIVE
    ? (["seed-portals", ...listIds().filter((p) => p !== "seed-portals" && isEnabled(p) && !DEPRECATED_PROVIDERS.has(p))] as string[])
    : (["seed-portals"] as string[]);
  const providers = providerIds
    .map((id) => resolve(id))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const ranAtIso = LIVE ? nowIso() : new Date(0).toISOString();

  let queryJurs: ("UK" | "US" | "CA" | "AE" | "INT")[] | null = null;
  let queryThemes: string[] | null = null;

  if (cellKey) {
    const jurDir = cellKey.split(":")[0].toLowerCase();
    const jur = JUR_MAP[jurDir] ?? "INT";
    queryJurs = [jur];
    queryThemes = [themeFor(cellKey)];
  } else {
    try {
      const covRaw = read(path.join(cwd, "state", "odd-coverage.json"), "utf8");
      const cov = JSON.parse(covRaw) as { gaps_ranked: string[] };
      const top = (cov.gaps_ranked as string[]).slice(0, 3);
      if (top.length) {
        queryJurs = [...new Set(top.map((k) => JUR_MAP[k.split(":")[0].toLowerCase()] ?? "INT"))] as ("UK" | "US" | "CA" | "AE" | "INT")[];
        queryThemes = top.map(themeFor);
      }
    } catch {
      // best-effort
    }
  }

  let dedupeIndex: DiscoveryCtx["dedupeIndex"] | undefined;
  try {
    const raw = read(path.join(cwd, "state", "dedupe-index.json"), "utf8");
    dedupeIndex = JSON.parse(raw) as DiscoveryCtx["dedupeIndex"];
  } catch {
    dedupeIndex = undefined;
  }

  const ctx: DiscoveryCtx = {
    ranAtIso,
    query: {
      jurisdictions: (queryJurs ?? (["UK", "US", "CA", "AE", "INT"] as const)) as unknown as DiscoveryCtx["query"]["jurisdictions"],
      themes: queryThemes ?? ['"road safety audit"', "preliminary design RSA", "stage 1 road safety audit"],
    },
    providers,
    dedupeIndex,
    // C1: live → real PDF fetch via pipeline (hit.url + withHostBudget + %PDF guard)
    // dry-run → deterministic fixtures
    ...(LIVE ? {} : { acquireDocs: (match: MatchAssignment) => Promise.resolve(fixtureDocsFor(match).slice(0, 1)) }),
  };

  const store = deps?.store;
  const job = await createJob({ live: LIVE, cellKey, providers: providerIds }, store);
  await appendLog(job.id, { at: nowIso(), node: "D00-QUEUED", message: `job ${job.id} queued live=${LIVE} cellKey=${cellKey ?? "gap-aware"}` }, store);

  return {
    jobId: job.id,
    status: "queued",
    ranAtIso,
    live: LIVE,
    cellKey: cellKey ?? null,
    providers: providerIds,
    ctx,
    providerIds,
  };
}
