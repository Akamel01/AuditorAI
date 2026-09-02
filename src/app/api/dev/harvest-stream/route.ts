// POST /api/dev/harvest-stream — start a continuous AI harvest stream
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { createStream, saveStream, listStreams, tickStream } from "@/discovery/harvest-stream";

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
    // fire-and-forget first tick via after (like harvest)
    const { after } = await import("next/server");
    after(tickStream(stream.id).catch(() => {}));
    return NextResponse.json({ streamId: stream.id, stream }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
