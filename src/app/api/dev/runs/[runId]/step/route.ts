// POST /api/dev/runs/[runId]/step — execute one node against the session
// state. Body { nodeId, ai?: true } runs AG-AI-CANDIDATES through the live
// driver; { decisions?: [...] } feeds human adjudication. Off default refuses
// uniformly, so the deterministic path never changes.
import { NextResponse } from "next/server";
import { badRequest, requireAdmin } from "@/lib/api";
import { getSession, putSession } from "@/lib/devtab";
import { getPipeline, mergeState } from "@/domain/pipeline/pipeline";
import { generateCandidatesLive } from "@/domain/pipeline/nodes/ai-candidates";
import { getAiAdapter } from "@/lib/ai";
import type { AdjudicationDecision, AgNodeId, AuditArtifact } from "@/domain/pipeline/types";

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

    const body = (await req.json()) as {
      nodeId?: string;
      ai?: boolean;
      decisions?: AdjudicationDecision[];
    };
    const nodeId = body.nodeId as AgNodeId | undefined;
    if (!nodeId) return badRequest("nodeId is required");
    const descriptor = getPipeline().describe().find((d) => d.id === nodeId);
    if (!descriptor) return badRequest(`unknown node ${nodeId}`);
    if (nodeId === "AG-PERSIST") {
      return badRequest("AG-PERSIST persists via the finish endpoint, not step");
    }

    let artifacts: AuditArtifact[] = [];
    const useLive = nodeId === "AG-AI-CANDIDATES" && body.ai === true && getAiAdapter().enabled;
    if (useLive) {
      const res = await generateCandidatesLive(
        session.state,
        {
          ranAtIso: session.ranAtIso,
          project: session.project,
          versionStart: session.artifacts.length + 1,
          allowLiveInference: true,
        },
        getAiAdapter(),
      );
      artifacts = res.artifacts;
      session.state = mergeState(session.state, res.patch);
    } else {
      const res = getPipeline().runNode(nodeId, session.state, {
        ranAtIso: session.ranAtIso,
        project: session.project,
        versionStart: session.artifacts.length + 1,
        ...(body.decisions ? { decisions: body.decisions } : {}),
      });
      artifacts = res.artifacts;
      session.state = mergeState(session.state, res.patch);
    }

    session.executed.push({ nodeId, artifactCount: artifacts.length });
    session.artifacts.push(...artifacts);
    putSession(session);
    return NextResponse.json({
      executed: nodeId,
      artifacts,
      state: session.state,
      trail: session.executed,
    });
  } catch (e) {
    // Node contract violations (missing slices, eligibility failures) are
    // meaningful step errors, not server faults.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 422 },
    );
  }
}
