import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { resumeStream, tickStream } from "@/discovery/harvest-stream";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { id } = await ctx.params;
    const stream = await resumeStream(id);
    if (!stream) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { after } = await import("next/server");
    after(tickStream(id).catch(() => {}));
    return NextResponse.json({ resumed: true, stream });
  } catch (e) {
    return serverError(e);
  }
}
