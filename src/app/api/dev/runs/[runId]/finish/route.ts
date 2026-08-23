// POST /api/dev/runs/[runId]/finish — persist the session's accumulated
// artifact trail (N3 layout). Requires AG-REPORT to have executed. The trail
// is exactly what stepping produced, including any what-if edits.
import { NextResponse } from "next/server";
import { badRequest, requireAdmin, serverError } from "@/lib/api";
import { devWorkspaceHash, getSession } from "@/lib/devtab";
import { getDataStore, Repository } from "@/lib/persistence";

interface Ctx {
  params: Promise<{ runId: string }>;
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { runId } = await ctx.params;
    const session = getSession(runId);
    if (!session) return NextResponse.json({ error: "unknown runId" }, { status: 404 });
    if (!session.state.report_bundle) {
      return badRequest("nothing to finish: run AG-REPORT first");
    }

    const auditId = session.state.report_bundle.json.audit_id;
    const repo = new Repository(getDataStore());
    const stored = await repo.saveArtifactTrailFor(
      devWorkspaceHash(),
      { projectId: session.project.project_id, auditId },
      session.artifacts,
    );

    return NextResponse.json({
      audit_id: auditId,
      project_id: session.project.project_id,
      stored: stored.stored,
    });
  } catch (e) {
    return serverError(e);
  }
}
