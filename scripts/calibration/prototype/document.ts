import { getDocumentProxy, extractText } from "unpdf";
import { createHash } from "node:crypto";
import { normalizeWithMap } from "./normalize";

export interface PageOffset {
  page: number;
  norm_start: number;
  norm_end: number;
  raw_start: number;
  raw_chars: number;
}

export interface SectionOffset {
  title: string;
  page: number;
  norm_start: number;
  raw_start: number;
}

export interface DocumentText {
  doc_sha256: string;
  page_count: number;
  normalized_text: string;
  normToRaw: number[];
  pages: PageOffset[];
  sections: SectionOffset[];
  heading_rule: "numbered-or-allcaps-v2";
}

export interface SpanLocation {
  page: number;
  end_page: number;
  cross_page: boolean;
  section: string | null;
  section_start: number | null;
  raw_start: number;
  raw_end: number;
}

export function buildDocument(pages: string[], sha256: string): DocumentText {
  // strip NUL per page; do not trim
  const cleaned = pages.map((p) => p.replace(/\u0000/g, ""));
  const raw = cleaned.join("\n");
  const { text, normToRaw } = normalizeWithMap(raw);

  // page raw starts
  const rawStarts: number[] = [];
  let acc = 0;
  for (let i = 0; i < cleaned.length; i++) {
    rawStarts.push(acc);
    acc += cleaned[i].length;
    if (i < cleaned.length - 1) acc += 1; // join \n
  }

  // norm_start per page: first normalized index whose raw index >= page raw start
  const pageNormStart: number[] = [];
  for (let p = 0; p < cleaned.length; p++) {
    const rs = rawStarts[p];
    // lower bound in normToRaw
    let lo = 0;
    let hi = normToRaw.length;
    // first index with normToRaw[idx] >= rs
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (normToRaw[mid] >= rs) hi = mid;
      else lo = mid + 1;
    }
    pageNormStart.push(lo);
  }

  const pagesOut: PageOffset[] = [];
  for (let p = 0; p < cleaned.length; p++) {
    const ns = pageNormStart[p];
    const ne = p + 1 < cleaned.length ? pageNormStart[p + 1] : text.length;
    pagesOut.push({
      page: p + 1,
      norm_start: ns,
      norm_end: ne,
      raw_start: rawStarts[p],
      raw_chars: cleaned[p].length,
    });
  }

  // sections: detect headings from raw lines before normalization, tracking raw line offsets
  const sections: SectionOffset[] = [];
  // walk raw lines
  const rawLines = raw.split(/\n/);
  // Need map raw line start offsets
  let lineStart = 0;
  for (const line of rawLines) {
    const trimmed = line.trim();
    const lineEnd = lineStart + line.length;
    // heading test
    if (trimmed.length >= 1 && trimmed.length <= 80) {
      const isHeading = isHeadingLine(trimmed);
      if (isHeading) {
        // find norm_start for this raw line start
        let lo = 0;
        let hi = normToRaw.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (normToRaw[mid] >= lineStart) hi = mid;
          else lo = mid + 1;
        }
        const page = pageOfOffset(lo, pagesOut);
        sections.push({ title: trimmed, page, norm_start: lo, raw_start: lineStart });
      }
    }
    lineStart = lineEnd + 1; // +\n
    if (lineStart > raw.length) break;
  }
  sections.sort((a, b) => a.norm_start - b.norm_start);

  return {
    doc_sha256: sha256,
    page_count: cleaned.length,
    normalized_text: text,
    normToRaw,
    pages: pagesOut,
    sections,
    heading_rule: "numbered-or-allcaps-v2",
  };
}

function isHeadingLine(trimmed: string): boolean {
  const tokens = trimmed.split(/\s+/).filter((t) => t.length > 0);
  // numbered
  if (/^\d+(?:\.\d+)*\.?\s+\S/.test(trimmed) && tokens.length <= 10 && !trimmed.endsWith(".")) {
    return true;
  }
  // all-caps: contains at least one letter, no lowercase letter
  if (tokens.length <= 10) {
    const hasLetter = /\p{L}/u.test(trimmed);
    const hasLower = /\p{Ll}/u.test(trimmed);
    if (hasLetter && !hasLower) return true;
  }
  return false;
}

function pageOfOffset(off: number, pages: PageOffset[]): number {
  // page containing normalized offset
  let p = 1;
  for (const pg of pages) {
    if (off >= pg.norm_start && off < pg.norm_end) return pg.page;
    if (off >= pg.norm_start) p = pg.page;
  }
  return p;
}

export async function loadDocument(pdfPath: string): Promise<DocumentText> {
  const fs = await import("node:fs/promises");
  const bytes = await fs.readFile(pdfPath);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const res = await extractText(pdf, { mergePages: false });
  if (res.text.length !== res.totalPages) throw new Error("page_count mismatch");
  // strip NUL already in buildDocument
  return buildDocument(res.text, sha);
}

export function locate(doc: DocumentText, start: number, len: number): SpanLocation | null {
  if (start < 0 || len < 0 || start + len > doc.normalized_text.length) return null;
  const endExclusive = start + len;
  if (endExclusive === start) return null; // empty
  // page of start
  const pageOf = (off: number): number => {
    for (const pg of doc.pages) {
      if (off >= pg.norm_start && off < pg.norm_end) return pg.page;
    }
    // last page
    return doc.pages[doc.pages.length - 1]?.page ?? 1;
  };
  const page = pageOf(start);
  const end_page = pageOf(endExclusive - 1);
  const cross_page = end_page !== page;
  // section: last heading with norm_start <= start
  let section: string | null = null;
  let section_start: number | null = null;
  for (const s of doc.sections) {
    if (s.norm_start <= start) {
      section = s.title;
      section_start = s.norm_start;
    } else break;
  }
  const raw_start = doc.normToRaw[start];
  const raw_end = doc.normToRaw[endExclusive - 1] + 1;
  return { page, end_page, cross_page, section, section_start, raw_start, raw_end };
}

export function windowFor(
  doc: DocumentText,
  span: { start_offset: number; end_offset: number; page: number; end_page: number },
  pagePad: number,
  charCap: number,
): { pages: [number, number]; start_offset: number; end_offset: number; chars: number; truncated: boolean } {
  const firstPage = Math.max(1, span.page - pagePad);
  const lastPage = Math.min(doc.page_count, span.end_page + pagePad);
  const firstPageObj = doc.pages.find((p) => p.page === firstPage) ?? doc.pages[0];
  const lastPageObj = doc.pages.find((p) => p.page === lastPage) ?? doc.pages[doc.pages.length - 1];
  let windowStart = firstPageObj.norm_start;
  let windowEnd = lastPageObj.norm_end;
  let truncated = false;
  if (windowEnd - windowStart > charCap) {
    truncated = true;
    let start = Math.max(windowStart, span.start_offset - 6000);
    let end = Math.min(windowEnd, start + charCap);
    if (end < span.end_offset) {
      end = span.end_offset;
      start = Math.max(windowStart, end - charCap);
    }
    // clamp so window still contains the span
    if (start > span.start_offset) start = span.start_offset;
    if (end < span.end_offset) end = span.end_offset;
    if (end - start > charCap) {
      // shrink from left if needed but keep end
      start = Math.max(windowStart, end - charCap);
      if (start > span.start_offset) start = span.start_offset;
    }
    windowStart = start;
    windowEnd = end;
  }
  return {
    pages: [firstPage, lastPage],
    start_offset: windowStart,
    end_offset: windowEnd,
    chars: windowEnd - windowStart,
    truncated,
  };
}
