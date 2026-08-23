// AG-AI-CANDIDATES — AI Candidate Generation (ai-bounded). OFF by default:
// zero provider calls, slice explicitly null. Uniform refusal: an adapter that
// cannot run in this context (disabled, or enabled but sync-only) yields zero
// candidates plus a degraded status artifact; the deterministic path is
// unaffected. Live inference flows through pipeline.runAllLive →
// generateCandidatesLive.
import { getAiAdapter, MAX_IMAGES_PER_CALL, type AiAdapter } from "@/lib/ai";
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

/** The bounded CandidateFinding subset — nothing outside these keys survives. */
const CANDIDATE_FIELDS = [
  "kind",
  "category",
  "location",
  "road_users",
  "scenario",
  "statement",
  "evidence",
  "assumptions",
  "rationale",
  "recommendation",
  "source_attachment_ids",
] as const;

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

  // M3 vision budget: first N drawings become image blocks; the rest degrade
  // to name-only text summaries so nothing is silently dropped.
  const attachments = ctx.attachments ?? [];
  const shown = attachments.slice(0, MAX_IMAGES_PER_CALL);
  const overflow = attachments.slice(MAX_IMAGES_PER_CALL);
  const images = shown.map((a) => a.data_url);
  const contextNotes = overflow.map((a) => a.file_name);

  try {
    // Boundary enforcement: project onto the declared subset (adapters cannot
    // widen it) and re-assert producer identity (adapters cannot self-label).
    const raw = await adapter.generateCandidates(
      provisional,
      images.length ? images : undefined,
      contextNotes.length ? contextNotes : undefined,
    );
    const consideredIds = shown.map((a) => a.attachment_id);
    const candidates: CandidatesSlice = raw.map((c) => {
      const bounded: Record<string, unknown> = { producer: "safety-reasoning-agent" };
      if (consideredIds.length > 0) bounded.source_attachment_ids = consideredIds;
      for (const f of CANDIDATE_FIELDS) {
        if (f in c) bounded[f] = c[f as keyof typeof c];
      }
      return bounded as CandidatesSlice[number];
    });
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
