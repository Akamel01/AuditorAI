// DrawingProcessor seam — multimodal chain preserved page-by-page.
// Phase-1 implementation extracts text + page count via unpdf; PNG
// rasterization and OCR are interface-staged (nulls recorded, never dropped)
// pending a rasterizer dependency decision (ADR-worthy when chosen).

export interface PdfExtractResult {
  page_count: number;
  text_head: string;
  text_sha256: string | null;
  engine: string;
}

export interface DrawingProcessor {
  extractPdf(bytes: Uint8Array): Promise<PdfExtractResult>;
}

class UnpdfDrawingProcessor implements DrawingProcessor {
  async extractPdf(bytes: Uint8Array): Promise<PdfExtractResult> {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const copy = new Uint8Array(bytes); // unpdf may detach the buffer
      const pdf = await getDocumentProxy(copy);
      const { totalPages, text } = await extractText(pdf, { mergePages: true });
      const merged = Array.isArray(text) ? text.join("\n") : text;
      const head = merged.slice(0, 4000);
      const sha256Hex = (await import("node:crypto"))
        .createHash("sha256")
        .update(head)
        .digest("hex");
      return {
        page_count: totalPages,
        text_head: head,
        text_sha256: head.length > 0 ? sha256Hex : null,
        engine: "unpdf",
      };
    } catch {
      // Encrypted/scanned PDF: record failure honestly rather than dropping.
      return { page_count: 0, text_head: "", text_sha256: null, engine: "unpdf:failed" };
    }
  }
}

export function getDrawingProcessor(): DrawingProcessor {
  return new UnpdfDrawingProcessor();
}
