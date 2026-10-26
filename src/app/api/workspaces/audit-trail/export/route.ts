import { NextResponse } from "next/server";
import {
  requireAuditTrailSigningKey,
} from "@/lib/audit-trail-signing";
import { requireWorkspace, serverError } from "@/lib/api";
import {
  buildAuditTrailExport,
  signAuditTrailExport,
  verifyAuditTrail,
} from "@/domain/audit-trail";

export async function GET(req: Request) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const key = requireAuditTrailSigningKey();
    const entries = await auth.repo.listAuditTrail(auth.ws);
    const verification = verifyAuditTrail(entries, { workspace: auth.ws });
    const body = buildAuditTrailExport({
      workspace: auth.ws,
      exported_at: new Date().toISOString(),
      trail_starts_at: entries[0]?.recorded_at ?? null,
      verification,
      entries,
    });
    const exported = signAuditTrailExport(body, key);
    return new NextResponse(JSON.stringify(exported, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="audit-trail-${body.exported_at.slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return serverError(e);
  }
}
