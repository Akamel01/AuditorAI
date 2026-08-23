// GET/DELETE /api/projects/[projectId]/attachments/[attachmentId] — fetch a
// stored drawing (thumbnail src) or remove it. Deletion + referential repair
// of Project.input_values is one Repository operation.
import { NextResponse } from "next/server";
import { notFound, requireWorkspace, serverError } from "@/lib/api";

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
    return NextResponse.json({ deleted: attachmentId });
  } catch (e) {
    return serverError(e);
  }
}
