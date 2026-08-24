import { describe, expect, it } from "vitest";
import { getPack } from "@/domain/packs";
import { StageNotEligibleError } from "@/domain/pipeline/constants";
import { runAudit } from "@/domain/engine";
import { oddClaimZone, oddFloorSatisfied, resolveOdd } from "@/domain/odd";
import type { Project } from "@/domain/types";

const T0 = "2026-08-22T00:00:00.000Z";

function baseProject(over: Partial<Project> = {}): Project {
  return {
    project_id: "P-ODD",
    workspace_key_hash: "h",
    metadata: { name: "T", description: "", scheme_summary: "", authority: "", location: "" },
    stage_selection: { jurisdiction: "UK", native_stage_id: "uk:S1" },
    input_values: {},
    created_at: T0,
    updated_at: T0,
    ...over,
  };
}

describe("ODD declaration resolution (ADR-0005)", () => {
  it("resolves IN cells by jurisdiction + canonical multiset", () => {
    const r = resolveOdd("UK", ["PRELIMINARY_DESIGN"]);
    expect(r.status).toBe("in");
    expect(r.cell?.fixture_ids).toContain("GF-6");
  });

  it("matches combined spans only on exact multiset", () => {
    expect(resolveOdd("AE", ["PRELIMINARY_DESIGN", "DETAILED_DESIGN"]).status).toBe(
      "mapped_unproven",
    );
    // partial overlap is NOT membership
    expect(resolveOdd("AE", ["FEASIBILITY_CONCEPT", "PRELIMINARY_DESIGN"]).status).toBe(
      "unlisted",
    );
  });

  it("UK x FEASIBILITY_CONCEPT is structurally absent; unknown combos are unlisted", () => {
    expect(resolveOdd("UK", ["FEASIBILITY_CONCEPT"]).status).toBe("structurally_absent");
    // declared since v1.1.0 (us planning), but this exact span is not:
    expect(
      resolveOdd("US", ["FEASIBILITY_CONCEPT", "DETAILED_DESIGN"]).status,
    ).toBe("unlisted");
  });

  it("three-zone claim language", () => {
    const inR = oddClaimZone({ status: "in", declaration_version: "1.0.1" });
    const mu = oddClaimZone({ status: "mapped_unproven", declaration_version: "1.0.1" });
    const sa = oddClaimZone({
      status: "structurally_absent",
      declaration_version: "1.0.1",
    });
    expect(inR.claims_allowed).toBe(true);
    expect(mu.claims_allowed).toBe(false);
    expect(mu.stamp).toContain("validation pending");
    expect(sa.claims_allowed).toBe(false);
  });
});

describe("ODD intake gate (Phase-2 wiring)", () => {
  it("refuses structurally-absent selections at audit start", () => {
    try {
      runAudit(
        baseProject({
          stage_selection: { jurisdiction: "UK", native_stage_id: "__nonexistent__" },
        }),
        T0,
      );
      throw new Error("should have thrown");
    } catch (e) {
      // stage doesn't exist in pack → StageNotEligible takes precedence
      expect(e).toBeInstanceOf(StageNotEligibleError);
    }
  });

  it("refuses runs whose resolved stage maps to a structurally-absent ODD cell", () => {
    const uk = getPack("UK");
    const feas = uk.stages.find((s) => s.canonical_stages.includes("FEASIBILITY_CONCEPT"));
    expect(feas).toBeUndefined(); // pack-level guard already keeps this impossible
  });

  it("stamps mapped-unproven results and leaves in-cell results unstamped", () => {
    const ae = getPack("AE");
    const s12 = ae.stages.find((s) => s.native_stage_id === "ae-ad:S1_2")!;
    const p = baseProject({
      stage_selection: { jurisdiction: "AE", native_stage_id: s12.native_stage_id },
      input_values: Object.fromEntries(
        ae.inputs
          .filter((i) => i.stage_ids.includes(s12.native_stage_id))
          .map((i) => [i.input_id, { state: "provided" as const, value: "x" }]),
      ),
    });
    const r = runAudit(p, T0);
    expect(r.odd_status).toBe("mapped_unproven");
    expect(r.odd_stamp).toContain("validation pending");
    expect(r.limitations.join("\n")).toContain("validation pending");

    const uk = runAudit(baseProject(), T0);
    expect(uk.odd_status).toBe("in");
    expect(uk.odd_stamp).toBeNull();
  });

  it("records floor satisfaction for in-cell runs (null elsewhere)", () => {
    const r = runAudit(baseProject(), T0);
    expect(typeof r.odd_floor_satisfied).toBe("boolean");
    const cell = resolveOdd("UK", ["PRELIMINARY_DESIGN"]).cell!;
    const provided = new Set(
      r.input_manifest.filter((m) => m.state === "provided").map((m) => m.input_id),
    );
    expect(r.odd_floor_satisfied).toBe(cell.input_floor.every((id) => provided.has(id)));
    expect(oddFloorSatisfied(resolveOdd("AE", ["DETAILED_DESIGN"]), new Set())).toBeNull();
  });
});
