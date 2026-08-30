"use client";

import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow } from "@/app/_components/ui/chips";

export interface DiscoveryStatusProps {
  ledgerTotal?: number | null;
  lastAt?: string | null;
  dedupe?: { sha256Entries?: number; textHashEntries?: number; clusters?: number } | null;
  isLive?: boolean;
}

export function DiscoveryStatus({ ledgerTotal, lastAt, dedupe, isLive }: DiscoveryStatusProps) {
  const sha = dedupe?.sha256Entries ?? 0;
  const clusters = dedupe?.clusters ?? 0;
  return (
    <div className="rounded-[1.5rem] bg-sunken/80 p-1.5 ring-1 ring-hairline">
      <Panel className="!rounded-[1.25rem] border-hairline bg-surface px-4 py-3">
        <Eyebrow code="CH 0+410">Discovery status · ledger & dedupe</Eyebrow>
        <div className="mt-2 grid gap-2 font-mono text-[11px] leading-snug text-muted sm:grid-cols-3">
          <span>
            ledger: <span className="text-text">{ledgerTotal ?? "—"}</span> entries
            {lastAt ? <span className="text-faint"> · last {lastAt.slice(0, 10)}</span> : null}
            {isLive ? <span className="ml-1 rounded bg-accent-tint px-1 py-0.5 text-[10px] text-accent">live</span> : <span className="ml-1 text-faint">file</span>}
          </span>
          <span>
            dedupe: <span className="text-text">{sha}</span> sha · <span className="text-text">{clusters}</span> clusters
          </span>
          <span className="text-faint">KV mirror preferred · file fallback</span>
        </div>
      </Panel>
    </div>
  );
}
