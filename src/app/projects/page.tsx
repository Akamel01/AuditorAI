"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { stageDisplay } from "@/app/_components/stage-label";
import type { Project } from "@/domain/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<{ projects: Project[] }>("/api/projects");
      setProjects(data.projects);
    } catch (e) {
      setError(String((e as Error).message));
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
      <NewProjectForm onCreated={load} />
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {projects && projects.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">No projects yet.</p>
      )}
      <ul className="mt-6 space-y-3">
        {projects?.map((p) => (
          <li key={p.project_id} className="rounded-lg border p-4 hover:bg-neutral-50">
            <Link href={`/projects/${p.project_id}`} className="block">
              <div className="font-medium">{p.metadata.name}</div>
              <div className="text-xs text-neutral-500">
                {p.stage_selection.jurisdiction} · {p.stage_selection.native_stage_id} ·
                updated {new Date(p.updated_at).toLocaleString()}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function NewProjectForm({ onCreated }: { onCreated: () => void }) {
  const [jurisdictions, setJurisdictions] = useState<
    { id: string; label: string; framework_name: string; framework_status: string }[]
  >([]);
  const [stages, setStages] = useState<
    { native_stage_id: string; display_name: string; canonical_stages: string[]; mvp_scope: boolean; confidence: string }[]
  >([]);
  const [jur, setJur] = useState<string>("");
  const [stageId, setStageId] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{
      jurisdictions: { id: string; label: string; framework_name: string; framework_status: string }[];
    }>("/api/jurisdictions")
      .then((d) => setJurisdictions(d.jurisdictions))
      .catch(() => setJurisdictions([]));
  }, []);
  useEffect(() => {
    if (!jur) return;
    setStages([]);
    setStageId("");
    api<{ stages: typeof stages }>(`/api/jurisdictions/${jur}/stages`).then((d) =>
      setStages(d.stages.filter((s) => s.mvp_scope)),
    );
  }, [jur]);

  return (
    <form
      className="mt-6 space-y-3 rounded-lg border bg-neutral-50 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api("/api/projects", {
            method: "POST",
            json: {
              name,
              jurisdiction: jur,
              native_stage_id: stageId,
            },
          });
          setName("");
          onCreated();
        } catch (e2) {
          setErr(String((e2 as Error).message));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-neutral-700">
          Project name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Mill Road junction upgrade"
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs font-medium text-neutral-700">
          Jurisdiction → Framework
          <select
            value={jur}
            onChange={(e) => setJur(e.target.value)}
            required
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          >
            <option value="">Select…</option>
            {jurisdictions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label} — {j.framework_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-neutral-700 sm:col-span-2">
          Native stage (shown with canonical mapping in the project)
          <select id="stage-select" value={stageId} onChange={(e) => setStageId(e.target.value)} required disabled={!stages.length}
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm">
            <option value="">Select…</option>
            {stages.map((s) => {
              const t = stageDisplay({
                nativeLabel: s.display_name,
                canonicalStages: s.canonical_stages,
                confidence: s.confidence,
              });
              return (
                <option key={s.native_stage_id} value={s.native_stage_id}>
                  {t.nativeLabel} · mapping confidence: {t.confidence}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        disabled={busy || !jur || !name}
        className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
