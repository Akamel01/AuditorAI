// GET/DELETE /api/projects/[projectId]/attachments/[attachmentId] — fetch a
// stored drawing (thumbnail src) or remove it (frees the KV key and strips the
// id from any input_values referencing it).
import { NextResponse } from "next/server";
import { badRequest, notFound, requireWorkspace, serverError } from "@/lib/api";

interface Ctx {
  params: Promise<{ projectId: string; attachmentId: string }>;
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(_req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId, attachmentId } = await ctx.params;
    const attachment = await auth.repo.getAttachment(auth.ws, projectId, attachmentId);
    if (!attachment) return notFound("attachment not found");
    return NextResponse.json({ attachment });
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId, attachmentId } = await ctx.params;
    await auth.repo.deleteAttachment(auth.ws, projectId, attachmentId);

    // Strip the id from any input_values that reference it.
    const project = await auth.repo.getProject(auth.ws, projectId);
    if (project) {
      let touched = false;
      for (const v of Object.values(project.input_values)) {
        if (v.attachments?.includes(attachmentId)) {
          v.attachments = v.attachments.filter((a) => a !== attachmentId);
          if (v.attachments.length === 0) delete v.attachments;
          touched = true;
        }
      }
      if (touched) {
        project.updated_at = new Date().toISOString();
        await auth.repo.saveProject(auth.ws, project);
      }
    }
    return NextResponse.json({ deleted: attachmentId });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("unknown attachment")) {
      return badRequest(e.message);
    }
    return serverError(e);
  }
}
