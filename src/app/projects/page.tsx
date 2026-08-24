"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { stageDisplay } from "@/app/_components/stage-label";
import type { Project } from "@/domain/types";
import { AppShell } from "@/app/_components/ui/app-shell";
import { Eyebrow } from "@/app/_components/ui/chips";
import { Button } from "@/app/_components/ui/button";
import { Panel } from "@/app/_components/ui/panel";
import { EmptyState, LoadingRows } from "@/app/_components/ui/empty-state";
import { InlineNotice } from "@/app/_components/ui/inline-notice";
import { ArrowRight, Plus, Road } from "@/app/_components/ui/icons";

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
    <AppShell>
      <div className="pt-10">
        <Eyebrow code="CH 0+000">Workspace</Eyebrow>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-[26px] font-semibold leading-tight">Projects</h1>
          {projects && projects.length > 0 && (
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
              {projects.length} scheme{projects.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <NewProjectForm onCreated={load} />

        {error && (
          <div className="mt-5">
            <InlineNotice>{error}</InlineNotice>
          </div>
        )}

        {!projects && !error && (
          <div className="mt-8">
            <LoadingRows rows={3} />
          </div>
        )}

        {projects && projects.length === 0 && (
          <div className="mt-8">
            <EmptyState
              icon={<Road size={28} />}
              title="No projects yet"
              hint="Create a project above: name the scheme, choose the jurisdiction and framework, and pick the native stage the audit will examine."
            />
          </div>
        )}

        {projects && projects.length > 0 && (
          <ul className="mt-6 overflow-hidden rounded-md border border-hairline bg-surface">
            {projects.map((p) => {
              return (
                <li key={p.project_id} className="border-b border-hairline last:border-b-0">
                  <Link
                    href={`/projects/${p.project_id}`}
                    className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3.5 no-underline transition-colors duration-150 hover:bg-sunken"
                  >
                    <span className="text-[14px] font-medium text-text">{p.metadata.name}</span>
                    <span className="font-mono text-[11px] text-subtle">
                      {p.stage_selection.jurisdiction} · {p.stage_selection.native_stage_id}
                    </span>
                    <span className="ml-auto font-mono text-[10.5px] text-faint">
                      updated {new Date(p.updated_at).toLocaleString()}
                    </span>
                    <ArrowRight
                      size={13}
                      className="self-center text-faint transition-transform duration-200 ease-[cubic-bezier(.2,0,0,1)] group-hover:translate-x-0.5 group-hover:text-subtle"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

const FORM_LABEL =
  "block text-[11px] font-medium uppercase tracking-[0.1em] text-subtle";

function NewProjectForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(true);
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

  const inputCls =
    "mt-1.5 h-9 w-full rounded-md border border-edge bg-surface px-2.5 text-[13.5px] text-text transition-colors duration-150 placeholder:text-faint hover:border-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-tint";

  return (
    <Panel className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left text-[13.5px] font-medium text-text transition-colors hover:bg-sunken"
      >
        <Plus size={15} className="text-subtle" />
        New project
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
          {open ? "close" : "scheme · jurisdiction · stage"}
        </span>
      </button>

      {open && (
        <form
          className="border-t border-hairline p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              await api("/api/projects", {
                method: "POST",
                json: { name, jurisdiction: jur, native_stage_id: stageId },
              });
              setName("");
              setJur("");
              setStageId("");
              onCreated();
            } catch (e2) {
              setErr(String((e2 as Error).message));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={FORM_LABEL}>
              Project name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Mill Road junction upgrade"
                className={inputCls}
              />
            </label>
            <label className={FORM_LABEL}>
              Jurisdiction → framework
              {/* first select in the DOM is the jurisdiction (e2e contract) */}
              <select
                value={jur}
                onChange={(e) => setJur(e.target.value)}
                required
                className={`${inputCls} appearance-none bg-[image:none]`}
              >
                <option value="">Select…</option>
                {jurisdictions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label} — {j.framework_name}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${FORM_LABEL} sm:col-span-2`}>
              Native stage · shown with its canonical mapping in the project
              <select
                id="stage-select"
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                required
                disabled={!stages.length}
                className={`${inputCls} appearance-none disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <option value="">{stages.length ? "Select…" : "Choose a jurisdiction first"}</option>
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
          {err && (
            <div className="mt-3">
              <InlineNotice>{err}</InlineNotice>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" variant="primary" loading={busy}>
              {busy ? "Creating…" : "Create project"}
            </Button>
            <span className="font-mono text-[10.5px] text-faint">
              stage semantics follow the framework’s own vocabulary
            </span>
          </div>
        </form>
      )}
    </Panel>
  );
}
