// E1 eval-gate mathematics: pure, unit-tested decision logic for the E4
// harness. Thresholds are the owner-set values from the R7/E1 checkpoint
// (2026-08-22): all dimensions >=1 AND substance=2 AND evidence-grounding=2
// per finding; >=90% of sampled findings pass per project; zero-drop
// regression tolerance vs prior archived run.

export const DIMENSIONS = [
  "substance",
  "evidence_grounding",
  "jurisdiction_correctness",
  "recommendation_quality",
  "vru_coverage",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export const THRESHOLDS = {
  perDimensionMinimum: 1,
  substanceRequired: 2,
  evidenceGroundingRequired: 2,
  corpusPassMark: 0.9,
  regressionTolerance: 0, // zero-drop
} as const;

export interface FindingVerdict {
  finding_id: string;
  scores: Record<Dimension, number>;
  justifications: Record<Dimension, string>;
}

export function isScoredVerdict(v: unknown): v is FindingVerdict {
  if (typeof v !== "object" || v === null) return false;
  const cand = v as Partial<FindingVerdict>;
  if (typeof cand.finding_id !== "string") return false;
  if (typeof cand.scores !== "object" || cand.scores === null) return false;
  if (typeof cand.justifications !== "object" || cand.justifications === null) return false;
  return DIMENSIONS.every((d) => {
    const s = (cand.scores as Record<string, unknown>)[d];
    const j = (cand.justifications as Record<string, unknown>)[d];
    return typeof s === "number" && s >= 0 && s <= 2 && typeof j === "string" && j.length > 0;
  });
}

/** E1 pass gate for one finding. */
export function passesFindingGate(verdict: FindingVerdict): boolean {
  return (
    DIMENSIONS.every((d) => verdict.scores[d] >= THRESHOLDS.perDimensionMinimum) &&
    verdict.scores.substance >= THRESHOLDS.substanceRequired &&
    verdict.scores.evidence_grounding >= THRESHOLDS.evidenceGroundingRequired
  );
}

/** Mean of dimension totals across findings — the regression-tracking number. */
export function projectMeanScore(verdicts: FindingVerdict[]): number {
  if (verdicts.length === 0) return 0;
  const total = verdicts.reduce(
    (sum, v) => sum + DIMENSIONS.reduce((s, d) => s + v.scores[d], 0),
    0,
  );
  return total / verdicts.length;
}

export function projectPassRate(verdicts: FindingVerdict[]): number {
  if (verdicts.length === 0) return 1; // nothing sampled cannot fail its gate
  return verdicts.filter(passesFindingGate).length / verdicts.length;
}

export function projectPassesCorpusMark(verdicts: FindingVerdict[]): boolean {
  return projectPassRate(verdicts) >= THRESHOLDS.corpusPassMark;
}

/** Zero-drop tolerance: ANY mean decline vs prior run flags Tier-2 review. */
export function detectRegression(
  currentMean: number,
  priorMean: number | null,
): { regression: boolean; delta: number } {
  if (priorMean === null) return { regression: false, delta: 0 };
  const delta = round3(currentMean - priorMean);
  return { regression: delta < -THRESHOLDS.regressionTolerance, delta };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
