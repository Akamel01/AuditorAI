// POST /api/upload — multipart upload → validated, size-capped text extraction.
import { NextResponse } from "next/server";
import { badRequest, requireWorkspace, serverError } from "@/lib/api";
import { MAX_UPLOAD_BYTES, UploadError, extractText } from "@/lib/extract";

export async function POST(req: Request) {
  const auth = requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("multipart field 'file' is required");
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
