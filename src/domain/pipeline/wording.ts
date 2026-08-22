// Recommendation wording discipline (ADR-0003, canonical across packs).
const BANNED_WORDS = ["consider", "must"];

export function validateRecommendationWording(text: string): {
  ok: boolean;
  violations: string[];
} {
  const lower = text.toLowerCase();
  const violations = BANNED_WORDS.filter((w) =>
    new RegExp(`\\b${w}\\b`).test(lower),
  );
  return { ok: violations.length === 0, violations };
}
