// GET /api/dev/tickets — compiled Wayfinder tracker (markdown is canonical).
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { indexWayfinderTickets } from "@/wayfinder/tickets";

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    return NextResponse.json(indexWayfinderTickets());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ENOENT") || msg.includes("no such file")) {
      return NextResponse.json({ schema_version: "1.0.0", source: "wayfinder-missing", counts: { total: 0, frontier: 0, ready_without_owner: 0, hitl_frontier: 0, blocked: 0 }, tickets: [] });
    }
    return serverError(e);
  }
}
