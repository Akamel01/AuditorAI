// Coverage scorer + dedupe index unit tests.
import { describe, expect, it } from "vitest";
import { computeCoverage, buildQueue, TARGET_TOTAL, type PackagedMatch } from "@/discovery/coverage";
import { checkDuplicate, claimFingerprints, emptyDedupeIndex } from "@/discovery/dedupe";
import type {
  AcquisitionBundle,
  MatchAssignment,
  ProjectPackageAssembly,
} from "@/discovery/types";

function pkg(id: string, completeness: ProjectPackageAssembly["completeness"]): ProjectPackageAssembly {
  return {
    package_id: id,
    match_id: `MAT-${id}`,
    metadata: { title: id, scheme_summary: null, authority_hint: null, location_hint: null, source_urls: ["https://x.invalid/a.pdf"] },
    inputs: { drawing_doc_ids: [], other_doc_ids: [] },
    outputs: { rsa_report_doc_ids: [], checklist_doc_ids: [], designer_response_doc_ids: [] },
    completeness,
  };
}

function match(jur: MatchAssignment["jurisdiction"], stages: MatchAssignment["canonical_stages"]): MatchAssignment {
  return {
    match_id: "MAT-x",
    qualification_id: "QAL-x",
    jurisdiction: jur,
    native_stage_id: null,
    canonical_stages: stages,
    mapping_confidence: "authoritative",
    odd_status: "in",
    matched_by: "test",
  };
}

const ZERO = new Date(0).toISOString();

describe("coverage scorer", () => {
  it("excludes structurally_absent and weights mapped_unproven 3x over IN", () => {
    const view = computeCoverage([], ZERO);
    const absent = view.cells.find((c) => c.status === "structurally_absent")!;
    expect(absent.target).toBe(0);
    expect(absent.label).toBe("EXCLUDED");

    const inCell = view.cells.find((c) => c.cell_key === "uk:PRELIMINARY_DESIGN")!;
    const unproven = view.cells.find((c) => c.cell_key === "uae:FEASIBILITY_CONCEPT")!;
    // uk S1 is IN with 2 fixtures (weight 1); UAE S0 mapped_unproven (weight 3)
    expect(unproven.target).toBeGreaterThan(inCell.target);
    expect(view.cells.reduce((s, c) => s + c.target, 0)).toBeLessThanOrEqual(TARGET_TOTAL);
  });

  it("gives fragile single-fixture IN cell a risk bonus", () => {
    const view = computeCoverage([], ZERO);
    const usaDetailed = view.cells.find((c) => c.cell_key === "usa:DETAILED_DESIGN")!;
    const usaPrelim = view.cells.find((c) => c.cell_key === "usa:PRELIMINARY_DESIGN")!;
    // usa DETAILED has one fixture GF-8 => bonus weight; usa PRELIM has three fixtures.
    expect(usaDetailed.priority).toBeGreaterThanOrEqual(usaPrelim.priority);
    expect(usaDetailed.target).toBeGreaterThan(usaPrelim.target * 0.5);
  });

  it("labels MISSING/UNDER-COVERED/COVERED correctly as packages accumulate", () => {
    const base = match("UK", ["PRELIMINARY_DESIGN"]);
    const one: PackagedMatch[] = [{ pkg: pkg("PKG-a", "outputs-only"), match: base }];
    const v1 = computeCoverage(one, ZERO);
    expect(v1.cells.find((c) => c.cell_key === "uk:PRELIMINARY_DESIGN")!.label).toBe("UNDER-COVERED");

    const target = v1.cells.find((c) => c.cell_key === "uk:PRELIMINARY_DESIGN")!.target;
    const exact: PackagedMatch[] = Array.from({ length: target }, (_, i) => ({
      pkg: pkg(`PKG-${i}`, "full-package"),
      match: base,
    }));
    const v2 = computeCoverage(exact, ZERO);
    expect(v2.cells.find((c) => c.cell_key === "uk:PRELIMINARY_DESIGN")!.label).toBe("COVERED");

    const flooded: PackagedMatch[] = Array.from({ length: target * 2 }, (_, i) => ({
      pkg: pkg(`PKG-f${i}`, "full-package"),
      match: base,
    }));
    const v3 = computeCoverage(flooded, ZERO);
    expect(v3.cells.find((c) => c.cell_key === "uk:PRELIMINARY_DESIGN")!.label).toBe("OVER-REPRESENTED");
  });

  it("counts only declared cells; foreign canonical combos are ignored", () => {
    const foreign: PackagedMatch[] = [
      { pkg: pkg("PKG-f", "full-package"), match: match("AE", ["PRELIMINARY_DESIGN", "FEASIBILITY_CONCEPT"]) },
    ];
    // AE combined S1_2 spans [PRELIMINARY_DESIGN, DETAILED_DESIGN]; the combo above is undeclared.
    const view = computeCoverage(foreign, ZERO);
    for (const c of view.cells) expect(c.have_total).toBe(0);
  });

  it("queue ranks by priority desc and cites reasons", () => {
    const view = computeCoverage([], ZERO);
    const q = buildQueue(view, 5);
    expect(q.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < q.length; i++) {
      const a = view.cells.find((c) => c.cell_key === q[i - 1].cell_key)!;
      const b = view.cells.find((c) => c.cell_key === q[i].cell_key)!;
      expect(a.priority).toBeGreaterThanOrEqual(b.priority);
    }
    expect(q.every((item) => item.reason.length > 0)).toBe(true);
  });
});

describe("dedupe", () => {
  const bundleOf = (pkgId: string, sha: string, textKey: string | null): AcquisitionBundle => ({
    bundle_id: `ACQ-${pkgId}`,
    match_id: `MAT-${pkgId}`,
    documents: [
      {
        doc_id: `DOC-${pkgId}`,
        url: `https://x.invalid/${pkgId}.pdf`,
        sha256: sha,
        bytes: 1,
        mime: "application/pdf",
        page_count: 1,
        pages: [{ page_no: 1, png_sha256: null, ocr_sha256: null, ocr_conf: null }],
        extraction: { engine: "unpdf", text_sha256: textKey },
        title_hint: null,
      },
    ],
  });

  it("detects exact duplicate via doc sha256 and names canonical", () => {
    const idx = emptyDedupeIndex();
    const a = pkg("PKG-a", "full-package");
    const b = pkg("PKG-b", "outputs-only");
    claimFingerprints(a, bundleOf(a.package_id, "f".repeat(64), null), idx);
    const verdict = checkDuplicate(b, bundleOf(b.package_id, "f".repeat(64), null), idx);
    expect(verdict.status).toBe("duplicate");
    expect(verdict.canonical_package_id).toBe("PKG-a");
  });

  it("detects near duplicate via normalized-text hash when bytes differ", () => {
    const idx = emptyDedupeIndex();
    const a = pkg("PKG-a", "full-package");
    const b = pkg("PKG-b", "outputs-only");
    claimFingerprints(a, bundleOf(a.package_id, "1".repeat(64), "t1"), idx);
    const verdict = checkDuplicate(b, bundleOf(b.package_id, "2".repeat(64), "t1"), idx);
    expect(verdict.status).toBe("near_dup");
    expect(verdict.canonical_package_id).toBe("PKG-a");
  });

  it("unique content passes and claims fingerprints", () => {
    const idx = emptyDedupeIndex();
    const a = pkg("PKG-a", "full-package");
    const verdict = checkDuplicate(a, bundleOf(a.package_id, "9".repeat(64), "t9"), idx);
    expect(verdict.status).toBe("unique");
    claimFingerprints(a, bundleOf(a.package_id, "9".repeat(64), "t9"), idx);
    expect(idx.sha256["9".repeat(64)]).toBe("PKG-a");
    expect(idx.text_hash.t9).toBe("PKG-a");
    expect(idx.clusters[0].members).toEqual(["PKG-a"]);
  });
});
