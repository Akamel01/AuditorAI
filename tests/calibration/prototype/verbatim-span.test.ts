import { describe, it, expect } from "vitest";
import { buildDocument, locate, windowFor } from "../../../scripts/calibration/prototype/document";
import { normalizeForMatch, normalizeWithMap, countWords } from "../../../scripts/calibration/prototype/normalize";
import { checkVerbatim } from "../../../scripts/calibration/prototype/verbatim";

describe("normalize", () => {
  it("whitespace/NBSP collapse", () => {
    expect(normalizeForMatch("a  b\tc\nd\u00A0e")).toBe("a b c d e");
  });
  it("ligatures", () => {
    expect(normalizeForMatch("\uFB01\uFB02")).toBe("fifl");
  });
  it("ligatures exact", () => {
    expect(normalizeForMatch("\uFB01")).toBe("fi");
    expect(normalizeForMatch("\uFB03")).toBe("ffi");
  });
  it("line-break hyphenation letter-letter joins", () => {
    expect(normalizeForMatch("rear-\nend")).toBe("rearend");
  });
  it("compound rear-end", () => {
    expect(normalizeForMatch("rear-\nend")).toBe("rearend");
  });
  it("digit-letter keeps hyphen", () => {
    expect(normalizeForMatch("a1-\nbc")).toBe("a1- bc");
  });
  it("soft hyphen/zero-width removal", () => {
    expect(normalizeForMatch("a\u00ADb\u200Bc\u200Dd\uFEFFe")).toBe("abcde");
  });
  it("curly quotes/dashes", () => {
    expect(normalizeForMatch("\u201Chello\u201D \u2018hi\u2019 \u2013 \u2014")).toBe('"hello" \'hi\' - -');
  });
  it("case/accent sensitivity", () => {
    expect(normalizeForMatch("Café")).toBe("Café");
    expect(normalizeForMatch("café")).not.toBe("Café");
  });
});

describe("word gate", () => {
  it("2/3/14/15", () => {
    expect(countWords("a b")).toBe(2);
    expect(countWords("a b c")).toBe(3);
    const fourteen = Array(14).fill("w").join(" ");
    expect(countWords(fourteen)).toBe(14);
    const fifteen = Array(15).fill("w").join(" ");
    expect(countWords(fifteen)).toBe(15);
  });
  it("ellipsis raw", () => {
    const doc = buildDocument(["hello world foo bar"], "0".repeat(64));
    const r = checkVerbatim(doc, { quote: "hello ... world", page: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("ellipsis");
  });
  it("…", () => {
    const doc = buildDocument(["hello world foo bar"], "0".repeat(64));
    const r = checkVerbatim(doc, { quote: "hello … world", page: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("ellipsis");
  });
  it("empty quote", () => {
    const doc = buildDocument(["hello world foo bar"], "0".repeat(64));
    const r = checkVerbatim(doc, { quote: "   ", page: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("empty_quote");
  });
  it("bullet 2 words => word_count", () => {
    const doc = buildDocument(["• Lane drops here now"], "0".repeat(64));
    const r = checkVerbatim(doc, { quote: "• Lane drops", page: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("word_count");
  });
});

describe("page offsets", () => {
  it("synthetic 3-page doc", () => {
    const doc = buildDocument(["page one text", "page two text", "page three text"], "0".repeat(64));
    expect(doc.page_count).toBe(3);
    expect(doc.pages.length).toBe(3);
    // norm_start increasing
    expect(doc.pages[0].norm_start).toBe(0);
    expect(doc.pages[1].norm_start).toBeGreaterThan(0);
    expect(doc.pages[2].norm_end).toBe(doc.normalized_text.length);
  });
  it("cross-page span", () => {
    const doc = buildDocument(["hello world foo", "bar baz qux"], "0".repeat(64));
    const r = checkVerbatim(doc, { quote: "world foo bar", page: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.page).toBe(1);
      expect(r.end_page).toBe(2);
      expect(r.cross_page).toBe(true);
    }
  });
  it("empty page range", () => {
    const doc = buildDocument(["", "second page here"], "0".repeat(64));
    expect(doc.pages[0].norm_start).toBe(doc.pages[0].norm_end);
  });
  it("page-boundary end_page", () => {
    const doc = buildDocument(["aaa bbb ccc", "ddd eee fff"], "0".repeat(64));
    const loc = locate(doc, 0, 3);
    expect(loc?.page).toBe(1);
    expect(loc?.end_page).toBe(1);
    // end at boundary
    const lastCharPage1 = doc.pages[0].norm_end - 1;
    const loc2 = locate(doc, lastCharPage1, 1);
    expect(loc2?.page).toBe(1);
    expect(loc2?.end_page).toBe(1);
  });
});

describe("sections", () => {
  it("section lookup + numbered body not heading + allcaps table header is", () => {
    const raw = "1. Introduction\nSome numbered body paragraph with many words here that should not be heading.\nTABLE HEADER ROW\ncontent here";
    // build single page
    const doc = buildDocument([raw], "0".repeat(64));
    // section for content after TABLE HEADER
    const idx = doc.normalized_text.indexOf("content here");
    const loc = locate(doc, idx, 12);
    expect(loc?.section).not.toBeNull();
    // numbered body paragraph: "Some numbered..." should not be a heading
    const headings = doc.sections.map((s) => s.title);
    expect(headings.some((h) => h.startsWith("Some numbered"))).toBe(false);
    // allcaps table header detected (documented heuristic)
    expect(headings.some((h) => h === "TABLE HEADER ROW")).toBe(true);
  });
  it("unknown section", () => {
    const doc = buildDocument(["no headings here at all"], "0".repeat(64));
    const loc = locate(doc, 0, 2);
    expect(loc?.section).toBeNull();
  });
});

describe("verbatim claimed-page", () => {
  it("claimed-page mismatch", () => {
    const doc = buildDocument(["hello world foo bar", "hello world foo bar"], "0".repeat(64));
    const r = checkVerbatim(doc, { quote: "hello world foo", page: 2 });
    // quote appears on page1 and page2; claimed page2 => accept page2
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.page).toBe(2);
  });
  it("claimed-page-first (same quote p1/p2 claimed p2 => p2)", () => {
    const doc = buildDocument(["hello world foo bar", "hello world foo bar"], "0".repeat(64));
    const r = checkVerbatim(doc, { quote: "hello world foo", page: 2 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.page).toBe(2);
  });
  it(">20 occurrences claimed-page late => pass", () => {
    const occ = "the quick brown";
    const first = Array(25).fill(occ).join(" x ");
    const doc = buildDocument([first, occ], "0".repeat(64));
    const r = checkVerbatim(doc, { quote: occ, page: 2 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.page).toBe(2);
      expect(r.occurrence_count).toBe(20);
      expect(r.occurrence_capped).toBe(true);
    }
  });
  it("page mismatch when not on claimed page", () => {
    const doc = buildDocument(["hello world foo bar", "zzz"], "0".repeat(64));
    const r = checkVerbatim(doc, { quote: "hello world foo", page: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("page_mismatch");
  });
  it("not found", () => {
    const doc = buildDocument(["hello world foo bar"], "0".repeat(64));
    const r = checkVerbatim(doc, { quote: "nope nope nope", page: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_found");
  });
});

describe("map invariants", () => {
  it("normToRaw length === text length, non-decreasing", () => {
    const { text, normToRaw } = normalizeWithMap("a-\nb c");
    expect(normToRaw.length).toBe(text.length);
    for (let i = 1; i < normToRaw.length; i++) expect(normToRaw[i]).toBeGreaterThanOrEqual(normToRaw[i - 1]);
  });
});

describe("windowFor", () => {
  it("windowFor ±1 page and 20k cap", () => {
    const doc = buildDocument(["a ".repeat(100), "b ".repeat(100), "c ".repeat(100)], "0".repeat(64));
    const span = { start_offset: 5, end_offset: 8, page: 2, end_page: 2 };
    const w = windowFor(doc, span, 1, 20000);
    expect(w.pages[0]).toBe(1);
    expect(w.pages[1]).toBe(3);
    expect(w.chars).toBeLessThanOrEqual(20000);
  });
});
