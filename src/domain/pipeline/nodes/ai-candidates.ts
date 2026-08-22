// AG-AI-CANDIDATES — AI Candidate Generation (ai-bounded). OFF by default:
// zero provider calls, slice explicitly null. The adapter seam is consulted
// here (this is the contact point A1's live driver replaces/extends); sync
// batch execution requires the off-adapter, so an enabled adapter in the sync
// pipeline is refused loudly rather than silently skipped.
import { getAiAdapter } from "@/lib/ai";
import { makeArtifact } from "@/domain/pipeline/nodes/shared";
import type { CandidatesSlice, NodeFn } from "@/domain/pipeline/types";

export const runAiCandidates: NodeFn = (state, ctx) => {
  const adapter = ctx.aiAdapter ?? getAiAdapter();

  if (!adapter.enabled) {
    // OFF default: zero behavior change vs the legacy engine.
    return { artifacts: [], patch: { candidate_findings: null } };
  }
  if (!ctx.allowLiveInference) {
    throw new Error(
      "AG-AI-CANDIDATES: live inference requires the async driver (A1); OffAiAdapter is the only sync-safe adapter",
    );
  }

  // Unreachable in N2; kept as the seam shape A1's driver calls into.
  const candidates: CandidatesSlice = [];
  return {
    artifacts: [
      makeArtifact(
        "AG-AI-CANDIDATES",
        "safety-reasoning-agent",
        "candidates.ai",
        1,
        ctx,
        "draft",
        candidates,
      ),
    ],
    patch: { candidate_findings: candidates },
  };
};
