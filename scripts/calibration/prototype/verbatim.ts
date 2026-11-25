import { normalizeForMatch, countWords } from "./normalize";
import type { DocumentText } from "./document";
import { locate } from "./document";

export interface VerbatimOk {
  ok: true;
  quote: string;
  quote_normalized: string;
  word_count: number;
  start_offset: number;
  end_offset: number;
  raw_start: number;
  raw_end: number;
  page: number;
  end_page: number;
  cross_page: boolean;
  section: string | null;
  section_start: number | null;
  occurrence_count: number;
  occurrence_capped: boolean;
}

export interface VerbatimFail {
  ok: false;
  reason: "empty_quote" | "ellipsis" | "word_count" | "not_found" | "page_mismatch";
  detail: string;
  quote_normalized: string | null;
  word_count: number | null;
  claimed_page: number | null;
  found_page: number | null;
  start_offset: number | null;
  section: string | null;
}

export type VerbatimResult = VerbatimOk | VerbatimFail;

export function checkVerbatim(
  doc: DocumentText,
  input: { quote: string; page: number },
): VerbatimResult {
  const rawQuote = input.quote;
  // empty
  if (rawQuote.trim() === "") {
    return fail("empty_quote", "quote is empty", null, null, input.page, null, null);
  }
  // ellipsis check on raw quote
  if (rawQuote.includes("...") || rawQuote.includes("…")) {
    const qn = normalizeForMatch(rawQuote).trim();
    return fail("ellipsis", "quote contains ellipsis", qn, countWords(qn), input.page, null, null);
  }
  const qn = normalizeForMatch(rawQuote).trim();
  const wc = countWords(qn);
  if (qn === "") {
    return fail("empty_quote", "quote normalizes to empty", qn, 0, input.page, null, null);
  }
  if (wc < 3 || wc > 14) {
    return fail("word_count", `word count ${wc} outside 3-14`, qn, wc, input.page, null, null);
  }

  // scan all occurrences
  const haystack = doc.normalized_text;
  const occs: number[] = [];
  let idx = 0;
  while (true) {
    const pos = haystack.indexOf(qn, idx);
    if (pos === -1) break;
    occs.push(pos);
    if (occs.length >= 20) {
      // record capped; but continue scanning to know if claimed page occurs later
      // We still need to scan rest for claimed-page preference beyond 20.
      // Keep scanning but don't store beyond 20.
    }
    idx = pos + 1; // allow overlapping? indexOf standard non-overlap; use +1 to find all including overlapping
    if (idx > haystack.length) break;
  }
  // Actually we need all positions for claimed-page preference even beyond 20.
  // Re-scan fully storing up to? Amendment: record up to 20 occurrences; prefer claimed-page even after 20th.
  // We'll collect all positions but cap stored list at 20; track claimed-page occurrence separately.
  const allPositions: number[] = [];
  let searchIdx = 0;
  while (true) {
    const pos = haystack.indexOf(qn, searchIdx);
    if (pos === -1) break;
    allPositions.push(pos);
    searchIdx = pos + 1;
  }

  if (allPositions.length === 0) {
    return fail("not_found", "quote not found", qn, wc, input.page, null, null);
  }

  // find first occurrence whose start page equals claimed page
  const pageOf = (off: number): number => {
    for (const pg of doc.pages) {
      if (off >= pg.norm_start && off < pg.norm_end) return pg.page;
    }
    return doc.pages[doc.pages.length - 1]?.page ?? 1;
  };

  let chosenPos: number | null = null;
  for (const pos of allPositions) {
    if (pageOf(pos) === input.page) {
      chosenPos = pos;
      break;
    }
  }

  if (chosenPos === null) {
    // page mismatch: found_page of first occurrence
    const firstPos = allPositions[0];
    const foundPage = pageOf(firstPos);
    return fail("page_mismatch", `model page ${input.page}; quote found on page ${foundPage}`, qn, wc, input.page, foundPage, null);
  }

  const start = chosenPos;
  const endExclusive = start + qn.length;
  const loc = locate(doc, start, qn.length);
  if (!loc) {
    return fail("not_found", "locate failed", qn, wc, input.page, null, null);
  }
  const storedCount = Math.min(allPositions.length, 20);
  const cappedFlag = allPositions.length > 20;
  return {
    ok: true,
    quote: rawQuote,
    quote_normalized: qn,
    word_count: wc,
    start_offset: start,
    end_offset: endExclusive,
    raw_start: loc.raw_start,
    raw_end: loc.raw_end,
    page: loc.page,
    end_page: loc.end_page,
    cross_page: loc.cross_page,
    section: loc.section,
    section_start: loc.section_start,
    occurrence_count: storedCount,
    occurrence_capped: cappedFlag,
  };
}

function fail(
  reason: VerbatimFail["reason"],
  detail: string,
  qn: string | null,
  wc: number | null,
  claimed: number | null,
  found: number | null,
  start: number | null,
): VerbatimFail {
  return {
    ok: false,
    reason,
    detail,
    quote_normalized: qn,
    word_count: wc,
    claimed_page: claimed,
    found_page: found,
    start_offset: start,
    section: null,
  };
}

export { countWords } from "./normalize";
