// GET/POST /api/projects/[projectId]/audits/[auditId]/issues
// ADR-0004 (DEC-0005): POST issues the audit — an explicit in-product act by
// the Auditor that freezes the draft's current results into an immutable,
// sequentially numbered revision. Issued revisions are never modified or
// deleted; later runs change only the draft. GET lists the issue lineage.
// Freezing over unreviewed AI candidates succeeds loudly: a limitation line
// names them in the frozen snapshot only (ADR-0006).
// G-11: the evidence-binding rule is enforced here, at issuance — not only in
// flight. A draft whose findings cite unresolvable evidence, or that still
// carry an ADR-0010 auto-flag, is refused unless the Auditor overrides it with
// a named reviewer claim; the override is then visible in the issued record.
// G-10: the capability claim is bounded here, at issuance — not only stamped in
// the report text. A draft whose cell's input floor is unsatisfied carries an
// invalidated claim and is refused; a draft outside the declared ODD is issued
// only when the record carries the out-of-ODD stamp that denies the claim.
import { NextResponse } from "next/server";
import { badRequest, notFound, requireWorkspace, serverError } from "@/lib/api";
import { unreviewedCandidateLimitation } from "@/domain/candidate-review";
import { evaluateEvidenceBinding } from "@/domain/evidence-binding";
import { CapabilityClaimNotIssuableError } from "@/domain/pipeline/constants";
import type { AuditResult, EvidenceOverride } from "@/domain/types";

type Ctx = { params: Promise<{ projectId: string; auditId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId, auditId } = await ctx.params;
    const issues = await auth.repo.listIssues(auth.ws, projectId, auditId);
    return NextResponse.json({ issues });
  } catch (e) {
    return serverError(e);
  }
}

/** Read the optional request body: absent body => {}, malformed JSON => 400. */
async function readBody(req: Request): Promise<
  { ok: true; value: { evidence_override?: unknown } } | { ok: false }
> {
  const raw = await req.text();
  if (raw.trim() === "") return { ok: true, value: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: true, value: {} };
  }
  return { ok: true, value: parsed as { evidence_override?: unknown } };
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace(req);
  if (!auth.ok) return auth.res;
  try {
    const { projectId, auditId } = await ctx.params;
    const draft = await auth.repo.getAudit(auth.ws, projectId, auditId);
    if (!draft) return notFound("audit not found");

    // ADR-0005 d4/d5: the freeze carries a capability claim, so it is bounded here, at
    // issuance — not only annotated in the report text (G-10, issue #44).
    //  - A claim that was invalidated (the ODD cell's input floor is not satisfied)
    //    must not become a formal revision: refuse, loudly.
    //  - A run outside the declared ODD is legitimate (d4: mapped-unproven packs run
    //    and are stamped "validation pending"), so it is not refused outright; but it
    //    may only be issued when the record carries that out-of-ODD stamp, which
    //    denies the capability claim. A record with no capability status at all (a
    //    draft predating ODD stamping) is not issuable either.
    // Checked first: no request content can relax the bound, so a draft that cannot
    // be issued is refused before the body is even read.
    if (draft.odd_floor_satisfied === false) {
      throw new CapabilityClaimNotIssuableError("below_floor");
    }
    if (draft.odd_status !== "in" && !draft.odd_stamp) {
      throw new CapabilityClaimNotIssuableError("outside_odd");
    }

    const body = await readBody(req);
    if (!body.ok) return badRequest("invalid request body: expected JSON");

    // A supplied override must name a reviewer: an override with no attributable
    // claim is not an override.
    const rawOverride = body.value.evidence_override;
    let override: { auditor_pseudonym: string; note: string | null } | null = null;
    if (rawOverride !== undefined && rawOverride !== null) {
      const candidate =
        typeof rawOverride === "object" && !Array.isArray(rawOverride)
          ? (rawOverride as { auditor_pseudonym?: unknown; note?: unknown })
          : null;
      const pseudonym = candidate?.auditor_pseudonym;
      if (typeof pseudonym !== "string" || pseudonym.trim() === "") {
        return badRequest("invalid evidence_override.auditor_pseudonym: expected a non-empty string");
      }
      override = {
        auditor_pseudonym: pseudonym.trim(),
        note: typeof candidate?.note === "string" ? candidate.note : null,
      };
    }


    // Pending candidates are never members of a formal record (ADR-0006): the
    // snapshot strips them; unreviewed ones speak only through the limitation.
    const { candidate_findings: _pending, ...freezable } = draft;
    const toFreeze =
      _pending && _pending.length > 0
        ? {
            ...freezable,
            limitations: [...freezable.limitations, unreviewedCandidateLimitation(_pending.length)],
          }
        : freezable;

    // G-11: the gate runs BEFORE anything is written. A draft whose findings
    // are not bound to evidence is refused unless the request carries a named
    // reviewer override; a clean draft ignores any supplied override.
    const violations = evaluateEvidenceBinding(draft);
    if (violations.length > 0 && !override) {
      return NextResponse.json(
        {
          error: "evidence binding not satisfied",
          violations: violations.map((v) => ({
            finding_id: v.finding_id,
            kind: v.kind,
            detail: v.detail,
          })),
        },
        { status: 400 },
      );
    }
    const evidence_override: EvidenceOverride | undefined =
      violations.length > 0 && override
        ? {
            auditor_pseudonym: override.auditor_pseudonym,
            reasons: violations.map((v) => `${v.kind}:${v.finding_id}:${v.detail}`),
            note: override.note,
            overridden_at: new Date().toISOString(),
          }
        : undefined;
    const frozen: AuditResult = evidence_override
      ? { ...toFreeze, evidence_override }
      : toFreeze;

    const issue = await auth.repo.saveIssue(
      auth.ws,
      projectId,
      auditId,
      frozen,
      new Date().toISOString(),
      auth.actor,
    );
    return NextResponse.json({ issue }, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}
