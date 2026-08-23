// GET /api/dev/replay — stored artifact trail for an audit, split by the N3
// replay rule (verified = trusted; everything else regenerates).
import { NextResponse } from "next/server";
import { badRequest, requireAdmin, serverError } from "@/lib/api";
import { devWorkspaceHash } from "@/lib/devtab";
import { getDataStore, Repository } from "@/lib/persistence";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const auditId = url.searchParams.get("auditId");
    if (!projectId || !auditId)
      return badRequest("projectId and auditId query params are required");

    // Dev-console workspace is where finish persists stepped runs.
    const ws = devWorkspaceHash(req.headers.get("x-workspace-key"));
    const repo = new Repository(getDataStore());
    const artifacts = await repo.listArtifacts(ws, projectId, auditId);
    return NextResponse.json({
      project_id: projectId,
      audit_id: auditId,
      count: artifacts.length,
      ...repo.replayPlan(artifacts),
    });
  } catch (e) {
    return serverError(e);
  }
}
