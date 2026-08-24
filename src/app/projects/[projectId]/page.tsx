"use client";
// Project detail: title block, stage card, inputs checklist with states +
// upload extraction, audit runs. The UI never shows canonical stages without
// the native label (ADR-0002).
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { humanizeEnum } from "@/lib/format";
import { shrinkImage } from "@/lib/image";
import {
  deriveInputState,
  filterInputsForStage,
  mergeAttachment,
  selectValueFor,
} from "@/domain/input-states";
import { stageDisplay } from "@/app/_components/stage-label";
import type { Attachment, InputValueState, Project } from "@/domain/types";
import { AppShell } from "@/app/_components/ui/app-shell";
import { ConfidenceMark, Eyebrow, StateChip } from "@/app/_components/ui/chips";
import { Button } from "@/app/_components/ui/button";
import { Panel } from "@/app/_components/ui/panel";
import { EmptyState, LoadingRows, Skeleton } from "@/app/_components/ui/empty-state";
import { InlineNotice } from "@/app/_components/ui/inline-notice";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Layers,
  Paperclip,
  Pin,
  Road,
  Spinner,
  Upload,
  X,
} from "@/app/_components/ui/icons";

interface StageInfo {
  framework: { name: string; publisher: string; revision: string | null; status: string; qualification_note: string | null };
  stages: {
    native_stage_id: string;
    display_name: string;
    definition: string;
    canonical_stages: string[];
    confidence: string;
    mvp_scope: boolean;
    notes: string | null;
    evidence_ids: string[];
  }[];
}

const STATE_OPTIONS: { value: InputValueState; label: string }[] = [
  { value: "provided", label: "Provided" },
  { value: "unknown", label: "Unknown" },
  { value: "not_applicable", label: "Not applicable" },
  { value: "not_available", label: "Not available" },
];

export default function ProjectPage() {
  const { projectId: id } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [stageInfo, setStageInfo] = useState<StageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ project: Project }>(`/api/projects/${id}`);
      setProject(d.project);
      const s = await api<StageInfo>(
        `/api/jurisdictions/${d.project.stage_selection.jurisdiction}/stages`,
      );
      setStageInfo(s);
    } catch (e) {
      setError(String((e as Error).message));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <AppShell>
        <div className="pt-12">
          <InlineNotice>{error}</InlineNotice>
        </div>
      </AppShell>
    );

  if (!project || !stageInfo)
    return (
      <AppShell>
        <div className="pt-12">
          <Skeleton className="h-8 w-1/2" />
          <div className="mt-6">
            <LoadingRows rows={4} />
          </div>
        </div>
      </AppShell>
    );

  const stage = stageInfo.stages.find(
    (s) => s.native_stage_id === project.stage_selection.native_stage_id,
  );
  const pairing = stage
    ? stageDisplay({
        nativeLabel: stage.display_name,
        canonicalStages: stage.canonical_stages,
        confidence: stage.confidence,
      })
    : null;

  return (
    <AppShell>
      <div className="pt-8">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-faint no-underline transition-colors hover:text-subtle"
        >
          <ArrowLeft size={13} />
          Projects
        </Link>

        {/* title block */}
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline md:grid-cols-4">
          <TitleCell k="Scheme" v={project.metadata.name} />
          <TitleCell
            k="Framework"
            v={
              <>
                {stageInfo.framework.name}
                {stageInfo.framework.revision ? (
                  <span className="mono ml-1.5 text-[11px] text-subtle">({stageInfo.framework.revision})</span>
                ) : null}
              </>
            }
          />
          <TitleCell k="Native stage" v={stage?.display_name ?? project.stage_selection.native_stage_id} />
          <TitleCell
            k="Canonical map"
            v={
              <span className="flex flex-wrap items-center gap-2">
                <span className="mono text-[11.5px]">{pairing ? pairing.canonicalText : "—"}</span>
                {stage && <ConfidenceMark confidence={stage.confidence} />}
              </span>
            }
          />
        </div>

        {/* stage definition */}
        {stage && (
          <Panel className="mt-4 p-4">
            <div className="flex items-start gap-3">
              <Pin size={16} className="mt-1 shrink-0 text-subtle" />
              <div className="min-w-0">
                <p className="text-[13.5px] leading-relaxed text-muted">{stage.definition}</p>
                {stage.notes && (
                  <p className="formal mt-2 text-[14px] leading-relaxed text-warn">{stage.notes}</p>
                )}
                {stage.evidence_ids.length > 0 && (
                  <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-faint">
                    Evidence: {stage.evidence_ids.join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </Panel>
        )}

        <InputsEditor project={project} onChanged={load} />

        <AuditsSection projectId={project.project_id} />
      </div>
    </AppShell>
  );
}

function TitleCell({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">{k}</div>
      <div className="mt-1.5 text-[13px] font-medium leading-snug" title={typeof v === "string" ? v : undefined}>
        {v}
      </div>
    </div>
  );
}

/* ————— inputs ————— */

interface InputDef {
  input_id: string;
  label: string;
  requirement_level: string;
  description?: string;
  conditional_on?: string | null;
  stage_ids: string[];
  evidence_ids: string[];
}

function InputsEditor({ project, onChanged }: { project: Project; onChanged: () => void }) {
  const [inputs, setInputs] = useState<InputDef[]>([]);
  useEffect(() => {
    api<{ inputs: InputDef[] }>(`/api/inputs/${project.stage_selection.jurisdiction}`).then((d) =>
      setInputs(filterInputsForStage(d.inputs, project.stage_selection.native_stage_id)),
    );
  }, [project.stage_selection.jurisdiction, project.stage_selection.native_stage_id]);

  async function setInput(inputId: string, state: InputValueState, value?: string) {
    await api(`/api/projects/${project.project_id}`, {
      method: "PATCH",
      json: { input_values: { [inputId]: { state, value: value ?? "" } } },
    });
    onChanged();
  }

  // A `provided` claim needs substance before it can be written (server
  // rejects unsubstantiated ones). Selecting Provided only reveals the local
  // editing affordances; the first substantive action performs the write.
  const [pendingProvided, setPendingProvided] = useState<string[]>([]);
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const failInput = (inputId: string, err: unknown) =>
    setInputErrors((prev) => ({ ...prev, [inputId]: String((err as Error).message) }));
  const hasSubstance = (inputId: string) => {
    const v = project.input_values[inputId];
    return !!v?.value?.trim() || !!(v?.attachments && v.attachments.length > 0);
  };
  const revealProvided = (inputId: string) =>
    setPendingProvided((p) => (p.includes(inputId) ? p : [...p, inputId]));
  const settleProvided = (inputId: string) =>
    setPendingProvided((p) => p.filter((x) => x !== inputId));

  async function uploadFor(inputId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const data = await api<{ extracted_text?: string }>("/api/upload", {
      method: "POST",
      body: form,
    });
    const text = data.extracted_text ?? "";
    if (!text.trim() && !hasSubstance(inputId)) {
      throw new Error(
        "no text could be extracted — paste a summary or attach the document as an image instead",
      );
    }
    await setInput(inputId, "provided", text);
  }

  async function attachImage(inputId: string, file: File) {
    const shrunk = await shrinkImage(file);
    const form = new FormData();
    form.append("kind", "image");
    form.append("project_id", project.project_id);
    form.append("input_id", inputId);
    form.append("file", new File([shrunk], file.name || "pasted-image.png", { type: shrunk.type }));
    const data = await api<{ attachment?: Attachment }>("/api/upload", {
      method: "POST",
      body: form,
    });
    if (!data.attachment) throw new Error("attach failed");
    const current = project.input_values[inputId];
    await api(`/api/projects/${project.project_id}`, {
      method: "PATCH",
      json: {
        input_values: {
          [inputId]: {
            state: "provided" as InputValueState,
            value: current?.value ?? "",
            attachments: mergeAttachment(current?.attachments, data.attachment.attachment_id),
          },
        },
      },
    });
    settleProvided(inputId);
    onChanged();
  }

  async function detachImage(inputId: string, attachmentId: string) {
    await api(`/api/projects/${project.project_id}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    onChanged();
  }

  const provided = inputs.filter((i) => {
    const s = deriveInputState(i.requirement_level, project.input_values[i.input_id]);
    return s === "provided";
  }).length;

  return (
    <section className="mt-10">
      <Eyebrow code="CH 0+030">
        Stage inputs — {provided}/{inputs.length} provided
      </Eyebrow>
      <p className="-mt-2 mb-4 max-w-[74ch] text-[12.5px] leading-relaxed text-subtle">
        States are explicit and never guessed: Unknown is never treated as No, and a “provided”
        claim needs substance before it is recorded.
      </p>

      {inputs.length === 0 && (
        <EmptyState
          icon={<Layers size={26} />}
          title="No stage inputs defined"
          hint="This framework and stage combination declares no required inputs — the audit will run on process rules and stage questions alone."
        />
      )}

      <ul className="space-y-2.5">
        {inputs.map((i) => {
          const current = project.input_values[i.input_id];
          const state: InputValueState = deriveInputState(i.requirement_level, current);
          const expanded = state === "provided" || !!current?.value || pendingProvided.includes(i.input_id);
          return (
            <li key={i.input_id}>
              <Panel className={expanded ? "" : "transition-colors duration-150 hover:border-edge"}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <span className="text-[13.5px] font-medium">{i.label}</span>
                  <StateChip state={state} label={humanizeEnum(state)} />
                  {i.conditional_on && (
                    <span className="font-mono text-[10.5px] text-faint">if {i.conditional_on}</span>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                      {i.requirement_level}
                    </span>
                    <select
                      aria-label={`State of ${i.label}`}
                      className="h-7 cursor-pointer rounded-[5px] border border-edge bg-surface px-1.5 font-mono text-[11px] text-muted transition-colors hover:border-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-tint"
                      value={selectValueFor(state)}
                      onChange={(e) => {
                        const v = e.target.value as InputValueState;
                        if (!v) return;
                        if (v === "provided" && !hasSubstance(i.input_id)) {
                          revealProvided(i.input_id);
                          return;
                        }
                        settleProvided(i.input_id);
                        setInput(i.input_id, v);
                      }}
                    >
                      <option value="">— missing ({i.requirement_level}) —</option>
                      {STATE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>

                {expanded && (
                  <div className="border-t border-hairline px-4 py-3">
                    <textarea
                      defaultValue={current?.value ?? ""}
                      onBlur={(e) => {
                        if (!e.target.value.trim() && !hasSubstance(i.input_id)) return;
                        settleProvided(i.input_id);
                        setInput(i.input_id, "provided", e.target.value);
                      }}
                      onPaste={(e) => {
                        const img = Array.from(e.clipboardData.items).find((it) =>
                          it.type.startsWith("image/"),
                        );
                        if (img) {
                          e.preventDefault();
                          const f = img.getAsFile();
                          if (f) attachImage(i.input_id, f).catch((err) => failInput(i.input_id, err));
                        }
                      }}
                      rows={3}
                      className="w-full resize-y rounded-md border border-edge bg-surface px-3 py-2 text-[13px] leading-relaxed text-text transition-colors placeholder:text-faint hover:border-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-tint"
                      placeholder="Paste or edit the provided information… (paste an image to attach a drawing)"
                    />

                    {current?.attachments && current.attachments.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2.5">
                        {current.attachments.map((attId) => (
                          <AttachmentThumb
                            key={attId}
                            projectId={project.project_id}
                            attachmentId={attId}
                            onRemove={() => detachImage(i.input_id, attId).catch((err) => failInput(i.input_id, err))}
                          />
                        ))}
                      </div>
                    )}

                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px]">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-accent transition-colors hover:text-accent-strong">
                        <Upload size={12} />
                        upload PDF/TXT/MD → extract text
                        <input
                          type="file"
                          accept=".pdf,.txt,.md"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadFor(i.input_id, f).catch((err) => failInput(i.input_id, err));
                          }}
                        />
                      </label>
                      <label
                        className="inline-flex cursor-pointer items-center gap-1.5 text-accent transition-colors hover:text-accent-strong"
                        data-testid={`attach-${i.input_id}`}
                      >
                        <Paperclip size={12} />
                        attach image (PNG/JPEG/WebP, ≤500 KB)
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) attachImage(i.input_id, f).catch((err) => failInput(i.input_id, err));
                          }}
                        />
                      </label>
                    </div>

                    {i.evidence_ids.length > 0 && (
                      <p className="mt-2 font-mono text-[10.5px] text-faint">
                        Evidence: {i.evidence_ids.join(" · ")}
                      </p>
                    )}

                    {inputErrors[i.input_id] && (
                      <div className="mt-2.5">
                        <InlineNotice>{inputErrors[i.input_id]}</InlineNotice>
                      </div>
                    )}
                  </div>
                )}
              </Panel>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AttachmentThumb({
  projectId,
  attachmentId,
  onRemove,
}: {
  projectId: string;
  attachmentId: string;
  onRemove: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ file_name: string; bytes: number } | null>(null);
  useEffect(() => {
    api<{ attachment: { data_url: string; file_name: string; bytes: number } }>(
      `/api/projects/${projectId}/attachments/${attachmentId}`,
    )
      .then((d) => {
        setSrc(d.attachment.data_url);
        setMeta({ file_name: d.attachment.file_name, bytes: d.attachment.bytes });
      })
      .catch(() => setSrc(null));
  }, [projectId, attachmentId]);
  return (
    <div className="group relative rounded-md border border-hairline bg-surface p-1" data-testid={`thumb-${attachmentId}`}>
      {src ? (
        <img src={src} alt={meta?.file_name ?? attachmentId} className="h-16 w-24 rounded-[4px] object-cover" />
      ) : (
        <Skeleton className="h-16 w-24" />
      )}
      <div className="mt-1 max-w-24 truncate font-mono text-[9.5px] text-faint">
        {meta ? `${meta.file_name} · ${Math.round(meta.bytes / 1000)} KB` : attachmentId}
      </div>
      <button
        onClick={onRemove}
        aria-label={`Remove ${attachmentId}`}
        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 cursor-pointer place-items-center rounded-full border border-edge bg-surface text-concern opacity-0 transition-opacity duration-150 hover:bg-concern-tint group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X size={11} />
      </button>
    </div>
  );
}

/* ————— audits ————— */

function AuditsSection({ projectId }: { projectId: string }) {
  const [audits, setAudits] = useState<{ audit_id: string; ran_at: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ audits: { audit_id: string; ran_at: string }[] }>(`/api/projects/${projectId}/audits`)
      .then((d) => setAudits(d.audits))
      .catch(() => setAudits([]));
  }, [projectId]);
  useEffect(load, [load]);

  return (
    <section className="mt-10 pb-4">
      <Eyebrow code="CH 0+060">Audit runs</Eyebrow>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const d = await api<{ audit: { audit_id: string } }>(
                `/api/projects/${projectId}/audits`,
                { method: "POST" },
              );
              location.href = `/projects/${projectId}/audits/${d.audit.audit_id}`;
            } catch (e) {
              setError(String((e as Error).message));
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <>
              <Spinner size={14} />
              Running audit…
            </>
          ) : (
            <>
              <Road size={14} />
              Run audit
            </>
          )}
        </Button>
        <p className="max-w-[56ch] text-[12.5px] leading-relaxed text-subtle">
          One run walks the whole alignment — input manifest, process rules, stage questions — and
          replaces the draft’s results.
        </p>
      </div>
      {error && (
        <div className="mt-3 max-w-[560px]">
          <InlineNotice>{error}</InlineNotice>
        </div>
      )}

      {audits.length > 0 && (
        <ul className="mt-5 overflow-hidden rounded-md border border-hairline bg-surface">
          {audits.map((a, idx) => (
            <li key={a.audit_id} className="border-b border-hairline last:border-b-0">
              <Link
                href={`/projects/${projectId}/audits/${a.audit_id}`}
                className="group flex items-center gap-3 px-4 py-3 no-underline transition-colors hover:bg-sunken"
              >
                <Clock size={14} className="shrink-0 text-faint" />
                <span className="font-mono text-[12px] text-text">{a.audit_id}</span>
                <span className="font-mono text-[10.5px] text-faint">
                  {new Date(a.ran_at).toLocaleString()}
                </span>
                {idx === 0 && (
                  <span className="rounded-full border border-accent-line bg-accent-tint px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-accent">
                    latest draft
                  </span>
                )}
                <ArrowRight
                  size={13}
                  className="ml-auto text-faint transition-transform duration-200 ease-[cubic-bezier(.2,0,0,1)] group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
