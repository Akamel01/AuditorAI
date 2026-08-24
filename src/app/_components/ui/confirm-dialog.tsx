"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Seal } from "./icons";

/*
 * Confirmation for irreversible acts (issuing a report).
 * Replaces window.confirm with a designed moment of ceremony.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Tab") {
        e.preventDefault();
        const next = document.activeElement === confirmRef.current ? cancelRef.current : confirmRef.current;
        next?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="anim-settle w-full max-w-[440px] rounded-lg border border-edge bg-surface p-5 shadow-[var(--pop-shadow)]"
      >
        <div className="flex items-start gap-3">
          <Seal size={20} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-snug">{title}</h2>
            <div className="mt-2 text-[13px] leading-relaxed text-muted">{body}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="h-8 cursor-pointer rounded-md border border-edge bg-surface px-3 text-[13px] font-medium text-muted transition-colors hover:border-faint hover:text-text"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md bg-accent px-3 text-[13px] font-medium text-[color:var(--accent-contrast)] transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {busy && <AlertTriangle size={13} className="anim-pulse" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
