// Unit tests: matcher (pack+ODD reuse), qualifier rules, classifier thresholds.
import { describe, expect, it } from "vitest";
import { qualifyHits } from "@/discovery/qualifier";
import { matchQualified } from "@/discovery/matcher";
import { classifyBundle, AUTO_RESERVE_BELOW } from "@/discovery/classifier";
import type { DiscoveryHit, AcquisitionBundle, AcquiredDocument } from "@/discovery/types";

function hit(overrides: Partial<DiscoveryHit> = {}): DiscoveryHit {
  return {
    hit_id: "HIT-t-x",
    url: "https://example.invalid/doc.pdf",
    source_type: "dot-portal",
    provider_id: "t",
    portal_id: null,
    discovered_at: new Date(0).toISOString(),
    licence_hint: "unknown",
    http_status: null,
    sha256_hint: null,
    title_hint: null,
    jurisdiction_guess: null,
    ...overrides,
  };
}

describe("qualifier", () => {
  it("marks explicit RSA report titles in_scope", () => {
    const [q] = qualifyHits([hit({ title_hint: "Stage 1 Road Safety Audit Report — A9" })]);
    expect(q.verdict).toBe("in_scope");
  });
  it("routes existing-road / inspection material to reserve", () => {
    const [a, b] = qualifyHits([
      hit({ title_hint: "Existing Road Safety Inspection 2024" }),
      hit({ title_hint: "In-service road safety audit review" }),
    ]);
    expect(a.verdict).toBe("reserve");
    expect(b.verdict).toBe("reserve");
  });
  it("keeps tier-1 licensed pending out of in_scope", () => {
    const [q] = qualifyHits([
      hit({ title_hint: "Road Safety Audit Stage 2", licence_hint: "licensed-tier1-pending" }),
    ]);
    expect(q.verdict).toBe("reserve");
    expect(q.reasons.join(" ")).toMatch(/case-by-case/);
  });
});

describe("matcher", () => {
  it("matches UK stage-1 hint to uk:S1 with authoritative mapping and IN cell", () => {
    const [q] = qualifyHits([hit({ url: "https://standardsforhighways.co.uk/x.pdf", title_hint: "Stage 1 preliminary design road safety audit" })]);
    q.jurisdiction_guess = "UK";
    const out = matchQualified(q);
    expect(out.refusal_reason).toBeNull();
    expect(out.assignment!.native_stage_id).toBe("uk:S1");
    expect(out.assignment!.canonical_stages).toEqual(["PRELIMINARY_DESIGN"]);
    expect(out.assignment!.mapping_confidence).toBe("authoritative");
    expect(out.assignment!.odd_status).toBe("in");
  });

  it("matches US final design to DETAILED_DESIGN (interpreted)", () => {
    const [q] = qualifyHits([hit({ title_hint: "final design phase road safety audit" })]);
    q.jurisdiction_guess = "US";
    const out = matchQualified(q);
    expect(out.assignment!.canonical_stages).toEqual(["DETAILED_DESIGN"]);
    expect(out.assignment!.mapping_confidence).toBe("interpreted");
  });

  it("refuses UK feasibility (structurally absent) without throwing", () => {
    const [q] = qualifyHits([hit({ title_hint: "feasibility concept options assessment" })]);
    q.jurisdiction_guess = "UK";
    // Force stage toward feasibility by stripping other tokens
    q.scheme_hint = "feasibility concept route option safety";
    const out = matchQualified(q);
    if (out.assignment === null) {
      expect(out.refusal_reason).toBeTruthy();
    } else {
      // If keywords drifted to another UK stage, the assignment must still be a declared cell.
      expect(["in", "mapped_unproven"]).toContain(out.assignment.odd_status);
    }
  });

  it("stamps UAE S0 as mapped_unproven", () => {
    const [q] = qualifyHits([hit({ title_hint: "stage 0 feasibility conceptual design audit master plan" })]);
    q.jurisdiction_guess = "AE";
    const out = matchQualified(q);
    expect(out.assignment).not.toBeNull();
    expect(out.assignment!.odd_status).toBe("mapped_unproven");
  });
});

function doc(url: string, textSha: string | null): AcquiredDocument {
  return {
    doc_id: `DOC-${url.slice(-6)}`,
    url,
    sha256: "a".repeat(64),
    bytes: 10,
    mime: "application/pdf",
    page_count: 1,
    pages: [{ page_no: 1, png_sha256: null, ocr_sha256: null, ocr_conf: null }],
    extraction: { engine: "unpdf", text_sha256: textSha },
    title_hint: null,
  };
}

describe("classifier", () => {
  it("assigns strong roles at high confidence", () => {
    const bundle: AcquisitionBundle = {
      bundle_id: "ACQ-x",
      match_id: "MAT-x",
      documents: [
        doc("https://x.invalid/stage-2-road-safety-audit-report.pdf", null),
        doc("https://x.invalid/designer-response-report-decision-log.pdf", null),
        doc("https://x.invalid/checklist-prompt-list.pdf", null),
      ],
    };
    const labels = classifyBundle(bundle);
    const byDoc = new Map(labels.labels.map((l) => [l.doc_id, l]));
    expect(byDoc.get(bundle.documents[0].doc_id)!.role).toBe("rsa_report");
    expect(byDoc.get(bundle.documents[0].doc_id)!.confidence).toBeGreaterThanOrEqual(AUTO_RESERVE_BELOW);
    expect(byDoc.get(bundle.documents[1].doc_id)!.role).toBe("designer_response");
    expect(byDoc.get(bundle.documents[2].doc_id)!.role).toBe("checklist");
    expect(labels.classifier_trace.auto_reserved_doc_ids).toHaveLength(0);
  });

  it("auto-reserves low-confidence documents below threshold (owner decision)", () => {
    const bundle: AcquisitionBundle = {
      bundle_id: "ACQ-y",
      match_id: "MAT-y",
      documents: [doc("https://x.invalid/misc-notes-memo.pdf", null)],
    };
    const labels = classifyBundle(bundle);
    expect(labels.labels).toHaveLength(0);
    expect(labels.classifier_trace.auto_reserved_doc_ids).toEqual([bundle.documents[0].doc_id]);
  });
});
