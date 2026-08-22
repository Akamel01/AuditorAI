// POST /api/dev/runs/[runId]/edit — what-if: overwrite a shared-state slice
// between steps (JSON value replaces the slice whole, never merged).
import { NextResponse } from "next/server";
import { badRequest, requireAdmin } from "@/lib/api";
import { getSession, putSession } from "@/lib/devtab";

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

    const body = (await req.json()) as { slice?: string; value?: unknown };
    if (!body.slice) return badRequest("slice is required");
    if (body.value === undefined) return badRequest("value is required");
    if (!(body.slice in session.state) && !charteredSlices().includes(body.slice)) {
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
    if (e instanceof SyntaxError) return badRequest(`value is not valid JSON: ${e.message}`);
    return badRequest(e instanceof Error ? e.message : String(e));
  }
}

function charteredSlices(): string[] {
  return [
    "project_input",
    "stage_context",
    "input_manifest",
    "rule_results",
    "audit_questions",
    "candidate_findings",
    "adjudication",
    "evidence_linkset",
    "report_bundle",
    "persistence_ref",
  ];
}
