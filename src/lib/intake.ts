// Image intake policy (M1/M2): caps, magic-byte sniffing, dedupe, per-project
// count cap. One home for every image-attachment rule; the upload route only
// orchestrates. Files are stored inline as data URLs (M1 decision).
import { randomBytes } from "node:crypto";
import type { Attachment } from "@/domain/types";
import { ATTACHMENT_MAX_BYTES, MAX_ATTACHMENTS_PER_PROJECT } from "@/domain/types";

export function sniffImageMime(buf: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  const b = Buffer.from(buf);
  if (
    b.length > 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47
  ) {
    return "image/png";
  }
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    b.length > 12 &&
    b.slice(0, 4).toString("latin1") === "RIFF" &&
    b.slice(8, 12).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export interface IntakeDeps {
  newAttachmentId?: (projectId: string) => string;
  nowIso?: () => string;
}

/** Validate a pasted/uploaded drawing against the intake caps and build the
 *  Attachment record. Pure given the caller-supplied existing attachments:
 *  no storage access, so the route stays orchestration-only. */
export async function buildImageAttachment(
  form: FormData,
  file: File,
  existing: Attachment[],
  deps: IntakeDeps = {},
): Promise<{ ok: true; value: Attachment } | { ok: false; error: string }> {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: `Image exceeds ${ATTACHMENT_MAX_BYTES / 1000} KB limit` };
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImageMime(buf);
  if (!mime) {
    return { ok: false, error: "Not a valid PNG/JPEG/WebP image (magic-byte sniff failed)" };
  }

  const projectId = String(form.get("project_id") ?? "");
  if (!projectId) return { ok: false, error: "project_id is required for image attachments" };
  const inputId = (form.get("input_id") as string | null) || null;

  if (existing.length >= MAX_ATTACHMENTS_PER_PROJECT) {
    return {
      ok: false,
      error: `Attachment limit reached (${MAX_ATTACHMENTS_PER_PROJECT} per project)`,
    };
  }

  // A client-supplied id must not collide; server-generated ids are unique.
  const supplied = form.get("attachment_id") as string | null;
  if (supplied && existing.some((a) => a.attachment_id === supplied)) {
    return { ok: false, error: `Duplicate attachment id ${supplied}` };
  }

  const newAttachmentId =
    deps.newAttachmentId ?? ((p: string) => `ATT-${p}-${randomBytes(6).toString("hex")}`);
  const nowIso = deps.nowIso ?? (() => new Date().toISOString());

  return {
    ok: true,
    value: {
      attachment_id: supplied ?? newAttachmentId(projectId),
      project_id: projectId,
      input_id: inputId,
      file_name: file.name || "pasted-image",
      mime,
      bytes: buf.byteLength,
      data_url: `data:${mime};base64,${Buffer.from(buf).toString("base64")}`,
      created_at: nowIso(),
    },
  };
}
