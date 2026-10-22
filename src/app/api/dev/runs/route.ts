// POST /api/dev/runs — create a step-session for driving the pipeline
// node-by-node (D3). Guarded by D1 requireAdmin. The Project is supplied
// inline (what-if inputs welcome); nothing is read from storage here.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin, serverError } from "@/lib/api";
import { devRunRequest, readJsonBody } from "@/lib/request-schema";
import { getPipeline } from "@/domain/pipeline/pipeline";
import { putSession } from "@/lib/devtab";
import type { DevRunSession } from "@/lib/devtab";
import type { Project } from "@/domain/types";

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const body = await readJsonBody<{ project?: Project }>(req, devRunRequest);
    if (!body.project?.project_id || !body.project.stage_selection || !body.project.input_values) {
      return NextResponse.json(
        { error: "project with project_id, stage_selection and input_values is required" },
        { status: 400 },
      );
    }
    const session: DevRunSession = {
      runId: `devrun-${randomBytes(6).toString("hex")}`,
      project: body.project,
      ranAtIso: new Date().toISOString(),
      state: getPipeline().initialState(),
      executed: [],
      artifacts: [],
    };
    putSession(session);
    return NextResponse.json({
      runId: session.runId,
      ranAtIso: session.ranAtIso,
      descriptors: getPipeline().describe(),
      batchOrder: getPipeline().describe().filter((d) => d.executed_in_batch).map((d) => d.id),
    });
  } catch (e) {
    // A malformed or schema-invalid body is a 422 (RequestContractError via
    // ERROR_TABLE); the route's own "project with … is required" stays a 400.
    return serverError(e);
  }
}
