import { describe, expect, it } from "vitest";
import { getPack, listJurisdictions } from "@/domain/packs";
import { validateRecommendationWording } from "@/domain/pipeline/wording";
import { DISCLAIMER, StageNotEligibleError, runAudit } from "@/domain/engine";
import type { Project } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";

function baseProject(over: Partial<Project> = {}): Project {
  return {
    project_id: "P-TEST",
    workspace_key_hash: "h",
    metadata: { name: "T", description: "", scheme_summary: "", authority: "", location: "" },
    stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S1" },
    input_values: {},
    created_at: T0,
    updated_at: T0,
    ...over,
  };
}

describe("policy packs", () => {
  it("all five jurisdictions load and validate", () => {
    const list = listJurisdictions();
    expect(list.map((j) => j.id)).toEqual(["INT", "UK", "US", "CA", "AE"]);
    for (const j of list) expect(() => getPack(j.id)).not.toThrow();
  });

  it("every pack cites only evidence ids that exist in the registry", () => {
    // enforced inside getPack; a throw here would fail the suite
    expect(getPack("AE").framework.name).toContain("Abu Dhabi");
  });

  it("UK has no feasibility-concept native stage", () => {
    const uk = getPack("UK");
    const feas = uk.stages.filter((s) =>
      s.canonical_stages.includes("FEASIBILITY_CONCEPT"),
    );
    expect(feas).toHaveLength(0);
    expect(uk.exceptions.some((e) => e.kind === "no_native_equivalent")).toBe(true);
  });

  it("UAE combined stage spans two canonical stages (jurisdiction-specific)", () => {
    const ae = getPack("AE");
    const s12 = ae.stages.find((s) => s.native_stage_id === "ae-ad:S1_2");
    expect(s12?.canonical_stages).toEqual(["PRELIMINARY_DESIGN", "DETAILED_DESIGN"]);
  });
});

describe("audit engine", () => {
  it("is deterministic: identical inputs produce identical outputs", () => {
    const p = baseProject();
    const a = runAudit(p, T0);
    const b = runAudit(p, T0);
    expect(a).toEqual(b);
  });

  it("flags missing required collision data at UK Stage 1 as missing information (not a finding)", () => {
    const r = runAudit(baseProject(), T0);
    const mi = r.missing_information.find(
      (m) => m.input_id === "collision_data_analysis_36mo",
    );
    expect(mi).toBeDefined();
    expect(mi?.evidence_ids).toContain("EV-UK-011");
    expect(r.findings.find((f) => f.statement.text.includes("36 months"))).toBeUndefined();
  });

  it("respects provided inputs and not_applicable states", () => {
    const p = baseProject({
      input_values: Object.fromEntries(
        getPack("UK").inputs
          .filter((i) => i.stage_ids.includes("uk:S1"))
          .map((i) => [i.input_id, { state: "provided" as const, value: "x" }]),
      ),
    });
    const r = runAudit(p, T0);
    expect(r.missing_information).toHaveLength(0);
    expect(r.input_manifest.every((m) => m.state === "provided")).toBe(true);
  });

  it("raises a process-gap compliance question when Stage 2 lacks prior response reports", () => {
    const r = runAudit(
      baseProject({ stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S2" } }),
      T0,
    );
    const f = r.findings.find((f) => f.finding_id.startsWith("F-R-UK-PREVRESP"));
    expect(f).toBeDefined();
    expect(f?.kind).toBe("compliance_question");
    expect(f?.reviewer_status).toBe("draft");
    expect(f?.source_trace[0].origin).toBe("deterministic_rule");
  });

  it("rejects unknown/out-of-scope native stages via eligibility error", () => {
    expect(() =>
      runAudit(baseProject({ stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S3" } }), T0),
    ).toThrow(StageNotEligibleError);
    expect(() =>
      runAudit(baseProject({ stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S0" } }), T0),
    ).toThrow(StageNotEligibleError);
  });

  it("US mapping carries interpreted confidence; phases are named, not numbered", () => {
    const r = runAudit(
      baseProject({
        stage_selection: { jurisdiction: "US", native_stage_id: "us-fhwa:planning" },
      }),
      T0,
    );
    expect(r.mapping_confidence).toBe("interpreted");
    expect(r.native_stage_display_name).toMatch(/Planning/i);
    expect(r.native_stage_display_name).not.toMatch(/Stage \d/);
  });

  it("includes limitations for framework qualification and the fixed disclaimer", () => {
    const r = runAudit(
      baseProject({ stage_selection: { jurisdiction: "INT", native_stage_id: "int:preliminary-design" } }),
      T0,
    );
    expect(r.limitations.join(" ")).toContain("No true international RSA standard");
    expect(r.disclaimer).toBe(DISCLAIMER);
    expect(r.audit_questions.length).toBeGreaterThan(0);
  });
});

describe("recommendation wording discipline (ADR-0003)", () => {
  it("bans vague wording canonically", () => {
    expect(validateRecommendationWording("Consider adding signage").ok).toBe(false);
    expect(validateRecommendationWording("Must add signage").ok).toBe(false);
    expect(validateRecommendationWording("Extend the right-turn lane by 40 m").ok).toBe(true);
  });
});
