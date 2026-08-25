// AG-EVIDENCE-USE-AUDIT — Evidence-Use Audit (deterministic, ADR-0010).
// Audits every visible finding-shaped population — engine deterministic
// findings always, candidate findings when present (identical rules when the
// AI adapter is OFF). Checks: every normative statement carries >= 1
// citation; producer/source_trace enforcement per contracts/schemas/
// finding.schema.json expectations; citation use-direction consistency where
// determinable — a supports_concern citation must share a salient token with
// the concern text, otherwise it is flagged 'unverifiable-relation' rather
// than failed hard. Failures annotate (auto-flagged), never drop. No model
// calls anywhere.
import { requireSlice } from "@/domain/pipeline/result";
import { makeArtifact } from "@/domain/pipeline/nodes/shared";
import { annotate, sharesSalientToken } from "@/domain/pipeline/nodes/validation-shared";
import { PRODUCERS, type NodeFn, type RuleResultsSlice } from "@/domain/pipeline/types";
import type {
  CandidateFindingRecord,
  Finding,
  SourceTrace,
} from "@/domain/types";

const ORIGINS: readonly SourceTrace["origin"][] = [
  "deterministic_rule",
  "audit_question",
  "ai_candidate",
  "auditor_manual",
];

function isCandidate(item: CandidateFindingRecord | Finding): item is CandidateFindingRecord {
  return !("source_trace" in item);
}

function auditItem(item: CandidateFindingRecord | Finding): string[] {
  const reasons: string[] = [];

  if (item.evidence.length === 0) reasons.push("missing-citation");

  if (isCandidate(item)) {
    // Boundary schema requires a producer on candidates (ADR-0006 envelope).
    if (typeof item.producer !== "string" || item.producer === "") {
      reasons.push("missing-producer");
    } else if (!(PRODUCERS as readonly string[]).includes(item.producer)) {
      reasons.push(`invalid-producer:${item.producer}`);
    }
  } else {
    if (item.source_trace.length === 0) {
      reasons.push("missing-source-trace");
    }
    for (const t of item.source_trace) {
      if (!ORIGINS.includes(t.origin)) {
        reasons.push(`invalid-source-trace-origin:${String(t.origin)}`);
      }
      if (
        typeof t.producer === "string" &&
        t.producer !== "" &&
        !(PRODUCERS as readonly string[]).includes(t.producer)
      ) {
        reasons.push(`invalid-producer:${t.producer}`);
      }
    }
  }

  for (const c of item.evidence) {
    if (c.use !== "supports_concern") continue;
    if (c.quote === null || c.quote === "" || !sharesSalientToken(c.quote, item.statement.text)) {
      reasons.push(`unverifiable-relation:${c.evidence_id}`);
    }
  }

  return reasons;
}

export const runEvidenceUseAudit: NodeFn = (state, ctx) => {
  const rules = requireSlice(
    "AG-EVIDENCE-USE-AUDIT",
    state,
    "rule_results",
  ) as RuleResultsSlice;
  const candidates = state.candidate_findings ?? null;

  let checked = 0;
  let flagged = 0;

  let annotatedCandidates: CandidateFindingRecord[] | null = null;
  let changedCandidates = false;
  if (candidates !== null) {
    checked += candidates.length;
    annotatedCandidates = candidates.map((c) => {
      const reasons = auditItem(c);
      if (reasons.length === 0) return c;
      flagged += 1;
      changedCandidates = true;
      return annotate(c, reasons);
    });
  }

  checked += rules.deterministic_findings.length;
  let changedFindings = false;
  const annotatedFindings = rules.deterministic_findings.map((f) => {
    const reasons = auditItem(f);
    if (reasons.length === 0) return f;
    flagged += 1;
    changedFindings = true;
    return annotate(f, reasons);
  });

  const patch: {
    candidate_findings?: CandidateFindingRecord[];
    rule_results?: RuleResultsSlice;
  } = {};
  if (changedCandidates) {
    patch.candidate_findings = annotatedCandidates!;
  }
  if (changedFindings) {
    patch.rule_results = { ...rules, deterministic_findings: annotatedFindings };
  }

  return {
    artifacts: [
      makeArtifact(
        "AG-EVIDENCE-USE-AUDIT",
        "domain-engine",
        "audit.evidence-use",
        1,
        ctx,
        "verified",
        { checked, flagged },
      ),
    ],
    patch,
  };
};
