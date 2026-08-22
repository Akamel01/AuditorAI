// Upload intake: strict limits, MIME sniffing by extension+magic bytes,
// and text extraction for PDF/TXT/MD. Files themselves are never persisted —
// only extracted text (reduces security surface; DEC-0002).
import { extractText as unpdfExtract, getDocumentProxy } from "unpdf";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md"] as const;

export class UploadError extends Error {}

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf("."));
  if (!ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
    throw new UploadError(`Unsupported file type ${ext}; accepted: ${ACCEPTED_EXTENSIONS.join(", ")}`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(`File exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024} MB limit`);
  }

  const buf = new Uint8Array(await file.arrayBuffer());

  // Magic-byte sanity for PDFs (%PDF-)
  if (ext === ".pdf") {
    const head = Buffer.from(buf.slice(0, 5)).toString("latin1");
    if (!head.startsWith("%PDF-")) throw new UploadError("File is not a valid PDF");
    const pdf = await getDocumentProxy(buf);
    const { text } = await unpdfExtract(pdf, { mergePages: true });
    return normalize(text);
  }
  return normalize(Buffer.from(buf).toString("utf8"));
}

function normalize(s: string): string {
  const cleaned = s.replace(/\u0000/g, "").trim();
  if (!cleaned) throw new UploadError("No extractable text found in file");
  return cleaned.slice(0, 200_000); // cap stored size
}
