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

    // auto-tick on poll — guard against double-tick if two polls race (1s debounce)
    if (stream.status === "RUNNING") {
      const age = Date.now() - new Date(stream.updatedAt).getTime();
      if (age < 1000 && stream.iteration > 0) {
        return NextResponse.json({ stream });
      }
      const ticked = await tickStream(id);
      return NextResponse.json({ stream: ticked });
    }
    return NextResponse.json({ stream });
  } catch (e) {
    return serverError(e);
  }
}
