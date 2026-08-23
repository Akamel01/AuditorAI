// ADR-0002 pairing invariant helper: canonical-stage display text always
// derives through stageDisplay with the native label and confidence required.
import { describe, expect, it } from "vitest";
import { stageDisplay } from "@/app/_components/stage-label";

describe("stageDisplay", () => {
  const cases: {
    name: string;
    canonicalStages: string[] | undefined;
    expectedCanonicalText: string;
  }[] = [
    { name: "single canonical stage joins alone", canonicalStages: ["DETAILED_DESIGN"], expectedCanonicalText: "DETAILED_DESIGN" },
    { name: "multiple canonical stages join with ' + '", canonicalStages: ["FEASIBILITY_CONCEPT", "PRELIMINARY_DESIGN"], expectedCanonicalText: "FEASIBILITY_CONCEPT + PRELIMINARY_DESIGN" },
    { name: "empty mapping renders an em dash", canonicalStages: [], expectedCanonicalText: "—" },
    { name: "absent mapping renders an em dash", canonicalStages: undefined, expectedCanonicalText: "—" },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const t = stageDisplay({
        nativeLabel: "Stage 2 (completion of detailed design)",
        canonicalStages: c.canonicalStages,
        confidence: "authoritative",
      });
      expect(t).toEqual({
        nativeLabel: "Stage 2 (completion of detailed design)",
        canonicalText: c.expectedCanonicalText,
        confidence: "authoritative",
      });
    });
  }

  it("carries labels verbatim (no normalization at the seam)", () => {
    const t = stageDisplay({ nativeLabel: "Preliminary design", canonicalStages: ["X"], confidence: "inferred" });
    expect(t.nativeLabel).toBe("Preliminary design");
    expect(t.confidence).toBe("inferred");
  });
});
