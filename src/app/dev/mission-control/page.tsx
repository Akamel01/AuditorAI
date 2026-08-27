"use client";

import { useEffect, useState } from "react";
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
import { HarvestLog, type LedgerEntry } from "./_components/harvest-log";
import { fetchCoverage, fetchDiscovery, fetchOdd, fetchReadiness } from "@/lib/client";
import { getAdminKey, setAdminKey } from "@/lib/client";
import type { OddCoverageView } from "@/discovery/types";
import type { OddDeclaration } from "@/domain/odd";
import type { LearningMetrics } from "@/lib/learning-metrics";

type Segment = "overview" | "discovery" | "odd" | "readiness";

const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "discovery", label: "Discovery" },
  { value: "odd", label: "ODD Matrix" },
  { value: "readiness", label: "Readiness" },
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

  useEffect(() => {
    setEntered(true);
    setAdminKeyInput(getAdminKey());
  }, []);

  const reload = async () => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    try {
      const [odd, cov, disc, red] = await Promise.all([
        fetchOdd<OddDeclaration>(),
        fetchCoverage<OddCoverageView>(),
        fetchDiscovery<DiscoveryData>(),
        fetchReadiness<ReadinessPayload>(),
      ]);
      if (cancelled) return;
      setDeclaration(odd);
      setCoverage(cov);
      setDiscovery(disc);
      const rep = (red as ReadinessPayload).readiness ?? (red as ReadinessPayload).report ?? null;
      if (rep) setReadiness(rep as ReadinessReport);
      setLearning(normalizeLearning((red as ReadinessPayload).learning ?? (red as ReadinessPayload).metrics));
    } catch (e) {
      if (!cancelled) setError((e as Error).message);
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    reload();
  }, []);

  const ready = declaration && coverage && readiness;

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
                  coverage={coverage}
                  readiness={readiness}
                  ledgerTotal={discovery?.ledgerTotal}
                  ledgerLastAt={discovery?.lastAt ?? null}
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
                <ProviderHealth providers={discovery?.providers ?? []} />
                <QueueTicker coverage={coverage} onSelectCell={setSelectedKey} limit={3} />
                <HarvestLog ledgerTail={discovery?.ledgerTail ?? []} />
              </>
            )}

            {segment === "odd" && <OddMatrix declaration={declaration} coverage={coverage} onCellClick={setSelectedKey} selectedKey={selectedKey} />}

            {segment === "readiness" && <ReadinessMeters readiness={readiness} learning={learning} coverage={coverage} />}
          </div>
        )}

        <p className="mt-8 font-mono text-[10.5px] leading-snug text-faint">
          State is filesystem truth (state/*.json · policies/odd.json). Admin gate enforced at API layer; nav link always visible.
        </p>
      </div>
    </AppShell>
  );
}
