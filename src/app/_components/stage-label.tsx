// ADR-0002 pairing invariant (architecture overview §4.1): canonical stages
// are never presented without the Native Stage label and mapping confidence.
// Every stage-mapping surface derives its display fields through this module —
// nativeLabel and confidence are required inputs wherever canonical stages
// render, and the "—"-fallback join lives in exactly one place.
export interface StagePairing {
  nativeLabel: string;
  canonicalStages?: readonly string[];
  confidence: string;
}

export interface StageDisplayTriple {
  nativeLabel: string;
  /** canonical_stages joined for display, or an em dash when unmapped. */
  canonicalText: string;
  confidence: string;
}

export function stageDisplay(pairing: StagePairing): StageDisplayTriple {
  return {
    nativeLabel: pairing.nativeLabel,
    canonicalText: pairing.canonicalStages?.join(" + ") || "—",
    confidence: pairing.confidence,
  };
}
