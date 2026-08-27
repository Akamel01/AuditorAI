"use client";

import { useState } from "react";
import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow, StateChip } from "@/app/_components/ui/chips";
import { adminApi, fetchHealth } from "@/lib/client";

export interface ProviderHealthProps {
  /** from GET /api/dev/discovery — array of { id, enabled } */
  providers: Array<{ id: string; enabled: boolean }>;
  /** optional override for the Run action; defaults to POST /api/dev/discovery/run { live: true } */
  onRun?: () => Promise<void>;
  /** optional last discover latency for display (ms); if omitted shows health ping after Doctor) */
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

const EXPECTED: Array<{ id: string; label: string; note: string }> = [
  { id: "seed-portals", label: "seed-portals", note: "offline backbone — always-on" },
  { id: "brave-search", label: "brave-search", note: "Keychain auditorai/discovery-brave · env DISCOVERY_BRAVE_API_KEY" },
  { id: "google-cse", label: "google-cse", note: "deprecated — allowlist only" },
];

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

export function ProviderHealth({ providers, onRun, lastLatencyMs = null }: ProviderHealthProps) {
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runOk, setRunOk] = useState<string | null>(null);

  const healthProviders = health?.providers ?? null;

  // derive latency display: prefer health ping max, else lastLatencyMs, else —
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
    setRunLoading(true);
    setRunError(null);
    setRunOk(null);
    try {
      if (onRun) {
        await onRun();
        setRunOk("run triggered");
      } else {
        await adminApi("/api/dev/discovery/run", { method: "POST", json: { live: true } });
        setRunOk("run triggered");
      }
    } catch (e) {
      setRunError((e as Error).message);
    } finally {
      setRunLoading(false);
    }
  }

  return (
    <div className="rounded-[1.5rem] bg-sunken/80 p-1.5 ring-1 ring-hairline">
      <Panel className="!rounded-[1.25rem] border-hairline bg-surface px-4 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)]">
        <Eyebrow code="CH 0+400">Provider health · discovery</Eyebrow>

        {/* provider badges */}
        <div className="space-y-2">
          {EXPECTED.map((exp) => {
            const found = findProvider(providers, exp.id);
            const isSeed = exp.id === "seed-portals";
            const isBrave = exp.id === "brave-search";
            const isDeprecated = exp.id === "google-cse";
            // For brave, enabled reflects Keychain; for seed always true; for deprecated show deprecated regardless of enabled flag
            const enabled = isSeed ? true : (found?.enabled ?? false);
            // latency per provider when health available
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

        {/* latency + rate-limit row */}
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

        {/* actions */}
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
            {runLoading ? "Running…" : "Run live harvest"}
          </button>
          {(doctorError || runError || runOk) && (
            <span className={`font-mono text-[11px] ${runError || doctorError ? "text-concern" : "text-ok"}`}>
              {doctorError ?? runError ?? runOk}
            </span>
          )}
        </div>

        <p className="mt-3 font-mono text-[10.5px] leading-snug text-faint">
          Brave Search is gated by <span className="text-subtle">Keychain auditorai/discovery-brave</span> (env{" "}
          <span className="text-subtle">DISCOVERY_BRAVE_API_KEY</span> fallback). Google CSE is deprecated [EV-AE-012]. Rate 1 rps / 2-conc per
          host (src/discovery/ratelimit.ts).
        </p>
      </Panel>
    </div>
  );
}

export default ProviderHealth;
