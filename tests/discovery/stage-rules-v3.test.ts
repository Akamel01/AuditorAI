import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classify,
  classifyDocument,
  loadRuleSet,
} from "../../scripts/stage-rules";

const v2 = loadRuleSet(JSON.parse(readFileSync("docs/research/stage-rules/stage-rules.v2.json", "utf8")));
const v3 = loadRuleSet(JSON.parse(readFileSync("docs/research/stage-rules/stage-rules.v3.json", "utf8")));
const SCAN = v3.scan;
function norm(text: string): string {
  const n = typeof SCAN.normalize === "string" ? SCAN.normalize : null;
  const body = n ? text.normalize(n) : text;
  return body.slice(0, SCAN.chars);
}
function readFixture(name: string): string {
  return readFileSync(`tests/fixtures/stage-rules/sections/${name}`, "utf8");
}
const ctx = { title: "", hint: "UNSTAGED" };

describe("stage-rules v3", () => {
  it("T1 loader accepts shipped v3", () => {
    expect(v3.rule_set_version).toBe("v3");
    expect(v3.frozen).toBe(true);
    expect(v3.rules.length).toBe(17);
    expect(v3.sections).toEqual({ enabled: true, min_section_chars: 80, max_heading_chars: 120 });
  });

  it("T2 v3 rules/scan/cells deep-equal v2", () => {
    expect(v3.rules).toEqual(v2.rules);
    expect(v3.scan).toEqual(v2.scan);
    expect(v3.cells).toEqual(v2.cells);
  });

  it("T3 bad section configs throw", () => {
    const base = JSON.parse(readFileSync("docs/research/stage-rules/stage-rules.v3.json", "utf8"));
    const mk = (sections: unknown) => ({ ...base, sections });
    const cases: unknown[] = [
      mk("nope"),
      mk({ enabled: "yes", min_section_chars: 80, max_heading_chars: 120 }),
      mk({ enabled: true, min_section_chars: 0, max_heading_chars: 120 }),
      mk({ enabled: true, min_section_chars: -1, max_heading_chars: 120 }),
      mk({ enabled: true, min_section_chars: 1.5, max_heading_chars: 120 }),
      mk({ enabled: true, min_section_chars: 80, max_heading_chars: 0 }),
      mk({ enabled: true, min_section_chars: 80, max_heading_chars: -2 }),
      mk({ enabled: true, min_section_chars: 80, max_heading_chars: 2.5 }),
    ];
    for (const c of cases) {
      expect(() => loadRuleSet(c), "should throw").toThrow(/stage-rules: sections/);
    }
  });

  it("T4 v1/v2 classifyDocument is pure wrapper", () => {
    const v1 = loadRuleSet(JSON.parse(readFileSync("docs/research/stage-rules/stage-rules.v1.json", "utf8")));
    for (const rs of [v1, v2]) {
      const text = readFixture("single-stage.txt");
      const doc = classifyDocument(text, ctx, rs);
      const base = classify(text, ctx, rs);
      expect(doc.sections).toEqual([]);
      expect(doc.decision).toEqual(base);
      expect(JSON.stringify(doc.decision)).toBe(JSON.stringify(base));
      expect((doc.decision as { sections?: unknown }).sections).toBeUndefined();
    }
  });

  it("T5 multi-stage numbered fixture", () => {
    const text = readFixture("multi-stage-numbered.txt");
    const doc = classifyDocument(text, ctx, v3);
    const headings = doc.sections.map((s) => s.heading);
    expect(headings).toEqual(["2. PRELIMINARY DESIGN STAGE AUDIT", "3. DETAILED DESIGN STAGE AUDIT"]);
    expect(doc.sections.map((s) => s.candidate.stage)).toEqual(["PRELIMINARY_DESIGN", "DETAILED_DESIGN"]);
    expect(doc.decision.stage).toBe("MULTI_STAGE");
    expect(doc.decision.cell_key).toBe("");
    expect(doc.decision.ambiguous).toBe(true);
    expect(doc.decision.candidates.length).toBe(2);
    // TOC headings absent
    expect(headings.some((h) => /INTRODUCTION \.\./.test(h))).toBe(false);
    // combined heading absent
    expect(headings.some((h) => /COMBINED/.test(h))).toBe(false);
  });

  it("T6 single-stage fixture", () => {
    const text = readFixture("single-stage.txt");
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections.length).toBe(1);
    expect(doc.sections[0].heading).toBe("Road Safety Audit – Preliminary Design Stage");
    expect(doc.decision.stage).toBe("PRELIMINARY_DESIGN");
    expect(doc.decision.cell_key).toBe("canada:PRELIMINARY_DESIGN");
    expect(doc.decision.ambiguous).toBe(false);
  });

  it("T7 no-headings fixture", () => {
    const text = readFixture("no-headings.txt");
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections).toEqual([]);
    expect(doc.decision).toEqual(classify(text, ctx, v3));
  });

  it("T8 all-caps + list fixture", () => {
    const text = readFixture("all-caps-and-list.txt");
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections.length).toBe(1);
    const s = doc.sections[0];
    expect(s.candidate.stage).toBe("PRELIMINARY_DESIGN");
    // span covers Hildebrand line
    const region = norm(text);
    const spanText = region.slice(s.span.start, s.span.end);
    expect(spanText).toContain("Hildebrand");
    // numbered sentence / reference did not become clear sections
    expect(doc.sections.length).toBe(1);
  });

  it("T9 French fixture", () => {
    const text = readFixture("french-numbered.txt");
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections.length).toBe(2);
    expect(doc.sections.map((s) => s.candidate.stage)).toEqual(["PRELIMINARY_DESIGN", "DETAILED_DESIGN"]);
    expect(doc.decision.stage).toBe("MULTI_STAGE");
  });

  it("T10 derived-only fixture", () => {
    const text = readFixture("derived-only.txt");
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections).toEqual([]);
    expect(doc.decision).toEqual(classify(text, ctx, v3));
  });

  it("T11 alberta real fixture", () => {
    const text = readFileSync("tests/fixtures/stage-rules/alberta-transportation-rsa-guidelines-2004.txt", "utf8");
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections.length).toBeGreaterThanOrEqual(1);
    expect(doc.decision.stage).toBe("MULTI_STAGE");
    const region = norm(text);
    for (const s of doc.sections) {
      const spanText = region.slice(s.span.start, s.span.end);
      expect(collapse(spanText).toLowerCase()).toContain(collapse(s.candidate.matched_phrase).toLowerCase());
    }
  });

  it("T12 determinism", () => {
    const text = readFixture("multi-stage-numbered.txt");
    const a = classifyDocument(text, ctx, v3);
    const b = classifyDocument(text, ctx, v3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const region = norm(text);
    let prevEnd = -1;
    for (const s of a.sections) {
      expect(s.span.start).toBeGreaterThanOrEqual(0);
      expect(s.span.start).toBeLessThan(s.span.end);
      expect(s.span.end).toBeLessThanOrEqual(region.length);
      expect(s.span.start).toBeGreaterThanOrEqual(prevEnd === -1 ? 0 : prevEnd);
      prevEnd = s.span.end;
    }
  });

  it("T13 title-only", () => {
    const doc = classifyDocument("", { title: "Stage 3 Road Safety Audit", hint: "UNSTAGED" }, v3);
    expect(doc.sections).toEqual([]);
    expect(doc.decision).toEqual(classify("", { title: "Stage 3 Road Safety Audit", hint: "UNSTAGED" }, v3));
  });

  it("T14 span/evidence invariant", () => {
    const files = ["multi-stage-numbered.txt", "single-stage.txt", "all-caps-and-list.txt", "french-numbered.txt", "french-heading-english-body.txt"];
    for (const f of files) {
      const text = readFixture(f);
      const region = norm(text);
      const doc = classifyDocument(text, ctx, v3);
      for (const s of doc.sections) {
        expect(s.evidence_region).toBe("heading");
        expect(s.span.start).toBeLessThanOrEqual(s.candidate.offset);
        expect(s.candidate.offset).toBeLessThan(s.span.end);
        const heading = collapse(s.heading);
        const spanText = collapse(region.slice(s.span.start, s.span.end));
        const phrase = collapse(s.candidate.matched_phrase);
        expect(heading.toLowerCase()).toContain(phrase.toLowerCase());
        expect(spanText.toLowerCase()).toContain(phrase.toLowerCase());
      }
    }
  });

  it("T15 document invariant", () => {
    const files = ["multi-stage-numbered.txt", "single-stage.txt", "french-numbered.txt"];
    for (const f of files) {
      const text = readFixture(f);
      const doc = classifyDocument(text, ctx, v3);
      expect(doc.decision.ambiguous).toBe(doc.decision.candidates.length >= 2);
      if (doc.sections.length === 0) return;
      const distinct = [...new Set(doc.sections.map((s) => s.candidate.stage))];
      if (distinct.length === 1) {
        expect(doc.decision.stage).toBe(distinct[0]);
        expect(doc.decision.ambiguous).toBe(false);
        const cellStages = new Set(["FEASIBILITY_CONCEPT","PRELIMINARY_DESIGN","DETAILED_DESIGN"]);
        if (cellStages.has(distinct[0])) expect(doc.decision.cell_key).not.toBe("");
      } else {
        expect(doc.decision.stage).toBe("MULTI_STAGE");
        expect(doc.decision.cell_key).toBe("");
        expect(doc.decision.ambiguous).toBe(true);
        expect(doc.decision.candidates.length).toBe(distinct.length);
      }
      expect(doc.decision.candidates.map((c) => c.stage)).toEqual(distinct);
    }
  });

  it("T16 rollback flag", () => {
    const clone = JSON.parse(readFileSync("docs/research/stage-rules/stage-rules.v3.json", "utf8"));
    clone.sections.enabled = false;
    const rs = loadRuleSet(clone);
    const text = readFixture("single-stage.txt");
    const doc = classifyDocument(text, ctx, rs);
    expect(doc.sections).toEqual([]);
    expect(doc.decision).toEqual(classify(text, ctx, rs));
  });

  it("T17 max heading length", () => {
    const prefix = "1. PRELIMINARY DESIGN ";
    const line121 = prefix + "X".repeat(121 - prefix.length);
    expect(line121.length).toBe(121);
    const line120 = prefix + "X".repeat(120 - prefix.length);
    expect(line120.length).toBe(120);
    const body = `${line121}\n${"x".repeat(90)}\n${line120}\n${"y".repeat(90)}`;
    const doc = classifyDocument(body, ctx, v3);
    expect(doc.sections.some((s: { heading: string }) => s.heading === line120)).toBe(true);
    expect(doc.sections.some((s: { heading: string }) => s.heading === line121)).toBe(false);
  });

  it("T18 wrapped-sentence near-miss", () => {
    const text = "1.1.4 The independent Stage 1 Road Safety Audit was carefully carried out\nSafety Audit continued here with enough body text to pass\n";
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections.every((s: { heading: string }) => !/independent Stage 1 Road/.test(s.heading))).toBe(true);
  });

  it("T19 TOC vs legitimate trailing number", () => {
    const tocText = "2 Items Raised at Previous Stage 1 Road Safety Audit 7\nfoo\n2. PRELIMINARY DESIGN STAGE AUDIT\n" + "b".repeat(90);
    const tocDoc = classifyDocument(tocText, ctx, v3);
    expect(tocDoc.sections.some((s: { heading: string }) => s.heading === "2 Items Raised at Previous Stage 1 Road Safety Audit 7")).toBe(false);
    expect(tocDoc.sections.some((s: { heading: string }) => s.heading === "2. PRELIMINARY DESIGN STAGE AUDIT")).toBe(true);

    const tocText2 = "4. PROBLEMS IDENTIFIED AT THIS STAGE 1 ROAD SAFETY AUDIT 8\nfoo\n4. PROBLEMS IDENTIFIED AT THIS STAGE 1 ROAD SAFETY\n" + "b".repeat(90);
    const tocDoc2 = classifyDocument(tocText2, ctx, v3);
    expect(tocDoc2.sections.some((s: { heading: string }) => s.heading === "4. PROBLEMS IDENTIFIED AT THIS STAGE 1 ROAD SAFETY AUDIT 8")).toBe(false);

    const legitText = "STAGE 1 – 2041\n" + "c".repeat(90);
    const legitDoc = classifyDocument(legitText, ctx, v3);
    expect(legitDoc.sections.some((s: { heading: string }) => s.heading === "STAGE 1 – 2041")).toBe(true);
  });

});
describe("stage-rules v3 refinement", () => {
  it("T20 header window keeps short header section", () => {
    const text = readFileSync("tests/fixtures/stage-rules/sections/header-window.txt", "utf8");
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections.length).toBeGreaterThanOrEqual(1);
    expect(doc.sections[0].candidate.stage).toBe("PRELIMINARY_DESIGN");
    // short header section (<80 chars) is kept
    expect(doc.sections.some((s: { span: { end: number; start: number } }) => (s.span.end - s.span.start) < 80)).toBe(true);
  });

  it("T21 token cap 14-16 accepted, 17 rejected", () => {
    // build a 14-token title-case stage-bearing line
    const make = (n: number) => {
      const base = ["Road", "Safety", "Audit", "Stage", "Preliminary", "Design"];
      while (base.length < n) base.push("Word" + base.length);
      return base.join(" ");
    };
    const line14 = make(14);
    const line16 = make(16);
    const line17 = make(17);
    const body = `${line14}\n${"x".repeat(90)}`;
    const doc14 = classifyDocument(body, ctx, v3);
    expect(doc14.sections.some((s: { heading: string }) => s.heading === line14)).toBe(true);
    const body16 = `${line16}\n${"x".repeat(90)}`;
    const doc16 = classifyDocument(body16, ctx, v3);
    expect(doc16.sections.some((s: { heading: string }) => s.heading === line16)).toBe(true);
    const body17 = `${line17}\n${"x".repeat(90)}`;
    const doc17 = classifyDocument(body17, ctx, v3);
    expect(doc17.sections.some((s: { heading: string }) => s.heading === line17)).toBe(false);
  });

  it("T22 short section dropped after offset 600", () => {
    const pad = "n".repeat(620);
    const shortText = pad + "\n\nPRELIMINARY DESIGN SHORT\nNEXT HEADING\n" + "y".repeat(90);
    const doc = classifyDocument(shortText, ctx, v3);
    // short heading at >=600 is dropped; only the later long section (if any) remains
    expect(doc.sections.every((s: { heading: string }) => s.heading !== "PRELIMINARY DESIGN SHORT")).toBe(true);
  });

});

describe("stage-rules v3 combined", () => {
  it("T23 combined-stage heading yields no clear section", () => {
    const text = "COMBINED STAGE 1 AND 2 ROAD SAFETY AUDIT DESIGNERS’ RESPONSE\n" + "b".repeat(90);
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections.every((s: { heading: string }) => !/COMBINED STAGE 1 AND 2/.test(s.heading))).toBe(true);
  });
});

describe("stage-rules v3 PR #88 guards", () => {
  it("T24 carry-over items stage 1 no FEAS, current PRELIM remains", () => {
    const text = readFileSync("tests/fixtures/stage-rules/sections/carry-over-items-stage1.txt", "utf8");
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections.every((s: { candidate: { stage: string } }) => s.candidate.stage !== "FEASIBILITY_CONCEPT")).toBe(true);
    expect(doc.sections.some((s: { candidate: { stage: string } }) => s.candidate.stage === "PRELIMINARY_DESIGN")).toBe(true);
  });
  it("T25 carry-over previous stage no FEAS, current PRELIM remains", () => {
    const text = readFileSync("tests/fixtures/stage-rules/sections/carry-over-previous-stage.txt", "utf8");
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections.every((s: { candidate: { stage: string } }) => s.candidate.stage !== "FEASIBILITY_CONCEPT")).toBe(true);
    expect(doc.sections.some((s: { candidate: { stage: string } }) => s.candidate.stage === "PRELIMINARY_DESIGN")).toBe(true);
  });
  it("T26 generic planning yields no clear section", () => {
    const text = readFileSync("tests/fixtures/stage-rules/sections/generic-planning.txt", "utf8");
    const doc = classifyDocument(text, ctx, v3);
    expect(doc.sections).toEqual([]);
    expect(doc.decision).toEqual(classify(text, ctx, v3));
  });
});

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
