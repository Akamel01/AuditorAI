// POST /api/dev/runs/[runId]/step — execute one node against the session
// state. Body { nodeId, ai?: true } permits live inference for ai-bounded
// nodes; { decisions?: [...] } feeds human adjudication. Behavior selection
// is registry-driven via pipeline.runNodeAsync; off default refuses
// uniformly, so the deterministic path never changes.
import { NextResponse } from "next/server";
import { badRequest, requireAdmin, RequestContractError, serverError } from "@/lib/api";
import { devWorkspaceHash, getSession, putSession } from "@/lib/devtab";
import { getPipeline } from "@/domain/pipeline/pipeline";
import { getPack } from "@/domain/packs";
import { getAiAdapter } from "@/lib/ai";
import { getDataStore, Repository } from "@/lib/persistence";
import type { AdjudicationDecision, AgNodeId } from "@/domain/pipeline/types";

interface Ctx {
  params: Promise<{ runId: string }>;
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  try {
    const { runId } = await ctx.params;
    const session = getSession(runId);
    if (!session) return NextResponse.json({ error: "unknown runId" }, { status: 404 });

    let body: { nodeId?: string; ai?: boolean; decisions?: AdjudicationDecision[] };
    try {
      body = (await req.json()) as {
        nodeId?: string;
        ai?: boolean;
        decisions?: AdjudicationDecision[];
      };
    } catch (e) {
      throw new RequestContractError(e instanceof Error ? e.message : String(e));
    }
    const nodeId = body.nodeId as AgNodeId | undefined;
    if (!nodeId) return badRequest("nodeId is required");
    const descriptor = getPipeline().describe().find((d) => d.id === nodeId);
    if (!descriptor) return badRequest(`unknown node ${nodeId}`);
    if (!descriptor.executed_in_batch) {
      return badRequest("persistence runs via the finish endpoint, not step");
    }

    const goLive = body.ai === true && getAiAdapter().enabled;
    const pack = goLive ? getPack(session.project.stage_selection.jurisdiction) : null;
    let out;
    try {
      out = await getPipeline().runNodeAsync(
        nodeId,
        session.state,
        {
          ranAtIso: session.ranAtIso,
          project: session.project,
          ...(goLive && pack
            ? {
                allowLiveInference: true,
                attachments: (
                  await new Repository(getDataStore()).listAttachments(
                    devWorkspaceHash(),
                    session.project.project_id,
                  )
                ).map((a) => ({
                  attachment_id: a.attachment_id,
                  file_name: a.file_name,
                  data_url: a.data_url,
                })),
                candidateVocabulary: {
                  issue_categories: pack.issue_categories,
                  road_user_categories: pack.road_user_categories,
                },
              }
            : {}),
          ...(body.decisions ? { decisions: body.decisions } : {}),
        },
        session.artifacts,
      );
    } catch (e) {
      // Node contract violations (missing slices, eligibility failures) are
      // meaningful step errors, not server faults.
      throw new RequestContractError(e instanceof Error ? e.message : String(e));
    }

    session.state = out.state;
    session.executed.push({ nodeId, artifactCount: out.artifacts.length });
    session.artifacts.push(...out.artifacts);
    putSession(session);
    return NextResponse.json({
      executed: nodeId,
      artifacts: out.artifacts,
      state: session.state,
      trail: session.executed,
    });
  } catch (e) {
    return serverError(e);
  }
}
