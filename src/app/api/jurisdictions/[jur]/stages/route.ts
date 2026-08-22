// GET /api/jurisdictions/[jur]/stages — native stages incl. canonical mapping
// and confidence, plus exceptions that shape availability (ADR-0002).
import { NextResponse } from "next/server";
import { getPack } from "@/domain/packs";
import { badRequest, serverError } from "@/lib/api";
import type { JurisdictionId } from "@/domain/types";

type Ctx = { params: Promise<{ jur: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { jur } = await ctx.params;
    if (!["INT", "UK", "US", "CA", "AE"].includes(jur))
      return badRequest(`unknown jurisdiction ${jur}`);
    const pack = getPack(jur as JurisdictionId);
    return NextResponse.json({
      framework: pack.framework,
      stages: pack.stages.map((s) => ({
        native_stage_id: s.native_stage_id,
        display_name: s.display_name,
        definition: s.definition,
        canonical_stages: s.canonical_stages,
        confidence: s.confidence,
        mvp_scope: s.mvp_scope,
        notes: s.notes ?? null,
        evidence_ids: s.evidence_ids ?? [],
      })),
      exceptions: pack.exceptions,
    });
  } catch (e) {
    return serverError(e);
  }
}
