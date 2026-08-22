// AG-AI-CANDIDATES — AI Candidate Generation (ai-bounded). OFF by default:
// zero provider calls, slice explicitly null. Uniform refusal: an adapter that
// cannot run in this context (disabled, or enabled but sync-only) yields zero
// candidates plus a degraded status artifact; the deterministic path is
// unaffected. Live inference flows through pipeline.runAllLive →
// generateCandidatesLive.
import { getAiAdapter, type AiAdapter } from "@/lib/ai";
import { assembleAuditResult, makeArtifact } from "@/domain/pipeline/nodes/shared";
import type {
  CandidatesSlice,
  NodeFn,
  NodeResult,
  NodeRunCtx,
  SharedState,
} from "@/domain/pipeline/types";

export const runAiCandidates: NodeFn = (_state, ctx) => {
  const adapter = ctx.aiAdapter ?? getAiAdapter();

  if (!adapter.enabled) {
    // OFF default: zero behavior change vs the legacy engine.
    return { artifacts: [], patch: { candidate_findings: null } };
  }
  if (!ctx.allowLiveInference) {
    // Enabled but not drivable here: refuse uniformly, deterministic path unaffected.
    return {
      artifacts: [
        makeArtifact(
          "AG-AI-CANDIDATES",
          "safety-reasoning-agent",
          "candidates.ai",
          1,
          ctx,
          "rejected",
          { skipped: true, reason: "live inference requires the async driver (runAllLive)" },
        ),
      ],
      patch: { candidate_findings: null },
    };
  }

  // Drivable context must use the async path below.
  return { artifacts: [], patch: { candidate_findings: null } };
};

/**
 * Live path used by DefaultAuditPipeline.runAllLive: assembles the provisional
 * audit result from current slices and asks the adapter for bounded
 * candidates. Adapter failure ⇒ zero candidates + degraded artifact.
 */
export async function generateCandidatesLive(
  state: SharedState,
  ctx: NodeRunCtx,
  adapter: AiAdapter,
): Promise<NodeResult> {
  const provisional = assembleAuditResult(state, ctx.ranAtIso);
  try {
    // Producer identity is enforced at the boundary; adapters cannot self-label.
    const candidates: CandidatesSlice = (await adapter.generateCandidates(provisional)).map(
      (c) => ({ ...c, producer: "safety-reasoning-agent" }),
    );
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
  } catch (e) {
    return {
      artifacts: [
        makeArtifact(
          "AG-AI-CANDIDATES",
          "safety-reasoning-agent",
          "candidates.ai",
          1,
          ctx,
          "rejected",
          {
            skipped: true,
            reason: `adapter failure: ${e instanceof Error ? e.message : String(e)}`,
          },
        ),
      ],
      patch: { candidate_findings: null },
    };
  }
}
