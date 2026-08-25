// AG-AI-CANDIDATES — AI Candidate Generation (ai-bounded). OFF by default:
// zero provider calls, slice explicitly null. Uniform refusal: an adapter that
// cannot run in this context (disabled, or enabled but sync-only) yields zero
// candidates plus a degraded status artifact; the deterministic path is
// unaffected. Live inference flows through pipeline.runAllLive →
// generateCandidatesLive.
import {
  CANDIDATE_FIELDS,
  MAX_IMAGES_PER_CALL,
  PROMPT_HASH,
  PROMPT_VERSION,
  getAiAdapter,
  validateCandidateAtBoundary,
  type AiAdapter,
  type CandidateFinding,
} from "@/lib/ai";
import { loadFewshotStore, selectFewshots } from "@/lib/fewshot";
import { assembleAuditResult } from "@/domain/pipeline/result";
import { makeArtifact } from "@/domain/pipeline/nodes/shared";
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
  const provisional = assembleAuditResult(state, ctx.ranAtIso, "AG-AI-CANDIDATES");

  // ADR-0008 §3: deterministic exemplar cascade over the compiled store; the
  // chosen ids ride the run log (and outcome rows via the review route) so
  // every candidate is reproducible from (prompt hash, exemplar ids, …).
  // Store absence degrades to an empty selection — never blocks generation.
  const store = loadFewshotStore();
  const fewshotIds = store
    ? selectFewshots(
        {
          jurisdiction: provisional.jurisdiction,
          native_stage_id: provisional.native_stage_id,
          canonical_stage: provisional.canonical_stages[0] ?? null,
        },
        store,
      )
    : [];
  console.log(
    `[fewshot] AG-AI-CANDIDATES store_version=${store?.store_version ?? "none"} selected=[${fewshotIds.join(", ")}]`,
  );

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
      ctx.candidateVocabulary,
    );
    const consideredIds = shown.map((a) => a.attachment_id);
    const candidates: CandidatesSlice = [];
    for (const item of raw) {
      const bounded = projectCandidate(item, consideredIds);
      if (!validateCandidateAtBoundary(bounded)) {
        return refused(
          ctx,
          `boundary validation failed: ${JSON.stringify(validateCandidateAtBoundary.errors)}`,
        );
      }
      candidates.push(bounded);
    }
    // ADR-0012 generation-time identity: stamped after boundary projection so
    // adapters can never forge it; rides the persisted candidates onto the
    // draft and, via promotion, onto outcome rows. The fewshot selection stays
    // loud in the run log AND travels with each candidate.
    const generationProvenance = {
      adapter_id: adapter.id ?? null,
      prompt_version: PROMPT_VERSION,
      prompt_hash: PROMPT_HASH,
      fewshot_ids: [...fewshotIds],
    };
    for (const c of candidates) c.generation_provenance = { ...generationProvenance };
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
    return refused(ctx, `adapter failure: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function projectCandidate(c: CandidateFinding, consideredIds: string[]): CandidateFinding {
  const bounded: Record<string, unknown> = { producer: "safety-reasoning-agent" };
  if (consideredIds.length > 0) bounded.source_attachment_ids = consideredIds;
  for (const f of CANDIDATE_FIELDS) {
    if (f in c) bounded[f] = c[f as keyof typeof c];
  }
  return bounded as unknown as CandidateFinding;
}

function refused(ctx: NodeRunCtx, reason: string): NodeResult {
  return {
    artifacts: [
      makeArtifact(
        "AG-AI-CANDIDATES",
        "safety-reasoning-agent",
        "candidates.ai",
        1,
        ctx,
        "rejected",
        { skipped: true, reason },
      ),
    ],
    patch: { candidate_findings: null },
  };
}
