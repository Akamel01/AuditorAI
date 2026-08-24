import type { ReactNode } from "react";

export interface RailStation {
  label: string;
  code?: string;
}

/*
 * The alignment rail — the product's signature structural device.
 * The audit process is a road alignment: two edge lines, a dashed
 * centreline, and stations at chainage points. Order carries information;
 * the rail never decorates a list that isn't a sequence.
 */
export function AlignmentRail({
  stations,
  current,
  className = "",
}: {
  stations: RailStation[];
  /** index of the station currently in progress */
  current: number;
  className?: string;
}) {
  const pct = (i: number) => ((i + 0.5) / stations.length) * 100;
  const doneTo = current >= 0 ? pct(Math.min(current, stations.length - 1)) : 0;

  return (
    <div className={className}>
      <div className="relative h-[34px]" aria-hidden="true">
        {/* carriageway edges */}
        <div className="absolute inset-x-0 top-[13px] h-px bg-hairline" />
        <div className="absolute inset-x-0 top-[23px] h-px bg-hairline" />
        {/* centreline: solid up to current, dotted ahead */}
        <div
          className="absolute left-0 top-[18px] h-[1.5px] -translate-y-1/2 bg-subtle transition-[width] duration-700 ease-[cubic-bezier(.2,0,0,1)]"
          style={{
            width: `${doneTo}%`,
            backgroundImage: "repeating-linear-gradient(90deg, var(--text-3) 0 7px, transparent 7px 13px)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute top-[18px] h-[1.5px] -translate-y-1/2 opacity-40"
          style={{
            left: `${doneTo}%`,
            right: 0,
            backgroundImage: "repeating-linear-gradient(90deg, var(--text-3) 0 2px, transparent 2px 9px)",
          }}
        />
        {/* stations */}
        {stations.map((s, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <span
              key={s.label}
              className={`absolute top-[18px] h-[12px] w-[12px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors duration-300 ${
                done
                  ? "border-text bg-text"
                  : now
                    ? "border-accent bg-canvas shadow-[0_0_0_3px_var(--accent-tint)]"
                    : "border-edge bg-canvas"
              }`}
              style={{ left: `${pct(i)}%` }}
            />
          );
        })}
      </div>
      <div className="flex">
        {stations.map((s, i) => (
          <div key={s.label} className="min-w-0 flex-1 px-1 text-center first:pl-0 last:pr-0">
            {s.code && (
              <span className="block font-mono text-[9.5px] uppercase leading-[1.7] tracking-[0.12em] text-faint">
                {s.code}
              </span>
            )}
            <span
              className={`block text-[12px] font-medium leading-snug ${
                i <= current ? "text-text" : "text-faint"
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RailCaption({ children }: { children: ReactNode }) {
  return <p className="mt-4 max-w-[72ch] text-[12.5px] leading-relaxed text-subtle">{children}</p>;
}
