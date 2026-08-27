// GET /api/dev/discovery/jobs/:id — single job (admin-gated)
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { getJob } from "@/discovery/jobs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    const job = await getJob(id);
    if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (e) {
    return serverError(e);
  }
}
