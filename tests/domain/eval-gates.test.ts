// E1 gate mathematics: pure decision logic over judge verdicts.
import { describe, expect, it } from "vitest";
import {
  THRESHOLDS,
  detectRegression,
  isScoredVerdict,
  passesFindingGate,
  projectMeanScore,
  projectPassRate,
  projectPassesCorpusMark,
  type FindingVerdict,
} from "@/lib/eval-gates";

function verdict(over: Partial<Record<string, number>> = {}): FindingVerdict {
  const scores = {
    substance: 2,
    evidence_grounding: 2,
    jurisdiction_correctness: 2,
    recommendation_quality: 2,
    vru_coverage: 2,
    ...over,
  } as FindingVerdict["scores"];
  return {
    finding_id: "F-X",
    scores,
    justifications: Object.fromEntries(
      Object.keys(scores).map((k) => [k, `justification for ${k}`]),
    ) as FindingVerdict["justifications"],
  };
}

describe("E1 finding gate", () => {
  it("passes only when all dims >=1 AND substance=2 AND evidence=2", () => {
    expect(passesFindingGate(verdict())).toBe(true);
    expect(passesFindingGate(verdict({ vru_coverage: 1 }))).toBe(true);
    expect(passesFindingGate(verdict({ substance: 1 }))).toBe(false); // substance must be 2
    expect(passesFindingGate(verdict({ evidence_grounding: 1 }))).toBe(false);
    expect(passesFindingGate(verdict({ vru_coverage: 0 }))).toBe(false); // all dims >= 1
  });

  it("rejects malformed verdicts", () => {
    expect(isScoredVerdict({ finding_id: "x" })).toBe(false);
    expect(
      isScoredVerdict({
        finding_id: "x",
        scores: { substance: 2, evidence_grounding: 2, jurisdiction_correctness: 2, recommendation_quality: 2, vru_coverage: 9 },
        justifications: { substance: "j", evidence_grounding: "j", jurisdiction_correctness: "j", recommendation_quality: "j", vru_coverage: "" },
      }),
    ).toBe(false); // score out of range / empty justification
    expect(isScoredVerdict(verdict())).toBe(true);
  });
});

describe("E1 corpus gates", () => {
  it("90% corpus pass mark with the documented boundary behavior", () => {
    const ten = Array.from({ length: 10 }, (_, i) =>
      i === 0 ? verdict({ substance: 1 }) : verdict(),
    );
    expect(projectPassRate(ten)).toBe(0.9);
    expect(projectPassesCorpusMark(ten)).toBe(true); // exactly at the mark passes

    const eleven = [...ten, verdict({ evidence_grounding: 0 })];
    expect(Math.round(projectPassRate(eleven) * 1000) / 1000).toBeLessThan(THRESHOLDS.corpusPassMark);
    expect(projectPassesCorpusMark(eleven)).toBe(false);
  });

  it("zero-drop regression flags ANY decline vs prior run", () => {
    expect(detectRegression(12.5, null)).toEqual({ regression: false, delta: 0 });
    expect(detectRegression(12.5, 12.5).regression).toBe(false);
    expect(detectRegression(12.4, 12.5)).toEqual({ regression: true, delta: -0.1 });
    expect(detectRegression(12.6, 12.5).regression).toBe(false); // improvement
  });

  it("mean score averages dimension totals across findings", () => {
    const two = [verdict(), verdict({ recommendation_quality: 0, vru_coverage: 0 })];
    // totals: 10 and 6 → mean 8
    expect(projectMeanScore(two)).toBe(8);
  });
});
