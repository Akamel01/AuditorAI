// POST /api/dev/discovery/jobs/:jobId/cancel — mark a discovery job as cancelled
import { NextResponse } from "next/server";
import { getJob, updateJob } from "@/discovery/jobs";
import { requireAdmin, serverError } from "@/lib/api";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { id: jobId } = await ctx.params;
    if (!jobId) return NextResponse.json({ error: "missing jobId" }, { status: 400 });
    // Load current job to ensure it exists; if not, 404
    const cur = await getJob(jobId);
    if (!cur) return NextResponse.json({ error: "not found" }, { status: 404 });
    // Patch status to cancelled; this is a simple KV truth that the worker will respect
    await updateJob(jobId, { status: "cancelled", updatedAt: new Date().toISOString(), currentNode: null }, undefined);
    return NextResponse.json({ cancelled: true, jobId });
  } catch (e) {
    return serverError(e);
  }
}
