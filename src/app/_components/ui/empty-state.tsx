import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-edge bg-surface px-6 py-12 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="text-[14px] font-medium text-text">{title}</p>
      {hint && <p className="mt-1.5 max-w-[44ch] text-[12.5px] leading-relaxed text-subtle">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-md border border-hairline bg-surface p-4">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="mt-2.5 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
