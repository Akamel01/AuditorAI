/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertV3OutputPath, renderCoverageV3Table } from "../../scripts/harvest-stage-rules-v2";

const ROOT = resolve(__dirname, "../..");
function sha(p: string) {
  return createHash("sha256").update(readFileSync(resolve(ROOT, p))).digest("hex");
}
function read(p: string) {
  return readFileSync(resolve(ROOT, p), "utf8");
}

const V1_RULES_SHA = "28bffafa5a68936b34de4f054ff01f813c3cb9298239cc6768e05d3f5f081a3e";
const V2_RULES_SHA = "347bd328d910a924cc2b54b41a1c2dcce9b755942cc811377565712f3d920d8a";
const V2_SIDECAR_SHA = "41ea6f87361d69ac055609b2d581f86bef8b243236b4d9bb71ce046db425e8c1";
const V2_COVERAGE_JSON_SHA = "e05942727ca34262a7f081f425f88bd0f995dfe19e71f3729efaf7d336897be3";
const V2_COVERAGE_MD_SHA = "6cbe56960fc8bb4b73d4f79a471bf06d980c227bf0db1b6413577fd3b7c5fbf2";
const AMBIGUOUS_V2_SHA = "1c29a3f0fb50bcc98bcb961ad07b1c46f4a7860868d3ea27bcaa5368f821c979";
const V3_RULES_SHA = "d374cfffd198965b1afa10f1d7d9952668f3caac8ea55486d807f832051523da";

describe("stage-rules v3 artifacts", () => {
  const json = JSON.parse(read("docs/research/stage-rules/coverage-v3-vs-v2.json"));
  const md = read("docs/research/stage-rules/coverage-v3-vs-v2.md");
  const sidecarText = read("docs/research/stage-rules/classifications-v3.jsonl");
  const rows = sidecarText.trim().split("\n").map((l) => JSON.parse(l));

  it("A1 md byte-derivable", () => {
    expect(renderCoverageV3Table(json)).toBe(md);
    expect(/\d{4}-\d{2}-\d{2}T\d{2}:/.test(JSON.stringify(json))).toBe(false);
  });

  it("A2 sidecar shape", () => {
    expect(rows.length).toBe(33);
    const shas = rows.map((r: any) => r.sha256);
    expect(shas).toEqual([...shas].sort());
    const req = ["project_id","sha256","title","tier","ca_province","lang","licence_verdict","stage_v2_primary","cell_key_v2","ambiguous_v2","body_available_v2","stage_v3_primary","cell_key_v3","confidence_v3","ambiguous_v3","candidates","section_stages","sections","body_available_v3","comparable","source"];
    for (const r of rows) for (const f of req) expect(r).toHaveProperty(f);
  });

  it("A3 per-section citation structure", () => {
    for (const r of rows) {
      let prev = -1;
      for (const s of r.sections) {
        expect(s.evidence_region).toBe("heading");
        expect(s.heading.length).toBeGreaterThan(0);
        expect(s.heading.toLowerCase()).toContain(s.candidate.matched_phrase.toLowerCase().replace(/\s+/g," "));
        expect(s.span.start).toBeLessThan(s.span.end);
        expect(s.span.start).toBeLessThanOrEqual(s.candidate.offset);
        expect(s.candidate.offset).toBeLessThan(s.span.end);
        expect(s.span.start).toBeGreaterThanOrEqual(prev);
        prev = s.span.end;
      }
    }
  });

  it("A4 document-level self-consistency", () => {
    for (const r of rows) {
      expect(r.ambiguous_v3).toBe(r.candidates.length >= 2);
      if (r.sections.length === 0) {
        if (r.stage_v3_primary === "MULTI_STAGE" || r.stage_v3_primary === "UNSTAGED") expect(r.cell_key_v3).toBe("");
        else {
          // no-cell stages have ""
          const noCellStages = ["PRE_OPENING","EXISTING","CONSTRUCTION","UNSTAGED"];
          if (noCellStages.includes(r.stage_v3_primary)) expect(r.cell_key_v3).toBe("");
        }
      } else {
        const distinct = [...new Set(r.sections.map((s: any) => s.candidate.stage))];
        if (distinct.length === 1) {
          expect(r.stage_v3_primary).toBe(distinct[0]);
          expect(r.ambiguous_v3).toBe(false);
        } else {
          expect(r.stage_v3_primary).toBe("MULTI_STAGE");
          expect(r.cell_key_v3).toBe("");
          expect(r.ambiguous_v3).toBe(true);
          expect(r.candidates.length).toBe(distinct.length);
        }
      }
    }
  });

  it("A5 denominators", () => {
    expect(json.denominators.rows).toBe(33);
    expect(json.denominators.v2_ambiguous).toBe(25);
    expect(json.denominators.v2_non_ambiguous).toBe(8);
    expect(json.denominators.comparable_rows + json.denominators.non_comparable_rows).toBe(33);
    const totalSections = rows.reduce((n: number, r: any) => n + r.sections.length, 0);
    expect(json.denominators.v3_stage_sections).toBe(totalSections);
    expect(json.denominators.v3_documents_with_sections + json.denominators.v3_documents_without_sections).toBe(33);
    expect(json.denominators.v3_documents_with_multiple_section_stages).toBe(rows.filter((r: any) => r.section_stages.length >= 2).length);
  });

  it("A6 count invariants", () => {
    for (const c of json.cells) {
      expect(c.v3_documents).toBeGreaterThanOrEqual(c.v3_section_documents);
      expect(c.v3_stage_sections).toBeGreaterThanOrEqual(c.v3_section_documents);
      expect(c.delta_documents).toBe(c.v3_documents - c.v2_documents);
    }
    for (const s of json.stages) {
      expect(s.v3_documents).toBeGreaterThanOrEqual(s.v3_section_documents);
      expect(s.v3_stage_sections).toBeGreaterThanOrEqual(s.v3_section_documents);
    }
    const stageV2Sum = json.stages.reduce((n: number, s: any) => n + s.v2_documents, 0);
    expect(stageV2Sum).toBe(33);
    expect(json.cells.length).toBe(3);
    expect(json.stages.length).toBe(8);
    expect(json.coverage_candidates.length).toBe(3);
    for (const c of json.coverage_candidates) {
      expect(c.v3_documents).toBeGreaterThanOrEqual(c.v3_section_documents);
      expect(c.v3_stage_sections).toBeGreaterThanOrEqual(c.v3_section_documents);
    }
  });

  it("A7 comparability", () => {
    const nonComp = rows.filter((r: any) => !r.comparable);
    expect(nonComp.length).toBe(json.denominators.non_comparable_rows);
    for (const r of nonComp) expect(r.body_available_v2).not.toBe(r.body_available_v3);
    for (const r of rows.filter((x: any) => x.comparable)) expect(r.body_available_v2).toBe(r.body_available_v3);
    const unavail = rows.filter((r: any) => !r.body_available_v3);
    expect(unavail.length).toBe(json.bodies.unavailable);
    const shas = unavail.map((r: any) => r.sha256).sort();
    const jsonShas = json.bodies.unavailable_rows.map((r: any) => r.sha256).sort();
    expect(shas).toEqual(jsonShas);
  });

  it("A8 unresolved", () => {
    for (const u of json.unresolved) {
      const r = rows.find((x: any) => x.sha256 === u.sha256);
      expect(r.sections.length).toBe(0);
      expect(["MULTI_STAGE","UNSTAGED"]).toContain(r.stage_v3_primary);
    }
    // completeness: every qualifying row is listed
    const qualifying = rows.filter((r: any) => r.sections.length === 0 && ["MULTI_STAGE","UNSTAGED"].includes(r.stage_v3_primary));
    expect(qualifying.length).toBe(json.unresolved.length);
    for (const r of qualifying) expect(json.unresolved.some((u: any) => u.sha256 === r.sha256)).toBe(true);
  });

  it("A9 artifact integrity", () => {
    expect(json.rule_sets.v2.sha256).toBe(sha("docs/research/stage-rules/stage-rules.v2.json"));
    expect(json.rule_sets.v3.sha256).toBe(sha("docs/research/stage-rules/stage-rules.v3.json"));
    expect(json.v2_sidecar.sha256).toBe(sha("docs/research/stage-rules/classifications-v2.jsonl"));
    expect(json.manifest.sha256).toBe(sha("docs/RSA-Documents/canada-intake-manifest.jsonl"));
    expect(json.v2_sidecar.rows).toBe(33);
    expect(json.manifest.rows).toBe(33);
  });

  it("A10 frozen pins", () => {
    expect(sha("docs/research/stage-rules/stage-rules.v1.json")).toBe(V1_RULES_SHA);
    expect(sha("docs/research/stage-rules/stage-rules.v2.json")).toBe(V2_RULES_SHA);
    expect(sha("docs/research/stage-rules/classifications-v2.jsonl")).toBe(V2_SIDECAR_SHA);
    expect(sha("docs/research/stage-rules/coverage-v2-vs-v1.json")).toBe(V2_COVERAGE_JSON_SHA);
    expect(sha("docs/research/stage-rules/coverage-v2-vs-v1.md")).toBe(V2_COVERAGE_MD_SHA);
    expect(sha("docs/research/stage-rules/ambiguous-v2.md")).toBe(AMBIGUOUS_V2_SHA);
  });

  it("A11 no edits to v2", () => {
    const v2Sidecar = read("docs/research/stage-rules/classifications-v2.jsonl").trim().split("\n");
    expect(v2Sidecar.length).toBe(33);
    const v2cov = JSON.parse(read("docs/research/stage-rules/coverage-v2-vs-v1.json"));
    expect(v2cov.table_b).toBeTruthy();
    expect(v2cov.denominators.table_b_merged_rows).toBe(335);
  });

  it("A13 coverage candidate shas", () => {
    expect(json.denominators.coverage_candidate_shas).toEqual(["0af7ea584ae04908b0f650f4d12ed9cc766c748ab56ef86faa417158e0bdcb95"]);
    for (const c of json.coverage_candidates) {
      expect(c.delta_documents).toBe(c.v3_documents - c.v2_documents);
    }
  });

  it("A12 v3 pin + allowlist", () => {
    expect(sha("docs/research/stage-rules/stage-rules.v3.json")).toBe(V3_RULES_SHA);
    expect(json.rule_sets.v3.sha256).toBe(V3_RULES_SHA);
    expect(() => assertV3OutputPath("docs/research/stage-rules/coverage-v2-vs-v1.md")).toThrow();
  });
});
