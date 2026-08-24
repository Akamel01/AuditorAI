"use client";

import { useId } from "react";
import { Clause } from "./icons";

/*
 * Evidence reference — the product's soul rendered as interaction:
 * a mono citation chip that reveals the quoted clause on intent
 * (hover or keyboard focus), never hiding provenance.
 */

export interface EvidenceItem {
  evidence_id: string;
  quote: string | null;
  use: string;
}

export function EvidenceRef({ evidence }: { evidence: EvidenceItem }) {
  const id = useId();
  return (
    <span className="group/ev relative inline-block">
      <button
        type="button"
        aria-describedby={evidence.quote ? id : undefined}
        className="inline-flex cursor-pointer items-baseline gap-1.5 border-b border-dotted border-accent/60 pb-px font-mono text-[12px] leading-relaxed text-accent transition-colors duration-150 hover:border-accent hover:text-accent-strong focus-visible:border-accent"
      >
        {evidence.evidence_id}
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
          {evidence.use.replace(/_/g, " ")}
        </span>
      </button>
      {evidence.quote && (
        <span
          role="tooltip"
          id={id}
          className="pointer-events-none invisible absolute bottom-[calc(100%+9px)] left-0 z-30 w-[300px] translate-y-1 rounded-md border border-edge bg-surface p-3.5 opacity-0 shadow-[var(--pop-shadow)] transition-[opacity,translate] duration-150 ease-[cubic-bezier(.2,0,0,1)] group-hover/ev:visible group-hover/ev:translate-y-0 group-hover/ev:opacity-100 group-focus-within/ev:visible group-focus-within/ev:translate-y-0 group-focus-within/ev:opacity-100"
        >
          <span className="formal block text-[12.5px] leading-[1.6] text-muted">
            {evidence.quote}
          </span>
          <span className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
            <Clause size={11} />
            {evidence.evidence_id} · registry provenance
          </span>
          <span className="absolute left-5 top-full h-2 w-2 translate-y-[-4px] rotate-45 border-r border-b border-edge bg-surface" />
        </span>
      )}
    </span>
  );
}
