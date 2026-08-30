"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow, StateChip } from "@/app/_components/ui/chips";
import { adminApi, fetchHealth } from "@/lib/client";

export interface ProviderHealthProps {
  providers: Array<{ id: string; enabled: boolean }>;
  onRun?: () => Promise<void>;
  onJob?: (job: DiscoveryJob | null) => void;
  lastLatencyMs?: number | null;
}

type HealthPing = {
  id: string;
  enabled: boolean;
  ping: { ok: boolean; latencyMs: number | null; hits: number | null; error: string | null };
};

type HealthResult = {
  providers: HealthPing[];
  ledger?: { entries: number; lastAt: string | null; ageMs: number | null; ageHuman: string | null };
  ledgerAge?: { entries: number; lastAt: string | null; ageMs: number | null; ageHuman: string | null };
  topology?: { drift: boolean; details: string[] };
};

type DiscoveryJob = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  live: boolean;
  cellKey: string | null;
  providers: string[];
  createdAt: string;
  updatedAt: string;
  logs: Array<{ at: string; node: string; message: string }>;
  currentNode: string | null;
  result?: {
    ranAtIso: string;
    coverage: unknown;
    queue: unknown[];
    packages: unknown[];
    hits: unknown[];
    matched: unknown[];
    refusals: string[];
    quality: unknown[];
  };
  error?: string | null;
};

const EXPECTED: Array<{ id: string; label: string; note: string }> = [
  { id: "seed-portals", label: "seed-portals", note: "offline backbone — always-on" },
  { id: "brave-search", label: "brave-search", note: "Keychain auditorai/discovery-brave · env DISCOVERY_BRAVE_API_KEY" },
  { id: "google-cse", label: "google-cse", note: "deprecated — allowlist only" },
];

const JOB_STORAGE_KEY = "auditorai.discovery.jobId";

function findProvider(providers: ProviderHealthProps["providers"], id: string) {
  return providers.find((p) => p.id === id) ?? null;
}

function BraveBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <StateChip state="provided" label="enabled" />
  ) : (
    <StateChip state="unknown" label="disabled (no Keychain/env)" />
  );
}

function SeedBadge() {
  return <StateChip state="provided" label="ready" />;
}

function DeprecatedBadge() {
  return <StateChip state="not_applicable" label="deprecated" />;
}

export function ProviderHealth({ providers, onRun, onJob, lastLatencyMs = null }: ProviderHealthProps) {
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runOk, setRunOk] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<DiscoveryJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const healthProviders = health?.providers ?? null;

  const latencyDisplay = (() => {
    if (healthProviders) {
      const lat = healthProviders
        .map((p) => p.ping.latencyMs)
        .filter((n): n is number => typeof n === "number");
      if (lat.length) return `${Math.max(...lat)} ms`;
      return "—";
    }
    if (typeof lastLatencyMs === "number") return `${lastLatencyMs} ms`;
    return "—";
  })();

  const ledgerAgeHuman = health?.ledger?.ageHuman ?? health?.ledgerAge?.ageHuman ?? null;

  const [paused, setPaused] = useState(false);
  const isRunning = (job?.status === "queued" || job?.status === "running") && !paused;
  const runLoading = job?.status === "queued" || job?.status === "running";

  async function fetchJobById(id: string): Promise<DiscoveryJob | null> {
    try {
      const data = await adminApi<{ job: DiscoveryJob }>(`/api/dev/discovery/jobs/${encodeURIComponent(id)}`);
      return data.job ?? null;
    } catch {
      return null;
    }
  }

  function startPolling(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    setPaused(false);
    pollRef.current = setInterval(async () => {
      const j = await fetchJobById(id);
      if (!j) return;
      setJob(j);
      onJob?.(j);
      if (j.status === "done") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        const pkgCount = (j.result?.packages as unknown[])?.length ?? 0;
        const hitsCount = (j.result?.hits as unknown[])?.length ?? 0;
        setRunOk(`done · ${pkgCount} packages · ${hitsCount} hits · ${j.id.slice(0, 8)}`);
        setRunError(null);
        setPaused(false);
        if (onRun) {
          try {
            await onRun();
          } catch {}
        }
      } else if (j.status === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setRunError(j.error ?? "harvest failed");
        setRunOk(null);
        setPaused(false);
      }
    }, 1500);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function handleStop() {
    stopPolling();
    setPaused(true);
    setRunOk((prev) => prev ?? `paused · ${job?.id.slice(0, 8) ?? ""} — job continues`);
  }

  function handleResume() {
    if (!jobId || !job) return;
    setPaused(false);
    setRunOk(null);
    setRunError(null);
    startPolling(jobId);
  }

  // Restore persisted job on mount — survives refresh/tab switch
  useEffect(() => {
    const persisted = typeof window !== "undefined" ? localStorage.getItem(JOB_STORAGE_KEY) : null;
    if (!persisted) return;
    setJobId(persisted);
    void (async () => {
      const j = await fetchJobById(persisted);
      if (!j) {
        localStorage.removeItem(JOB_STORAGE_KEY);
        return;
      }
      setJob(j);
      onJob?.(j);
      if (j.status === "queued" || j.status === "running") {
        startPolling(j.id);
      } else if (j.status === "done") {
        const pkgCount = (j.result?.packages as unknown[])?.length ?? 0;
        setRunOk(`done · ${pkgCount} packages · ${j.id.slice(0, 8)}`);
      } else if (j.status === "error") {
        setRunError(j.error ?? "harvest failed");
      }
    })();
    return () => stopPolling();
  }, []);

  // Resume polling on tab visible
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible" && jobId && isRunning) {
        void fetchJobById(jobId).then((j) => {
          if (j) setJob(j);
        });
      }
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [jobId, isRunning]);

  async function handleDoctor() {
    setDoctorLoading(true);
    setDoctorError(null);
    try {
      const data = await fetchHealth<HealthResult>();
      setHealth(data);
    } catch (e) {
      setDoctorError((e as Error).message);
    } finally {
      setDoctorLoading(false);
    }
  }

  async function handleRun() {
    setRunError(null);
    setRunOk(null);
    setJob(null);
    try {
      if (onRun) {
        // onRun is now the parent reload; we still need to run harvest via jobs API
        // Fall through to jobs API path — parent onRun will be called again on job done
      }
      const data = await adminApi<{ jobId: string; status: string }>(`/api/dev/discovery/run`, {
        method: "POST",
        json: { live: true },
      });
      const id = (data as { jobId: string }).jobId;
      if (!id) throw new Error("no jobId returned");
      localStorage.setItem(JOB_STORAGE_KEY, id);
      setJobId(id);
      const queued: DiscoveryJob = {
        id,
        status: "queued",
        live: true,
        cellKey: null,
        providers: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        logs: [{ at: new Date().toISOString(), node: "D00-QUEUED", message: "queued" }],
        currentNode: "D01-DISCOVER",
        error: null,
      };
      setJob(queued);
      onJob?.(queued);
      startPolling(id);
    } catch (e) {
      setRunError((e as Error).message);
    }
  }

  // Derive running label
  const runningLabel = (() => {
    if (!job || !isRunning) return null;
    const node = job.currentNode ?? "queued";
    const lastLog = job.logs[job.logs.length - 1]?.message?.slice(0, 60) ?? "";
    return `${node} · ${lastLog}`;
  })();

  return (
    <div className="rounded-[1.5rem] bg-sunken/80 p-1.5 ring-1 ring-hairline">
      <Panel className="!rounded-[1.25rem] border-hairline bg-surface px-4 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)]">
        <Eyebrow code="CH 0+400">Provider health · discovery</Eyebrow>

        <div className="space-y-2">
          {EXPECTED.map((exp) => {
            const found = findProvider(providers, exp.id);
            const isSeed = exp.id === "seed-portals";
            const isBrave = exp.id === "brave-search";
            const isDeprecated = exp.id === "google-cse";
            const enabled = isSeed ? true : (found?.enabled ?? false);
            const healthEntry = healthProviders?.find((p) => p.id === exp.id) ?? null;
            const ping = healthEntry?.ping ?? null;

            return (
              <div
                key={exp.id}
                className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-sunken px-2.5 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-medium tracking-[0.04em] text-text">{exp.label}</span>
                    <span className="hidden font-mono text-[10px] text-faint sm:inline">· {exp.note}</span>
                  </div>
                  {ping && (
                    <div className="mt-0.5 font-mono text-[10px] leading-none text-faint">
                      {healthEntry?.enabled ? (
                        ping.ok ? (
                          <span>
                            ok · {ping.latencyMs !== null ? `${ping.latencyMs} ms` : "—"} · hits {ping.hits ?? "—"}
                          </span>
                        ) : (
                          <span className="text-concern">err · {ping.error?.slice(0, 80) ?? "unknown"}</span>
                        )
                      ) : (
                        <span>disabled (no credentials)</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {isSeed && <SeedBadge />}
                  {isBrave && <BraveBadge enabled={enabled} />}
                  {isDeprecated && <DeprecatedBadge />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-sunken px-2.5 py-[3px] font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            last discover latency: <span className="text-text">{latencyDisplay}</span>
            {ledgerAgeHuman && <span className="text-faint">· ledger {ledgerAgeHuman} ago</span>}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-[3px] font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
            1 rps / 2-conc
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">politeness · per host</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDoctor}
            disabled={doctorLoading}
            className="inline-flex cursor-pointer items-center rounded-md border border-edge bg-surface px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-text transition-[transform,opacity,border-color] duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-faint hover:bg-sunken disabled:opacity-50"
            aria-label="Doctor — ping providers via GET /api/dev/health"
          >
            {doctorLoading ? "Doctor…" : "Doctor"}
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={runLoading}
            className="inline-flex cursor-pointer items-center rounded-md bg-accent px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-[color:var(--accent-contrast)] transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-strong disabled:opacity-50"
            aria-label="Run one live harvest batch — POST /api/dev/discovery/run"
          >
            {runLoading ? `Running… ${job?.currentNode ?? ""}` : "Run live harvest"}
          </button>
          {isRunning && (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex cursor-pointer items-center rounded-md border border-hairline bg-surface px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-text hover:bg-sunken"
              aria-label="Stop polling — job continues server-side"
            >
              Stop
            </button>
          )}
          {paused && !isRunning && job && (job.status === "queued" || job.status === "running") && (
            <button
              type="button"
              onClick={handleResume}
              className="inline-flex cursor-pointer items-center rounded-md border border-accent bg-accent-tint px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-accent hover:bg-accent/10"
              aria-label="Resume polling"
            >
              Resume
            </button>
          )}
          {paused && (
            <span className="inline-flex items-center rounded-full border border-hairline bg-sunken px-2 py-[2px] font-mono text-[10px] tracking-[0.04em] text-subtle">paused — job continues</span>
          )}
          {(doctorError || runError || runOk) && (
            <span className={`font-mono text-[11px] ${runError || doctorError ? "text-concern" : "text-ok"}`}>
              {doctorError ?? runError ?? runOk}
            </span>
          )}
        </div>

        {/* persisted progress — survives refresh/tab switch */}
        {job && (
          <div className="mt-3 rounded-md border border-hairline bg-sunken px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-subtle">
                job {job.id.slice(0, 8)} · {job.status}
                {job.cellKey ? ` · ${job.cellKey}` : ""} · {job.live ? "live" : "dry"} · {job.providers.join(", ") || "—"}
              </span>
              <span className={`font-mono text-[10px] ${paused ? "text-warn" : job.status === "done" ? "text-ok" : job.status === "error" ? "text-concern" : "text-faint"}`}>
                {paused ? "paused" : job.status === "running" || job.status === "queued" ? "polling 1.5s" : job.updatedAt.slice(11, 19)}
              </span>
            </div>
            {isRunning && runningLabel && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface ring-1 ring-hairline">
                <div className="h-full w-[45%] animate-[shimmer_1.2s_ease-in-out_infinite] bg-accent/70" />
              </div>
            )}
            {isRunning && <p className="mt-1.5 font-mono text-[10.5px] leading-snug text-muted">{runningLabel}</p>}
            {/* log tail — last 5 lines */}
            <div className="mt-2 max-h-[120px] overflow-auto rounded bg-surface p-2 ring-1 ring-hairline">
              <div className="space-y-0.5 font-mono text-[10px] leading-snug text-faint">
                {job.logs.slice(-6).map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="shrink-0 text-subtle">{l.node}</span>
                    <span className="min-w-0 truncate text-muted">{l.message}</span>
                  </div>
                ))}
                {job.logs.length === 0 && <span className="text-faint">no logs yet</span>}
              </div>
            </div>
            {job.status === "done" && job.result && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] text-subtle ring-1 ring-hairline">
                  hits {(job.result.hits as unknown[])?.length ?? 0}
                </span>
                <span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] text-subtle ring-1 ring-hairline">
                  packages {(job.result.packages as unknown[])?.length ?? 0}
                </span>
                <span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] text-subtle ring-1 ring-hairline">
                  quality {(job.result.quality as unknown[])?.length ?? 0}
                </span>
                {job.result.refusals?.length ? (
                  <span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] text-concern ring-1 ring-hairline">
                    refusals {job.result.refusals.length}
                  </span>
                ) : null}
              </div>
            )}
            {job.status === "error" && job.error && (
              <p className="mt-2 font-mono text-[10.5px] leading-snug text-concern">{job.error.slice(0, 300)}</p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const j = await fetchJobById(job.id);
                  if (j) setJob(j);
                  if (onRun) await onRun();
                }}
                className="inline-flex cursor-pointer items-center rounded border border-hairline bg-surface px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] text-text hover:bg-sunken"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(JOB_STORAGE_KEY);
                  setJob(null);
                  setJobId(null);
                  stopPolling();
                  setRunOk(null);
                  setRunError(null);
                }}
                className="inline-flex cursor-pointer items-center rounded border border-hairline bg-surface px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] text-faint hover:bg-sunken"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <p className="mt-3 font-mono text-[10.5px] leading-snug text-faint">
          Brave Search is gated by <span className="text-subtle">Keychain auditorai/discovery-brave</span> (env <span className="text-subtle">DISCOVERY_BRAVE_API_KEY</span> fallback). Google CSE is deprecated [EV-AE-012]. Rate 1 rps / 2-conc per host (src/discovery/ratelimit.ts).
        </p>
      </Panel>
    </div>
  );
}

export default ProviderHealth;
