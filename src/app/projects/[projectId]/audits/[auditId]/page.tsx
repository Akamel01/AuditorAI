"use client";
// Audit review: findings adjudication, questions, missing information, report.
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { humanizeEnum } from "@/lib/format";
import { renderReportMarkdown } from "@/lib/report";
import { stageDisplay } from "@/app/_components/stage-label";
import {
  REVIEWER_STATUS_ACTIONS,
  buildFindingUpdate,
  type ReviewerStatusAction,
} from "@/domain/finding-review";
import type { AuditResult, Finding } from "@/domain/types";

export default function AuditPage() {
  const { projectId: id, auditId } = useParams<{ projectId: string; auditId: string }>();
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ audit: AuditResult }>(
        `/api/projects/${id}/audits/${auditId}`,
      );
      setAudit(d.audit);
    } catch (e) {
      setError(String((e as Error).message));
    }
  }, [id, auditId]);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <main className="mx-auto max-w-3xl px-6 py-12 text-red-600">{error}</main>;
  if (!audit) return <main className="mx-auto max-w-3xl px-6 py-12 text-neutral-500">Loading…</main>;

  const markdown = renderReportMarkdown(audit);
  const pairing = stageDisplay({
    nativeLabel: audit.native_stage_display_name,
    canonicalStages: audit.canonical_stages,
    confidence: audit.mapping_confidence,
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/projects/${id}`} className="text-xs text-neutral-500 hover:underline">
        ← {audit.project_id}
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Audit review</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {audit.framework_name} · {pairing.nativeLabel} · canonical{" "}
        {pairing.canonicalText} ({pairing.confidence})
      </p>
      <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
        {audit.disclaimer}
      </p>

      {/* Findings */}
      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold">Findings ({audit.findings.length})</h2>
        {audit.findings.length === 0 && (
          <p className="text-sm text-neutral-500">No deterministic findings for this run.</p>
        )}
        {audit.findings.map((f) => (
          <FindingCard key={f.finding_id} f={f} projectId={id} auditId={auditId} onChanged={load} />
        ))}
      </section>

      {/* Missing information */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Missing information</h2>
        {audit.missing_information.length === 0 && (
          <p className="mt-1 text-sm text-neutral-500">None.</p>
        )}
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {audit.missing_information.map((m) => (
            <li key={m.question_id}>
              <span className="font-medium">{m.label}</span> — {m.note}{" "}
              <span className="text-xs text-neutral-400">[{m.evidence_ids.join(", ")}]</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Questions */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Stage questions</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {audit.audit_questions.map((q) => (
            <li key={q.question_id} className="rounded border p-2">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={q.addressed}
                  onChange={async (e) => {
                    await api(`/api/projects/${id}/audits/${auditId}`, {
                      method: "PATCH",
                      json: { question_marked: [{ question_id: q.question_id, addressed: e.target.checked }] },
                    });
                    load();
                  }}
                />
                <span>{q.text}</span>
              </label>
              {q.source_note && <p className="ml-6 text-[11px] text-neutral-400">{q.source_note}</p>}
            </li>
          ))}
        </ul>
      </section>

      {/* Limitations */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Limitations</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {audit.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </section>

      {/* Report */}
      <section className="mt-10 print:mt-0">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Report</h2>
          <a
            href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`}
            download={`${audit.audit_id}.md`}
            className="text-xs text-blue-600 underline"
          >
            download .md
          </a>
          <a
            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(audit, null, 2))}`}
            download={`${audit.audit_id}.json`}
            className="text-xs text-blue-600 underline"
          >
            download .json
          </a>
          <button
            onClick={() => window.print()}
            className="rounded border px-2 py-1 text-xs hover:bg-neutral-100 print:hidden"
          >
            print / save PDF
          </button>
        </div>
        <pre className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border bg-white p-4 text-xs leading-relaxed">
{markdown}
        </pre>
      </section>
    </main>
  );
}

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

  async function patch(status?: ReviewerStatusAction) {
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/audits/${auditId}`, {
        method: "PATCH",
        json: {
          finding_updates: [
            buildFindingUpdate({
              finding_id: f.finding_id,
              reviewer_status: status,
              recommendation: rec,
              reviewer_note: note,
            }),
          ],
        },
      });
      onChanged();
    } catch (e) {
      alert(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border p-4 text-sm" data-testid="finding-card">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            f.kind === "safety_concern"
              ? "bg-red-100 text-red-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {humanizeEnum(f.kind)}
        </span>
        <code className="text-[11px] text-neutral-500">{f.finding_id}</code>
        <span className="text-[11px] uppercase tracking-wide text-neutral-400">
          {f.reviewer_status}
        </span>
      </div>
      <p className="mt-2 font-medium">{f.statement.text}</p>
      {f.evidence.length > 0 && (
        <p className="mt-1 text-xs text-neutral-500">Evidence: {f.evidence.map((e) => e.evidence_id).join(", ")}</p>
      )}
      <p className="mt-1 text-xs text-neutral-500">
        Risk: not scored under this framework · confidence {f.confidence.label}
      </p>
      {f.rationale && <p className="mt-1 text-xs italic text-neutral-600">{f.rationale}</p>}

      <textarea
        value={rec}
        onChange={(e) => setRec(e.target.value)}
        rows={2}
        placeholder="Recommendation (specific; 'consider'/'must' are rejected)"
        className="mt-3 w-full rounded border px-2 py-1.5 text-xs"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={1}
        placeholder="Reviewer note (optional)"
        className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {REVIEWER_STATUS_ACTIONS.map((s) => (
          <button
            key={s}
            disabled={busy}
            onClick={() => patch(s)}
            className="rounded border bg-neutral-50 px-2 py-1 text-xs hover:bg-neutral-100 disabled:opacity-40"
          >
            {humanizeEnum(s)}
          </button>
        ))}
        <button
          disabled={busy}
          onClick={() => patch()}
          className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-40"
        >
          save edits
        </button>
      </div>
    </div>
  );
}
