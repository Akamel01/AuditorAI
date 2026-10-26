// POST /api/projects — create; GET — list for workspace.
import { NextResponse } from "next/server";
import {
  badRequest,
  newId,
  requireWorkspace,
  serverError,
} from "@/lib/api";
import { createProject, type CreateProjectInput } from "@/domain/project-edits";
import { createProjectRequest, readJsonBody } from "@/lib/request-schema";

export async function POST(req: Request) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const body = await readJsonBody<CreateProjectInput>(req, createProjectRequest);
    const outcome = createProject(body, {
      wsHash: auth.ws,
      nowIso: new Date().toISOString(),
      newProjectId: newId("P"),
    });
    if (!outcome.ok) return badRequest(outcome.error);
    await auth.repo.saveProject(auth.ws, outcome.value, auth.actor);
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
    // m3: the discriminator lives under ONE separate key, `database_status` —
    // a bare top-level `code` would sit in the error-body namespace
    // (src/lib/client.ts:72 reads data?.error on a non-ok response).
    return NextResponse.json({ projects, database_status: auth.databaseStatus });
  } catch (e) {
    return serverError(e);
  }
}
 
// rebuild
