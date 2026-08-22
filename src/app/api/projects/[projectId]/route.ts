// GET/PATCH /api/projects/[projectId] — fetch or update metadata/inputs/stage.
import { NextResponse } from "next/server";
import {
  badRequest,
  notFound,
  requireWorkspace,
  serverError,
} from "@/lib/api";
import { getPack } from "@/domain/packs";
import type { InputValueState, Project } from "@/domain/types";

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

    const body = (await req.json()) as {
      metadata?: Partial<Project["metadata"]>;
      input_values?: Record<string, { state: InputValueState; value?: string }>;
      native_stage_id?: string;
    };

    if (body.metadata) {
      project.metadata = { ...project.metadata, ...body.metadata };
    }
    if (body.native_stage_id) {
      const pack = getPack(project.stage_selection.jurisdiction);
      const stage = pack.stages.find((s) => s.native_stage_id === body.native_stage_id);
      if (!stage) return badRequest("unknown native stage");
      if (!stage.mvp_scope) return badRequest("stage outside MVP scope");
      project.stage_selection.native_stage_id = stage.native_stage_id;
    }
    if (body.input_values) {
      for (const [inputId, v] of Object.entries(body.input_values)) {
        if (!v || typeof v.state !== "string") return badRequest(`bad value for ${inputId}`);
        project.input_values[inputId] = { state: v.state, value: v.value ?? "" };
      }
    }
    project.updated_at = new Date().toISOString();
    await auth.repo.saveProject(auth.ws, project);
    return NextResponse.json({ project });
  } catch (e) {
    return serverError(e);
  }
}
