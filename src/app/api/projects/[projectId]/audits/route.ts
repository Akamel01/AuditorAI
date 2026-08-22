// GET /api/projects/[projectId]/audits — list; POST — run the deterministic
// audit pipeline and persist the result.
import { NextResponse } from "next/server";
import { notFound, requireWorkspace, serverError } from "@/lib/api";
import { runAudit } from "@/domain/engine";

type Ctx = { params: Promise<{ projectId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId } = await ctx.params;
    const project = await auth.repo.getProject(auth.ws, projectId);
    if (!project) return notFound("project not found");

    const result = runAudit(project, new Date().toISOString());
    await auth.repo.saveAudit(auth.ws, result);
    return NextResponse.json({ audit: result }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId } = await ctx.params;
    const audits = await auth.repo.listAudits(auth.ws, projectId);
    return NextResponse.json({ audits });
  } catch (e) {
    return serverError(e);
  }
}
