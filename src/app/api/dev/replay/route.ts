// GET /api/dev/replay — stored artifact trail for an audit, split by the N3
// replay rule (verified = trusted; everything else regenerates).
import { NextResponse } from "next/server";
import { badRequest, requireAdmin } from "@/lib/api";
import { getDataStore, Repository, workspaceHash } from "@/lib/persistence";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("project");
    const auditId = url.searchParams.get("audit");
    if (!projectId || !auditId) return badRequest("project and audit query params are required");

    // Dev-console workspace is where finish persists stepped runs.
    const ws = url.searchParams.get("ws")
      ? workspaceHash(url.searchParams.get("ws")!)
      : workspaceHash("dev-console");
    const repo = new Repository(getDataStore());
    const artifacts = await repo.listArtifacts(ws, projectId, auditId);
    return NextResponse.json({
      project_id: projectId,
      audit_id: auditId,
      count: artifacts.length,
      ...repo.replayPlan(artifacts),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 422 },
    );
  }
}
