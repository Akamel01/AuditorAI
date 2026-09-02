"use client";

type Stream = {
  packages: unknown[];
  quality: unknown[];
  coverage: unknown;
  logs: Array<{ node: string; message: string }>;
};

export function AiHarvestViz({ stream }: { stream: Stream | null }) {
  if (!stream) return <div className="text-sm text-gray-500">No stream — start to visualize</div>;

  // Simple Sankey-like flow: D01 hits → qualified → matched → acquired → packages → quality
  const pkgs = stream.packages as Array<{ completeness: string }>;
  const quals = stream.quality as Array<{ quality_score: number }>;

  const full = pkgs.filter((p) => p.completeness === "full-package").length;
  const excerpt = pkgs.filter((p) => p.completeness === "excerpt").length;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h4 className="font-semibold text-sm">Visualization — gpt-5-nano web search pipeline</h4>
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded bg-blue-100 px-2 py-1">hits →</span>
        <span className="rounded bg-green-100 px-2 py-1">packages {pkgs.length} (full {full} excerpt {excerpt})</span>
        <span className="rounded bg-purple-100 px-2 py-1">quality {quals.length} score {quals.filter((q) => q.quality_score === 1).length}</span>
        <span className="rounded bg-gray-100 px-2 py-1">coverage {stream.coverage ? "ok" : "—"}</span>
      </div>
      <div className="text-xs text-gray-600">
        Web search calls: gpt-5-nano via opencode/zen (x-preview-f-free, effort low, 60s timeout, 3 calls max, breaker) — see logs for query/latency
      </div>
      <div className="max-h-32 overflow-auto rounded bg-gray-50 p-2 font-mono text-xs">
        {stream.logs
          .filter((l) => l.node.includes("D0") || l.node === "STREAM")
          .slice(-15)
          .map((l, i) => (
            <div key={i}>
              {l.node}: {l.message}
            </div>
          ))}
      </div>
    </div>
  );
}
