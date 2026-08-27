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
import { appendLog, createJob, setJobDone, setJobError, setJobRunning, updateJob } from "@/discovery/jobs";
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

export async function executeJob(
  jobId: string,
  ctx: DiscoveryCtx,
  providerIds: string[],
  ranAtIso: string,
  deps?: HarvestDeps,
): Promise<void> {
  const store = deps?.store;
  const nowIso = deps?.nowIso ?? (() => new Date().toISOString());
  try {
    await setJobRunning(jobId, "D01-DISCOVER", store);
    await appendLog(jobId, { at: nowIso(), node: "D00-QUEUED", message: `providers ${providerIds.join(",")} query jurs=${ctx.query.jurisdictions.join(",")} themes=${ctx.query.themes.slice(0, 2).join(" | ")}` }, store);

    let state: Record<string, unknown> = {};
    const artifacts: unknown[] = [];
    let refusals: string[] = [];

    for (const nodeId of DISCOVERY_NODE_IDS) {
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
    };

    await setJobDone(jobId, {
      ranAtIso,
      coverage: (s.coverage as unknown) ?? null,
      queue: (s.queue as unknown[]) ?? [],
      packages: (s.package as unknown[]) ?? [],
      hits: (s.discovery_hits as unknown[]) ?? [],
      matched: (s.matched as unknown[]) ?? [],
      refusals,
      quality: (s.quality as unknown[]) ?? [],
    }, store);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await appendLog(jobId, { at: nowIso(), node: "ERROR", message: msg.slice(0, 500) }, store);
    await setJobError(jobId, msg.slice(0, 2000), store);
  }
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
    acquireDocs: (match: MatchAssignment) => Promise.resolve(fixtureDocsFor(match).slice(0, 1)),
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
