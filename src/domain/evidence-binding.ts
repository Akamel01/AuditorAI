// G-11: the evidence-binding rule, as a pure domain rule (no HTTP, no
// persistence). It answers one question: does this draft's report content
// bind to evidence that resolves?
// Scope: result.findings ONLY. Pending candidates are never examined — they
// are not report members (ADR-0006) and are judged at promotion time.
// The evidence lookup reuses the same seam the pipeline node uses
// (src/domain/pipeline/nodes/hallucination-check.ts), so the rule and the
// in-flight check can never disagree about what resolves.
import { tryGetEvidence } from "@/lib/evidence";
import type { AuditResult } from "@/domain/types";

export interface EvidenceBindingViolation {
  finding_id: string;
  kind: "unresolved-evidence-id" | "auto-flagged-hallucination";
  detail: string;
}

/** One violation per finding per kind, in findings order (deterministic).
 *  - unresolved-evidence-id: a cited evidence_id that does not resolve in the
 *    compiled registry; detail is the offending evidence_id.
 *  - auto-flagged-hallucination: the finding carries an ADR-0010
 *    validation annotation (a flag is never removed); detail is the
 *    annotation's reasons joined. */
export function evaluateEvidenceBinding(result: AuditResult): EvidenceBindingViolation[] {
  const violations: EvidenceBindingViolation[] = [];
  for (const finding of result.findings) {
    const unresolved = finding.evidence.find((e) => !tryGetEvidence(e.evidence_id));
    if (unresolved) {
      violations.push({
        finding_id: finding.finding_id,
        kind: "unresolved-evidence-id",
        detail: unresolved.evidence_id,
      });
    }
    const annotation = finding.validation;
    if (annotation && annotation.status === "auto-flagged") {
      violations.push({
        finding_id: finding.finding_id,
        kind: "auto-flagged-hallucination",
        detail: annotation.reasons.join(","),
      });
    }
  }
  return violations;
}
