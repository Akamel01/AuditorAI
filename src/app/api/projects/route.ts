// POST /api/projects — create; GET — list for workspace.
import { NextResponse } from "next/server";
import {
  badRequest,
  newId,
  requireWorkspace,
  serverError,
} from "@/lib/api";
import { createProject, type CreateProjectInput } from "@/domain/project-edits";

export async function POST(req: Request) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const body = (await req.json()) as CreateProjectInput;
    const outcome = createProject(body, {
      wsHash: auth.ws,
      nowIso: new Date().toISOString(),
      newProjectId: newId("P"),
    });
    if (!outcome.ok) return badRequest(outcome.error);
    await auth.repo.saveProject(auth.ws, outcome.value);
    return NextResponse.json({ project: outcome.value }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}

export async function GET(req: Request) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const projects = await auth.repo.listProjects(auth.ws);
    return NextResponse.json({ projects });
  } catch (e) {
    return serverError(e);
  }
}
