"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow, StateChip } from "@/app/_components/ui/chips";
import { adminApi } from "@/lib/client";

export interface LedgerEntry {
  seq: number;
  at: string;
  payload_kind: string;
  data: unknown;
}

export interface HarvestLogProps {
  /** last 20 ledger entries from GET /api/dev/discovery — array of LedgerEntry */
  ledgerTail: LedgerEntry[];
  /** optional run handler; defaults to POST /api/dev/discovery/run { live: true } */
  onRun?: () => Promise<void>;
}

type Group = {
  at: string;
  entries: LedgerEntry[];
};

type QualityVerdict = {
  package_id: string;
  dedupe_status: "unique" | "duplicate" | "near_dup";
  canonical_package_id: string | null;
};

type ProvenanceRecord = {
  package_id: string;
  provenance_id: string;
  sha256_chain: { doc_id: string; sha256: string }[];
  source_urls: string[];
};

function shortSha(sha: string): string {
  return sha.slice(0, 12);
}

function dedupeChip(status: string) {
  if (status === "unique") return <StateChip state="provided" label="unique" />;
  if (status === "duplicate") return <StateChip state="conflicting" label="duplicate" />;
  if (status === "near_dup") return <StateChip state="unknown" label="near_dup" />;
  return <StateChip state="unknown" label={status} />;
}

function payloadChip(kind: string) {
  // map core payload_kinds to subtle badge treatment; fallback unknown
  const isCore =
    kind === "package.assemblies" ||
    kind === "quality.verdicts" ||
    kind === "provenance.records" ||
    kind === "coverage.view";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-[2px] font-mono text-[10px] leading-none tracking-[0.04em] ${
        isCore ? "border-accent-line bg-accent-tint text-accent" : "border-hairline bg-surface text-faint"
      }`}
      title={kind}
    >
      {kind}
    </span>
  );
}

export function HarvestLog({ ledgerTail, onRun }: HarvestLogProps) {
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runOk, setRunOk] = useState<string | null>(null);

  const groups: Group[] = useMemo(() => {
    const byAt = new Map<string, LedgerEntry[]>();
    for (const e of ledgerTail) {
      const key = e.at ?? "unknown";
      const arr = byAt.get(key);
      if (arr) arr.push(e);
      else byAt.set(key, [e]);
    }
    // sort by at descending (most recent first); parse ISO
    const sortedKeys = [...byAt.keys()].sort((a, b) => Date.parse(b) - Date.parse(a));
    return sortedKeys.map((at) => ({ at, entries: byAt.get(at)! }));
  }, [ledgerTail]);

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Eyebrow code="CH 0+430">Harvest log · last {ledgerTail.length}</Eyebrow>
          <button
            type="button"
            onClick={handleRun}
            disabled={runLoading}
            className="inline-flex cursor-pointer items-center rounded-md bg-accent px-3 py-1.5 font-mono text-[11px] font-medium tracking-[0.04em] text-[color:var(--accent-contrast)] transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-strong disabled:opacity-50"
            aria-label="Run one live harvest batch — POST /api/dev/discovery/run"
          >
            {runLoading ? "Running…" : "Run live harvest"}
          </button>
        </div>

        {(runError || runOk) && (
          <div className={`mt-2 font-mono text-[11px] ${runError ? "text-concern" : "text-ok"}`}>{runError ?? runOk}</div>
        )}

        {groups.length === 0 ? (
          <p className="mt-3 font-mono text-[11px] text-faint">No ledger entries — run a batch to populate state/discovery-ledger.json.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-hairline text-left font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                  <th className="pb-2 pr-3 font-normal">Run · at</th>
                  <th className="pb-2 pr-3 font-normal">Payload kinds</th>
                  <th className="pb-2 pr-3 font-normal">Dedupe</th>
                  <th className="pb-2 font-normal">Provenance · SHA</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  // collect dedupe statuses from any quality.verdicts entry in this run
                  const qualityEntries = g.entries.filter((e) => e.payload_kind === "quality.verdicts");
                  const dedupeStatuses: string[] = [];
                  for (const q of qualityEntries) {
                    const data = Array.isArray(q.data) ? (q.data as QualityVerdict[]) : [];
                    for (const v of data) if (v.dedupe_status) dedupeStatuses.push(v.dedupe_status);
                  }
                  const uniqueStatuses = [...new Set(dedupeStatuses)];

                  // collect provenance SHA links from provenance.records
                  const provEntries = g.entries.filter((e) => e.payload_kind === "provenance.records");
                  const shas: { sha: string; pkg: string }[] = [];
                  for (const p of provEntries) {
                    const data = Array.isArray(p.data) ? (p.data as ProvenanceRecord[]) : [];
                    for (const r of data) {
                      const first = r.sha256_chain?.[0];
                      if (first?.sha256) shas.push({ sha: first.sha256, pkg: r.package_id });
                    }
                  }

                  return (
                    <tr key={g.at} className="border-b border-hairline/60 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-mono text-[11px] font-medium tracking-[0.04em] text-text" title={g.at}>
                          {g.at.slice(0, 19).replace("T", " ")}
                        </div>
                        <div className="font-mono text-[10px] text-faint">{g.entries.length} entries · seq {g.entries[0].seq}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex max-w-[320px] flex-wrap gap-1.5">
                          {g.entries.map((e) => (
                            <span key={`${g.at}-${e.seq}-${e.payload_kind}`}>{payloadChip(e.payload_kind)}</span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {uniqueStatuses.length ? (
                            uniqueStatuses.map((s) => <span key={s}>{dedupeChip(s)}</span>)
                          ) : (
                            <span className="font-mono text-[10px] text-faint">—</span>
                          )}
                        </div>
                        {qualityEntries.length > 0 && (
                          <div className="mt-1 font-mono text-[10px] text-faint">
                            {qualityEntries.reduce((sum, e) => sum + (Array.isArray(e.data) ? e.data.length : 0), 0)} verdicts
                          </div>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {shas.length ? (
                            shas.slice(0, 3).map((s) => (
                              <a
                                key={`${s.pkg}-${s.sha}`}
                                href={`#${s.sha}`}
                                onClick={(e) => e.preventDefault()}
                                className="inline-flex items-center gap-1 rounded-full border border-hairline bg-sunken px-2 py-[2px] font-mono text-[10px] leading-none tracking-[0.04em] text-subtle hover:border-edge hover:text-text"
                                title={`${s.pkg} · ${s.sha}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                                {shortSha(s.sha)}
                              </a>
                            ))
                          ) : (
                            <span className="font-mono text-[10px] text-faint">—</span>
                          )}
                          {shas.length > 3 && (
                            <span className="font-mono text-[10px] text-faint">+{shas.length - 3}</span>
                          )}
                        </div>
                        {provEntries.length > 0 && (
                          <div className="mt-1 font-mono text-[10px] text-faint">
                            {provEntries.reduce((sum, e) => sum + (Array.isArray(e.data) ? e.data.length : 0), 0)} records
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 font-mono text-[10.5px] leading-snug text-faint">
          Grouped by <span className="text-subtle">at</span> (run). Payload kinds are chips; dedupe badges from{" "}
          <span className="text-subtle">quality.verdicts</span> (unique / duplicate / near_dup); provenance via SHA chain
          (first doc).
        </p>
      </Panel>
    </div>
  );
}

export default HarvestLog;
