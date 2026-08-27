// GET /api/dev/coverage — OddCoverageView via state/odd-coverage.json
// or recomputed via computeCoverage([],[now]) if file missing.
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { computeCoverage } from "@/discovery/coverage";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const file = path.join(process.cwd(), "state", "odd-coverage.json");
    try {
      const raw = readFileSync(file, "utf8");
      const view = JSON.parse(raw);
      return NextResponse.json(view);
    } catch {
      // Fallback: recompute empty coverage (deterministic) — mirrors discovery-coverage fallback
      const view = computeCoverage([], new Date().toISOString());
      return NextResponse.json(view);
    }
  } catch (e) {
    return serverError(e);
  }
}
