import { AlertTriangle, Check, Road } from "./icons";

/** Inline, in-place feedback — replaces browser alert() in flows. */
export function InlineNotice({
  tone = "error",
  children,
}: {
  tone?: "error" | "ok" | "info";
  children: React.ReactNode;
}) {
  const style =
    tone === "error"
      ? "border-concern-line bg-concern-tint text-concern"
      : tone === "ok"
        ? "border-ok-line bg-ok-tint text-ok"
        : "border-edge bg-sunken text-muted";
  return (
    <p className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[12.5px] leading-relaxed ${style}`} role={tone === "error" ? "alert" : undefined}>
      {tone === "error" ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : tone === "ok" ? <Check size={14} className="mt-0.5 shrink-0" /> : <Road size={14} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}
