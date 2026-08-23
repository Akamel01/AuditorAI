// GET/PATCH /api/projects/[projectId]/audits/[auditId]
// PATCH updates reviewer statuses / notes / recommendations on findings and
// promotes/rejects AI candidates (ADR-0006) — both post-pipeline on the
// stored draft, mirroring the production review flow.
import { NextResponse } from "next/server";
import { badRequest, notFound, requireWorkspace, serverError } from "@/lib/api";
import { validateRecommendationWording } from "@/domain/engine";
import { applyCandidatePromotions, type CandidatePromotion } from "@/domain/candidate-review";
import type { Finding } from "@/domain/types";

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
      finding_updates?: {
        finding_id: string;
        reviewer_status?: Finding["reviewer_status"];
        recommendation?: string | null;
        reviewer_note?: string | null;
        location?: string | null;
        severity?: string | null;
        likelihood?: string | null;
      }[];
      question_marked?: { question_id: string; addressed: boolean }[];
      candidate_promotions?: CandidatePromotion[];
    };

    for (const u of body.finding_updates ?? []) {
      const f = audit.findings.find((x) => x.finding_id === u.finding_id);
      if (!f) return badRequest(`unknown finding ${u.finding_id}`);
      if (u.reviewer_status) f.reviewer_status = u.reviewer_status;
      if (u.recommendation !== undefined) {
        if (u.recommendation) {
          const check = validateRecommendationWording(u.recommendation);
          if (!check.ok)
            return badRequest(
              `recommendation uses banned wording: ${check.violations.join(", ")}`,
            );
        }
        f.recommendation = u.recommendation;
      }
      if (u.reviewer_note !== undefined) f.reviewer_note = u.reviewer_note;
      if (u.location !== undefined) f.location = u.location;
      if (u.severity !== undefined)
        f.risk_components.severity = u.severity;
      if (u.likelihood !== undefined)
        f.risk_components.likelihood = u.likelihood;
    }

    for (const q of body.question_marked ?? []) {
      const item = audit.audit_questions.find((x) => x.question_id === q.question_id);
      if (!item) return badRequest(`unknown question ${q.question_id}`);
      item.addressed = q.addressed;
    }

    if (body.candidate_promotions?.length) {
      const applied = applyCandidatePromotions(audit, body.candidate_promotions);
      if (!applied.ok) return badRequest(applied.error);
      audit.findings = applied.value.findings;
      if (applied.value.candidate_findings)
        audit.candidate_findings = applied.value.candidate_findings;
      else delete audit.candidate_findings;
    }

    await auth.repo.saveAudit(auth.ws, audit);
    return NextResponse.json({ audit });
  } catch (e) {
    return serverError(e);
  }
}
