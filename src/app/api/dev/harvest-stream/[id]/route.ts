// GET /api/dev/harvest-stream/[id] — get stream status
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { loadStream, tickStream } from "@/discovery/harvest-stream";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { id } = await ctx.params;
    const stream = await loadStream(id);
    if (!stream) return NextResponse.json({ error: "not found" }, { status: 404 });

    // auto-tick if RUNNING and iteration < max and not recently ticked (simple poll-driven)
    // The UI polls every 2s, so we tick on GET when RUNNING
    if (stream.status === "RUNNING") {
      const ticked = await tickStream(id);
      return NextResponse.json({ stream: ticked });
    }
    return NextResponse.json({ stream });
  } catch (e) {
    return serverError(e);
  }
}
