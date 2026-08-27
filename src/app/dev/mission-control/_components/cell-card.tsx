"use client";

import { useEffect, useRef, useState } from "react";
import { Panel } from "@/app/_components/ui/panel";
import type { CoverageCellView } from "@/discovery/types";
import type { CanonicalStage } from "@/domain/types";

// Minimal declaration cell shape the matrix merges in — mirrors OddCell in src/domain/odd.ts
export interface DeclarationCell {
  jurisdiction_id: string;
  framework_id: string;
  native_stage_id: string | null;
  canonical_stage: CanonicalStage[];
  mapping_confidence: "authoritative" | "interpreted" | "inferred" | null;
  status: "in" | "mapped_unproven" | "structurally_absent";
  fixture_ids: string[];
  incident_flags: string[];
  input_floor: string[];
  scheme_scope_note?: string;
}

export interface CellCardProps {
  cell: CoverageCellView;
  declaration?: DeclarationCell | null;
  index?: number;
  onClick?: (cellKey: string) => void;
}

const JUR_LABEL: Record<string, string> = {
  UK: "UK",
  US: "US",
  CA: "CA",
  AE: "AE",
  INT: "INT",
};

function confidenceDot(conf: string | null | undefined): string {
  if (!conf) return "border border-dashed border-subtle bg-transparent";
  const c = conf.toLowerCase();
  if (c === "authoritative") return "bg-subtle";
  if (c === "interpreted") return "bg-[linear-gradient(90deg,var(--text-3)_50%,transparent_50%)] border border-subtle";
  return "border border-dashed border-subtle bg-transparent";
}

function statusBadgeClass(status: CoverageCellView["status"]): string {
  if (status === "in") return "border-accent-line bg-accent-tint text-accent";
  if (status === "mapped_unproven") return "border-warn-line bg-warn-tint text-warn";
  return "border-edge bg-surface text-faint";
}

function labelPillClass(label: CoverageCellView["label"]): string {
  switch (label) {
    case "COVERED":
      return "border-ok-line bg-ok-tint text-ok";
    case "UNDER-COVERED":
      return "border-warn-line bg-warn-tint text-warn";
    case "MISSING":
      return "border-concern-line bg-concern-tint text-concern";
    case "OVER-REPRESENTED":
      return "border-accent-line bg-accent-tint text-accent";
    case "EXCLUDED":
    default:
      return "border-edge bg-sunken text-faint";
  }
}

function Donut({ have, target, size = 56 }: { have: number; target: number; size?: number }) {
  const pct = target > 0 ? Math.min(1, have / target) : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = c * pct;
  const gap = c - dash;
  const track = "var(--hairline)";
  const fill = pct >= 1 ? "var(--ok)" : pct > 0 ? "var(--accent)" : "var(--edge)";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 44 44" className="-rotate-90">
        <circle cx={22} cy={22} r={r} fill="none" stroke={track} strokeWidth={4} />
        <circle
          cx={22}
          cy={22}
          r={r}
          fill="none"
          stroke={fill}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.32,0.72,0,1)" }}
        />
      </svg>
      <span className="pointer-events-none absolute font-mono text-[10px] font-medium leading-none tracking-[0.04em] text-text">
        {target === 0 ? "—" : `${have}/${target}`}
      </span>
    </div>
  );
}

function PriorityHeat({ priority }: { priority: number }) {
  // 0–3 scale (coverage weight). Map to 4 dots growing in opacity.
  const level = Math.min(4, Math.max(0, Math.round(priority)));
  // color heat: 0 faint, 1 subtle, 2 warn, 3 concern
  const color =
    priority >= 3 ? "bg-concern" : priority >= 2 ? "bg-warn" : priority >= 1 ? "bg-accent" : "bg-edge";
  return (
    <span className="inline-flex items-center gap-0.5" title={`priority ${priority.toFixed(2)}`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i < level ? color : "bg-hairline"} ${i < level ? "opacity-100" : "opacity-60"}`}
        />
      ))}
    </span>
  );
}

export function CellCard({ cell, declaration, index = 0, onClick }: CellCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // respect prefers-reduced-motion — immediately visible
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const conf = declaration?.mapping_confidence ?? null;
  const inputFloor = declaration?.input_floor ?? [];
  const jur = JUR_LABEL[cell.jurisdiction_id] ?? cell.jurisdiction_id;
  const native = cell.native_stage_id ?? declaration?.native_stage_id ?? "—";
  const isExcluded = cell.status === "structurally_absent" || cell.target === 0;
  const fullPct = cell.have_total > 0 ? cell.have_full_package / cell.have_total : 0;

  return (
    <div
      ref={ref}
      className={`rounded-[1.5rem] bg-sunken/80 p-1.5 ring-1 ring-hairline transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform ${
        visible ? "translate-y-0 opacity-100 blur-none" : "translate-y-16 opacity-0 blur-md"
      }`}
      style={{ transitionDelay: `${Math.min(index * 48, 420)}ms` }}
    >
      <Panel
        as="article"
        className={`!rounded-[1.25rem] flex h-full flex-col border-hairline bg-surface px-3.5 py-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)] ${onClick ? "cursor-pointer transition-colors hover:border-edge" : ""}`}
        onClick={onClick ? () => onClick(cell.cell_key) : undefined}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick(cell.cell_key);
                }
              }
            : undefined
        }
        aria-label={`${cell.cell_key} ${cell.label}`}
      >
        {/* header: jurisdiction + native_stage + confidence */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-text">{jur}</span>
              <span className="text-hairline">·</span>
              <span className="truncate font-mono text-[10.5px] tracking-[0.04em] text-subtle" title={native}>
                {native}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`inline-block h-[8px] w-[12px] rounded-[2px] ${confidenceDot(conf)}`} />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                {conf ?? "—"}
              </span>
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-[3px] font-mono text-[10px] font-medium uppercase tracking-[0.08em] leading-none ${statusBadgeClass(cell.status)}`}
          >
            {cell.status === "in" ? "IN" : cell.status === "mapped_unproven" ? "mapped · unproven" : "absent"}
          </span>
        </div>

        {/* donut + bar */}
        <div className="mt-3 flex items-center gap-3">
          <Donut have={cell.have_total} target={cell.target} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-[2px] font-mono text-[10px] uppercase tracking-[0.08em] leading-none ${labelPillClass(cell.label)}`}
              >
                {cell.label}
              </span>
              <span className="font-mono text-[10px] text-faint">
                {cell.have_total}/{cell.target === 0 ? "—" : cell.target}
              </span>
            </div>
            {/* small bar have_full vs have_total */}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken ring-1 ring-hairline">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ width: `${Math.round(fullPct * 100)}%` }}
                title={`${cell.have_full_package} full / ${cell.have_total} total`}
              />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] leading-none text-faint">
              <span>{cell.have_full_package} full</span>
              <span>{cell.have_total} total</span>
            </div>
          </div>
        </div>

        {/* footer: fixtures + floor + priority */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline pt-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-sunken px-2 py-[2px] font-mono text-[10px] leading-none text-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-subtle" />
              {cell.fixture_ids.length} fixtures
            </span>
            {inputFloor.length > 0 && (
              <span className="hidden items-center gap-0.5 sm:inline-flex" title={`${inputFloor.length} input-floor items`}>
                {inputFloor.slice(0, 6).map((_, i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-edge ring-1 ring-hairline" />
                ))}
                {inputFloor.length > 6 && (
                  <span className="font-mono text-[10px] text-faint">+{inputFloor.length - 6}</span>
                )}
              </span>
            )}
          </div>
          <PriorityHeat priority={cell.priority} />
        </div>

        {/* uncovered hint line (single line, truncated) */}
        {!isExcluded && cell.uncovered_reasons.length > 0 && (
          <p className="mt-2 truncate font-mono text-[10px] leading-snug text-faint" title={cell.uncovered_reasons.join(" · ")}>
            {cell.uncovered_reasons[0]}
          </p>
        )}
      </Panel>
    </div>
  );
}
