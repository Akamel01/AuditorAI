"use client";

import { useMemo } from "react";
import { Panel } from "@/app/_components/ui/panel";
import { Eyebrow } from "@/app/_components/ui/chips";
import { CellCard, type DeclarationCell } from "./cell-card";
import type { OddCoverageView, CoverageCellView } from "@/discovery/types";
import type { OddDeclaration } from "@/domain/odd";

export interface OddMatrixProps {
  declaration: OddDeclaration;
  coverage: OddCoverageView;
  onCellClick?: (cellKey: string) => void;
  selectedKey?: string | null;
}

const JUR_ORDER = ["uk", "usa", "canada", "uae", "international"];
const STAGE_ORDER: Record<string, number> = {
  FEASIBILITY_CONCEPT: 0,
  PRELIMINARY_DESIGN: 1,
  "PRELIMINARY_DESIGN+DETAILED_DESIGN": 2,
  DETAILED_DESIGN: 3,
};

function canonicalKey(stages: string[]): string {
  return [...stages].sort().join("+");
}

function declKeyFor(d: DeclarationCell): string {
  return `${d.jurisdiction_id}:${canonicalKey(d.canonical_stage)}`;
}

function coverKeyFor(c: CoverageCellView): string {
  // coverage cell_key already is jurisdiction_id(canonical dir):stages — normalized
  return c.cell_key;
}

export function OddMatrix({ declaration, coverage, onCellClick, selectedKey }: OddMatrixProps) {
  const merged = useMemo(() => {
    const declByKey = new Map<string, DeclarationCell>();
    for (const c of declaration.cells as unknown as DeclarationCell[]) {
      declByKey.set(declKeyFor(c), c);
    }
    // sort coverage cells for stable matrix: jur order then stage order
    const sorted = [...coverage.cells].sort((a, b) => {
      const aDir = a.cell_key.split(":")[0];
      const bDir = b.cell_key.split(":")[0];
      const ai = JUR_ORDER.indexOf(aDir);
      const bi = JUR_ORDER.indexOf(bDir);
      if (ai !== bi) return ai - bi;
      const ak = canonicalKey(a.canonical_stage);
      const bk = canonicalKey(b.canonical_stage);
      return (STAGE_ORDER[ak] ?? 99) - (STAGE_ORDER[bk] ?? 99) || ak.localeCompare(bk);
    });
    return sorted.map((cell) => ({
      cell,
      declaration: declByKey.get(coverKeyFor(cell)) ?? null,
    }));
  }, [declaration, coverage]);

  const inCount = coverage.cells.filter((c) => c.status === "in").length;
  const gaps = coverage.gaps_ranked.slice(0, 3);

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Hero matrix — 8 col */}
      <div className="col-span-12 lg:col-span-8">
        <div className="rounded-[1.5rem] bg-sunken/80 p-1.5 ring-1 ring-hairline">
          <div className="rounded-[1.25rem] border border-hairline bg-surface px-3 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)] sm:px-4 sm:py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Eyebrow code="CH 0+200">ODD Matrix · 16 cells</Eyebrow>
              <span className="font-mono text-[11px] tracking-[0.06em] text-faint">
                {inCount} IN · v{declaration.declaration_version}
              </span>
            </div>

            {/* column headers — canonical stages */}
            <div className="mt-3 hidden grid-cols-4 gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-faint sm:grid">
              <span>Feasibility · Concept</span>
              <span>Preliminary Design</span>
              <span>Prelim + Detailed</span>
              <span>Detailed Design</span>
            </div>

            {/* jurisdiction rows via CSS grid — cards handle their own row grouping */}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
              {merged.map(({ cell, declaration: decl }, i) => (
                <CellCard key={cell.cell_key} cell={cell} declaration={decl} index={i} onClick={onCellClick} />
              ))}
            </div>

            <p className="mt-3 font-mono text-[10.5px] leading-snug text-faint">
              Tap a cell to inspect floor, fixtures, and priority. Combined S12 spans two canonical stages [EV-AE-012].
            </p>
          </div>
        </div>
      </div>

      {/* Side — 4 col: legend + gaps ranked */}
      <div className="col-span-12 flex flex-col gap-4 lg:col-span-4">
        <Panel className="rounded-[1.25rem] border-hairline bg-surface px-4 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)]">
          <Eyebrow code="CH 0+220">Legend</Eyebrow>
          <div className="mt-3 space-y-2.5 font-mono text-[11px] leading-snug">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="text-text">IN — claims allowed</span>
              <span className="ml-auto rounded-full border border-accent-line bg-accent-tint px-2 py-[1px] text-[10px] uppercase tracking-[0.08em] text-accent">IN</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-warn" />
              <span className="text-text">mapped · unproven — validation pending</span>
              <span className="ml-auto rounded-full border border-warn-line bg-warn-tint px-2 py-[1px] text-[10px] uppercase tracking-[0.08em] text-warn">warn</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-edge" />
              <span className="text-text">structurally absent — refused</span>
              <span className="ml-auto rounded-full border border-edge bg-sunken px-2 py-[1px] text-[10px] uppercase tracking-[0.08em] text-faint">absent</span>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
              <span className="inline-block h-[8px] w-[12px] rounded-[2px] bg-subtle" />
              <span className="text-faint">authoritative</span>
              <span className="inline-block h-[8px] w-[12px] rounded-[2px] border border-subtle bg-[linear-gradient(90deg,var(--text-3)_50%,transparent_50%)]" />
              <span className="text-faint">interpreted</span>
              <span className="inline-block h-[8px] w-[12px] rounded-[2px] border border-dashed border-subtle" />
              <span className="text-faint">inferred</span>
            </div>
            <p className="pt-1 text-faint">Confidence swatch: fill treatment only — never decorative.</p>
          </div>
        </Panel>

        <Panel className="rounded-[1.25rem] border-hairline bg-surface px-4 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)]">
          <Eyebrow code="CH 0+240">Gaps ranked · top 3</Eyebrow>
          <ol className="mt-3 space-y-2">
            {gaps.length === 0 ? (
              <li className="font-mono text-[11px] text-faint">No gaps — coverage complete.</li>
            ) : (
              gaps.map((k, i) => {
                const cell = coverage.cells.find((c) => c.cell_key === k);
                const selected = selectedKey === k;
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => onCellClick?.(k)}
                      className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
                        selected ? "border-accent bg-accent-tint" : "border-hairline bg-sunken hover:border-edge hover:bg-surface"
                      }`}
                    >
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-text font-mono text-[11px] font-medium leading-none text-[color:var(--canvas)]">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[11px] font-medium tracking-[0.04em] text-text">{k}</span>
                        {cell && (
                          <span className="block truncate font-mono text-[10px] text-faint">
                            {cell.have_total}/{cell.target} · priority {cell.priority.toFixed(2)}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[10px] text-faint">→</span>
                    </button>
                  </li>
                );
              })
            )}
          </ol>
          <p className="mt-3 font-mono text-[10.5px] leading-snug text-faint">
            Queue ranks by <span className="text-subtle">gap × risk_weight</span> (ADR-0005 fragile-bonus 2).
          </p>
        </Panel>

        <Panel className="rounded-[1.25rem] border-hairline bg-surface px-4 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.75)]">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">Declaration</div>
          <div className="mt-1 font-mono text-[12px] leading-snug text-text">
            v{declaration.declaration_version} · {declaration.date} · {declaration.adr_ref}
          </div>
          <div className="mt-1 font-mono text-[11px] text-subtle">{declaration.decision_ref}</div>
        </Panel>
      </div>
    </div>
  );
}
