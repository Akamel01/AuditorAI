// GET /api/dev/discovery/jobs — list recent discovery jobs (admin-gated)
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { listJobs } from "@/discovery/jobs";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const url = new URL(req.url);
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.min(Math.max(Number.parseInt(limitRaw, 10) || 10, 1), 20) : 10;
    const jobs = await listJobs(limit);
    return NextResponse.json({ jobs });
  } catch (e) {
    return serverError(e);
  }
}
