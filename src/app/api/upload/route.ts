// POST /api/upload — multipart upload: text extraction for PDF/TXT/MD, or
// inline image attachments under the M1 caps. Orchestration only: intake
// policy lives in lib/intake.ts.
import { NextResponse } from "next/server";
import { badRequest, requireWorkspace, serverError } from "@/lib/api";
import { MAX_UPLOAD_BYTES, extractText } from "@/lib/extract";
import { buildImageAttachment } from "@/lib/intake";
import { uploadFields, validateFormFields } from "@/lib/request-schema";

export async function POST(req: Request) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const form = await req.formData();
    // Only the NON-file fields are schema-checked here; the file policy (size,
    // extension, magic bytes) stays with lib/intake.ts and lib/extract.ts.
    const fields = validateFormFields(form, uploadFields);
    if (!fields.ok) return badRequest(fields.error);

    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("multipart field 'file' is required");

    // Image branch: paste-to-attach drawings (M2).
    if (fields.value.kind === "image") {
      // The tenant repository resolved by requireWorkspace — one store per
      // request, never a second Repository built here.
      const repo = auth.repo;
      const projectId = fields.value.project_id ?? "";
      const existing = projectId ? await repo.listAttachments(auth.ws, projectId) : [];
      const built = await buildImageAttachment(form, file, existing);
      if (!built.ok) return badRequest(built.error);
      await repo.saveAttachment(auth.ws, built.value, auth.actor);
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
