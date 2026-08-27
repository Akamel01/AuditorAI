"use client";

import { useMemo } from "react";
import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow, StateChip } from "@/app/_components/ui/chips";

export interface LedgerEntry {
  seq: number;
  at: string;
  payload_kind: string;
  data: unknown;
}

export interface HarvestLogProps {
  /** last 20 ledger entries from GET /api/dev/discovery — array of LedgerEntry */
  ledgerTail: LedgerEntry[];
  /** optional live job for synthetic display when file ledger empty */
  job?: { id: string; status: string; result?: { packages?: unknown[]; hits?: unknown[] } } | null;
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

export function HarvestLog({ ledgerTail, job }: HarvestLogProps) {
  const groups: Group[] = useMemo(() => {
    const byAt = new Map<string, LedgerEntry[]>();
    for (const e of ledgerTail) {
      const key = e.at ?? "unknown";
      const arr = byAt.get(key);
      if (arr) arr.push(e);
      else byAt.set(key, [e]);
    }
    const sortedKeys = [...byAt.keys()].sort((a, b) => Date.parse(b) - Date.parse(a));
    return sortedKeys.map((at) => ({ at, entries: byAt.get(at)! }));
  }, [ledgerTail]);

  const isJobActive = job && (job.status === "queued" || job.status === "running");
  const jobHasResult = job?.result && Array.isArray(job.result.packages) && (job.result.packages as unknown[]).length > 0;

  return (
    <div className="rounded-[1.5rem] bg-sunken/80 p-1.5 ring-1 ring-hairline">
      <Panel className="!rounded-[1.25rem] border-hairline bg-surface px-4 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Eyebrow code="CH 0+430">Harvest log · last {ledgerTail.length}</Eyebrow>
          {job && (
            <span className={`inline-flex items-center rounded-full border px-2.5 py-[3px] font-mono text-[10px] leading-none tracking-[0.04em] ${isJobActive ? "border-accent-line bg-accent-tint text-accent" : jobHasResult ? "border-hairline bg-sunken text-subtle" : "border-hairline bg-surface text-faint"}`}>
              job {job.id.slice(0, 8)} · {job.status}
              {jobHasResult ? ` · ${(job.result!.packages as unknown[]).length} pkgs` : ""}
            </span>
          )}
        </div>

        {groups.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-hairline bg-sunken px-3 py-3">
            <p className="font-mono text-[11px] text-faint">No ledger entries — run a batch to populate state/discovery-ledger.json.</p>
            {jobHasResult && (
              <p className="mt-1.5 font-mono text-[10.5px] leading-snug text-subtle">
                Live job <span className="text-text">{job!.id.slice(0, 8)} · {job!.status}</span> produced{" "}
                <span className="text-text">{(job!.result!.packages as unknown[]).length} packages</span> ·{" "}
                <span className="text-text">{(job!.result!.hits as unknown[]).length} hits</span> — see Provider health log above for D01..D10 steps. File ledger updates only when harvest is persisted to state; job result is the live source.
              </p>
            )}
            {isJobActive && <p className="mt-1.5 font-mono text-[10.5px] text-accent">Job running — check Provider health progress log.</p>}
          </div>
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
