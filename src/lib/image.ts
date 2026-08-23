// Client-side image intake: canvas re-encode strips EXIF metadata and
// downscales so the blob fits the M1 inline cap (≤500 KB per image).
import { ATTACHMENT_MAX_BYTES } from "@/domain/types";

export const MAX_IMAGE_BYTES = ATTACHMENT_MAX_BYTES;

export async function shrinkImage(file: File | Blob, maxBytes = 480_000): Promise<Blob> {
  if (file.size <= maxBytes && file.type !== "") return file;
  const bitmap = await createImageBitmap(file);
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.9;
  let blob = await toBlob(canvas, "image/jpeg", quality);
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.15;
    blob = await toBlob(canvas, "image/jpeg", quality);
  }
  if (blob.size > ATTACHMENT_MAX_BYTES) throw new Error("Image cannot be shrunk below 500 KB");
  return blob;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas encode failed"))),
      type,
      quality,
    ),
  );
}
