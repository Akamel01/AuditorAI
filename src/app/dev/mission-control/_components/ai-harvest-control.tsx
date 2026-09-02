"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/client";

type Stream = {
  id: string;
  status: string;
  cellKey: string | null;
  live: boolean;
  iteration: number;
  maxIterations: number;
  coverage: unknown;
  packages: unknown[];
  quality: unknown[];
  logs: Array<{ at: string; node: string; message: string }>;
  error: string | null;
};

export function AiHarvestControl() {
  const [streamId, setStreamId] = useState<string | null>(null);
  const [stream, setStream] = useState<Stream | null>(null);
  const [cellKey, setCellKey] = useState("");
  const [live, setLive] = useState(true);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function start() {
    setBusy(true);
    try {
      const res = await adminApi<{ streamId: string; stream: Stream }>("/api/dev/harvest-stream", {
        method: "POST",
        body: JSON.stringify({ live, cellKey: cellKey || null }),
      });
      setStreamId(res.streamId);
      setStream(res.stream);
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    if (!streamId) return;
    const res = await adminApi<{ stream: Stream }>(`/api/dev/harvest-stream/${streamId}/pause`, { method: "POST" });
    setStream(res.stream);
  }

  async function resume() {
    if (!streamId) return;
    const res = await adminApi<{ stream: Stream }>(`/api/dev/harvest-stream/${streamId}/resume`, { method: "POST" });
    setStream(res.stream);
  }

  async function stop() {
    if (!streamId) return;
    const res = await adminApi<{ stream: Stream }>(`/api/dev/harvest-stream/${streamId}/stop`, { method: "POST" });
    setStream(res.stream);
  }

  useEffect(() => {
    if (!streamId) return;
    const tick = async () => {
      try {
        const res = await adminApi<{ stream: Stream }>(`/api/dev/harvest-stream/${streamId}`);
        setStream(res.stream);
        if (res.stream.status === "DONE" || res.stream.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    };
    // ponytail: 2s poll ceiling — per-jurisdiction SSE if throughput matters
    pollRef.current = setInterval(tick, 2000);
    tick();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [streamId]);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">AI Harvest Stream — gpt-5-nano web search</h3>
      <div className="flex gap-2">
        <input
          placeholder="cellKey e.g. uk:PRELIMINARY_DESIGN or empty for gap-aware"
          value={cellKey}
          onChange={(e) => setCellKey(e.target.value)}
          className="flex-1 rounded border px-2 py-1 text-sm"
        />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> live
        </label>
        <button onClick={start} disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50">
          Start
        </button>
        <button onClick={pause} disabled={!stream || stream.status !== "RUNNING"} className="rounded border px-3 py-1 text-sm">
          Pause
        </button>
        <button onClick={resume} disabled={!stream || stream.status !== "PAUSED"} className="rounded border px-3 py-1 text-sm">
          Resume
        </button>
        <button onClick={stop} disabled={!stream || stream.status === "DONE" || stream.status === "FAILED"} className="rounded border px-3 py-1 text-sm">
          Stop
        </button>
      </div>

      {stream && (
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-mono">{stream.id.slice(0, 12)}</span> · {stream.status} · iter {stream.iteration}/{stream.maxIterations} · packages {stream.packages.length} · live {String(stream.live)}
          </div>
          <div className="text-xs text-gray-600">cellKey: {stream.cellKey ?? "gap-aware"} · error: {stream.error ?? "—"}</div>
          <div className="max-h-48 overflow-auto rounded bg-gray-50 p-2 font-mono text-xs">
            {stream.logs.slice(-20).map((l, i) => (
              <div key={i}>
                {l.at.slice(11, 19)} {l.node}: {l.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        Model: opencode/gpt-5-nano · Web search via LLM · Never stops till verified (coverage/quality gates) · Poll 2s
      </div>
    </div>
  );
}
