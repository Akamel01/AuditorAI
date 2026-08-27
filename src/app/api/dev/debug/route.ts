import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { getDataStore } from "@/lib/persistence";
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const store = getDataStore();
    let idx: unknown = null;
    let idxErr: string | null = null;
    try {
      idx = await store.get("discovery:job:index");
    } catch (e) {
      idxErr = e instanceof Error ? e.message : String(e);
    }
    let list: unknown = null;
    let listErr: string | null = null;
    try {
      const { listJobs } = await import("@/discovery/jobs");
      list = await listJobs(3);
    } catch (e) {
      listErr = e instanceof Error ? e.message : String(e);
    }
    return NextResponse.json({
      kind: store.kind,
      hasUrl: !!process.env.KV_REST_API_URL,
      hasToken: !!process.env.KV_REST_API_TOKEN,
      urlPrefix: process.env.KV_REST_API_URL?.slice(0,30) ?? null,
      idx,
      idxErr,
      list,
      listErr,
    });
  } catch (e) { return serverError(e); }
}
