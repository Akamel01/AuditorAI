// POST /api/dev/discovery/run — gap-aware or targeted discovery batch.
// Body { live?: boolean, cellKey?: string } — admin-gated via requireAdmin.
// Returns 202 {jobId} and runs pipeline async with KV job store for progress
// that survives refresh/tab switch. Poll GET /api/dev/discovery/jobs/:id.
import { after, NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { harvest, executeJob, UnknownCellKeyError } from "@/discovery/harvest";

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    let body: { live?: boolean; cellKey?: string } = {};
    try {
      const text = await req.text();
      if (text.trim().length > 0) body = JSON.parse(text) as { live?: boolean; cellKey?: string };
    } catch {
      return NextResponse.json({ error: "invalid request body" }, { status: 400 });
    }

    let result;
    try {
      result = await harvest({ live: body.live, cellKey: body.cellKey });
    } catch (e) {
      if (e instanceof UnknownCellKeyError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    after(() => executeJob(result.jobId, result.ctx, result.providerIds, result.ranAtIso));

    return NextResponse.json(
      {
        jobId: result.jobId,
        status: result.status,
        ranAtIso: result.ranAtIso,
        live: result.live,
        cellKey: result.cellKey,
        providers: result.providers,
      },
      { status: 202 },
    );
  } catch (e) {
    return serverError(e);
  }
}
