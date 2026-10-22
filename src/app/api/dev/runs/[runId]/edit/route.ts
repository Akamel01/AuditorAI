// POST /api/dev/runs/[runId]/edit — what-if: overwrite a shared-state slice
// between steps (JSON value replaces the slice whole, never merged).
import { NextResponse } from "next/server";
import { badRequest, requireAdmin, serverError } from "@/lib/api";
import { devRunEditRequest, readJsonBody } from "@/lib/request-schema";
import { getSession, putSession } from "@/lib/devtab";
import { SHARED_STATE_SLICES } from "@/domain/pipeline/types";

interface Ctx {
  params: Promise<{ runId: string }>;
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { runId } = await ctx.params;
    const session = getSession(runId);
    if (!session) return NextResponse.json({ error: "unknown runId" }, { status: 404 });

    const body = await readJsonBody<{ slice?: string; value?: unknown }>(req, devRunEditRequest);
    if (!body.slice) return badRequest("slice is required");
    if (body.value === undefined) return badRequest("value is required");
    if (
      !(body.slice in session.state) &&
      !(SHARED_STATE_SLICES as readonly string[]).includes(body.slice)
    ) {
      return badRequest(`'${body.slice}' is not a chartered SharedState slice`);
    }
    // Slices are replaced whole; JSON.parse gives callers a clean deep copy.
    session.state = {
      ...session.state,
      [body.slice]: JSON.parse(JSON.stringify(body.value)),
    };
    putSession(session);
    return NextResponse.json({ edited: body.slice, state: session.state });
  } catch (e) {
    // The slice value is replaced whole with a JSON deep copy; a malformed
    // body is a 422 (RequestContractError), the domain 400s above stay 400.
    return serverError(e);
  }
}
