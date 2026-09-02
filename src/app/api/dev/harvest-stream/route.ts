// POST /api/dev/harvest-stream — start a continuous AI harvest stream
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { createStream, saveStream, listStreams } from "@/discovery/harvest-stream";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const streams = await listStreams();
    return NextResponse.json({ streams });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const body = (await req.json().catch(() => ({}))) as { live?: boolean; cellKey?: string | null };
    const live = body.live === true;
    const cellKey = typeof body.cellKey === "string" && body.cellKey.length > 0 ? body.cellKey : null;
    const stream = createStream(cellKey, live);
    stream.status = "RUNNING";
    await saveStream(stream);
    // UI polls GET which ticks when RUNNING — no after() needed (ponytail: single poll, no experimental dep)
    return NextResponse.json({ streamId: stream.id, stream }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
