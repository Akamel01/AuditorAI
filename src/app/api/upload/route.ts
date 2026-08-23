// POST /api/upload — multipart upload: text extraction for PDF/TXT/MD, or
// inline image attachments under the M1 caps. Orchestration only: intake
// policy lives in lib/intake.ts.
import { NextResponse } from "next/server";
import { badRequest, requireWorkspace, serverError } from "@/lib/api";
import { MAX_UPLOAD_BYTES, extractText } from "@/lib/extract";
import { buildImageAttachment } from "@/lib/intake";
import { getDataStore, Repository } from "@/lib/persistence";

export async function POST(req: Request) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("multipart field 'file' is required");

    // Image branch: paste-to-attach drawings (M2).
    if ((form.get("kind") as string | null) === "image") {
      const repo = new Repository(getDataStore());
      const projectId = String(form.get("project_id") ?? "");
      const existing = projectId ? await repo.listAttachments(auth.ws, projectId) : [];
      const built = await buildImageAttachment(form, file, existing);
      if (!built.ok) return badRequest(built.error);
      await repo.saveAttachment(auth.ws, built.value);
      return NextResponse.json({ attachment: built.value });
    }

    if (file.size > MAX_UPLOAD_BYTES)
      return badRequest(`File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit`);
    const text = await extractText(file);
    return NextResponse.json({
      file_name: file.name,
      bytes: file.size,
      extracted_text: text,
    });
  } catch (e) {
    return serverError(e);
  }
}
