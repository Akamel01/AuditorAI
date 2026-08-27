// POST /api/dev/discovery/run — gap-aware or targeted discovery batch.
// Body { live?: boolean, cellKey?: string } — admin-gated via requireAdmin.
// Returns 202 {jobId} and runs pipeline async with KV job store for progress
// that survives refresh/tab switch. Poll GET /api/dev/discovery/jobs/:id.
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { listProviderIds, providerEnabled, resolveProvider } from "@/discovery/providers";
import "@/discovery/providers";
import { DISCOVERY_NODE_IDS } from "@/discovery/types";
import { runDiscoveryNode, type DiscoveryCtx, type RawDocument } from "@/discovery/pipeline";
import type { MatchAssignment } from "@/discovery/types";
import { appendLog, createJob, setJobDone, setJobError, setJobRunning, updateJob } from "@/discovery/jobs";

export const maxDuration = 60;

const DEPRECATED_PROVIDERS = new Set(["google-cse"]);

const JUR_MAP: Record<string, "UK" | "US" | "CA" | "AE" | "INT"> = {
  uk: "UK",
  usa: "US",
  canada: "CA",
  international: "INT",
  ae: "AE",
  uae: "AE",
};

function themeFor(cellKey: string): string {
  if (cellKey.includes("DETAILED_DESIGN")) return "final design road safety audit";
  if (cellKey.includes("FEASIBILITY_CONCEPT")) return "feasibility concept road safety audit";
  return "preliminary design road safety audit";
}

function fixtureDocsFor(match: MatchAssignment): RawDocument[] {
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

async function executeJob(
  jobId: string,
  ctx: DiscoveryCtx,
  providerIds: string[],
  ranAtIso: string,
): Promise<void> {
  const nowIso = () => new Date().toISOString();
  try {
    await setJobRunning(jobId, "D01-DISCOVER");
    await appendLog(jobId, { at: nowIso(), node: "D00-QUEUED", message: `providers ${providerIds.join(",")} query jurs=${ctx.query.jurisdictions.join(",")} themes=${ctx.query.themes.slice(0, 2).join(" | ")}` });

    let state: Record<string, unknown> = {};
    const artifacts: unknown[] = [];
    let refusals: string[] = [];

    for (const nodeId of DISCOVERY_NODE_IDS) {
      await updateJob(jobId, { currentNode: nodeId });
      await appendLog(jobId, { at: nowIso(), node: nodeId, message: `start ${nodeId}` });
      const t0 = Date.now();
      const res = await runDiscoveryNode(nodeId as never, state as never, ctx);
      // merge patch
      state = { ...state, ...res.patch };
      if (res.artifacts?.length) artifacts.push(...res.artifacts);
      if (res.refusals?.length) refusals = [...refusals, ...res.refusals];
      const patchKeys = Object.keys(res.patch).join(",");
      const elapsed = Date.now() - t0;
      await appendLog(jobId, {
        at: nowIso(),
        node: nodeId,
        message: `done ${nodeId} — patch ${patchKeys || "none"} artifacts ${res.artifacts.length} refusals ${res.refusals?.length ?? 0} ${elapsed}ms`,
      });
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
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await appendLog(jobId, { at: nowIso(), node: "ERROR", message: msg.slice(0, 500) });
    await setJobError(jobId, msg.slice(0, 2000));
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    let body: { live?: boolean; cellKey?: string } = {};
    try {
      const text = await req.text();
      if (text.trim().length > 0) body = JSON.parse(text) as { live?: boolean; cellKey?: string };
    } catch {
      return NextResponse.json({ error: "invalid request body" }, { status: 400 });
    }

    const LIVE = body.live === true;
    const cellKey = typeof body.cellKey === "string" && body.cellKey.length > 0 ? body.cellKey : null;

    if (cellKey) {
      try {
        const oddRaw = readFileSync(path.join(process.cwd(), "policies", "odd.json"), "utf8");
        const odd = JSON.parse(oddRaw) as { cells: { jurisdiction_id: string; canonical_stage: string[] }[] };
        const normalizedCellKeys = new Set(
          odd.cells.map((c) => `${c.jurisdiction_id}:${[...c.canonical_stage].sort().join("+")}`),
        );
        if (!normalizedCellKeys.has(cellKey)) {
          return NextResponse.json({ error: `unknown cellKey ${cellKey}` }, { status: 400 });
        }
      } catch {
        // best-effort
      }
    }

    const providerIds = LIVE
      ? (["seed-portals", ...listProviderIds().filter((p) => p !== "seed-portals" && providerEnabled(p) && !DEPRECATED_PROVIDERS.has(p))] as string[])
      : (["seed-portals"] as string[]);
    const providers = providerIds
      .map((id) => resolveProvider(id))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const ranAtIso = LIVE ? new Date().toISOString() : new Date(0).toISOString();

    let queryJurs: ("UK" | "US" | "CA" | "AE" | "INT")[] | null = null;
    let queryThemes: string[] | null = null;

    if (cellKey) {
      const jurDir = cellKey.split(":")[0].toLowerCase();
      const jur = JUR_MAP[jurDir] ?? "INT";
      queryJurs = [jur];
      queryThemes = [themeFor(cellKey)];
    } else {
      try {
        const covRaw = readFileSync(path.join(process.cwd(), "state", "odd-coverage.json"), "utf8");
        const cov = JSON.parse(covRaw) as { gaps_ranked: string[] };
        const top = (cov.gaps_ranked as string[]).slice(0, 3);
        if (top.length) {
          queryJurs = [...new Set(top.map((k) => JUR_MAP[k.split(":")[0].toLowerCase()] ?? "INT"))] as ("UK" | "US" | "CA" | "AE" | "INT")[];
          queryThemes = top.map(themeFor);
        }
      } catch {}
    }

    let dedupeIndex: DiscoveryCtx["dedupeIndex"] | undefined;
    try {
      const raw = readFileSync(path.join(process.cwd(), "state", "dedupe-index.json"), "utf8");
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
      ...(LIVE ? {} : { acquireDocs: (match: MatchAssignment) => Promise.resolve(fixtureDocsFor(match)) }),
    };

    const job = await createJob({ live: LIVE, cellKey, providers: providerIds });
    await appendLog(job.id, { at: new Date().toISOString(), node: "D00-QUEUED", message: `job ${job.id} queued live=${LIVE} cellKey=${cellKey ?? "gap-aware"}` });

    const runPromise = executeJob(job.id, ctx, providerIds, ranAtIso);

    // Try Vercel/Next after() to keep running after response; fallback to detached promise
    let usedAfter = false;
    try {
      const mod = await import("next/server");
      const after = (mod as unknown as { after?: (fn: () => Promise<void>) => void }).after;
      if (typeof after === "function") {
        after(() => runPromise);
        usedAfter = true;
      }
    } catch {}
    if (!usedAfter) {
      void runPromise;
    }

    return NextResponse.json(
      {
        jobId: job.id,
        status: "queued",
        ranAtIso,
        live: LIVE,
        cellKey: cellKey ?? null,
        providers: providerIds,
      },
      { status: 202 },
    );
  } catch (e) {
    return serverError(e);
  }
}
