// POST /api/dev/discovery/run — gap-aware or targeted discovery batch.
// Body { live?: boolean, cellKey?: string } — admin-gated via requireAdmin.
// For live, Keychain fallback mirrors scripts/discovery-run.ts (resolveSecret).
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { listProviderIds, providerEnabled, resolveProvider } from "@/discovery/providers";
import "@/discovery/providers";
import { runDiscoveryPipeline, type DiscoveryCtx, type RawDocument } from "@/discovery/pipeline";
import type { MatchAssignment } from "@/discovery/types";

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

    // Validate cellKey if provided — must exist in ODD declaration
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
        // if odd.json unreadable, proceed — validation is best-effort
      }
    }

    // Resolve providers — same as scripts/discovery-run.ts
    const providerIds = LIVE
      ? (["seed-portals", ...listProviderIds().filter((p) => p !== "seed-portals" && providerEnabled(p) && !DEPRECATED_PROVIDERS.has(p))] as string[])
      : (["seed-portals"] as string[]);
    const providers = providerIds
      .map((id) => resolveProvider(id))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const ranAtIso = LIVE ? new Date().toISOString() : new Date(0).toISOString();

    // Determine gap-aware or targeted query
    let queryJurs: ("UK" | "US" | "CA" | "AE" | "INT")[] | null = null;
    let queryThemes: string[] | null = null;

    if (cellKey) {
      const jurDir = cellKey.split(":")[0].toLowerCase();
      const jur = JUR_MAP[jurDir] ?? "INT";
      queryJurs = [jur];
      queryThemes = [themeFor(cellKey)];
    } else {
      // Gap-aware: read last coverage view for top gaps (both live and dry-run)
      try {
        const covRaw = readFileSync(path.join(process.cwd(), "state", "odd-coverage.json"), "utf8");
        const cov = JSON.parse(covRaw) as { gaps_ranked: string[] };
        const top = (cov.gaps_ranked as string[]).slice(0, 3);
        if (top.length) {
          queryJurs = [...new Set(top.map((k) => JUR_MAP[k.split(":")[0].toLowerCase()] ?? "INT"))] as ("UK" | "US" | "CA" | "AE" | "INT")[];
          queryThemes = top.map(themeFor);
        }
      } catch {
        // no coverage file — fall through to defaults
      }
    }

    // Load dedupe index if present (stateful quality node)
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

    const outcome = await runDiscoveryPipeline(ctx);

    return NextResponse.json({
      ranAtIso,
      live: LIVE,
      cellKey: cellKey ?? null,
      providers: providerIds,
      coverage: outcome.state.coverage ?? null,
      queue: outcome.state.queue ?? [],
      packages: outcome.state.package ?? [],
      hits: outcome.state.discovery_hits ?? [],
      matched: outcome.state.matched ?? [],
      refusals: outcome.refusals ?? [],
      quality: outcome.state.quality ?? [],
    });
  } catch (e) {
    return serverError(e);
  }
}
