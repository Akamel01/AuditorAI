// GET /api/projects/[projectId]/audits — list; POST — run the audit pipeline
// and persist the result. Deterministic by default; when the AI adapter is
// enabled (env), the live driver runs candidate generation with project
// drawings passed as image blocks (M3), respecting the vision budget.
import { NextResponse } from "next/server";
import { notFound, requireWorkspace, serverError } from "@/lib/api";
import { runAudit } from "@/domain/engine";
import { getPipeline } from "@/domain/pipeline/pipeline";
import { getPack } from "@/domain/packs";
import type { JurisdictionId } from "@/domain/types";
import { getAiAdapter } from "@/lib/ai";

type Ctx = { params: Promise<{ projectId: string }> };

function packVocabulary(jurisdiction: JurisdictionId) {
  const pack = getPack(jurisdiction);
  return {
    issue_categories: pack.issue_categories,
    road_user_categories: pack.road_user_categories,
  };
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId } = await ctx.params;
    const project = await auth.repo.getProject(auth.ws, projectId);
    if (!project) return notFound("project not found");

    const ranAtIso = new Date().toISOString();
    const adapter = getAiAdapter();
    const result = adapter.enabled
      ? await getPipeline().runAllLive(project, ranAtIso, {
          aiAdapter: adapter,
          attachments: (await auth.repo.listAttachments(auth.ws, projectId)).map((a) => ({
            attachment_id: a.attachment_id,
            file_name: a.file_name,
            data_url: a.data_url,
          })),
          candidateVocabulary: packVocabulary(project.stage_selection.jurisdiction),
        })
      : runAudit(project, ranAtIso);

    await auth.repo.saveAudit(auth.ws, result);
    return NextResponse.json({ audit: result }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId } = await ctx.params;
    const audits = await auth.repo.listAudits(auth.ws, projectId);
    return NextResponse.json({ audits });
  } catch (e) {
    return serverError(e);
  }
}
