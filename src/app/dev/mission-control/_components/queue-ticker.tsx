"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow } from "@/app/_components/ui/chips";
import type { OddCoverageView, CoverageCellView } from "@/discovery/types";

export interface QueueTickerProps {
  /** OddCoverageView from GET /api/dev/coverage or discovery pipeline */
  coverage: OddCoverageView;
  /** optional override for theme mapping; defaults to internal QUERY_THEMES */
  onSelectCell?: (cellKey: string) => void;
  /** restricts to top N gaps (default 3) */
  limit?: number;
}

// Mirrors src/discovery/coverage.ts QUERY_THEMES but kept client-safe (no fs import).
const QUERY_THEMES: Record<string, string[]> = {
  UK: ['"road safety audit" "stage 1"', 'NSIP "road safety audit" preliminary design'],
  US: ["FHWA road safety audit preliminary design report", 'site:dot.state.mn.us "road safety audit"'],
  CA: ['Alberta "road safety audit" functional planning', 'BC MoTI "road safety audit"'],
  AE: ["Abu Dhabi road safety audit stage 0", "jawdah qcc ISGL audit"],
  INT: ["CAREC road safety audit worked example", '"stage 2" RSA detailed design Ireland ABP'],
};

function themeFor(cell: CoverageCellView, idx: number): string {
  const themes = QUERY_THEMES[cell.jurisdiction_id] ?? QUERY_THEMES.INT;
  return themes[idx % themes.length];
}

function PriorityHeat({ priority }: { priority: number }) {
  const level = Math.min(4, Math.max(0, Math.round(priority)));
  const color = priority >= 3 ? "bg-concern" : priority >= 2 ? "bg-warn" : priority >= 1 ? "bg-accent" : "bg-edge";
  return (
    <span className="inline-flex items-center gap-0.5" title={`priority ${priority.toFixed(2)}`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < level ? color : "bg-hairline"} ${i < level ? "opacity-100" : "opacity-60"}`} />
      ))}
    </span>
  );
}

export function QueueTicker({ coverage, onSelectCell, limit = 3 }: QueueTickerProps) {
  const gaps = coverage.gaps_ranked.slice(0, limit);
  const byKey = new Map<string, CoverageCellView>();
  for (const c of coverage.cells) byKey.set(c.cell_key, c);

  // staggered entrance — respects prefers-reduced-motion
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setVisible(true);
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    const t = setTimeout(() => setVisible(true), 120);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);

  if (gaps.length === 0) {
    return (
      <div className="rounded-[1.5rem] bg-sunken/80 p-1.5 ring-1 ring-hairline">
        <Panel className="!rounded-[1.25rem] border-hairline bg-surface px-4 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)]">
          <Eyebrow code="CH 0+420">Queue ticker · next gaps</Eyebrow>
          <p className="font-mono text-[11px] text-faint">No gaps — coverage complete.</p>
        </Panel>
      </div>
    );
  }

  return (
    <div ref={ref} className="rounded-[1.5rem] bg-sunken/80 p-1.5 ring-1 ring-hairline">
      <Panel className="!rounded-[1.25rem] border-hairline bg-surface px-3 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)] sm:px-4 sm:py-4">
        <Eyebrow code="CH 0+420">Queue ticker · top {limit}</Eyebrow>

        <div className="mt-3 flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
          {gaps.map((key, i) => {
            const cell = byKey.get(key);
            const rank = i + 1;
            const priority = cell?.priority ?? 0;
            const reason = cell?.uncovered_reasons[0] ?? (cell ? `priority ${cell.priority} (status ${cell.status}, ${cell.have_total}/${cell.target})` : "gap ranked by priority");
            const queryTheme = cell ? themeFor(cell, i) : "road safety audit";
            return (
              <Panel
                key={key}
                className={`min-w-[220px] flex-1 !rounded-[1.0rem] border-hairline bg-sunken px-3 py-3 shadow-sm transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform sm:min-w-0 ${
                  visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
                } ${onSelectCell ? "cursor-pointer hover:border-edge hover:bg-surface" : ""}`}
                style={{ transitionDelay: `${i * 90}ms` }}
                onClick={onSelectCell ? () => onSelectCell(key) : undefined}
                role={onSelectCell ? "button" : undefined}
                tabIndex={onSelectCell ? 0 : undefined}
                onKeyDown={
                  onSelectCell
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectCell(key);
                        }
                      }
                    : undefined
                }
                aria-label={`queue ${rank} ${key}`}
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-text font-mono text-[11px] font-medium leading-none text-[color:var(--canvas)]">
                    {rank}
                  </span>
                  <span className="truncate font-mono text-[11px] font-medium tracking-[0.04em] text-text" title={key}>
                    {key}
                  </span>
                </div>
                <div className="mt-2 font-mono text-[10.5px] leading-snug text-subtle" title={queryTheme}>
                  theme: <span className="text-text">{queryTheme}</span>
                </div>
                <div className="mt-1.5 line-clamp-2 font-mono text-[10.5px] leading-snug text-faint" title={reason}>
                  {reason}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                    priority {priority.toFixed(2)}
                  </span>
                  <PriorityHeat priority={priority} />
                </div>
              </Panel>
            );
          })}
        </div>

        <p className="mt-3 font-mono text-[10.5px] leading-snug text-faint">
          Horizontal ticker — top {limit} from <span className="text-subtle">gaps_ranked</span> (gap × risk_weight, fragile-bonus 2). ↑ translate-y stagger
          cubic-bezier(0.32,0.72,0,1).
        </p>
      </Panel>
    </div>
  );
}

export default QueueTicker;
