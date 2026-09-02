// wave A: parallel_safe = true; locks = []
"use client";

import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/app/_components/ui/app-shell";
import { Eyebrow } from "@/app/_components/ui/chips";
import { Segmented } from "@/app/_components/ui/segmented";
import { Panel } from "@/app/_components/ui/panel";
import { InlineNotice } from "@/app/_components/ui/inline-notice";
import { KpiStrip, type ReadinessReport } from "./_components/kpi-strip";
import { OddMatrix } from "./_components/odd-matrix";
import { ReadinessMeters } from "./_components/readiness-meters";
import { ProviderHealth } from "./_components/provider-health";
import { QueueTicker } from "./_components/queue-ticker";
import { DiscoveryStatus } from "./_components/discovery-status";
import { adminApi } from "@/lib/client";
import { HarvestLog, type LedgerEntry } from "./_components/harvest-log";
import { fetchCoverage, fetchDiscovery, fetchOdd, fetchReadiness, fetchTickets } from "@/lib/client";
import { TicketBoard } from "./_components/ticket-board";
import type { TicketIndex } from "@/wayfinder/ticket-types";
import { AiHarvestControl, type Stream as HarvestStream } from "./_components/ai-harvest-control";
import { AiHarvestViz } from "./_components/ai-harvest-viz";
import { getAdminKey, setAdminKey } from "@/lib/client";
import type { OddCoverageView } from "@/discovery/types";
import type { OddDeclaration } from "@/domain/odd";
import type { LearningMetrics } from "@/lib/learning-metrics";

type LatestJob = {
  id: string;
  status: string;
  result?: { coverage?: unknown; packages?: unknown[]; hits?: unknown[]; queue?: unknown[] };
} | null;

type Segment = "overview" | "discovery" | "odd" | "readiness" | "tickets" | "ai-harvest";

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "discovery", label: "Discovery" },
  { value: "odd", label: "ODD Matrix" },
  { value: "readiness", label: "Readiness" },
  { value: "tickets", label: "Tickets" },
  { value: "ai-harvest", label: "AI Harvest" },
];

type DiscoveryData = {
  ledgerTotal: number;
  lastAt: string | null;
  ledgerTail: LedgerEntry[];
  providers: { id: string; enabled: boolean }[];
  dedupe: unknown;
};

type ReadinessPayload = {
  readiness: ReadinessReport;
  learning: LearningMetrics & { outcomes_present?: boolean; note?: string };
  report?: ReadinessReport;
  metrics?: unknown;
};

function normalizeLearning(raw: unknown): LearningMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.total_outcomes === "number" && typeof r.promotion_rate !== "undefined") {
    return r as unknown as LearningMetrics;
  }
  return null;
}

function AiHarvestTab() {
  const [harvestStream, setHarvestStream] = useState<HarvestStream | null>(null);
  return (
    <div className="space-y-4">
      <AiHarvestControl onStream={setHarvestStream} />
      <AiHarvestViz stream={harvestStream} />
    </div>
  );
}

export default function MissionControlPage() {
  const [segment, setSegment] = useState<Segment>("overview");
  const [entered, setEntered] = useState(false);
  const [declaration, setDeclaration] = useState<OddDeclaration | null>(null);
  const [coverage, setCoverage] = useState<OddCoverageView | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [learning, setLearning] = useState<LearningMetrics | null>(null);
  const [discovery, setDiscovery] = useState<DiscoveryData | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [adminKeySaved, setAdminKeySaved] = useState(false);
  const [tickets, setTickets] = useState<TicketIndex | null>(null);
  const [latestJob, setLatestJob] = useState<LatestJob>(null);
  const [gapRunError, setGapRunError] = useState<string | null>(null);
  const [gapRun, setGapRun] = useState<{ id: string; status: string; cellKey: string | null } | null>(null);
  const gapPollRef = useRef<number | null>(null);

  async function handleRunGap(cellKey: string) {
    setGapRunError(null);
    try {
      const data = await adminApi<{ jobId: string; status: string }>(`/api/dev/discovery/run`, {
        method: "POST",
        json: { live: true, cellKey },
      });
      const id = (data as { jobId: string }).jobId;
      if (!id) throw new Error("no jobId returned");
      const queued = { id, status: (data as { jobId: string; status: string }).status ?? "queued", cellKey };
      setGapRun(queued);
      // visual confirmation: also seed latestJob so HarvestLog & coverage reflect live gap run immediately
      setLatestJob({ id, status: queued.status, result: undefined } as unknown as LatestJob);

      // start polling every 1.5s
      if (gapPollRef.current) window.clearInterval(gapPollRef.current);
      gapPollRef.current = window.setInterval(async () => {
        try {
          const j = await adminApi<{ job: LatestJob & { error?: string } }>(`/api/dev/discovery/jobs/${encodeURIComponent(id)}`);
          const job = (j as { job: LatestJob & { error?: string } })?.job ?? (j as unknown as LatestJob);
          const status = (job as { status: string })?.status ?? null;
          if (!status) return;
          setGapRun((g) => (g?.id === id ? { ...g, status } : g));
          // keep Mission Control live preview in sync
          if (job) setLatestJob(job as unknown as LatestJob);
          if (status === "done") {
            if (gapPollRef.current) clearInterval(gapPollRef.current);
            gapPollRef.current = null;
            setGapRun(null);
            await reload();
          } else if (status === "error") {
            if (gapPollRef.current) clearInterval(gapPollRef.current);
            gapPollRef.current = null;
            setGapRun(null);
            setGapRunError((job as { error?: string })?.error ?? "harvest failed");
          }
        } catch (e) {
          if (gapPollRef.current) clearInterval(gapPollRef.current);
          gapPollRef.current = null;
          setGapRun(null);
          setGapRunError((e as Error).message);
        }
      }, 1500);
    } catch (e) {
      setGapRunError((e as Error).message);
    }
  }

  useEffect(() => {
    return () => {
      if (gapPollRef.current) window.clearInterval(gapPollRef.current);
    };
  }, []);

  // ensure React namespace is available for type usage

  useEffect(() => {
    setEntered(true);
    setAdminKeyInput(getAdminKey());
  }, []);

  const reload = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [odd, cov, disc, red, tix] = await Promise.all([
        fetchOdd<OddDeclaration>(),
        fetchCoverage<OddCoverageView>(),
        fetchDiscovery<DiscoveryData>(),
        fetchReadiness<ReadinessPayload>(),
        fetchTickets<TicketIndex>(),
      ]);
      setDeclaration(odd);
      setCoverage(cov);
      setDiscovery(disc);
      setTickets(tix);
      const rep = (red as ReadinessPayload).readiness ?? (red as ReadinessPayload).report ?? null;
      if (rep) setReadiness(rep as ReadinessReport);
      setLearning(normalizeLearning((red as ReadinessPayload).learning ?? (red as ReadinessPayload).metrics));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const ready = declaration && coverage && readiness;
  const displayCoverage = (latestJob?.result?.coverage as OddCoverageView | undefined) ?? coverage;
  const isLiveCoverage = !!latestJob?.result?.coverage;

  return (
    <AppShell wide>
      <div
        className={`pt-8 transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${entered ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
      >
        <Eyebrow code="CH 0+000">MISSION CONTROL</Eyebrow>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-text">Mission Control</h1>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">developer · admin-gated via x-admin-key</span>
        </div>

        <div className="mt-5">
          <Segmented options={SEGMENTS} value={segment} onChange={setSegment} ariaLabel="Mission Control sections" />
        </div>

        {error && (
          <div className="mt-5">
            {error.toLowerCase().includes("unauthorized") ? (
              <Panel className="border-accent/20 bg-accent/[0.04] px-5 py-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[color:var(--accent-contrast)]">⌖</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-text">Admin key required</h3>
                    <p className="mt-1 font-mono text-[11px] leading-snug text-muted">
                      Mission Control is developer-only and gated by <span className="text-text">x-admin-key</span> (server env <span className="text-text">ADMIN_KEY</span>). Paste the key below — it stays in your browser (localStorage <span className="text-text">auditorai.admin_key</span>) and is sent as a header. For local dev the test key is <span className="rounded bg-sunken px-1 py-0.5 font-mono text-[10px]">test-admin-key-0123456789abcdef</span> if your server was started with it.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        value={adminKeyInput}
                        onChange={(e) => setAdminKeyInput(e.target.value)}
                        placeholder="paste admin key"
                        className="min-w-[260px] flex-1 rounded-md border border-hairline bg-surface px-3 py-1.5 font-mono text-[12px] text-text placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAdminKey(adminKeyInput.trim());
                          setAdminKeySaved(true);
                          setTimeout(() => setAdminKeySaved(false), 2000);
                          reload();
                        }}
                        className="inline-flex items-center rounded-md bg-accent px-4 py-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-[color:var(--accent-contrast)] transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-strong active:scale-[0.98]"
                      >
                        Save & reload
                      </button>
                    </div>
                    {adminKeySaved && <p className="mt-2 font-mono text-[11px] text-ok">Saved to localStorage. Retrying…</p>}
                    <p className="mt-2 font-mono text-[10.5px] text-faint">Key never leaves your browser except as <span className="text-subtle">x-admin-key</span> header. Rotate via Vercel env <span className="text-subtle">ADMIN_KEY</span> + re-paste here.</p>
                  </div>
                </div>
              </Panel>
            ) : (
              <InlineNotice>{error}</InlineNotice>
            )}
          </div>
        )}

        {loading && !ready && !error && (
          <Panel className="mt-6 px-5 py-8">
            <div className="font-mono text-[12px] text-faint">Loading mission data…</div>
            <div className="mt-3 h-2 w-1/3 animate-pulse rounded-full bg-sunken" />
          </Panel>
        )}

        {!loading && !ready && !error && (
          <Panel className="mt-6 px-5 py-6">
            <p className="font-mono text-[12px] text-faint">No data returned. Check admin key and state files.</p>
          </Panel>
        )}

        {ready && (
          <div className="mt-6 space-y-6">
            {segment === "overview" && (
              <>
                <KpiStrip
                  coverage={displayCoverage as unknown as OddCoverageView}
                  readiness={readiness}
                  ledgerTotal={discovery?.ledgerTotal}
                  ledgerLastAt={discovery?.lastAt ?? null}
                  isLive={isLiveCoverage}
                />
                <Panel className="px-4 py-4">
                  <Eyebrow code="CH 0+180">Health · quick look</Eyebrow>
                  <div className="grid gap-3 font-mono text-[11px] leading-snug text-muted sm:grid-cols-3">
                    <span>coverage: {coverage.cells.reduce((s, c) => s + c.have_total, 0)} / {coverage.target_total} · gaps {coverage.gaps_ranked.length}</span>
                    <span>ledger: {discovery?.ledgerTotal ?? "—"} entries · last {discovery?.lastAt ? discovery.lastAt.slice(0, 10) : "—"}</span>
                    <span>providers: {(discovery?.providers ?? []).filter((p) => p.enabled).length}/{(discovery?.providers ?? []).length} enabled</span>
                  </div>
                </Panel>
                <OddMatrix declaration={declaration} coverage={coverage} onCellClick={setSelectedKey} selectedKey={selectedKey} />
                <ReadinessMeters readiness={readiness} learning={learning} coverage={coverage} />
              </>
            )}

            {segment === "discovery" && (
              <>
                <ProviderHealth providers={discovery?.providers ?? []} onRun={reload} onJob={(j) => setLatestJob(j as unknown as LatestJob)} />
                <DiscoveryStatus
                  ledgerTotal={discovery?.ledgerTotal ?? null}
                  lastAt={discovery?.lastAt ?? null}
                  dedupe={discovery?.dedupe as { sha256Entries?: number; clusters?: number } | null}
                  isLive={isLiveCoverage}
                />
                <QueueTicker
                  coverage={(displayCoverage as OddCoverageView) ?? coverage!}
                  onSelectCell={setSelectedKey}
                  onRunCell={handleRunGap}
                  selectedKey={selectedKey}
                  activeCellKey={gapRun?.cellKey ?? null}
                  limit={3}
                />
                {gapRun && (
                  <Panel className="border-accent/30 bg-accent/[0.04] px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-medium text-text">
                        Triggered <span className="text-accent">{gapRun.cellKey}</span> · job {gapRun.id.slice(0, 8)} · {gapRun.status}
                      </span>
                      <span className="font-mono text-[10px] text-faint">{gapRun.status === "queued" || gapRun.status === "running" ? "polling 1.5s" : gapRun.status}</span>
                    </div>
                    {(gapRun.status === "queued" || gapRun.status === "running") && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sunken ring-1 ring-hairline">
                        <div className="h-full w-[45%] animate-[shimmer_1.2s_ease-in-out_infinite] bg-accent/70" />
                      </div>
                    )}
                    <p className="mt-1.5 font-mono text-[10.5px] leading-snug text-muted">
                      Live harvesting <span className="text-text">{gapRun.cellKey}</span> — check Provider health log for D01..D10 progress. Updates survive refresh.
                    </p>
                  </Panel>
                )}
                {selectedKey &&
                  (() => {
                    const cell = (displayCoverage as OddCoverageView | null)?.cells.find((c) => c.cell_key === selectedKey) ?? null;
                    if (!cell) return null;
                    const pct = cell.target > 0 ? Math.round((cell.have_total / cell.target) * 1000) / 10 : 0;
                    return (
                      <Panel className="border-hairline bg-surface px-4 py-3">
                        <Eyebrow code="CH 0+421">Gap detail · {selectedKey}</Eyebrow>
                        <div className="mt-2 grid gap-3 sm:grid-cols-3">
                          <div>
                            <div className="font-mono text-[11px] font-medium text-text">
                              {cell.have_total} / {cell.target} · {cell.label}
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sunken ring-1 ring-hairline">
                              <div className="h-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <div className="mt-1 font-mono text-[10px] text-faint">
                              {pct}% · priority {cell.priority.toFixed(2)} · full-package {cell.have_full_package}
                            </div>
                          </div>
                          <div className="font-mono text-[10.5px] leading-snug text-muted">
                            <div className="text-[10px] uppercase tracking-[0.08em] text-faint">Uncovered</div>
                            <ul className="mt-1 list-disc pl-4">
                              {cell.uncovered_reasons.length ? cell.uncovered_reasons.map((r) => <li key={r}>{r}</li>) : <li className="text-faint">Covered</li>}
                            </ul>
                          </div>
                          <div className="font-mono text-[10.5px] leading-snug text-muted">
                            <div className="text-[10px] uppercase tracking-[0.08em] text-faint">Provenance</div>
                            <div className="mt-1">
                              status <span className="text-text">{cell.status}</span> · stage <span className="text-text">{cell.native_stage_id ?? "—"}</span>
                            </div>
                            <div className="mt-0.5">fixtures {cell.fixture_ids.join(", ") || "—"}</div>
                            <div className="mt-0.5">have {cell.have_total} · target {cell.target}</div>
                          </div>
                        </div>
                        <p className="mt-2 font-mono text-[10px] text-faint">Card click shows this progress; use “Run this gap (Live)” button on the card to harvest.</p>
                      </Panel>
                    );
                  })()}
                {gapRunError && (
                  <Panel className="mt-2 border-accent-line/20 bg-accent-tint px-3 py-2">
                    <p className="font-mono text-[10.5px] leading-snug text-concern">{gapRunError}</p>
                  </Panel>
                )}
                {isLiveCoverage && latestJob && (
                  <Panel className="border-accent-line/20 bg-accent-tint px-3 py-2">
                    <p className="font-mono text-[10.5px] leading-snug text-subtle">
                      Live queue from <span className="text-text">job {latestJob.id.slice(0, 8)} · {latestJob.status}</span> — file `state/odd-coverage.json` updates only when harvest is persisted. This ticker reflects the live `coverage.view` from the last run.
                    </p>
                  </Panel>
                )}
                <HarvestLog ledgerTail={discovery?.ledgerTail ?? []} job={latestJob} />
              </>
            )}

            {segment === "odd" && <OddMatrix declaration={declaration} coverage={coverage} onCellClick={setSelectedKey} selectedKey={selectedKey} />}

            {segment === "readiness" && <ReadinessMeters readiness={readiness} learning={learning} coverage={coverage} />}

            {segment === "tickets" && tickets && <TicketBoard index={tickets} />}

            {segment === "ai-harvest" && <AiHarvestTab />}
          </div>
        )}

        <p className="mt-8 font-mono text-[10.5px] leading-snug text-faint">
          State is filesystem truth (state/*.json · policies/odd.json). Admin gate enforced at API layer; nav link always visible.
        </p>
      </div>
    </AppShell>
  );
}
