// GET /api/inputs/[jur] — the jurisdiction's input catalog (all stages);
// UI filters to the selected native stage.
import { NextResponse } from "next/server";
import { getPack } from "@/domain/packs";
import { badRequest, serverError } from "@/lib/api";
import type { JurisdictionId } from "@/domain/types";
import { JURISDICTION_IDS } from "@/domain/types";

type Ctx = { params: Promise<{ jur: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { jur } = await ctx.params;
    if (!JURISDICTION_IDS.includes(jur as JurisdictionId))
      return badRequest(`unknown jurisdiction ${jur}`);
    const pack = getPack(jur as JurisdictionId);
    return NextResponse.json({ inputs: pack.inputs });
  } catch (e) {
    return serverError(e);
  }
}
