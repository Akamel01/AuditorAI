// GET/PATCH /api/projects/[projectId]/audits/[auditId]
// PATCH delegates post-pipeline review work to the domain modules (backlog
// C3): finding edits and question marks (finding-review), candidate promotions
// (candidate-review, ADR-0006) — both applied to the stored draft, mirroring
// the production review flow. The handler only auths, parses, delegates,
// persists; no domain conditionals live here.
import { NextResponse } from "next/server";
import { badRequest, notFound, requireWorkspace, serverError } from "@/lib/api";
import {
  applyCandidatePromotions,
  parseOutcomeConsent,
  type CandidatePromotion,
} from "@/domain/candidate-review";
import {
  applyFindingUpdates,
  applyQuestionMarks,
  type FindingUpdateEntry,
  type QuestionMarkEntry,
} from "@/domain/finding-review";
import { PROMPT_HASH, PROMPT_VERSION, getAiAdapterId } from "@/lib/ai";

type Ctx = { params: Promise<{ projectId: string; auditId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  const { projectId, auditId } = await ctx.params;
  const audit = await auth.repo.getAudit(auth.ws, projectId, auditId);
  if (!audit) return notFound("audit not found");
  return NextResponse.json({ audit });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId, auditId } = await ctx.params;
    const audit = await auth.repo.getAudit(auth.ws, projectId, auditId);
    if (!audit) return notFound("audit not found");

    const body = (await req.json()) as {
      finding_updates?: FindingUpdateEntry[];
      question_marked?: QuestionMarkEntry[];
      candidate_promotions?: CandidatePromotion[];
      consent?: unknown;
      auditor_pseudonym?: string;
    };

    let next = audit;
    const updated = applyFindingUpdates(next, body.finding_updates ?? []);
    if (!updated.ok) return badRequest(updated.error.message);
    next = updated.value;

    const marked = applyQuestionMarks(next, body.question_marked ?? []);
    if (!marked.ok) return badRequest(marked.error.message);
    next = marked.value;

    if (body.candidate_promotions?.length) {
      const parsedConsent = parseOutcomeConsent(body);
      if (!parsedConsent.ok) return badRequest(parsedConsent.error);
      const pseudonym = body.auditor_pseudonym;
      if (pseudonym !== undefined && (typeof pseudonym !== "string" || pseudonym.trim() === "")) {
        return badRequest("invalid auditor_pseudonym: expected a non-empty string");
      }
      // ADR-0012 run-level provenance fallback from the live adapter/prompt
      // getters; candidates stamped with generation_provenance at generation
      // time keep their own identity field-by-field (buildOutcomeRow).
      const run_provenance = {
        adapter_id: getAiAdapterId(),
        prompt_version: PROMPT_VERSION,
        prompt_hash: PROMPT_HASH,
      };
      const promoted = applyCandidatePromotions(
        next,
        body.candidate_promotions,
        {
          ...(parsedConsent.value !== undefined ? { consent: parsedConsent.value } : {}),
          ...(pseudonym !== undefined ? { auditor_pseudonym: pseudonym.trim() } : {}),
          run_provenance,
        },
      );
      if (!promoted.ok) return badRequest(promoted.error);
      next = promoted.value;
    }

    await auth.repo.saveAudit(auth.ws, next);
    return NextResponse.json({ audit: next });
  } catch (e) {
    return serverError(e);
  }
}
