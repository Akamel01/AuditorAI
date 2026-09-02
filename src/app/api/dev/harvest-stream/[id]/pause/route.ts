import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { pauseStream } from "@/discovery/harvest-stream";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { id } = await ctx.params;
    const stream = await pauseStream(id);
    if (!stream) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ paused: true, stream });
  } catch (e) {
    return serverError(e);
  }
}
