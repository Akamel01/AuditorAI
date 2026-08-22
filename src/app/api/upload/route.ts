// POST /api/upload — multipart upload: text extraction for PDF/TXT/MD, or
// inline image attachments under the M1 caps (≤500KB, PNG/JPEG/WebP,
// mime-sniffed by magic bytes, ≤12 per project).
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { badRequest, requireWorkspace, serverError } from "@/lib/api";
import { MAX_UPLOAD_BYTES, UploadError, extractText, sniffImageMime } from "@/lib/extract";
import { getDataStore, Repository } from "@/lib/persistence";
import type { Attachment } from "@/domain/types";

const MAX_IMAGE_BYTES = 500 * 1000;
const MAX_ATTACHMENTS_PER_PROJECT = 12;

export async function POST(req: Request) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("multipart field 'file' is required");

    // Image branch: paste-to-attach drawings (M2).
    if ((form.get("kind") as string | null) === "image") {
      return await handleImageUpload(auth.ws, req, form, file);
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
    if (e instanceof UploadError) return badRequest(e.message);
    return serverError(e);
  }
}

async function handleImageUpload(
  wsHash: string,
  _req: Request,
  form: FormData,
  file: File,
): Promise<NextResponse> {
  if (file.size > MAX_IMAGE_BYTES) {
    return badRequest(`Image exceeds ${MAX_IMAGE_BYTES / 1000} KB limit`);
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(buf);
  if (!mime) {
    return badRequest("Not a valid PNG/JPEG/WebP image (magic-byte sniff failed)");
  }

  const projectId = String(form.get("project_id") ?? "");
  if (!projectId) return badRequest("project_id is required for image attachments");
  const inputId = (form.get("input_id") as string | null) || null;

  const repo = new Repository(getDataStore());
  const existing = await repo.listAttachments(wsHash, projectId);
  if (existing.length >= MAX_ATTACHMENTS_PER_PROJECT) {
    return badRequest(`Attachment limit reached (${MAX_ATTACHMENTS_PER_PROJECT} per project)`);
  }

  // A client-supplied id must not collide; server-generated ids are unique.
  const supplied = form.get("attachment_id") as string | null;
  if (supplied && existing.some((a) => a.attachment_id === supplied)) {
    return badRequest(`Duplicate attachment id ${supplied}`);
  }
  const attachment: Attachment = {
    attachment_id: supplied ?? `ATT-${projectId}-${randomBytes(6).toString("hex")}`,
    project_id: projectId,
    input_id: inputId,
    file_name: file.name || "pasted-image",
    mime,
    bytes: buf.byteLength,
    data_url: `data:${mime};base64,${Buffer.from(buf).toString("base64")}`,
    created_at: new Date().toISOString(),
  };

  await repo.saveAttachment(wsHash, attachment);
  return NextResponse.json({ attachment });
}
