// Canonical constants shared across engine and pipeline (single definition
// point; src/domain/engine.ts re-exports for API compatibility).
import type { JurisdictionId } from "@/domain/types";

export const DISCLAIMER =
  "This software assists the Road Safety Audit process. It does not replace professional judgment: final responsibility remains with the qualified auditor and the road authority. Compliance-oriented outputs never imply that a scheme is 'safe'.";

export class StageNotEligibleError extends Error {
  constructor(
    public readonly jurisdiction: JurisdictionId,
    public readonly native_stage_id: string,
    reason: string,
    public readonly evidence_ids: string[],
  ) {
    super(reason);
  }
}

/** Selection falls outside the declared ODD matrix (ADR-0005; default-refuse). */
export class OddOutsideDomainError extends Error {
  constructor(
    public readonly jurisdiction: JurisdictionId,
    public readonly native_stage_id: string,
    public readonly odd_status: "structurally_absent" | "unlisted",
    reason: string,
  ) {
    super(reason);
  }
}

export type CapabilityRefusalReason = "outside_odd" | "below_floor";

export class CapabilityClaimNotIssuableError extends Error {
  constructor(public readonly reason: CapabilityRefusalReason) {
    super(
      reason === "outside_odd"
        ? 'cannot issue: capability status is not "in" — this audit is outside the declared ODD (validation pending)'
        : "cannot issue: input floor not satisfied — this audit is outside the cell's claim",
    );
  }
}
