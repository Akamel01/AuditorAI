import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { getDataStore } from "@/lib/persistence";
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const store = getDataStore();
    return NextResponse.json({
      kind: store.kind,
      hasUrl: !!process.env.KV_REST_API_URL,
      hasToken: !!process.env.KV_REST_API_TOKEN,
      urlPrefix: process.env.KV_REST_API_URL?.slice(0,30) ?? null,
    });
  } catch (e) { return serverError(e); }
}
