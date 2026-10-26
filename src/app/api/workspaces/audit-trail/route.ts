import { NextResponse } from "next/server";
import { requireWorkspace, serverError } from "@/lib/api";
import { verifyAuditTrail } from "@/domain/audit-trail";

export async function GET(req: Request) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const entries = await auth.repo.listAuditTrail(auth.ws);
    const verification = verifyAuditTrail(entries, { workspace: auth.ws });
    return NextResponse.json({
      workspace: auth.ws,
      trail_starts_at: entries[0]?.recorded_at ?? null,
      verification,
      entries,
    });
  } catch (e) {
    return serverError(e);
  }
}
