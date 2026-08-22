// AI seam (ADR-0001): provider-agnostic, OFF by default. Adapters may emit only
// bounded candidate artifacts; nothing here can produce final determinations.
import type { AuditResult, Finding } from "@/domain/types";

export type CandidateFinding = Pick<
  Finding,
  | "kind"
  | "category"
  | "location"
  | "road_users"
  | "scenario"
  | "statement"
  | "evidence"
  | "assumptions"
  | "rationale"
  | "recommendation"
> & { producer: string };

export interface AiAdapter {
  readonly enabled: boolean;
  /** Generate bounded candidate findings for human adjudication. */
  generateCandidates(audit: AuditResult): Promise<CandidateFinding[]>;
}

export class OffAiAdapter implements AiAdapter {
  readonly enabled = false;
  async generateCandidates(): Promise<CandidateFinding[]> {
    return [];
  }
}

export function getAiAdapter(): AiAdapter {
  // Only 'off' ships in MVP; future adapters register behind this seam.
  return new OffAiAdapter();
}
