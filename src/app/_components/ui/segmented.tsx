"use client";

import { useLayoutEffect, useRef, useState } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Crisp Chainage segmented — sliding pill from live position (Option A).
 *  Damping 1.0 · response 0.18s · no bounce · 180ms var(--ease-drawer)
 *  Interruptible: pill re-targets from presentation transform.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  ariaLabel,
}: {
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  useLayoutEffect(() => {
    const el = value ? btnRefs.current.get(value) : null;
    const container = containerRef.current;
    if (!el || !container) return;
    const cRect = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    // left relative to container padding (2px)
    const left = r.left - cRect.left;
    const width = r.width;
    setPill({ left, width, ready: true });
  }, [value, options]);

  // handle resize / font load
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => {
      const el = value ? btnRefs.current.get(value) : null;
      const container = containerRef.current;
      if (!el || !container) return;
      const cRect = container.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      setPill({ left: r.left - cRect.left, width: r.width, ready: true });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className="relative inline-flex rounded-md border border-edge bg-surface p-[2px]"
    >
      {/* sliding pill — critically damped, no overshoot */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[2px] bottom-[2px] rounded-[5px] bg-text shadow-sm"
        style={{
          left: pill.left,
          width: pill.width,
          opacity: pill.ready ? 1 : 0,
          transform: pill.ready ? "translateZ(0)" : undefined,
          transition: pill.ready ? "left 180ms cubic-bezier(0.32,0.72,0,1), width 180ms cubic-bezier(0.32,0.72,0,1), opacity 120ms ease" : undefined,
          willChange: "left, width",
        }}
      />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(n) => {
              if (n) btnRefs.current.set(o.value, n);
              else btnRefs.current.delete(o.value);
            }}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`relative z-[1] cursor-pointer rounded-[5px] font-medium leading-none transition-colors duration-150 ease-[cubic-bezier(.2,0,0,1)] ${
              size === "sm" ? "px-2.5 py-[7px] text-[12px]" : "px-3 py-2 text-[13px]"
            } ${on ? "text-[color:var(--canvas)]" : "text-muted hover:text-text"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
