// GET/POST /api/projects/[projectId]/audits/[auditId]/issues
// ADR-0004 (DEC-0005): POST issues the audit — an explicit in-product act by
// the Auditor that freezes the draft's current results into an immutable,
// sequentially numbered revision. Issued revisions are never modified or
// deleted; later runs change only the draft. GET lists the issue lineage.
// Freezing over unreviewed AI candidates succeeds loudly: a limitation line
// names them in the frozen snapshot only (ADR-0006).
import { NextResponse } from "next/server";
import { notFound, requireWorkspace, serverError } from "@/lib/api";
import { unreviewedCandidateLimitation } from "@/domain/candidate-review";

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
    // Pending candidates are never members of a formal record (ADR-0006): the
    // snapshot strips them; unreviewed ones speak only through the limitation.
    const { candidate_findings: _pending, ...freezable } = draft;
    const toFreeze =
      _pending && _pending.length > 0
        ? {
            ...freezable,
            limitations: [...freezable.limitations, unreviewedCandidateLimitation(_pending.length)],
          }
        : freezable;
    const issue = await auth.repo.saveIssue(
      auth.ws,
      projectId,
      auditId,
      toFreeze,
      new Date().toISOString(),
    );
    return NextResponse.json({ issue }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
