// AG-EVIDENCE-LINKS — Evidence Linkset Validation (deterministic, hard gate).
// Unions every evidence_id recorded across slices so far; each must resolve in
// the compiled registry. An unresolved id is a loud failure, never a warning.
import { tryGetEvidence } from "@/lib/evidence";
import { makeArtifact } from "@/domain/pipeline/nodes/shared";
import type { NodeFn } from "@/domain/pipeline/types";

export const runEvidenceLinks: NodeFn = (state, ctx) => {
  const ids = new Set<string>();
  for (const m of state.input_manifest ?? []) {
    for (const id of m.evidence_ids) ids.add(id);
  }
  const rules = state.rule_results;
  if (rules) {
    for (const mi of rules.missing_information) {
      for (const id of mi.evidence_ids) ids.add(id);
    }
    for (const f of rules.deterministic_findings) {
      for (const e of f.evidence) ids.add(e.evidence_id);
    }
  }
  for (const c of state.candidate_findings ?? []) {
    for (const e of c.evidence) ids.add(e.evidence_id);
  }
  if (state.adjudication) {
    for (const f of state.adjudication.final_findings) {
      for (const e of f.evidence) ids.add(e.evidence_id);
    }
  }

  const unresolved = [...ids].filter((id) => tryGetEvidence(id) === null);
  if (unresolved.length > 0) {
    throw new Error(
      `AG-EVIDENCE-LINKS: evidence ids not resolvable in state/evidence-registry.json: ${unresolved.sort().join(", ")}`,
    );
  }

  const slice = {
    evidence_ids: [...ids].sort(),
    registry: "state/evidence-registry.json",
  };
  return {
    artifacts: [
      makeArtifact("AG-EVIDENCE-LINKS", "domain-engine", "evidence.linkset", 1, ctx, "verified", slice),
    ],
    patch: { evidence_linkset: slice },
  };
};
