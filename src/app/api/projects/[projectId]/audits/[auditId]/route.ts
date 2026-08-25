// GET/PATCH /api/projects/[projectId]/audits/[auditId]
// PATCH updates reviewer statuses / notes / recommendations on findings and
// promotes/rejects AI candidates (ADR-0006) — both post-pipeline on the
// stored draft, mirroring the production review flow.
import { NextResponse } from "next/server";
import { badRequest, notFound, requireWorkspace, serverError } from "@/lib/api";
import { validateRecommendationWording } from "@/domain/engine";
import {
  applyCandidatePromotions,
  type CandidatePromotion,
  type OutcomeConsent,
} from "@/domain/candidate-review";
import { PROMPT_HASH, PROMPT_VERSION, getAiAdapterId } from "@/lib/ai";
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
      /** Ticket 05 (ADR-0009 §4): capture posture for outcome logging.
       *  Absent ⇒ logged under defaults (devtab/tests stable);
       *  {declined:true} ⇒ promotion applies, no outcome row is written. */
      consent?: OutcomeConsent;
      auditor_pseudonym?: string;
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
      const consent = body.consent;
      if (
        consent !== undefined &&
        consent !== null &&
        (typeof consent !== "object" ||
          ("declined" in consent && consent.declined !== true) ||
          (!("declined" in consent) && typeof (consent as { version?: unknown }).version !== "string"))
      ) {
        return badRequest("invalid consent: expected {version} or {declined:true}");
      }
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
      const applied = applyCandidatePromotions(
        audit,
        body.candidate_promotions,
        {
          ...(consent !== undefined && consent !== null ? { consent } : {}),
          ...(pseudonym !== undefined ? { auditor_pseudonym: pseudonym.trim() } : {}),
          run_provenance,
        },
      );
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
