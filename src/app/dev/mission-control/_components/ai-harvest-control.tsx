"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/client";
import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow } from "@/app/_components/ui/chips";
import { InlineNotice } from "@/app/_components/ui/inline-notice";

export type Stream = {
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

export function AiHarvestControl({ onStream }: { onStream?: (s: Stream | null) => void }) {
  const [streamId, setStreamId] = useState<string | null>(null);
  const [stream, setStream] = useState<Stream | null>(null);
  const [cellKey, setCellKey] = useState("");
  const [live, setLive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function push(s: Stream | null) {
    setStream(s);
    onStream?.(s);
  }

  async function start() {
    setBusy(true);
    setErr(null);
    // clear previous poll before starting new stream
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      const res = await adminApi<{ streamId: string; stream: Stream }>("/api/dev/harvest-stream", {
        method: "POST",
        body: JSON.stringify({ live, cellKey: cellKey || null }),
      });
      setStreamId(res.streamId);
      push(res.stream);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pause() {
    if (!streamId) return;
    try {
      const res = await adminApi<{ stream: Stream }>(`/api/dev/harvest-stream/${streamId}/pause`, { method: "POST" });
      push(res.stream);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function resume() {
    if (!streamId) return;
    try {
      const res = await adminApi<{ stream: Stream }>(`/api/dev/harvest-stream/${streamId}/resume`, { method: "POST" });
      push(res.stream);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function stop() {
    if (!streamId) return;
    try {
      const res = await adminApi<{ stream: Stream }>(`/api/dev/harvest-stream/${streamId}/stop`, { method: "POST" });
      push(res.stream);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  useEffect(() => {
    if (!streamId) return;
    const tick = async () => {
      try {
        const res = await adminApi<{ stream: Stream }>(`/api/dev/harvest-stream/${streamId}`);
        push(res.stream);
        if (res.stream.status === "DONE" || res.stream.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch (e) {
        setErr((e as Error).message);
      }
    };
    // ponytail: 2s poll ceiling — per-jurisdiction SSE if throughput matters
    pollRef.current = setInterval(tick, 2000);
    tick();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [streamId]);

  const statusColor =
    stream?.status === "DONE"
      ? "text-ok"
      : stream?.status === "FAILED"
        ? "text-concern"
        : stream?.status === "RUNNING" || stream?.status === "VERIFYING"
          ? "text-accent"
          : "text-muted";
  const iterPct = stream ? Math.min(100, (stream.iteration / stream.maxIterations) * 100) : 0;

  return (
    <Panel className="space-y-4 px-4 py-4">
      <Eyebrow code="CH AI">AI Harvest Stream — gpt-5-nano web search</Eyebrow>
      <div className="flex flex-wrap gap-2">
        <input
          placeholder="cellKey e.g. uk:PRELIMINARY_DESIGN or empty for gap-aware"
          value={cellKey}
          onChange={(e) => setCellKey(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-hairline bg-surface px-3 py-1.5 font-mono text-[12px] text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          spellCheck={false}
          autoComplete="off"
        />
        <label className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
            aria-label="live web search via gpt-5-nano"
            className="h-3.5 w-3.5 rounded border-hairline text-accent focus:ring-accent"
          />
          live
        </label>
        <button
          onClick={start}
          disabled={busy}
          className="inline-flex items-center rounded-md bg-accent px-4 py-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-[color:var(--accent-contrast)] hover:bg-accent-strong disabled:bg-sunken disabled:text-faint active:scale-[0.98]"
        >
          {busy ? "Starting…" : "Start"}
        </button>
        <button
          onClick={pause}
          disabled={!stream || stream.status !== "RUNNING"}
          className="rounded-md border border-hairline bg-surface px-3 py-1.5 font-mono text-[11px] text-text hover:bg-sunken disabled:bg-sunken disabled:text-faint disabled:opacity-100"
        >
          Pause
        </button>
        <button
          onClick={resume}
          disabled={!stream || stream.status !== "PAUSED"}
          className="rounded-md border border-hairline bg-surface px-3 py-1.5 font-mono text-[11px] text-text hover:bg-sunken disabled:bg-sunken disabled:text-faint disabled:opacity-100"
        >
          Resume
        </button>
        <button
          onClick={stop}
          disabled={!stream || stream.status === "DONE" || stream.status === "FAILED"}
          className="rounded-md border border-hairline bg-surface px-3 py-1.5 font-mono text-[11px] text-text hover:bg-sunken disabled:bg-sunken disabled:text-faint disabled:opacity-100"
        >
          Stop
        </button>
      </div>

      {err && <InlineNotice>{err}</InlineNotice>}

      {stream && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="rounded bg-sunken px-1.5 py-0.5 text-text" title={stream.id}>
              {stream.id}
            </span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(stream.id)}
              className="rounded border border-hairline px-1.5 py-0.5 text-[10px] text-muted hover:bg-sunken"
            >
              copy
            </button>
            <span className={`font-semibold ${statusColor}`}>{stream.status}</span>
            {(stream.status === "RUNNING" || stream.status === "VERIFYING") && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden />
            )}
            <span className="text-muted">
              iter {stream.iteration}/{stream.maxIterations} · packages {stream.packages.length} · live {String(stream.live)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken ring-1 ring-hairline">
            <div className="h-full bg-accent transition-all" style={{ width: `${iterPct}%` }} />
          </div>
          <div className="font-mono text-[11px] text-muted">
            cellKey: <span className="text-text">{stream.cellKey ?? "gap-aware"}</span>
            {stream.error ? (
              <span className="text-concern"> · error: {stream.error}</span>
            ) : stream.status === "DONE" ? (
              <span className="text-ok"> · verified</span>
            ) : null}
          </div>
          <div className="max-h-48 overflow-auto rounded-md border border-hairline bg-sunken p-2 font-mono text-[11px] leading-snug text-muted">
            {stream.logs.slice(-20).map((l, i) => (
              <div key={i} className="whitespace-pre-wrap">
                {l.at.slice(11, 19)} {l.node}: {l.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="font-mono text-[10.5px] text-faint">
        Model: opencode/gpt-5-nano · Web search via LLM · Never stops till verified (coverage/quality gates) · Poll 2s
      </div>
    </Panel>
  );
}
