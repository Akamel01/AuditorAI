// POST /api/projects — create; GET — list for workspace.
import { NextResponse } from "next/server";
import {
  badRequest,
  newId,
  requireWorkspace,
  serverError,
} from "@/lib/api";
import { getPack } from "@/domain/packs";
import type { JurisdictionId, Project } from "@/domain/types";

export async function POST(req: Request) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const body = (await req.json()) as {
      name?: string;
      jurisdiction?: JurisdictionId;
      native_stage_id?: string;
      description?: string;
      scheme_summary?: string;
      authority?: string;
      location?: string;
    };
    if (!body.name?.trim()) return badRequest("name is required");
    if (!body.jurisdiction || !body.native_stage_id)
      return badRequest("jurisdiction and native_stage_id are required");

    const pack = getPack(body.jurisdiction);
    const stage = pack.stages.find((s) => s.native_stage_id === body.native_stage_id);
    if (!stage) return badRequest(`unknown native stage ${body.native_stage_id}`);
    if (!stage.mvp_scope)
      return badRequest(`stage ${stage.display_name} is outside MVP scope`);

    const now = new Date().toISOString();
    const project: Project = {
      project_id: newId("P"),
      workspace_key_hash: auth.ws,
      metadata: {
        name: body.name.trim(),
        description: body.description ?? "",
        scheme_summary: body.scheme_summary ?? "",
        authority: body.authority ?? "",
        location: body.location ?? "",
      },
      stage_selection: {
        jurisdiction: body.jurisdiction,
        native_stage_id: stage.native_stage_id,
      },
      input_values: {},
      created_at: now,
      updated_at: now,
    };
    await auth.repo.saveProject(auth.ws, project);
    return NextResponse.json({ project }, { status: 201 });
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
