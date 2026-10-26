"use client";

import { useEffect, useState } from "react";
import { api, downloadTrailExport } from "@/lib/client";
import { AppShell } from "@/app/_components/ui/app-shell";
import { Eyebrow } from "@/app/_components/ui/chips";
import { Button } from "@/app/_components/ui/button";
import { Panel } from "@/app/_components/ui/panel";
import { EmptyState, LoadingRows } from "@/app/_components/ui/empty-state";
import { InlineNotice } from "@/app/_components/ui/inline-notice";
import type { AuditTrailEntry, AuditTrailVerifyResult } from "@/domain/audit-trail";

interface TrailData {
  workspace: string;
  trail_starts_at: string | null;
  entries: AuditTrailEntry[];
  verification: AuditTrailVerifyResult;
}

export default function AuditTrailPage() {
  const [data, setData] = useState<TrailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportedAt] = useState(() => new Date().toISOString());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api<TrailData>("/api/workspaces/audit-trail");
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onExport() {
    try {
      await downloadTrailExport();
    } catch (e) {
      setError(String((e as Error).message));
    }
  }

  const v = data?.verification;
  const headHash = v?.head?.entry_hash ?? null;
  const headSeq = v?.head?.seq ?? null;

  return (
    <AppShell>
      <div className="pt-10">
        <Eyebrow code="Evidence">Evidence</Eyebrow>
        <h1 className="text-[26px] font-semibold leading-tight">Audit trail</h1>
        <p className="mt-1.5 max-w-[60ch] text-[13px] leading-relaxed text-subtle">
          Append-only, hash-chained record of workspace mutations.
        </p>

        {error && (
          <div className="mt-5">
            <InlineNotice>{error}</InlineNotice>
          </div>
        )}

        {!data && !error && (
          <div className="mt-8">
            <LoadingRows rows={3} />
          </div>
        )}

        {data && (
          <>
            {v?.ok ? (
              <div
                data-testid="trail-verify-ok"
                className="mt-6 rounded-md border border-ok-line bg-ok-tint px-3 py-2 text-[12.5px] text-ok"
              >
                chain intact · {v.checked} entries · head {headHash ? headHash.slice(0, 12) + "…" : "none"}
              </div>
            ) : (
              <div className="mt-6 space-y-2">
                <div
                  data-testid="trail-verify-broken"
                  className="rounded-md border border-concern-line bg-concern-tint px-3 py-2 text-[12.5px] text-concern"
                >
                  chain broken · {v?.reason ?? "unknown"} · first bad seq {v?.first_bad_seq ?? "—"}
                </div>
                <InlineNotice>
                  Preserve the last signed export; the chain proves internal consistency only.
                </InlineNotice>
              </div>
            )}

            <div className="mt-4 text-[12.5px] text-subtle">
              {data.trail_starts_at
                ? `Trail begins at ${data.trail_starts_at}; prior history is not chained.`
                : "No recorded activity yet. Prior history is not chained."}
            </div>

            {data.entries.length === 0 && (
              <div className="mt-6">
                <EmptyState title="No recorded activity yet." hint="No recorded activity yet." />
              </div>
            )}

            {data.entries.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-md border border-hairline bg-surface">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-hairline text-left font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
                      <th className="px-3 py-2">seq</th>
                      <th className="px-3 py-2">recorded_at (UTC)</th>
                      <th className="px-3 py-2">actor</th>
                      <th className="px-3 py-2">action</th>
                      <th className="px-3 py-2">subject</th>
                      <th className="px-3 py-2">evidence</th>
                      <th className="px-3 py-2">payload hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e: AuditTrailEntry) => (
                      <tr key={e.seq} className="border-b border-hairline last:border-b-0">
                        <td className="px-3 py-2 font-mono">{e.seq}</td>
                        <td className="px-3 py-2 font-mono">{e.recorded_at}</td>
                        <td className="px-3 py-2">
                          {e.actor === "auditor" ? "unattributed (pre-account record)" : e.actor}
                        </td>
                        <td className="px-3 py-2">{e.action}</td>
                        <td className="px-3 py-2 font-mono">
                          {e.subject.type} {e.subject.id}
                        </td>
                        <td className="px-3 py-2 font-mono">{e.evidence_refs.length}</td>
                        <td className="px-3 py-2 font-mono">{e.payload_hash.slice(0, 12)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2 print:hidden">
              <Button data-testid="trail-export" onClick={onExport}>
                download signed JSON
              </Button>
              <Button data-testid="trail-print" onClick={() => window.print()}>
                print / save PDF
              </Button>
            </div>

            <Panel className="hidden print:block mt-8 p-4 text-[12px]">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">Printed audit trail</p>
              <p className="mt-2">Workspace: {data.workspace}</p>
              <p>Head seq: {headSeq ?? "—"} · full head hash: {headHash ?? "—"}</p>
              <p>Exported at: {exportedAt}</p>
              <p className="mt-2">
                The signed JSON export is the cryptographically verifiable record; this sheet is its rendering.
              </p>
              <p className="mt-2 text-subtle">
                The chain proves internal consistency; an attacker with store write access can rewrite a suffix.
                Tail truncation is not detectable without an external head. A signed export made before the
                rewrite is the notarisation.
              </p>
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  );
}
