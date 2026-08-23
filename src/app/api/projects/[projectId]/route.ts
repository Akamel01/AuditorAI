// GET/PATCH /api/projects/[projectId] — fetch or update metadata/inputs/stage.
import { NextResponse } from "next/server";
import {
  badRequest,
  notFound,
  requireWorkspace,
  serverError,
} from "@/lib/api";
import { patchProject, type PatchProjectInput } from "@/domain/project-edits";

type Ctx = { params: Promise<{ projectId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  const { projectId } = await ctx.params;
  const project = await auth.repo.getProject(auth.ws, projectId);
  if (!project) return notFound("project not found");
  return NextResponse.json({ project });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId } = await ctx.params;
    const project = await auth.repo.getProject(auth.ws, projectId);
    if (!project) return notFound("project not found");

    const body = (await req.json()) as PatchProjectInput;
    const outcome = patchProject(project, body, new Date().toISOString());
    if (!outcome.ok) return badRequest(outcome.error);

    await auth.repo.saveProject(auth.ws, outcome.value);
    return NextResponse.json({ project: outcome.value });
  } catch (e) {
    return serverError(e);
  }
}
