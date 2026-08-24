import type { ReactNode } from "react";

/*
 * Chips encode state semantically, never decoratively.
 * Confidence is rendered as fill treatment: solid → half → dashed outline.
 */

export function KindChip({ kind }: { kind: "safety_concern" | "compliance_question" }) {
  const concern = kind === "safety_concern";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-medium leading-[1.6] ${
        concern
        ? "border-concern-line bg-concern-tint text-concern"
        : "border-accent-line bg-accent-tint text-accent"
      }`}
    >
      <span className={`h-[6px] w-[6px] rounded-full ${concern ? "bg-concern" : "bg-accent"}`} />
      {concern ? "Safety concern" : "Compliance question"}
    </span>
  );
}

const STATE_STYLES: Record<string, string> = {
  provided: "border-ok-line bg-ok-tint text-ok",
  conflicting: "border-concern-line bg-concern-tint text-concern",
  unknown: "border-edge bg-surface text-subtle",
  not_applicable: "border-dashed border-edge bg-transparent text-faint",
  not_available: "border-dashed border-edge bg-transparent text-faint",
};

export function StateChip({ state, label }: { state: string; label: string }) {
  const style =
    STATE_STYLES[state] ?? (state.includes("missing") ? "border-warn-line bg-warn-tint text-warn" : STATE_STYLES.unknown);
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-[3px] font-mono text-[10px] uppercase leading-none tracking-[0.08em] ${style}`}>
      {label}
    </span>
  );
}

function swatchFor(confidence: string): string {
  const c = confidence.toLowerCase();
  if (c === "high" || c === "authoritative") return "bg-subtle";
  if (c === "medium" || c === "interpreted")
    return "border border-subtle bg-[linear-gradient(90deg,var(--text-3)_50%,transparent_50%)]";
  return "border border-dashed border-subtle";
}

export function ConfidenceMark({ confidence }: { confidence: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase leading-none tracking-[0.08em] text-subtle"
      title={`Confidence: ${confidence}`}
    >
      <span className={`inline-block h-[10px] w-[14px] rounded-[2px] ${swatchFor(confidence)}`} />
      Confidence · {confidence}
    </span>
  );
}

export function RevisionSeal({ revision, latest = false }: { revision: number; latest?: boolean }) {
  return (
    <span
      className={`inline-grid h-[22px] min-w-[34px] place-items-center rounded-full border px-2 font-mono text-[11px] leading-none ${
        latest ? "border-text bg-text text-[color:var(--canvas)]" : "border-edge bg-surface text-muted"
      }`}
    >
      I{revision}
    </span>
  );
}

export function Eyebrow({ code, children }: { code?: string; children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase leading-none tracking-[0.14em] text-faint">
      {code && <span className="whitespace-nowrap">{code}</span>}
      {code && <span className="text-hairline">·</span>}
      <span className="whitespace-nowrap text-subtle">{children}</span>
      <span className="h-px min-w-6 flex-1 bg-hairline" />
    </div>
  );
}
