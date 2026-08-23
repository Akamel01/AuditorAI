"use client";
// Developer console (D3): Candidate-A layered DAG over the live pipeline
// registry, step controls, shared-state inspector/editor, AI toggle, replay.
// Guarded at the API layer by requireAdmin; this page holds no secrets —
// the admin key lives only in localStorage and travels per request.
import { useEffect, useMemo, useState } from "react";
import { adminApi, getAdminKey, setAdminKey } from "@/lib/client";
import { buildLayers } from "@/domain/pipeline/layout";
import type { NodeDescriptor } from "@/domain/pipeline/types";

interface RunInfo {
  runId: string;
  ranAtIso: string;
  batchOrder: string[];
}

const CLASS_COLORS: Record<string, string> = {
  deterministic: "#2563eb",
  "ai-bounded": "#9333ea",
  human: "#d97706",
};

export default function DevPage() {
  const [adminKey, setAdminKeyState] = useState("");
  const [projectJson, setProjectJson] = useState(SAMPLE_PROJECT);
  const [descriptors, setDescriptors] = useState<NodeDescriptor[]>([]);
  const [run, setRun] = useState<RunInfo | null>(null);
  const [state, setState] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState<NodeDescriptor | null>(null);
  const [executedIds, setExecutedIds] = useState<string[]>([]);
  const [aiOn, setAiOn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAdminKeyState(getAdminKey());
  }, []);

  function updateAdminKey(v: string) {
    setAdminKeyState(v);
    setAdminKey(v);
  }

  async function createRun() {
    setMessage(null);
    let project;
    try {
      project = JSON.parse(projectJson);
    } catch (e) {
      return setMessage(`invalid JSON: ${(e as Error).message}`);
    }
    let d: { runId: string; ranAtIso: string; batchOrder: string[]; descriptors: NodeDescriptor[] };
    try {
      d = await adminApi("/api/dev/runs", { method: "POST", json: { project } });
    } catch (e) {
      return setMessage(errText(e, "create failed"));
    }
    setRun({ runId: d.runId, ranAtIso: d.ranAtIso, batchOrder: d.batchOrder });
    setDescriptors(d.descriptors);
    setState({});
    setExecutedIds([]);
    setSelected(null);
  }

  async function step(nodeId: string) {
    if (!run) return;
    setMessage(null);
    let d: { state: Record<string, unknown>; trail: { nodeId: string }[] };
    try {
      d = await adminApi(`/api/dev/runs/${run.runId}/step`, {
        method: "POST",
        json: { nodeId, ai: aiOn && nodeId === "AG-AI-CANDIDATES" },
      });
    } catch (e) {
      return setMessage(`${nodeId}: ${errText(e, "step failed")}`);
    }
    setState(d.state);
    setExecutedIds(d.trail.map((t) => t.nodeId));
    const desc = descriptors.find((x) => x.id === nodeId);
    if (desc) setSelected(desc);
  }

  async function editSlice(slice: string, jsonText: string) {
    if (!run) return;
    setMessage(null);
    let value;
    try {
      value = JSON.parse(jsonText);
    } catch (e) {
      return setMessage(`invalid JSON: ${(e as Error).message}`);
    }
    try {
      const d = await adminApi<{ state: Record<string, unknown> }>(`/api/dev/runs/${run.runId}/edit`, {
        method: "POST",
        json: { slice, value },
      });
      setState(d.state);
    } catch (e) {
      setMessage(errText(e, "edit failed"));
    }
  }

  async function finish() {
    if (!run) return;
    try {
      const d = await adminApi<{ audit_id: string; stored: number }>(`/api/dev/runs/${run.runId}/finish`, {
        method: "POST",
      });
      setMessage(`archived ${d.audit_id} (${d.stored} artifacts)`);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }

  const layers = useMemo(() => buildLayers(descriptors), [descriptors]);

  return (
    <main className="flex h-screen flex-col md:flex-row">
      <section className="flex-1 overflow-auto bg-neutral-50 p-4">
        <h1 className="text-sm font-semibold text-neutral-600">Developer console — audit pipeline</h1>
        <div className="mt-2 flex flex-wrap items-start gap-2 text-xs">
          <textarea
            rows={4}
            className="w-full max-w-xl rounded border px-2 py-1 font-mono text-[11px]"
            value={projectJson}
            onChange={(e) => setProjectJson(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <input
              type="password"
              placeholder="ADMIN_KEY"
              value={adminKey}
              onChange={(e) => updateAdminKey(e.target.value)}
              className="rounded border px-2 py-1"
            />
            <button onClick={createRun} className="rounded bg-black px-3 py-1 text-white">
              Create session
            </button>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={aiOn} onChange={(e) => setAiOn(e.target.checked)} />
              AI adapter on for AG-AI-CANDIDATES
            </label>
            <button onClick={finish} disabled={!run} className="rounded border px-3 py-1 disabled:opacity-40">
              Finish &amp; archive trail
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-8" data-testid="dag">
          {layers.map((layerNodes, i) => (
            <div key={i} className="flex flex-wrap justify-center gap-5">
              {layerNodes.map((n) => (
                <button
                  key={n.id}
                  data-testid={`node-${n.id}`}
                  onClick={() => step(n.id)}
                  className={`w-48 rounded-lg border bg-white p-2 text-left shadow-sm hover:-translate-y-px ${
                    executedIds.includes(n.id) ? "border-green-500" : "border-neutral-300"
                  }`}
                >
                  <div className="text-[12px] font-semibold">{n.id}</div>
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: CLASS_COLORS[n.node_class] }}>
                    {n.node_class}
                    {n.executed_in_batch ? "" : " · step-only"}
                  </div>
                  <div className="mt-0.5 text-[10px] text-neutral-500">emits {n.emits}</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <aside className="flex w-full flex-col border-l bg-white md:w-[380px]">
        <header className="border-b px-4 py-2 text-sm font-semibold">
          {selected ? `${selected.id} — ${selected.name}` : "Click a node to execute + inspect"}
        </header>
        {selected && state && (
          <SliceEditor
            slice={firstWrite(selected)}
            value={JSON.stringify((state as Record<string, unknown>)[firstWrite(selected)] ?? null, null, 2)}
            onSave={editSlice}
          />
        )}
        <pre
          className="flex-1 overflow-auto p-3 font-mono text-[11px]"
          data-testid="inspector"
        >
          {selected
            ? JSON.stringify(
                {
                  descriptor: selected,
                  shared_state: state,
                },
                null,
                2,
              )
            : "—"}
        </pre>
        {message && <div className="border-t px-4 py-2 text-xs text-red-600">{message}</div>}
        <footer className="border-t px-4 py-2 text-[11px] text-neutral-500">
          Step = click node · edits replace slices whole · finish archives the N3 trail.
        </footer>
      </aside>
    </main>
  );
}

function firstWrite(d: NodeDescriptor): string {
  return d.writes[0] ?? "";
}

function errText(e: unknown, fallback: string): string {
  const msg = (e as Error).message;
  return /^Request failed \(\d+\)$/.test(msg) ? fallback : msg;
}

function SliceEditor({
  slice,
  value,
  onSave,
}: {
  slice: string;
  value: string;
  onSave: (slice: string, json: string) => Promise<void>;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  if (!slice) return null;
  return (
    <div className="border-b p-3">
      <div className="mb-1 text-[11px] font-medium text-neutral-600">Edit slice `{slice}`</div>
      <textarea
        rows={6}
        className="w-full rounded border px-2 py-1 font-mono text-[11px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        className="mt-1 rounded border px-2 py-1 text-xs"
        onClick={() => onSave(slice, text).catch(() => undefined)}
      >
        Save slice
      </button>
    </div>
  );
}

const SAMPLE_PROJECT = `{
  "project_id": "P-devdemo01",
  "workspace_key_hash": "devconsole",
  "metadata": {
    "name": "Dev console demo scheme",
    "description": "",
    "scheme_summary": "",
    "authority": "Demo",
    "location": ""
  },
  "stage_selection": { "jurisdiction": "UK", "native_stage_id": "uk:S2" },
  "input_values": {},
  "created_at": "2026-08-22T00:00:00.000Z",
  "updated_at": "2026-08-22T00:00:00.000Z"
}`;
