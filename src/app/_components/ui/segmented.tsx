"use client";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Compact decision control — reviewer status, view toggles. */
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
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex overflow-hidden rounded-md border border-edge bg-surface"
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`cursor-pointer border-hairline font-medium leading-none transition-colors duration-150 ease-[cubic-bezier(.2,0,0,1)] ${
              size === "sm" ? "px-2.5 py-[7px] text-[12px]" : "px-3 py-2 text-[13px]"
            } ${i < options.length - 1 ? "border-r" : ""} ${
              on ? "bg-text text-[color:var(--canvas)]" : "bg-transparent text-muted hover:bg-sunken hover:text-text"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
