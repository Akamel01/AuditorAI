"use client";
// Project detail: stage card, inputs checklist with states + upload extraction,
// audit runs. The UI never shows canonical stages without the native label (ADR-0002).
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { InputValueState, Project } from "@/domain/types";

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
  const { id } = useParams<{ id: string }>();
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

  if (error) return <main className="mx-auto max-w-3xl px-6 py-12 text-red-600">{error}</main>;
  if (!project || !stageInfo)
    return <main className="mx-auto max-w-3xl px-6 py-12 text-neutral-500">Loading…</main>;

  const stage = stageInfo.stages.find(
    (s) => s.native_stage_id === project.stage_selection.native_stage_id,
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/projects" className="text-xs text-neutral-500 hover:underline">← Projects</Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{project.metadata.name}</h1>

      <section className="mt-4 rounded-lg border bg-neutral-50 p-4 text-sm">
        <div className="font-semibold">{stage?.display_name}</div>
        <div className="mt-1 text-neutral-600">{stage?.definition}</div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white border px-2 py-0.5">
            Framework: {stageInfo.framework.name} {stageInfo.framework.revision ? `(${stageInfo.framework.revision})` : ""}
          </span>
          <span className="rounded-full bg-white border px-2 py-0.5">
            Canonical: {stage?.canonical_stages.join(" + ") || "—"} · confidence: {stage?.confidence}
          </span>
        </div>
        {stage?.notes && <p className="mt-2 text-xs italic text-amber-700">{stage.notes}</p>}
        {stage && stage.evidence_ids.length > 0 && (
          <p className="mt-1 text-[11px] text-neutral-400">Evidence: {stage.evidence_ids.join(", ")}</p>
        )}
      </section>

      <InputsEditor project={project} onChanged={load} />

      <AuditsSection projectId={project.project_id} />
    </main>
  );
}

function InputsEditor({ project, onChanged }: { project: Project; onChanged: () => void }) {
  const [inputs, setInputs] = useState<
    { input_id: string; label: string; requirement_level: string; description?: string; conditional_on?: string | null; stage_ids: string[]; evidence_ids: string[] }[]
  >([]);
  useEffect(() => {
    api<{
      inputs: { input_id: string; label: string; requirement_level: string; description?: string; conditional_on?: string | null; stage_ids: string[]; evidence_ids: string[] }[];
    }>(`/api/inputs/${project.stage_selection.jurisdiction}`).then((d) =>
      setInputs(
        d.inputs.filter((i) => i.stage_ids.includes(project.stage_selection.native_stage_id)),
      ),
    );
  }, [project.stage_selection.jurisdiction, project.stage_selection.native_stage_id]);

  async function setInput(inputId: string, state: InputValueState, value?: string) {
    await api(`/api/projects/${project.project_id}`, {
      method: "PATCH",
      json: { input_values: { [inputId]: { state, value: value ?? "" } } },
    });
    onChanged();
  }

  async function uploadFor(inputId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const key = localStorage.getItem("auditorai.workspace_key") ?? "";
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "x-workspace-key": key },
      body: form,
    });
    const data = (await res.json()) as { extracted_text?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? "upload failed");
    await setInput(inputId, "provided", data.extracted_text ?? "");
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Stage inputs</h2>
      <p className="text-xs text-neutral-500">
        States follow §27: Provided / Required / Recommended / Optional / Unknown / Not
        Applicable / Not Available / Conflicting — Unknown is never treated as No.
      </p>
      <ul className="mt-3 space-y-3">
        {inputs.map((i) => {
          const current = project.input_values[i.input_id];
          const state: InputValueState = current?.state ??
            (i.requirement_level === "required"
              ? "required_missing"
              : i.requirement_level === "recommended"
                ? "recommended_missing"
                : i.requirement_level === "optional"
                  ? "optional_missing"
                  : "unknown");
          return (
            <li key={i.input_id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-medium">{i.label}</span>
                  <span
                    className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] ${
                      state === "provided"
                        ? "border-green-300 bg-green-50 text-green-800"
                        : state.includes("missing")
                          ? "border-orange-300 bg-orange-50 text-orange-800"
                          : "border-neutral-300 bg-white text-neutral-600"
                    }`}
                  >
                    {state.replace("_", " ")}
                  </span>
                  {i.conditional_on && (
                    <span className="ml-1 text-[11px] text-neutral-400">if {i.conditional_on}</span>
                  )}
                </div>
                <select
                  className="rounded border px-2 py-1 text-xs"
                  value={state === "required_missing" || state === "recommended_missing" || state === "optional_missing" ? "" : state}
                  onChange={(e) => {
                    const v = e.target.value as InputValueState;
                    if (v) setInput(i.input_id, v);
                  }}
                >
                  <option value="">— missing ({i.requirement_level}) —</option>
                  {STATE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {(state === "provided" || current?.value) && (
                <>
                  <textarea
                    defaultValue={current?.value ?? ""}
                    onBlur={(e) => setInput(i.input_id, "provided", e.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded border px-2 py-1.5 text-sm"
                    placeholder="Paste or edit the provided information…"
                  />
                  <label className="mt-1 inline-block cursor-pointer text-[11px] text-blue-600 underline">
                    upload PDF/TXT/MD → extract text
                    <input
                      type="file"
                      accept=".pdf,.txt,.md"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadFor(i.input_id, f).catch((err) => alert(err.message));
                      }}
                    />
                  </label>
                </>
              )}
              {i.evidence_ids.length > 0 && (
                <p className="mt-1 text-[11px] text-neutral-400">Evidence: {i.evidence_ids.join(", ")}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AuditsSection({ projectId }: { projectId: string }) {
  const [audits, setAudits] = useState<{ audit_id: string; ran_at: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ audits: { audit_id: string; ran_at: string }[] }>(`/api/projects/${projectId}/audits`)
      .then((d) => setAudits(d.audits))
      .catch(() => setAudits([]));
  }, [projectId]);
  useEffect(load, [load]);

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Audits</h2>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const d = await api<{ audit: { audit_id: string } }>(
              `/api/projects/${projectId}/audits`,
              { method: "POST" },
            );
            location.href = `/projects/${projectId}/audits/${d.audit.audit_id}`;
          } catch (e) {
            alert(String((e as Error).message));
          } finally {
            setBusy(false);
          }
        }}
        className="mt-2 rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {busy ? "Running…" : "Run audit"}
      </button>
      <ul className="mt-3 space-y-2 text-sm">
        {audits.map((a) => (
          <li key={a.audit_id}>
            <Link
              href={`/projects/${projectId}/audits/${a.audit_id}`}
              className="text-blue-700 underline"
            >
              {a.audit_id}
            </Link>{" "}
            <span className="text-xs text-neutral-500">{new Date(a.ran_at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
