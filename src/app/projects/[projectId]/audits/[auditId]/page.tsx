"use client";
// Audit review: findings adjudication, questions, missing information, report.
// C7 deepened: fetch/PATCH orchestration lifted to domain/audit-workspace;
// this page + CandidateAdjudication are now pure render, delegating via
// the injected api adapter (lib/client api) to preserve buildFindingUpdate
// and promoteCandidate contracts verbatim.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, getAuditorPseudonym, setAuditorPseudonym } from "@/lib/client";
import { humanizeEnum } from "@/lib/format";
import { renderReportMarkdown } from "@/lib/report";
import { stageDisplay } from "@/app/_components/stage-label";
import { REVIEWER_STATUS_ACTIONS, type ReviewerStatusAction } from "@/domain/finding-review";
import { DEFAULT_AUDITOR_PSEUDONYM } from "@/domain/outcome-contracts";
import {
  buildPosture,
  buildPromotion as buildWorkspacePromotion,
  issue as issueWorkspace,
  load as loadWorkspace,
  promoteOne,
  saveFinding,
  setQuestionAddressed,
  type CapturePosture,
} from "@/domain/audit-workspace";
import type { AuditIssue, AuditResult, CandidateFindingRecord, Finding } from "@/domain/types";
import { AppShell } from "@/app/_components/ui/app-shell";
import { ConfidenceMark, Eyebrow, KindChip, RevisionSeal } from "@/app/_components/ui/chips";
import { Button } from "@/app/_components/ui/button";
import { Panel } from "@/app/_components/ui/panel";
import { EvidenceRef } from "@/app/_components/ui/evidence-ref";
import { Segmented } from "@/app/_components/ui/segmented";
import { ConfirmDialog } from "@/app/_components/ui/confirm-dialog";
import { EmptyState, LoadingRows, Skeleton } from "@/app/_components/ui/empty-state";
import { InlineNotice } from "@/app/_components/ui/inline-notice";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Download,
  Printer,
  RoadUserGlyph,
  Seal,
} from "@/app/_components/ui/icons";

const STATUS_OPTIONS = REVIEWER_STATUS_ACTIONS.map((s) => ({
  value: s,
  label: humanizeEnum(s)
    .replace("accepted with edits", "Accept with edits")
    .replace("accepted", "Accept")
    .replace("rejected", "Reject")
    .replace("escalated", "Escalate"),
}));

export default function AuditPage() {
  const { projectId: id, auditId } = useParams<{ projectId: string; auditId: string }>();
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [issueBusy, setIssueBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { audit: d, issues: i } = await loadWorkspace(id, auditId, api);
      setAudit(d);
      setIssues(i);
    } catch (e) {
      setError(String((e as Error).message));
    }
  }, [id, auditId]);
  useEffect(() => {
    load();
  }, [load]);

  async function issueReport() {
    setIssueBusy(true);
    try {
      await issueWorkspace(id, auditId, api);
      setConfirmOpen(false);
      await load();
    } catch (e) {
      setError(String((e as Error).message));
      setConfirmOpen(false);
    } finally {
      setIssueBusy(false);
    }
  }

  if (error && !audit)
    return (
      <AppShell>
        <div className="pt-12">
          <InlineNotice>{error}</InlineNotice>
        </div>
      </AppShell>
    );

  if (!audit)
    return (
      <AppShell>
        <div className="pt-12">
          <Skeleton className="h-8 w-2/3" />
          <div className="mt-6">
            <LoadingRows rows={4} />
          </div>
        </div>
      </AppShell>
    );

  const markdown = renderReportMarkdown(audit);
  const pairing = stageDisplay({
    nativeLabel: audit.native_stage_display_name,
    canonicalStages: audit.canonical_stages,
    confidence: audit.mapping_confidence,
  });
  const nextRev = (issues[issues.length - 1]?.revision ?? 0) + 1;
  const addressedCount = audit.audit_questions.filter((q) => q.addressed).length;

  return (
    <AppShell wide>
      <ConfirmDialog
        open={confirmOpen}
        title={`Issue this report as revision I${nextRev}?`}
        body={
          <>
            Issuing freezes the current results into an immutable, numbered record. Later runs
            replace the draft — they never alter an issued revision. This cannot be undone.
          </>
        }
        confirmLabel={issueBusy ? "Issuing…" : `Issue revision I${nextRev}`}
        busy={issueBusy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={issueReport}
      />

      <div className="pt-8">
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-faint no-underline transition-colors hover:text-subtle"
        >
          <ArrowLeft size={13} />
          {audit.project_id}
        </Link>

        {/* title block */}
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline md:grid-cols-4">
          <TitleCell k="Audit" v={<span className="mono text-[12.5px]">{audit.audit_id}</span>} />
          <TitleCell k="Framework" v={audit.framework_name} />
          <TitleCell k="Native stage" v={pairing.nativeLabel} />
          <TitleCell
            k="Canonical map"
            v={
              <span className="flex flex-wrap items-center gap-2">
                <span className="mono text-[11.5px]">{pairing.canonicalText}</span>
                <ConfidenceMark confidence={audit.mapping_confidence} />
              </span>
            }
          />
        </div>

        {/* disclaimer — formal voice */}
        <div className="mt-4 flex items-start gap-3 border-y border-edge py-4">
          <Seal size={18} className="mt-0.5 shrink-0 text-subtle" />
          <p className="formal max-w-[70ch] text-[15.5px] leading-[1.6] text-muted">{audit.disclaimer}</p>
        </div>

        {/* AI candidates — adjudication capture (ADR-0006/0009) */}
        {(audit.candidate_findings?.length ?? 0) > 0 && (
          <section className="mt-10">
            <Eyebrow code="CH 0+090">
              AI candidates — {audit.candidate_findings!.length} awaiting disposition
            </Eyebrow>
            <CandidateAdjudication
              candidates={audit.candidate_findings!}
              projectId={id}
              auditId={auditId}
              onChanged={load}
            />
          </section>
        )}

        {/* findings */}
        <section className="mt-10">
          <Eyebrow code="CH 0+090">Findings — {audit.findings.length} this run</Eyebrow>
          {audit.findings.length === 0 && (
            <EmptyState
              icon={<Check size={26} />}
              title="No deterministic findings for this run"
              hint="Process rules and stage questions raised no findings against the provided inputs. That is a statement about the checks — not a declaration that the scheme is safe."
            />
          )}
          <div className="space-y-3">
            {audit.findings.map((f) => (
              <FindingCard key={f.finding_id} f={f} projectId={id} auditId={auditId} onChanged={load} />
            ))}
          </div>
        </section>

        {/* missing information */}
        <section className="mt-10">
          <Eyebrow code="CH 0+090">Missing information</Eyebrow>
          {audit.missing_information.length === 0 ? (
            <p className="text-[13px] text-subtle">Nothing missing — all required inputs are recorded.</p>
          ) : (
            <ul className="overflow-hidden rounded-md border border-hairline bg-surface">
              {audit.missing_information.map((m) => (
                <li key={m.question_id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hairline px-4 py-3 last:border-b-0">
                  <AlertTriangle size={14} className="self-center text-warn" />
                  <span className="text-[13px] font-medium">{m.label}</span>
                  <span className="text-[12.5px] text-muted">{m.note}</span>
                  <span className="ml-auto font-mono text-[10.5px] text-faint">
                    {m.requirement_level}
                    {m.evidence_ids.length > 0 && ` · ${m.evidence_ids.join(" · ")}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* stage questions */}
        <section className="mt-10">
          <Eyebrow code="CH 0+090">
            Stage questions — {addressedCount}/{audit.audit_questions.length} addressed
          </Eyebrow>
          <ul className="overflow-hidden rounded-md border border-hairline bg-surface">
            {audit.audit_questions.map((q) => (
              <li key={q.question_id} className="border-b border-hairline px-4 py-3 last:border-b-0 transition-colors hover:bg-sunken/60">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={q.addressed}
                    onChange={async (e) => {
                      await setQuestionAddressed(
                        { projectId: id, auditId, questionId: q.question_id, addressed: e.target.checked },
                        api,
                      );
                      load();
                    }}
                    className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer appearance-none rounded-[3px] border border-edge bg-surface transition-colors checked:border-accent checked:bg-accent hover:border-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  />
                  <span className={`text-[13.5px] leading-relaxed ${q.addressed ? "text-subtle" : "text-text"}`}>
                    {q.text}
                  </span>
                </label>
                {q.source_note && (
                  <p className="ml-6 mt-1 font-mono text-[10.5px] leading-relaxed text-faint">{q.source_note}</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* limitations */}
        <section className="mt-10">
          <Eyebrow code="CH 0+120">Limitations</Eyebrow>
          <ul className="space-y-1.5">
            {audit.limitations.map((l, i) => (
              <li key={i} className="flex max-w-[80ch] items-start gap-2.5 text-[13px] leading-relaxed text-muted">
                <span className="mt-[7px] h-px w-3 shrink-0 bg-edge" />
                {l}
              </li>
            ))}
          </ul>
        </section>

        {/* report */}
        <section className="mt-12 print:mt-0">
          <Eyebrow code="CH 0+150">Report</Eyebrow>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
              download={`${audit.audit_id}.md`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-edge bg-surface px-2.5 font-mono text-[11.5px] text-muted no-underline transition-colors hover:border-faint hover:text-text"
            >
              <Download size={12} />
              report.md
            </a>
            <a
              href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(audit, null, 2))}`}
              download={`${audit.audit_id}.json`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-edge bg-surface px-2.5 font-mono text-[11.5px] text-muted no-underline transition-colors hover:border-faint hover:text-text"
            >
              <Download size={12} />
              audit.json
            </a>
            <Button size="sm" onClick={() => window.print()} className="print:hidden">
              <Printer size={12} />
              print / save PDF
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setConfirmOpen(true)}
              data-testid="issue-report"
              title="Freeze the current results as an immutable, numbered revision (ADR-0004)"
              className="print:hidden"
            >
              <Seal size={13} />
              issue report
              {issues.length > 0 ? ` (next I${issues[issues.length - 1].revision + 1})` : ""}
            </Button>
          </div>

          {issues.length > 0 && (
            <div className="mt-4" data-testid="issue-lineage">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                <Clock size={12} />
                Issued revisions — immutable
              </div>
              <ul className="overflow-hidden rounded-md border border-hairline bg-surface">
                {issues.map((iss, idx) => {
                  const md = renderReportMarkdown(iss.result);
                  return (
                    <li key={iss.revision} className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-b border-hairline px-4 py-3 last:border-b-0">
                      <RevisionSeal revision={iss.revision} latest={idx === issues.length - 1} />
                      <span className="text-[12.5px] text-muted">
                        issued {new Date(iss.issued_at).toLocaleString()}
                      </span>
                      <span className="ml-auto flex gap-3">
                        <a
                          href={`data:text/markdown;charset=utf-8,${encodeURIComponent(md)}`}
                          download={`${iss.result.audit_id}-I${iss.revision}.md`}
                          className="font-mono text-[11px] text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
                        >
                          .md
                        </a>
                        <a
                          href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(iss, null, 2))}`}
                          download={`${iss.result.audit_id}-I${iss.revision}.json`}
                          className="font-mono text-[11px] text-accent underline decoration-dotted underline-offset-2 hover:decoration-solid"
                        >
                          .json
                        </a>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* the report itself: a paper sheet inside the sheet */}
          <Panel className="mt-4 p-0">
            <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap p-5 font-mono text-[11.5px] leading-[1.7] text-muted">
              {markdown}
            </pre>
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}

function TitleCell({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">{k}</div>
      <div className="mt-1.5 text-[13px] font-medium leading-snug">{v}</div>
    </div>
  );
}

/* ————— finding card ————— — pure render + workspace delegation */

function FindingCard({
  f,
  projectId,
  auditId,
  onChanged,
}: {
  f: Finding;
  projectId: string;
  auditId: string;
  onChanged: () => void;
}) {
  const [rec, setRec] = useState(f.recommendation ?? "");
  const [note, setNote] = useState(f.reviewer_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(status?: ReviewerStatusAction) {
    setBusy(true);
    setError(null);
    try {
      await saveFinding(
        {
          projectId,
          auditId,
          findingId: f.finding_id,
          recommendation: rec,
          reviewerNote: note,
          ...(status ? { reviewerStatus: status } : {}),
        },
        api,
      );
      onChanged();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const statusTone =
    f.reviewer_status === "rejected"
      ? "text-concern"
      : f.reviewer_status === "draft"
        ? "text-faint"
        : "text-ok";

  return (
    <Panel as="article" className="overflow-hidden" data-testid="finding-card">
      {/* header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline px-4 py-2.5">
        <span className="font-mono text-[12px] font-medium text-muted">{f.finding_id}</span>
        <KindChip kind={f.kind} />
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
          <ConfidenceMark confidence={f.confidence.label} />
          <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] ${statusTone}`}>
            {f.reviewer_status === "draft"
              ? "○ awaiting review"
              : f.reviewer_status === "rejected"
                ? "× rejected"
                : `✓ ${f.reviewer_status}`}
          </span>
        </div>
      </div>

      {/* body */}
      <div className="grid lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="min-w-0 border-b border-hairline p-4 lg:border-b-0 lg:border-r lg:p-5">
          <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
            <span>{humanizeEnum(f.category)}</span>
            {f.location && (
              <span className="inline-flex items-baseline gap-1 normal-case tracking-normal">
                <PinInline />
                {f.location}
              </span>
            )}
          </div>

          <p className="max-w-[56ch] text-[15.5px] font-medium leading-[1.5] tracking-[-0.005em]">
            {f.statement.text}
          </p>
          {f.statement.normative_basis_note && (
            <p className="mt-1.5 text-[12px] text-subtle">{f.statement.normative_basis_note}</p>
          )}

          <div className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-subtle">
            {f.road_users.length > 0 && (
              <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                {f.road_users.map((u) => (
                  <span key={u} className="inline-flex items-center gap-1.5" title={u}>
                    <RoadUserGlyph user={u} size={15} className="text-muted" />
                    {u}
                  </span>
                ))}
              </span>
            )}
            <span>
              Risk:{" "}
              {f.risk_components.severity || f.risk_components.likelihood
                ? `${f.risk_components.severity ?? "—"} / ${f.risk_components.likelihood ?? "—"}${f.risk_components.scale_id ? ` (${f.risk_components.scale_id})` : ""}`
                : "not scored under this framework"}
            </span>
          </div>

          {f.scenario && (
            <p className="mt-3 max-w-[60ch] text-[13px] leading-relaxed text-muted">{f.scenario}</p>
          )}
          {f.rationale && (
            <p className="mt-3 max-w-[60ch] border-l-2 border-hairline pl-3.5 text-[13px] italic leading-relaxed text-subtle">
              {f.rationale}
            </p>
          )}

          <div className="mt-4">
            <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
              Recommendation
            </div>
            <textarea
              value={rec}
              onChange={(e) => setRec(e.target.value)}
              rows={2}
              placeholder="Recommendation (specific; 'consider'/'must' are rejected)"
              className="w-full resize-y rounded-md border border-edge bg-surface px-3 py-2 text-[13px] leading-relaxed text-text transition-colors placeholder:text-faint hover:border-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-tint"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reviewer note (optional)"
              className="mt-2 h-8 w-full rounded-md border border-edge bg-surface px-3 text-[12.5px] transition-colors placeholder:text-faint hover:border-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-tint"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Segmented
              ariaLabel={`Reviewer status for ${f.finding_id}`}
              options={STATUS_OPTIONS}
              value={f.reviewer_status === "draft" ? null : (f.reviewer_status as ReviewerStatusAction)}
              onChange={(v) => patch(v)}
            />
            <Button size="sm" onClick={() => patch()} loading={busy}>
              Save edits
            </Button>
          </div>
          {error && (
            <div className="mt-2.5 max-w-[520px]">
              <InlineNotice>{error}</InlineNotice>
            </div>
          )}
        </div>

        {/* evidence side */}
        <aside className="bg-sunken p-4 lg:p-5">
          <div className="mb-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
            Evidence · {f.evidence.length} {f.evidence.length === 1 ? "clause" : "items"}
          </div>
          {f.evidence.length === 0 && (
            <p className="text-[12.5px] leading-relaxed text-subtle">
              No cited clauses — this finding rests on recorded project information and reasoning.
            </p>
          )}
          <div className="space-y-2">
            {f.evidence.map((e) => (
              <div key={e.evidence_id} className="leading-relaxed">
                <EvidenceRef evidence={e} />
              </div>
            ))}
          </div>

          <div className="mb-2 mt-5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
            Source trace
          </div>
          <div className="space-y-0.5 font-mono text-[11px] leading-[1.8] text-subtle">
            {f.source_trace.map((t, i) => (
              <div key={i}>
                {humanizeEnum(t.origin)}
                {t.rule_id ? ` · ${t.rule_id}` : t.question_id ? ` · ${t.question_id}` : ""}
                {t.producer ? ` · ${t.producer}` : ""}
              </div>
            ))}
          </div>

          <div className="mb-2 mt-5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
            Confidence · {f.confidence.label}
          </div>
          <p className="text-[12px] leading-relaxed text-subtle">{f.confidence.basis}</p>

          {f.assumptions.length > 0 && (
            <>
              <div className="mb-2 mt-5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                Assumptions · {f.assumptions.length}
              </div>
              <ul className="space-y-1.5">
                {f.assumptions.map((a, i) => (
                  <li key={i} className="text-[12px] leading-relaxed text-subtle">
                    <span className="mr-1.5 inline-block h-px w-2.5 bg-edge align-middle" />
                    {a.text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </Panel>
  );
}

/* ————— AI candidate adjudication (ticket 05, ADR-0006/0009) — pure render — */

const CHECKBOX_CLS =
  "mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer appearance-none rounded-[3px] border border-edge bg-surface transition-colors checked:border-accent checked:bg-accent hover:border-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const INPUT_CLS =
  "h-8 w-full rounded-md border border-edge bg-surface px-3 text-[12.5px] transition-colors placeholder:text-faint hover:border-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-tint";
const TEXTAREA_CLS =
  "w-full resize-y rounded-md border border-edge bg-surface px-3 py-2 text-[13px] leading-relaxed text-text transition-colors placeholder:text-faint hover:border-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-tint";
const FIELD_LABEL_CLS = "mb-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint";

function CandidateAdjudication({
  candidates,
  projectId,
  auditId,
  onChanged,
}: {
  candidates: CandidateFindingRecord[];
  projectId: string;
  auditId: string;
  onChanged: () => void;
}) {
  const [consentLogged, setConsentLogged] = useState(true);
  const [pseudonym, setPseudonymState] = useState(DEFAULT_AUDITOR_PSEUDONYM);
  useEffect(() => setPseudonymState(getAuditorPseudonym()), []);

  function updatePseudonym(v: string) {
    setPseudonymState(v);
    setAuditorPseudonym(v);
  }

  const posture: CapturePosture = buildPosture(consentLogged, pseudonym);

  return (
    <>
      <div
        className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-hairline bg-surface px-4 py-2.5"
        data-testid="outcome-consent-bar"
      >
        <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug text-muted">
          <input
            type="checkbox"
            checked={consentLogged}
            onChange={(e) => setConsentLogged(e.target.checked)}
            data-testid="outcome-consent"
            className={CHECKBOX_CLS}
          />
          Log my decision for system improvement (pseudonymous)
        </label>
        <input
          value={pseudonym}
          onChange={(e) => updatePseudonym(e.target.value)}
          aria-label="Auditor pseudonym"
          placeholder={DEFAULT_AUDITOR_PSEUDONYM}
          data-testid="auditor-pseudonym"
          className="ml-auto h-8 w-44 rounded-md border border-edge bg-surface px-3 font-mono text-[11.5px] transition-colors placeholder:text-faint hover:border-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-tint"
        />
      </div>
      <div className="mt-3 space-y-3">
        {candidates.map((c, i) => (
          <CandidateCard
            key={i}
            index={i}
            c={c}
            projectId={projectId}
            auditId={auditId}
            posture={posture}
            onChanged={onChanged}
          />
        ))}
      </div>
    </>
  );
}

function CandidateCard({
  index,
  c,
  projectId,
  auditId,
  posture,
  onChanged,
}: {
  index: number;
  c: CandidateFindingRecord;
  projectId: string;
  auditId: string;
  posture: CapturePosture;
  onChanged: () => void;
}) {
  const [panel, setPanel] = useState<"none" | "edits" | "reject">("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statementText, setStatementText] = useState(c.statement.text);
  const [category, setCategory] = useState(c.category);
  const [recommendation, setRecommendation] = useState(c.recommendation ?? "");
  const [evidenceIds, setEvidenceIds] = useState(c.evidence.map((e) => e.evidence_id).join(", "));
  const [note, setNote] = useState("");

  async function submit(action: "accept" | "accept_with_edits" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const promo = buildWorkspacePromotion(index, action, c, {
        statementText,
        category,
        recommendation,
        evidenceIdsText: evidenceIds,
        note,
      });
      await promoteOne(projectId, auditId, promo, posture, api);
      onChanged();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel as="article" className="overflow-hidden" data-testid={`candidate-card-${index}`}>
      {/* header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline px-4 py-2.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
          candidate #{index + 1}
        </span>
        <KindChip kind={c.kind} />
        {c.validation && (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-warn">
            ⚠ auto-flagged: {c.validation.status}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-faint">{c.producer}</span>
      </div>

      {/* body */}
      <div className="p-4 lg:p-5">
        <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
          <span>{humanizeEnum(c.category)}</span>
          {c.location && <span>{c.location}</span>}
          {c.road_users.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 normal-case tracking-normal">
              {c.road_users.map((u) => (
                <span key={u} className="inline-flex items-center gap-1.5" title={u}>
                  <RoadUserGlyph user={u} size={14} className="text-muted" />
                  {u}
                </span>
              ))}
            </span>
          )}
        </div>

        <p className="max-w-[56ch] text-[15px] font-medium leading-[1.5] tracking-[-0.005em]">
          {c.statement.text}
        </p>
        {c.rationale && (
          <p className="mt-2 max-w-[60ch] border-l-2 border-hairline pl-3.5 text-[12.5px] italic leading-relaxed text-subtle">
            {c.rationale}
          </p>
        )}
        {c.evidence.length > 0 && (
          <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-faint">
            cited · {c.evidence.map((e) => e.evidence_id).join(" · ")}
          </p>
        )}

        {/* action bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Button size="sm" disabled={busy} onClick={() => submit("accept")} data-testid={`candidate-${index}-accept`}>
            Accept
          </Button>
          <Button
            size="sm"
            variant={panel === "edits" ? "primary" : "secondary"}
            disabled={busy}
            onClick={() => setPanel(panel === "edits" ? "none" : "edits")}
            data-testid={`candidate-${index}-edit`}
          >
            Accept with edits
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => setPanel(panel === "reject" ? "none" : "reject")}
            data-testid={`candidate-${index}-reject`}
          >
            Reject
          </Button>
        </div>

        {/* accept-with-edits panel: exactly the ADR-0009 edit whitelist */}
        {panel === "edits" && (
          <div className="mt-4 space-y-3 rounded-md border border-edge bg-sunken p-4" data-testid={`candidate-${index}-edit-panel`}>
            <div>
              <div className={FIELD_LABEL_CLS}>Statement</div>
              <textarea
                rows={2}
                value={statementText}
                onChange={(e) => setStatementText(e.target.value)}
                className={TEXTAREA_CLS}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className={FIELD_LABEL_CLS}>Category</div>
                {/* Pack vocabulary is not exposed client-side; free text is
                    validated server-side by the outcome schema/policy. */}
                <input value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <div className={FIELD_LABEL_CLS}>Evidence ids (comma-separated)</div>
                <input
                  value={evidenceIds}
                  onChange={(e) => setEvidenceIds(e.target.value)}
                  placeholder="EV-UK-002, EV-UK-009"
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div>
              <div className={FIELD_LABEL_CLS}>Recommendation</div>
              <textarea
                rows={2}
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                placeholder="Specific; 'consider'/'must' are rejected"
                className={TEXTAREA_CLS}
              />
            </div>
            <PanelActions
              busy={busy}
              note={note}
              setNote={setNote}
              submitLabel="Submit decision"
              onSubmit={() => submit("accept_with_edits")}
              onCancel={() => setPanel("none")}
              testidBase={`candidate-${index}`}
            />
          </div>
        )}

        {/* reject panel: optional note */}
        {panel === "reject" && (
          <div className="mt-4 rounded-md border border-edge bg-sunken p-4" data-testid={`candidate-${index}-reject-panel`}>
            <PanelActions
              busy={busy}
              note={note}
              setNote={setNote}
              submitLabel="Confirm reject"
              onSubmit={() => submit("reject")}
              onCancel={() => setPanel("none")}
              testidBase={`candidate-${index}`}
            />
          </div>
        )}

        {error && (
          <div className="mt-3 max-w-[520px]" data-testid={`candidate-${index}-error`}>
            <InlineNotice>{error}</InlineNotice>
          </div>
        )}
      </div>
    </Panel>
  );
}

function PanelActions({
  busy,
  note,
  setNote,
  submitLabel,
  onSubmit,
  onCancel,
  testidBase,
}: {
  busy: boolean;
  note: string;
  setNote: (v: string) => void;
  submitLabel: string;
  onSubmit: () => void;
  onCancel: () => void;
  testidBase: string;
}) {
  return (
    <>
      <div>
        <div className={FIELD_LABEL_CLS}>Note (optional)</div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reviewer note (optional)"
          className={INPUT_CLS}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button size="sm" variant="primary" loading={busy} onClick={onSubmit} data-testid={`${testidBase}-submit`}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </>
  );
}

function PinInline() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline-block translate-y-px">
      <path d="M12 21s-6.5-5.4-6.5-10.2A6.5 6.5 0 0 1 12 4.3a6.5 6.5 0 0 1 6.5 6.5C18.5 15.6 12 21 12 21Z" />
    </svg>
  );
}
