// Shared deterministic helpers for the ADR-0010 validation nodes. No model
// calls, no thresholds: pure string/set logic over registry + pack data.
import type { ValidationAnnotation } from "@/domain/types";

/** Standard whitespace normalization: collapse runs, trim ends. */
export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Salient tokens: lowercase alphanumeric runs of >= 4 characters — long
 *  enough to carry content words, short enough to keep domain terms like
 *  "lane" and "sign" adjacent forms comparable via shared longer tokens. */
export function salientTokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (m.length >= 4) out.add(m);
  }
  return out;
}

/** True when quote and statement share at least one salient token. */
export function sharesSalientToken(a: string, b: string): boolean {
  const ta = salientTokens(a);
  for (const t of salientTokens(b)) {
    if (ta.has(t)) return true;
  }
  return false;
}

/** Flag-and-show: copy the item with an auto-flagged annotation appended.
 *  The original item is never mutated and never dropped (ADR-0010). */
export function annotate<T>(item: T, reasons: string[]): T {
  const validation: ValidationAnnotation = { status: "auto-flagged", reasons };
  return { ...item, validation };
}
