"use client";

import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow } from "@/app/_components/ui/chips";

type Stream = {
  packages: unknown[];
  quality: unknown[];
  coverage: unknown;
  logs: Array<{ node: string; message: string }>;
};

export function AiHarvestViz({ stream }: { stream: Stream | null }) {
  if (!stream) return <Panel className="px-4 py-4 font-mono text-[11px] text-faint">No stream — start to visualize. Control creates a stream; poll drives D01..D10 until verified.</Panel>;

  const pkgs = stream.packages as Array<{ completeness: string }>;
  const quals = stream.quality as Array<{ quality_score: number }>;

  const full = pkgs.filter((p) => p.completeness === "full-package").length;
  const excerpt = pkgs.filter((p) => p.completeness === "excerpt").length;
  const verified = quals.filter((q) => q.quality_score === 1).length;

  return (
    <Panel className="space-y-3 px-4 py-4">
      <Eyebrow code="CH AI">Visualization — gpt-5-nano web search pipeline</Eyebrow>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
        <span className="rounded-md bg-accent/10 px-2 py-1 text-accent">hits →</span>
        <span className="rounded-md bg-ok/10 px-2 py-1 text-text">
          packages {pkgs.length} (full {full} excerpt {excerpt})
        </span>
        <span className="rounded-md bg-sunken px-2 py-1 text-muted">
          quality {quals.length} verified {verified}
        </span>
        <span className="rounded-md border border-hairline bg-surface px-2 py-1 text-muted">coverage {stream.coverage ? "ok" : "—"}</span>
      </div>
      <div className="font-mono text-[10.5px] text-faint">
        Web search: gpt-5-nano via opencode/zen (effort low, 60s, 3 calls, breaker) — see logs for query/limit/latency
      </div>
      <div className="max-h-32 overflow-auto rounded-md border border-hairline bg-sunken p-2 font-mono text-[11px] leading-snug text-muted">
        {stream.logs
          .filter((l) => l.node.includes("D0") || l.node === "STREAM")
          .slice(-15)
          .map((l, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {l.node}: {l.message}
            </div>
          ))}
      </div>
    </Panel>
  );
}
