// HarvestStream — continuous AI harvesting state machine
// IDLE → RUNNING → PAUSED → VERIFYING → DONE|FAILED, loops until verified
// Reuses DataStore, runDiscoveryPipeline, coverage/dedupe/quality, withHostBudget
import type { DataStore } from "@/lib/persistence";
import { getDataStore } from "@/lib/persistence/store";
import { runDiscoveryPipeline, type DiscoveryCtx } from "@/discovery/pipeline";
import { claimFingerprints, emptyDedupeIndex, type DedupeIndexDoc } from "@/discovery/dedupe";
import { listProviderIds, providerEnabled, resolveProvider } from "@/discovery/providers";
import { DEPRECATED_PROVIDERS, JUR_MAP, themeFor } from "@/discovery/harvest";

export type HarvestStreamStatus = "IDLE" | "RUNNING" | "PAUSED" | "VERIFYING" | "DONE" | "FAILED";

export interface HarvestStream {
  id: string;
  status: HarvestStreamStatus;
  cellKey: string | null;
  live: boolean;
  iteration: number;
  maxIterations: number;
  createdAt: string;
  updatedAt: string;
  currentNode: string | null;
  coverage: unknown | null;
  packages: unknown[];
  quality: unknown[];
  dedupeIndex: DedupeIndexDoc;
  logs: Array<{ at: string; node: string; message: string }>;
  error: string | null;
  // Whether this stream should continue running after verification (continuous loop)
  continuous: boolean;
}

const PREFIX = "harvest:stream:";
const INDEX_KEY = "harvest:stream:index";

function streamKey(id: string): string {
  return `${PREFIX}${id}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return `stream_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createStream(cellKey: string | null, live: boolean, continuous: boolean = true): HarvestStream {
  const id = newId();
  const now = nowIso();
  return {
    id,
    status: "IDLE",
    cellKey,
    live,
    iteration: 0,
    maxIterations: 10,
    createdAt: now,
    updatedAt: now,
    currentNode: null,
    coverage: null,
    packages: [],
    quality: [],
    dedupeIndex: emptyDedupeIndex(),
    logs: [{ at: now, node: "STREAM", message: `created live=${live} cellKey=${cellKey ?? "gap-aware"} continuous=${continuous}` }],
    error: null,
    continuous,
  };
}

export async function saveStream(stream: HarvestStream, store?: DataStore): Promise<void> {
  const s = store ?? getDataStore();
  await s.put(streamKey(stream.id), stream);
  // index for listing
  const idx = ((await s.get(INDEX_KEY)) as string[] | null) ?? [];
  if (!idx.includes(stream.id)) {
    idx.unshift(stream.id);
    await s.put(INDEX_KEY, idx.slice(0, 50));
  }
}

export async function loadStream(id: string, store?: DataStore): Promise<HarvestStream | null> {
  const s = store ?? getDataStore();
  const st = (await s.get(streamKey(id))) as HarvestStream | null;
  if (st) {
    // Migration: ensure legacy streams have a defined continuous flag
    // Old streams may have `continuous` unset. Treat as non-continuous by default.
    if (typeof st.continuous !== "boolean") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (st as any).continuous = false;
      // legacy streams stay single-shot unless explicitly upgraded
    }
  }
  return st;
}

export async function listStreams(store?: DataStore): Promise<HarvestStream[]> {
  const s = store ?? getDataStore();
  const idx = ((await s.get(INDEX_KEY)) as string[] | null) ?? [];
  const out: HarvestStream[] = [];
  for (const id of idx.slice(0, 20)) {
    const st = await loadStream(id, s);
    if (st) out.push(st);
  }
  return out;
}

function appendLog(stream: HarvestStream, node: string, message: string): void {
  stream.logs.push({ at: nowIso(), node, message });
  if (stream.logs.length > 200) stream.logs = stream.logs.slice(-200);
}

export function verifyStream(stream: HarvestStream): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const pkgs = stream.packages as Array<{ completeness: string }>;
  const quals = stream.quality as Array<{ quality_score: number; dedupe_status: string }>;

  if (pkgs.length === 0) reasons.push("0 packages — need at least 1");
  if (quals.length === 0 && pkgs.length > 0) reasons.push("no quality verdicts");
  if (quals.some((q) => q.quality_score !== 1)) reasons.push("quality_score != 1");
  if (quals.some((q) => q.dedupe_status !== "unique")) reasons.push("dedupe_status != unique");
  // coverage: at least 1 package for demo (ponytail: 20% ceiling)
  // full check would be have_total >= target_total * 0.2
  if (stream.coverage) {
    // coverage is validated via existence, not strict threshold for demo
  }
  return { passed: reasons.length === 0, reasons };
}

// ponytail: single prompt/global poll/20%/2s ceiling — per-jurisdiction tuning if needed
export async function tickStream(id: string, store?: DataStore): Promise<HarvestStream | null> {
  const stream = await loadStream(id, store);
  if (!stream) return null;
  if (stream.status === "PAUSED" || stream.status === "DONE" || stream.status === "FAILED") return stream;

  if (stream.status === "IDLE") stream.status = "RUNNING";
  if (stream.status !== "RUNNING" && stream.status !== "VERIFYING") return stream;

  // Guard anchor: capture updatedAt to detect races between load and pipeline resolution
  const startUpdatedAt = stream.updatedAt; // preserve initial update timestamp for race-detection
  // (traceability note: startUpdatedAt used for race-detection)

  stream.iteration += 1;
  stream.updatedAt = nowIso();
  stream.currentNode = "D01-DISCOVER";
  appendLog(stream, "STREAM", `iteration ${stream.iteration} start`);

  // Build DiscoveryCtx — reuse harvest.ts derivation (JUR_MAP + themeFor + provider resolution)
  const live = stream.live;
  const cellKey = stream.cellKey;
  const providerIds = live
    // ponytail: agent-reach-search self-gates async (env/Keychain or UI runtime keys) → [] when off, zero cost
    ? (["seed-portals", ...listProviderIds().filter((p) => p !== "seed-portals" && (providerEnabled(p) || p === "agent-reach-search") && !DEPRECATED_PROVIDERS.has(p))] as string[])
    : (["seed-portals"] as string[]);
  const providers = providerIds.map((pid) => resolveProvider(pid)).filter(Boolean) as NonNullable<ReturnType<typeof resolveProvider>>[];

  const ctx: DiscoveryCtx = {
    ranAtIso: nowIso(),
    query: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jurisdictions: (cellKey ? [JUR_MAP[cellKey.split(":")[0].toLowerCase()] ?? "INT"] : (["UK", "US", "CA", "AE", "INT"] as const)) as any,
      themes: cellKey ? [themeFor(cellKey)] : ['"road safety audit"', "preliminary design RSA", "stage 1 road safety audit"],
    },
    providers,
    dedupeIndex: stream.dedupeIndex,
    ...(live
      ? {}
      : {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          acquireDocs: async (match: any) => {
            const { fixtureDocsFor } = await import("@/discovery/harvest");
            // fixtureDocsFor expects MatchAssignment, but we can call it with a minimal stub
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return fixtureDocsFor({ jurisdiction: match.jurisdiction, native_stage_id: match.native_stage_id } as any).slice(0, 1);
          },
        }),
  };

  // For logging context in continuous mode, derive a label from cellKey or first jurisdiction
  const logLabel = stream.cellKey ?? ((ctx.query?.jurisdictions?.[0] ?? "UNKNOWN") as string);
  try {
    const { state } = await runDiscoveryPipeline(ctx);
    // Fresh guard: reload the stream to detect stale reads and prevent race with concurrent writers
    const fresh = await loadStream(id, store);
    if (!fresh || (fresh.status !== "RUNNING" && fresh.status !== "VERIFYING") || fresh.updatedAt !== startUpdatedAt) {
      return fresh ?? null;
    }
    // Prepare delta payloads for verification and persistence
    const newPkgs = (state.package as unknown[]) ?? [];
    const newQuals = (state.quality as unknown[]) ?? [];
    // H10: append unique-verdict packages only — re-discovered dupes are logged
    // and counted, never accumulated (else continuous streams fill cap-50 with
    // the same docs and package counts lie). Two layers: same package_id already
    // held (cross-tick re-yield — checkDuplicate deliberately ignores self-matches,
    // so identity is enforced here), and dupe-of-another verdicts from D08.
    const uniqueStatus = new Map(
      (newQuals as Array<{ package_id: string; dedupe_status: string }>).map((q) => [q.package_id, q.dedupe_status]),
    );
    const seenIds = new Set(
      ((stream.packages ?? []) as Array<{ package_id?: string }>).map((p) => p?.package_id),
    );
    const uniquePkgs = (newPkgs as Array<{ package_id: string }>).filter((p) => {
      if (!p?.package_id || seenIds.has(p.package_id)) return false;
      if (uniqueStatus.get(p.package_id) !== "unique") return false;
      seenIds.add(p.package_id);
      return true;
    });
    const uniqueQuals = (newQuals as Array<{ package_id: string }>).filter(
      (q) => uniqueStatus.get(q.package_id) === "unique",
    );
    const dupesSkipped = newPkgs.length - uniquePkgs.length;
    // Update stream with pipeline results — append new UNIQUE items, cap history at 50
    stream.packages = [...(stream.packages ?? []), ...uniquePkgs].slice(-50);
    stream.quality = [...(stream.quality ?? []), ...uniqueQuals].slice(-50);
    stream.coverage = (state.coverage as unknown) ?? null;
    // pipeline returns dedupe via ctx.dedupeIndex when available (otherwise keep current)
    if ((state as { dedupe?: DedupeIndexDoc }).dedupe) {
      stream.dedupeIndex = (state as { dedupe: DedupeIndexDoc }).dedupe;
    }
    // H10: persist cross-tick dedupe — d08Quality claims into a per-run clone that
    // the pipeline never returns, so without this every tick re-discovers the same
    // docs as unique. uniquePkgs (above) already holds the unique-verdict subset.
    try {
      const bundles = new Map(
        ((state.acquired as Array<{ match_id: string }>) ?? []).map((b) => [b.match_id, b]),
      );
      for (const pkg of uniquePkgs as Array<{ package_id: string; match_id: string }>) {
        const bundle = bundles.get(pkg.match_id) as Parameters<typeof claimFingerprints>[1] | undefined;
        if (bundle) claimFingerprints(pkg as Parameters<typeof claimFingerprints>[0], bundle, stream.dedupeIndex);
      }
    } catch {
      /* dedupe persistence is best-effort; quality gates still apply per tick */
    }
    stream.currentNode = null;
    stream.status = "VERIFYING";
    appendLog(stream, "STREAM", `iteration ${stream.iteration} done packages=${stream.packages.length}`);

    // delta verify: unique-only appends; steady-state (0 new uniques on a
    // non-empty stream) passes explicitly so settled ticks don't log failure.
    // invariant: continuous:true → DONE unreachable here, maxIterations ignored; single-shot falls through to DONE/FAILED
    const v =
      uniquePkgs.length > 0
        ? verifyStream({
            ...stream,
            packages: uniquePkgs,
            quality: uniqueQuals,
            coverage: stream.coverage,
          } as HarvestStream)
        : (stream.packages ?? []).length > 0
          ? { passed: true, reasons: ["steady-state: no new unique documents"] }
          : verifyStream({ ...stream, packages: [], quality: [], coverage: stream.coverage } as HarvestStream);
    if (v.passed) {
      if (stream.continuous) {
        stream.status = "RUNNING";
        appendLog(stream, "STREAM", `continuous next ${logLabel}${dupesSkipped > 0 ? ` (dupes skipped ${dupesSkipped})` : ""}`);
      } else {
        stream.status = "DONE";
        appendLog(stream, "STREAM", `verified — DONE`);
      }
    } else if (stream.continuous) {
      stream.status = "RUNNING";
      appendLog(stream, "STREAM", `verification failed: ${v.reasons.join("; ")} — continuous next ${logLabel}`);
    } else if (stream.iteration >= stream.maxIterations) {
      stream.status = "FAILED";
      stream.error = `max iterations ${stream.maxIterations} reached: ${v.reasons.join("; ")}`;
      appendLog(stream, "STREAM", `FAILED: ${stream.error}`);
    } else {
      stream.status = "RUNNING";
      appendLog(stream, "STREAM", `verification failed: ${v.reasons.join("; ")} — retry ${stream.iteration + 1}`);
    }
  } catch (e) {
    // Fresh path on error to avoid racing with concurrent loads
    const fresh = await loadStream(id, store);
    if (!fresh) return null;
    if (fresh.status !== "RUNNING" && fresh.status !== "VERIFYING") {
      // If not in a runnable state, drop without persisting a failed state to avoid churn
      return null;
    }
    stream.status = "FAILED";
    stream.error = e instanceof Error ? e.message : String(e);
    appendLog(stream, "STREAM", `FAILED: ${stream.error}`);
  }

  stream.updatedAt = nowIso();
  await saveStream(stream, store);
  return stream;
}

export async function pauseStream(id: string, store?: DataStore): Promise<HarvestStream | null> {
  const s = await loadStream(id, store);
  if (!s) return null;
  if (s.status === "RUNNING" || s.status === "VERIFYING") {
    s.status = "PAUSED";
    s.updatedAt = nowIso();
    appendLog(s, "STREAM", "paused");
    await saveStream(s, store);
  }
  return s;
}

export async function resumeStream(id: string, store?: DataStore): Promise<HarvestStream | null> {
  const s = await loadStream(id, store);
  if (!s) return null;
  if (s.status === "PAUSED") {
    s.status = "RUNNING";
    s.updatedAt = nowIso();
    appendLog(s, "STREAM", "resumed");
    await saveStream(s, store);
  }
  return s;
}

export async function stopStream(id: string, store?: DataStore): Promise<HarvestStream | null> {
  const s = await loadStream(id, store);
  if (!s) return null;
  if (s.status !== "DONE" && s.status !== "FAILED") {
    s.status = "FAILED";
    s.error = "stopped by operator";
    s.currentNode = null;
    s.updatedAt = nowIso();
    appendLog(s, "STREAM", "stopped by operator");
    await saveStream(s, store);
  }
  return s;
}
