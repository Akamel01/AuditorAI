// GET/POST /api/projects/[projectId]/audits/[auditId]/issues
// ADR-0004 (DEC-0005): POST issues the audit — an explicit in-product act by
// the Auditor that freezes the draft's current results into an immutable,
// sequentially numbered revision. Issued revisions are never modified or
// deleted; later runs change only the draft. GET lists the issue lineage.
import { NextResponse } from "next/server";
import { notFound, requireWorkspace, serverError } from "@/lib/api";

type Ctx = { params: Promise<{ projectId: string; auditId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId, auditId } = await ctx.params;
    const issues = await auth.repo.listIssues(auth.ws, projectId, auditId);
    return NextResponse.json({ issues });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId, auditId } = await ctx.params;
    const draft = await auth.repo.getAudit(auth.ws, projectId, auditId);
    if (!draft) return notFound("audit not found");
    const issue = await auth.repo.saveIssue(
      auth.ws,
      projectId,
      auditId,
      draft,
      new Date().toISOString(),
    );
    return NextResponse.json({ issue }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
