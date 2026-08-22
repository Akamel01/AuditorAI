// GET /api/dev/runs/[runId] — session snapshot: executed trail + current state.
// DELETE — abandon the session.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { dropSession, getSession } from "@/lib/devtab";

interface Ctx {
  params: Promise<{ runId: string }>;
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { runId } = await ctx.params;
  const session = getSession(runId);
  if (!session) return NextResponse.json({ error: "unknown runId (sessions are in-memory per instance)" }, { status: 404 });
  return NextResponse.json({
    runId,
    ranAtIso: session.ranAtIso,
    executed: session.executed,
    state: session.state,
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const { runId } = await ctx.params;
  dropSession(runId);
  return NextResponse.json({ dropped: runId });
}
