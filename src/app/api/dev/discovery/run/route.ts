// POST /api/dev/discovery/run — gap-aware or targeted discovery batch.
// Body { live?: boolean, cellKey?: string } — admin-gated via requireAdmin.
// Returns 202 {jobId} and runs pipeline async with KV job store for progress
// that survives refresh/tab switch. Poll GET /api/dev/discovery/jobs/:id.
import { after, NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { devDiscoveryRunRequest, readJsonBody } from "@/lib/request-schema";
import { harvest, executeJob, UnknownCellKeyError } from "@/discovery/harvest";

export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    // An absent body is legal here (it means "run the gap-aware batch").
    const body = await readJsonBody<{ live?: boolean; cellKey?: string }>(
      req,
      devDiscoveryRunRequest,
      { allowEmpty: true },
    );

    let result;
    try {
      result = await harvest({ live: body.live, cellKey: body.cellKey });
    } catch (e) {
      if (e instanceof UnknownCellKeyError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    // Run the worker in a fire-and-forget manner but guard against uncaught
    // rejections from a busy in-process lock. Catch and log non-fatal errors to
    // avoid surfacing a crash or leaving the job in an inconsistent state.
    after(async () => {
      try {
        await executeJob(result.jobId, result.ctx, result.providerIds, result.ranAtIso);
      } catch (err) {
        // Best-effort handling: a busy harvest should not crash the API route.
        // Without a per-call job id available here (beyond result.jobId), we
        // simply log for observability and swallow.
        console.error("harvest executeJob busy or failed:", (err as Error)?.message ?? err);
      }
    });

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
